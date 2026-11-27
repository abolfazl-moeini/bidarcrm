/**
 * BidarCRM - LeadsPage Component
 *
 * Dedicated sales prospects hub:
 * - Leads directory data table with status badges and channels
 * - Real-time search and status filtering (New, In Process, Converted, Dead)
 * - 1-Click Convert action (POST /Lead/action/convert) into Opportunity, Contact, and Account
 * - Quick Lead Creation dialog
 * - Direct SMS dispatch
 * - Persian CSV Export
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Target,
  Plus,
  RefreshCw,
  Search,
  X,
  Loader2,
  MessageSquare,
  Download,
  CheckCircle2,
  Building2,
  ArrowRightCircle,
  AlertCircle,
} from 'lucide-react';
import { apiClient } from '../lib/api-client';
import { downloadCsvBlob } from '../lib/url';
import { Lead, EspoListResponse } from '../types/espocrm';
import { toPersianDigits } from '../lib/currency';
import { formatIranPhone } from '../lib/iran-format';
import { formatJalaliDate } from '../lib/jalali';
import { LeadCreateModal } from '../features/leads/components/LeadCreateModal';
import { SmsModal } from '../components/common/SmsModal';

const STATUS_FILTERS = [
  { id: '', label: 'همه وضعیت‌ها' },
  { id: 'New', label: 'سرنخ جدید' },
  { id: 'In Process', label: 'در حال پیگیری' },
  { id: 'Converted', label: 'تبدیل‌شده' },
  { id: 'Dead', label: 'غیرفعال / ناموفق' },
];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  New: { label: 'جدید', color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20' },
  Assigned: { label: 'ارجاع‌شده', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
  'In Process': { label: 'در حال پیگیری', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  Converted: { label: 'تبدیل‌شده به معامله', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  Recycled: { label: 'بازیافت‌شده', color: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20' },
  Dead: { label: 'ناموفق / لغو', color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' },
};

const SOURCE_LABELS: Record<string, string> = {
  'Web Site': 'وب‌سایت',
  Call: 'تماس تلفنی',
  Email: 'ایمیل',
  'Existing Customer': 'مشتری فعلی',
  Partner: 'شریک تجاری',
  'Public Relations': 'روابط عمومی',
  Campaign: 'کمپین',
  Other: 'سایر',
};

export interface LeadsPageProps {
  onNavigate?: (path: string) => void;
  onSelectDeal?: (id: string) => void;
}

export const LeadsPage: React.FC<LeadsPageProps> = ({ onNavigate, onSelectDeal: _onSelectDeal }) => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [convertingLeadId, setConvertingLeadId] = useState<string | null>(null);
  const [convertSuccessMsg, setConvertSuccessMsg] = useState<string | null>(null);
  const [actionErrorMsg, setActionErrorMsg] = useState<string | null>(null);
  const successTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (successTimerRef.current !== null) {
        window.clearTimeout(successTimerRef.current);
      }
    };
  }, []);

  // SMS Modal State
  const [smsTarget, setSmsTarget] = useState<{ phone: string; name: string } | null>(null);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<EspoListResponse<Lead>>({
    queryKey: ['leads', 'list'],
    queryFn: () =>
      apiClient.get<EspoListResponse<Lead>>('/Lead?maxSize=200&orderBy=createdAt&order=desc'),
  });

  const leads = data?.list || [];

  const filteredLeads = useMemo(() => {
    let list = leads;

    if (selectedStatus) {
      list = list.filter((l) => l.status === selectedStatus);
    }

    if (!searchQuery.trim()) return list;
    const q = searchQuery.trim().toLowerCase();
    return list.filter((l) => {
      const name = l.name?.toLowerCase() || `${l.firstName || ''} ${l.lastName || ''}`.toLowerCase();
      const phone = l.phoneNumber?.toLowerCase() || '';
      const email = l.emailAddress?.toLowerCase() || '';
      const account = l.accountName?.toLowerCase() || '';
      return name.includes(q) || phone.includes(q) || email.includes(q) || account.includes(q);
    });
  }, [leads, searchQuery, selectedStatus]);

  // 1-Click Convert action into Deal + Contact + Account
  const handleConvertLead = async (lead: Lead) => {
    try {
      setConvertingLeadId(lead.id);
      setConvertSuccessMsg(null);
      setActionErrorMsg(null);

      // Call convert action
      const res = await apiClient.post<{ opportunityId?: string; opportunity?: { id: string } }>(
        '/Lead/action/convert',
        { id: lead.id }
      );

      setConvertSuccessMsg(`سرنخ «${lead.name}» با موفقیت به معامله و مشتری تبدیل شد.`);
      await queryClient.invalidateQueries({ queryKey: ['leads', 'list'] });
      await queryClient.invalidateQueries({ queryKey: ['deals'] });
      await queryClient.invalidateQueries({ queryKey: ['contacts'] });
      await queryClient.invalidateQueries({ queryKey: ['accounts'] });

      if (successTimerRef.current !== null) {
        window.clearTimeout(successTimerRef.current);
      }
      successTimerRef.current = window.setTimeout(() => setConvertSuccessMsg(null), 4000);

      // If a deal ID is returned, navigate to it
      if (res?.opportunityId || res?.opportunity?.id) {
        const oppId = res.opportunityId || res.opportunity?.id;
        if (oppId) {
          onNavigate?.(`/deals/${oppId}`);
        }
      }
    } catch (err) {
      setActionErrorMsg(
        err instanceof Error ? err.message : 'خطا در تبدیل سرنخ به مشتری و معامله.'
      );
    } finally {
      setConvertingLeadId(null);
    }
  };

  const handleExportCsv = async () => {
    try {
      setActionErrorMsg(null);
      await downloadCsvBlob(
        '/BidarExport/Lead',
        `leads-${new Date().toISOString().slice(0, 10)}.csv`
      );
    } catch (err) {
      setActionErrorMsg(
        err instanceof Error ? err.message : 'خطا در دریافت خروجی اکسل سرنخ‌ها.'
      );
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5 flex flex-col h-full" dir="rtl">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                سرنخ‌های فروش (Leads)
              </h1>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-md whitespace-nowrap inline-flex items-center shrink-0">
                {toPersianDigits(leads.length)} سرنخ
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              مشتریان بالقوه و تبدیل یک‌کلیکه به معامله، مخاطب و شرکت
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700/80 rounded-xl text-xs font-medium transition cursor-pointer"
            title="خروجی CSV سرنخ‌ها"
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
            <span>سرنخ جدید</span>
          </button>
        </div>
      </div>

      {/* Conversion Success Notification */}
      {convertSuccessMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{convertSuccessMsg}</span>
        </div>
      )}

      {/* Action / Export Error Banner */}
      {actionErrorMsg && (
        <div role="alert" className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-200 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{actionErrorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionErrorMsg(null)}
            className="text-rose-500 hover:text-rose-700 p-0.5"
            aria-label="بستن پیام خطا"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Query Error Banner */}
      {isError && (
        <div role="alert" className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-200 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{error instanceof Error ? error.message : 'خطا در دریافت فهرست سرنخ‌ها'}</span>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium"
          >
            تلاش مجدد
          </button>
        </div>
      )}

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setSelectedStatus(f.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                selectedStatus === f.id
                  ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative max-w-xs w-full">
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجو در سرنخ‌ها..."
            className="w-full pr-9 pl-8 py-1.5 bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm flex-1">
        <div className="overflow-x-auto">
          <table className="bidar-leads-table w-full text-right border-collapse font-vazirmatn">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs font-semibold select-none">
                <th className="py-3 px-4 font-vazirmatn">نام سرنخ</th>
                <th className="py-3 px-4 font-vazirmatn">شرکت / سازمان</th>
                <th className="py-3 px-4 font-vazirmatn">وضعیت</th>
                <th className="py-3 px-4 font-vazirmatn">منبع</th>
                <th className="py-3 px-4 font-vazirmatn">شماره تماس</th>
                <th className="py-3 px-4 font-vazirmatn">ایمیل</th>
                <th className="py-3 px-4 font-vazirmatn">تاریخ ثبت</th>
                <th className="py-3 px-4 text-center font-vazirmatn">تبدیل به معامله</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs text-slate-800 dark:text-slate-200">
              {filteredLeads.map((lead) => {
                const displayName =
                  lead.name || `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'سرنخ بدون نام';
                const statusMeta = STATUS_LABELS[lead.status || 'New'] || {
                  label: lead.status || 'جدید',
                  color: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
                };
                const jalaliDate = lead.createdAt ? formatJalaliDate(lead.createdAt) : '—';
                const isConverting = convertingLeadId === lead.id;

                return (
                  <tr key={lead.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold text-xs flex-shrink-0">
                          {displayName.charAt(0) || <Target className="w-4 h-4" />}
                        </div>
                        <span>{displayName}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                      {lead.accountName ? (
                        <div className="flex items-center gap-1.5 truncate">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>{lead.accountName}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-medium border whitespace-nowrap inline-flex items-center shrink-0 ${statusMeta.color}`}>
                        {statusMeta.label}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                      {lead.source ? (
                        <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px] whitespace-nowrap inline-flex items-center shrink-0">
                          {SOURCE_LABELS[lead.source] || lead.source}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      {lead.phoneNumber ? (
                        <div className="flex items-center gap-1.5" dir="ltr">
                          <a
                            href={`tel:${lead.phoneNumber}`}
                            className="text-slate-700 dark:text-slate-300 hover:text-emerald-600 font-sans tabular-nums transition"
                          >
                            {formatIranPhone(lead.phoneNumber)}
                          </a>
                          <button
                            type="button"
                            onClick={() =>
                              setSmsTarget({
                                phone: lead.phoneNumber || '',
                                name: displayName,
                              })
                            }
                            className="p-1 text-slate-400 hover:text-emerald-600"
                            title="ارسال پیامک"
                          >
                            <MessageSquare className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 font-sans tabular-nums text-[11px]">
                      {lead.emailAddress ? (
                        <a
                          href={`mailto:${lead.emailAddress}`}
                          className="text-slate-700 dark:text-slate-300 hover:text-emerald-600 transition"
                        >
                          {lead.emailAddress}
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 font-sans tabular-nums text-[11px] text-slate-500">
                      {jalaliDate}
                    </td>

                    {/* Convert Button */}
                    <td className="py-3.5 px-4 text-center">
                      {lead.status === 'Converted' ? (
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium whitespace-nowrap inline-flex items-center shrink-0">
                          تبدیل‌شده
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleConvertLead(lead)}
                          disabled={isConverting}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[11px] font-semibold transition cursor-pointer disabled:opacity-50"
                          title="تبدیل ۱-کلیکه به معامله، مخاطب و شرکت"
                        >
                          {isConverting ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <ArrowRightCircle className="w-3.5 h-3.5 rotate-180" />
                          )}
                          <span>تبدیل به معامله</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredLeads.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                    سرنخی با این مشخصات یافت نشد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 flex items-center justify-between">
          <span>
            تعداد کل سرنخ‌ها:{' '}
            <strong className="text-slate-800 dark:text-slate-200 font-semibold">
              {toPersianDigits(filteredLeads.length)}
            </strong>
          </span>
        </div>
      </div>

      {/* Lead Create Modal */}
      <LeadCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['leads', 'list'] });
        }}
      />

      {/* SMS Modal */}
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

export default LeadsPage;
