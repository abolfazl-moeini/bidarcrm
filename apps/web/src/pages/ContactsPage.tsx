/**
 * BidarCRM - ContactsPage Component
 *
 * Full contacts directory page with real-time search, count indicator,
 * table listing, and quick creation modal dialog.
 */

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, RefreshCw, AlertCircle } from 'lucide-react';
import { apiClient } from '../lib/api-client';
import { queryKeys } from '../lib/query-keys';
import { Contact, EspoListResponse } from '../types/espocrm';
import { toPersianDigits } from '../lib/currency';
import { ContactsTable } from '../features/contacts/components/ContactsTable';
import { ContactQuickCreateModal } from '../features/contacts/components/ContactQuickCreateModal';

export const ContactsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

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

  const handleCreateSuccess = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.contacts.lists() });
  };

  return (
    <div className="space-y-6 flex flex-col h-full" dir="rtl">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-100 tracking-tight">مخاطبان و مشتریان</h1>
              <span className="text-xs font-medium text-slate-400 bg-slate-800 px-2.5 py-0.5 rounded-md">
                {toPersianDigits(contacts.length)} مخاطب
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              مدیریت و مشاهده اشخاص و ارتباطات مشتریان
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => refetch()}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/70 border border-slate-800 rounded-xl transition cursor-pointer"
            title="به‌روزرسانی لیست"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-medium rounded-xl shadow-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>مخاطب جدید</span>
          </button>
        </div>
      </div>

      {/* Error Notice */}
      {isError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{error instanceof Error ? error.message : 'خطا در بارگذاری لیست مخاطبان'}</span>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="text-rose-400 hover:text-rose-200 font-semibold text-xs"
          >
            تلاش مجدد
          </button>
        </div>
      )}

      {/* Contacts Table with Search */}
      <div className="flex-1 min-h-0">
        <ContactsTable
          contacts={contacts}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isLoading={isLoading}
        />
      </div>

      {/* Quick Create Contact Modal */}
      <ContactQuickCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
};

export default ContactsPage;
