/**
 * BidarCRM - AccountsPage Component
 *
 * Accounts and organizations directory page.
 */

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, Search, X, RefreshCw, Phone, Mail, Globe, Calendar } from 'lucide-react';
import { apiClient } from '../lib/api-client';
import { queryKeys } from '../lib/query-keys';
import { Account, EspoListResponse } from '../types/espocrm';
import { toPersianDigits } from '../lib/currency';
import { formatJalaliDate } from '../lib/jalali';

export const AccountsPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isLoading, refetch } = useQuery<EspoListResponse<Account>>({
    queryKey: queryKeys.accounts.lists(),
    queryFn: () => apiClient.get<EspoListResponse<Account>>('/Account?maxSize=200'),
  });

  const accounts = data?.list || [];

  const filteredAccounts = useMemo(() => {
    if (!searchQuery.trim()) return accounts;
    const q = searchQuery.trim().toLowerCase();
    return accounts.filter((acc) => {
      return (
        acc.name?.toLowerCase().includes(q) ||
        acc.phoneNumber?.toLowerCase().includes(q) ||
        acc.emailAddress?.toLowerCase().includes(q) ||
        acc.industry?.toLowerCase().includes(q)
      );
    });
  }, [accounts, searchQuery]);

  return (
    <div className="space-y-6 flex flex-col h-full" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-100 tracking-tight">شرکت‌ها و سازمان‌ها</h1>
              <span className="text-xs font-medium text-slate-400 bg-slate-800 px-2.5 py-0.5 rounded-md">
                {toPersianDigits(accounts.length)} شرکت
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">مدیریت حساب‌ها و سازمان‌های همکار</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => refetch()}
          className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/70 border border-slate-800 rounded-xl transition cursor-pointer self-start sm:self-auto"
          title="به‌روزرسانی"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="جستجو در شرکت‌ها (نام، صنعت، تلفن)..."
          className="w-full pr-9 pl-8 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs text-slate-100 placeholder-slate-500 transition outline-none"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Accounts Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="bidar-accounts-table w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-900/90 border-b border-slate-800 text-slate-400 text-xs font-semibold select-none">
                <th className="py-3.5 px-4">نام شرکت</th>
                <th className="py-3.5 px-4">صنعت / حوزه فعالیت</th>
                <th className="py-3.5 px-4">تلفن</th>
                <th className="py-3.5 px-4">ایمیل</th>
                <th className="py-3.5 px-4">وبسایت</th>
                <th className="py-3.5 px-4">تاریخ ثبت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs text-slate-200">
              {filteredAccounts.map((account) => {
                const jalaliDate = account.createdAt ? formatJalaliDate(account.createdAt) : '—';
                return (
                  <tr key={account.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-100 flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                      <span>{account.name}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">{account.industry || '—'}</td>
                    <td className="py-3.5 px-4">
                      {account.phoneNumber ? (
                        <a
                          href={`tel:${account.phoneNumber}`}
                          className="text-slate-300 hover:text-emerald-400 font-mono inline-flex items-center gap-1"
                          dir="ltr"
                        >
                          <Phone className="w-3.5 h-3.5 text-emerald-500/70" />
                          <span>{account.phoneNumber}</span>
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {account.emailAddress ? (
                        <a
                          href={`mailto:${account.emailAddress}`}
                          className="text-slate-300 hover:text-indigo-400 font-mono inline-flex items-center gap-1"
                          dir="ltr"
                        >
                          <Mail className="w-3.5 h-3.5 text-indigo-400/70" />
                          <span>{account.emailAddress}</span>
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {account.website ? (
                        <a
                          href={account.website.startsWith('http') ? account.website : `https://${account.website}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-slate-300 hover:text-indigo-400 font-mono inline-flex items-center gap-1"
                          dir="ltr"
                        >
                          <Globe className="w-3.5 h-3.5 text-slate-500" />
                          <span>{account.website}</span>
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]" dir="ltr">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        <span>{jalaliDate}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredAccounts.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 text-xs">
                    شرکتی یافت نشد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AccountsPage;
