/**
 * BidarCRM - AccountsPage Component
 *
 * Accounts and organizations directory page with Didar-inspired tab navigation,
 * customerGroups chips and filtering (GAP-05), Iranian legal fields (nationalId,
 * postalCode, shebaNumber), Persian CSV export, and quick creation modal dialog.
 */

import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Search,
  X,
  RefreshCw,
  Phone,
  Globe,
  Calendar,
  Users,
  Plus,
  Download,
  Tag,
  MessageSquare,
} from 'lucide-react';
import { apiClient } from '../lib/api-client';
import { downloadCsvBlob, safeExternalUrl } from '../lib/url';
import { queryKeys } from '../lib/query-keys';
import { Account, EspoListResponse } from '../types/espocrm';
import { toPersianDigits } from '../lib/currency';
import { formatJalaliDate } from '../lib/jalali';
import { formatIranPhone } from '../lib/iran-format';
import { AccountCreateModal } from '../features/contacts/components/AccountCreateModal';
import { SmsModal } from '../components/common/SmsModal';

const CUSTOMER_GROUPS = [
  { id: '', label: 'همه شرکت‌ها' },
  { id: 'VIP', label: 'ویژه (VIP)' },
  { id: 'Reseller', label: 'نمایندگان' },
  { id: 'Loyal', label: 'وفادار' },
  { id: 'Exhibition', label: 'نمایشگاهی' },
  { id: 'FirstPurchase', label: 'خرید اول' },
];

const GROUP_LABELS: Record<string, string> = {
  VIP: 'ویژه (VIP)',
  Reseller: 'نماینده',
  Loyal: 'وفادار',
  Exhibition: 'نمایشگاهی',
  FirstPurchase: 'خرید اول',
};

