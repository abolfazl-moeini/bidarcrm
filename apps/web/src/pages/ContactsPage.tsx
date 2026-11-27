/**
 * BidarCRM - ContactsPage Component
 *
 * Full contacts directory page with Didar-inspired tab navigation (اشخاص / شرکت‌ها),
 * customer groups filter chips (GAP-05), Persian CSV export, direct SMS dispatch,
 * and quick contact/account creation dialogs.
 */

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Plus,
  RefreshCw,
  AlertCircle,
  Building2,
  Download,
  Tag,
} from 'lucide-react';
import { apiClient } from '../lib/api-client';
import { downloadCsvBlob } from '../lib/url';
import { queryKeys } from '../lib/query-keys';
import { Contact, EspoListResponse } from '../types/espocrm';
import { toPersianDigits } from '../lib/currency';
import { ContactsTable } from '../features/contacts/components/ContactsTable';
import { ContactQuickCreateModal } from '../features/contacts/components/ContactQuickCreateModal';
import { AccountCreateModal } from '../features/contacts/components/AccountCreateModal';
import { SmsModal } from '../components/common/SmsModal';

const CUSTOMER_GROUPS = [
  { id: '', label: 'همه مخاطبان' },
  { id: 'VIP', label: 'ویژه (VIP)' },
  { id: 'Reseller', label: 'نمایندگان' },
  { id: 'Loyal', label: 'وفادار' },
  { id: 'Exhibition', label: 'نمایشگاهی' },
  { id: 'FirstPurchase', label: 'خرید اول' },
];

export const ContactsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);

  // SMS Modal State
  const [smsTarget, setSmsTarget] = useState<{ phone: string; name: string } | null>(null);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<EspoListResponse<Contact>>({
    queryKey: queryKeys.contacts.lists(),
    queryFn: () => apiClient.get<EspoListResponse<Contact>>('/Contact?maxSize=200'),
  });

  const contacts = data?.list || [];

  const handleCreateSuccess = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.contacts.lists() });
    await refetch();
  };

  const handleExportCsv = async () => {
    try {
      await downloadCsvBlob(
        '/BidarExport/Contact',
        `contacts-${new Date().toISOString().slice(0, 10)}.csv`
      );
    } catch (err) {
      console.error('Failed to export contacts CSV:', err);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5 flex flex-col h-full" dir="rtl">
      {/* Header Controls - Didar Style */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                اشخاص و مخاطبان
              </h1>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-md whitespace-nowrap inline-flex items-center shrink-0">
                {toPersianDigits(contacts.length)} مخاطب
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              مدیریت و مشاهده اشخاص، اطلاعات هویتی و ارتباطات مشتریان
            </p>
          </div>
        </div>

        {/* Tab switchers + Export + Primary CTA */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* Segmented View Switcher between Contacts and Accounts */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-medium">
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg shadow-sm cursor-pointer font-semibold"
            >
              <Users className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>اشخاص</span>
            </button>
            <a
              href="/accounts"
              className="flex items-center gap-1.5 px-3 py-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg transition"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>شرکت‌ها</span>
            </a>
          </div>

          {/* Persian CSV Export */}
          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700/80 rounded-xl text-xs font-medium transition cursor-pointer"
            title="خروجی اکسل / CSV فارسی"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden md:inline">خروجی CSV</span>
          </button>

          <button
            type="button"
            onClick={() => refetch()}
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl transition cursor-pointer"
            title="به‌روزرسانی لیست"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setIsAccountModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition cursor-pointer"
          >
            <Building2 className="w-4 h-4" />
            <span>شرکت جدید</span>
          </button>

          <button
            type="button"
            onClick={() => setIsContactModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>مخاطب جدید</span>
          </button>
        </div>
      </div>

      {/* Customer Groups Filter Bar (GAP-05) */}
      <div
        data-testid="customer-groups-filter"
        className="flex flex-wrap items-center gap-1.5 min-h-fit overflow-visible bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 p-2.5 rounded-2xl shadow-sm"
        style={{ minHeight: 'fit-content', overflow: 'visible' }}
      >
        <Tag className="w-4 h-4 text-slate-400 mr-1 flex-shrink-0" />
        <span className="text-[11px] font-semibold text-slate-500 ml-2 whitespace-nowrap">
          فیلتر گروه:
        </span>
        {CUSTOMER_GROUPS.map((grp) => (
          <button
            key={grp.id}
            type="button"
            onClick={() => setSelectedGroup(grp.id)}
            className={`px-3 py-1 rounded-xl text-xs font-medium transition cursor-pointer whitespace-nowrap ${
              selectedGroup === grp.id
                ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            {grp.label}
          </button>
        ))}
      </div>

      {/* Error Alert */}
      {isError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
          <span>{error instanceof Error ? error.message : 'خطا در بارگذاری لیست مخاطبان'}</span>
        </div>
      )}

      {/* Contacts Table with Real-time Search and SMS action */}
      <div className="flex-1">
        <ContactsTable
          contacts={contacts}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedGroup={selectedGroup}
          isLoading={isLoading}
          onSendSms={(contact) => {
            if (contact.phoneNumber) {
              setSmsTarget({
                phone: contact.phoneNumber,
                name: contact.name || `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
              });
            }
          }}
        />
      </div>

      {/* Quick Create Contact Modal */}
      <ContactQuickCreateModal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />

      {/* Quick Create Account Modal */}
      <AccountCreateModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: queryKeys.accounts.lists() });
        }}
      />

      {/* Global SMS Modal */}
      {smsTarget && (
        <SmsModal
          isOpen={Boolean(smsTarget)}
          recipientPhone={smsTarget.phone}
          recipientName={smsTarget.name}
          onClose={() => setSmsTarget(null)}
        />
      )}
    </div>
  );
};

export default ContactsPage;