export const AccountsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [smsTarget, setSmsTarget] = useState<{ phone: string; name: string } | null>(null);

  const { data, isLoading, refetch } = useQuery<EspoListResponse<Account>>({
    queryKey: queryKeys.accounts.lists(),
    queryFn: () => apiClient.get<EspoListResponse<Account>>('/Account?maxSize=200'),
  });

  const accounts = (data?.list || []) as (Account & {
    customerGroups?: string[];
    nationalId?: string;
    shebaNumber?: string;
  })[];

  const filteredAccounts = useMemo(() => {
    let list = accounts;

    if (selectedGroup) {
      list = list.filter((acc) => acc.customerGroups?.includes(selectedGroup));
    }

    if (!searchQuery.trim()) return list;
    const q = searchQuery.trim().toLowerCase();
    return list.filter((acc) => {
      return (
        acc.name?.toLowerCase().includes(q) ||
        acc.phoneNumber?.toLowerCase().includes(q) ||
        acc.emailAddress?.toLowerCase().includes(q) ||
        acc.industry?.toLowerCase().includes(q) ||
        acc.nationalId?.includes(q)
      );
    });
  }, [accounts, searchQuery, selectedGroup]);

  const handleExportCsv = async () => {
    try {
      await downloadCsvBlob(
        '/BidarExport/Account',
        `accounts-${new Date().toISOString().slice(0, 10)}.csv`
      );
    } catch (err) {
      console.error('Failed to export accounts CSV:', err);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5 flex flex-col h-full" dir="rtl">
      {/* Header Controls - Didar Style */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                شرکت‌ها و سازمان‌ها
              </h1>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-md whitespace-nowrap inline-flex items-center shrink-0">
                {toPersianDigits(accounts.length)} شرکت
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              مدیریت حساب‌ها، مشخصات حقوقی و سازمان‌های همکار
            </p>
          </div>
        </div>

        {/* Tab Switcher & Actions */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-medium">
            <a
              href="/contacts"
              className="flex items-center gap-1.5 px-3 py-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg transition"
            >
              <Users className="w-3.5 h-3.5" />
              <span>اشخاص</span>
            </a>
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg shadow-sm cursor-pointer font-semibold"
            >
              <Building2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>شرکت‌ها</span>
            </button>
          </div>

          {/* Persian CSV Export */}
          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700/80 rounded-xl text-xs font-medium transition cursor-pointer"
            title="خروجی CSV شرکت‌ها"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden md:inline">خروجی CSV</span>
          </button>

          <button
            type="button"
            onClick={() => refetch()}
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl transition cursor-pointer"
            title="به‌روزرسانی"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>شرکت جدید</span>
          </button>
        </div>
      </div>

      {/* Customer Groups Filter Bar (GAP-05) */}
      <div className="flex flex-wrap min-h-fit overflow-visible items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-2xl shadow-sm">
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

      {/* Search Input */}
      <div className="relative max-w-md">
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="جستجو در نام شرکت، صنعت، تلفن، شناسه ملی..."
          className="w-full pr-9 pl-8 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 transition outline-none shadow-sm"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition p-0.5 cursor-pointer"
            title="پاک کردن"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Accounts Data Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm flex-1">
        <div className="overflow-x-auto">
          <table className="bidar-accounts-table w-full text-right border-collapse font-vazirmatn">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs font-semibold select-none">
                <th className="py-3 px-4 font-vazirmatn">نام شرکت</th>
                <th className="py-3 px-4 font-vazirmatn">صنعت / حوزه فعالیت</th>
                <th className="py-3 px-4 font-vazirmatn">گروه‌بندی</th>
                <th className="py-3 px-4 font-vazirmatn">شماره تماس</th>
                <th className="py-3 px-4 font-vazirmatn">شناسه ملی</th>
                <th className="py-3 px-4 font-vazirmatn">وب‌سایت</th>
                <th className="py-3 px-4 font-vazirmatn">تاریخ ثبت</th>
                <th className="py-3 px-4 text-center font-vazirmatn">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs text-slate-800 dark:text-slate-200">
              {filteredAccounts.map((acc) => {
                const jalaliDate = acc.createdAt ? formatJalaliDate(acc.createdAt) : '—';
                return (
                  <tr
                    key={acc.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
                          {acc.name?.charAt(0) || <Building2 className="w-4 h-4" />}
                        </div>
                        <span>{acc.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                      {acc.industry ? (
                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md text-[11px] whitespace-nowrap inline-flex items-center shrink-0">
                          {acc.industry}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    {/* Groups */}
                    <td className="py-3.5 px-4">
                      {acc.customerGroups && acc.customerGroups.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {acc.customerGroups.map((g) => (
                            <span
                              key={g}
                              className="px-2 py-0.5 rounded-md text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-medium whitespace-nowrap inline-flex items-center shrink-0"
                            >
                              {GROUP_LABELS[g] || g}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {acc.phoneNumber ? (
                        <a
                          href={`tel:${acc.phoneNumber}`}
                          className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 font-sans tabular-nums transition"
                          dir="ltr"
                        >
                          <Phone className="w-3.5 h-3.5 text-emerald-600/70 dark:text-emerald-500/70" />
                          <span>{formatIranPhone(acc.phoneNumber)}</span>
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    {/* Iranian National ID */}
                    <td className="py-3.5 px-4 font-sans tabular-nums text-[11px] text-slate-600 dark:text-slate-400">
                      {acc.nationalId ? toPersianDigits(acc.nationalId) : '—'}
                    </td>
                    <td className="py-3.5 px-4">
                      {(() => {
                        const safeHref = safeExternalUrl(acc.website);
                        if (safeHref) {
                          return (
                            <a
                              href={safeHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 hover:underline font-sans tabular-nums text-[11px]"
                              dir="ltr"
                            >
                              <Globe className="w-3.5 h-3.5" />
                              <span>{acc.website!.replace(/^https?:\/\//, '')}</span>
                            </a>
                          );
                        }
                        if (acc.website) {
                          return (
                            <span className="text-slate-500 dark:text-slate-400 text-[11px]" dir="ltr">
                              {acc.website}
                            </span>
                          );
                        }
                        return <span className="text-slate-400">—</span>;
                      })()}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-1.5 font-sans tabular-nums text-[11px]" dir="ltr">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                        <span>{jalaliDate}</span>
                      </div>
                    </td>
                    {/* Actions */}
                    <td className="py-3.5 px-4 text-center">
                      {acc.phoneNumber && (
                        <button
                          type="button"
                          onClick={() => {
                            setSmsTarget({
                              phone: acc.phoneNumber || '',
                              name: acc.name,
                            });
                          }}
                          className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition cursor-pointer"
                          title="ارسال پیامک مستقیم"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredAccounts.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 dark:text-slate-500 text-xs">
                    شرکتی یافت نشد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Summary */}
        <div className="p-3 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
          <span>
            تعداد کل شرکت‌ها:{' '}
            <strong className="text-slate-800 dark:text-slate-200 font-semibold">
              {toPersianDigits(filteredAccounts.length)}
            </strong>
          </span>
        </div>
      </div>

      {/* Account Create Modal */}
      <AccountCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={async () => {
          await queryClient.invalidateQueries({ queryKey: queryKeys.accounts.lists() });
          await refetch();
        }}
      />

      {/* SMS Modal */}
      {smsTarget && (
        <SmsModal
          isOpen={Boolean(smsTarget)}
          recipientPhone={smsTarget.phone}
          recipientName={smsTarget.name}
          accountName={smsTarget.name}
          onClose={() => setSmsTarget(null)}
        />
      )}
    </div>
  );
};

export default AccountsPage;
