/**
 * BidarCRM - DealCreateModal Component
 *
 * Quick deal creation dialog allowing sales reps to initiate opportunities:
 * - Didar-inspired 2-stage visual flow & responsive layout
 * - Deal Name, Amount in Toman (supports Persian digits and comma formatting)
 * - Pipeline & PipelineStage selection with interactive chevron stepper
 * - Searchable Contact & Account selector dropdowns
 * - Jalali datepicker / formatted Jalali date input with quick suggestions
 * - Quick selection of products/quantities auto-updating total amount
 * - Dark & Light mode adaptive tokens
 * - TanStack cache invalidation for Kanban and Dashboard
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Briefcase,
  Layers,
  Loader2,
  AlertCircle,
  User,
  Building2,
  Package,
  Plus,
  Minus,
  Check,
} from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { queryKeys } from '../../../lib/query-keys';
import {
  Opportunity,
  Pipeline,
  PipelineStage,
  Contact,
  Account,
  BidarProduct,
  EspoListResponse,
} from '../../../types/espocrm';
import { tomanToWords } from '../../../lib/number-to-words';
import {
  getJalaliParts,
  jalaliToGregorian,
  PERSIAN_MONTH_NAMES,
  getJalaliMonthLength,
} from '../../../lib/jalali';
import { toPersianDigits, formatCurrency } from '../../../lib/iran-format';
import { DEFAULT_PIPELINE_STAGES } from '../hooks/useKanbanDeals';

export interface DealCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (createdDeal: Opportunity) => void;
  defaultPipelineId?: string;
  defaultStageId?: string;
  stages?: PipelineStage[];
}

export function parseTomanAmount(raw: string): number {
  if (!raw) return 0;
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  let normalized = raw;
  for (let i = 0; i < 10; i++) {
    normalized = normalized.replaceAll(persianDigits[i]!, String(i));
  }
  normalized = normalized.replace(/[^0-9.]/g, '');
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? 0 : parsed;
}

interface SelectedProductItem {
  product: BidarProduct;
  quantity: number;
}

export const DealCreateModal: React.FC<DealCreateModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultPipelineId = '',
  defaultStageId = '',
  stages: propStages,
}) => {
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [pipelineId, setPipelineId] = useState(defaultPipelineId);
  const [stageId, setStageId] = useState(defaultStageId);
  const [closeDate, setCloseDate] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Contact and Account selection
  const [contactId, setContactId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [contactSearch, setContactSearch] = useState('');
  const [accountSearch, setAccountSearch] = useState('');
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);

  // Jalali Date Picker State
  const currentJalali = useMemo(() => getJalaliParts(), []);
  const [jYear, setJYear] = useState<number>(currentJalali.year);
  const [jMonth, setJMonth] = useState<number>(currentJalali.month);
  const [jDay, setJDay] = useState<number>(currentJalali.day);

  // Products selection
  const [showProductsPanel, setShowProductsPanel] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<SelectedProductItem[]>([]);

  // 1. Fetch Pipelines
  const pipelineQuery = useQuery<EspoListResponse<Pipeline>>({
    queryKey: queryKeys.pipelines.all,
    queryFn: () => apiClient.get<EspoListResponse<Pipeline>>('/Pipeline'),
    enabled: isOpen,
    staleTime: 1000 * 60 * 5,
  });

  // 2. Fetch Contacts
  const contactsQuery = useQuery<EspoListResponse<Contact>>({
    queryKey: queryKeys.contacts.lists(),
    queryFn: () => apiClient.get<EspoListResponse<Contact>>('/Contact?maxSize=100'),
    enabled: isOpen,
    staleTime: 1000 * 60 * 3,
  });

  // 3. Fetch Accounts
  const accountsQuery = useQuery<EspoListResponse<Account>>({
    queryKey: queryKeys.accounts.lists(),
    queryFn: () => apiClient.get<EspoListResponse<Account>>('/Account?maxSize=100'),
    enabled: isOpen,
    staleTime: 1000 * 60 * 3,
  });

  // 4. Fetch Products
  const productsQuery = useQuery<EspoListResponse<BidarProduct>>({
    queryKey: ['products', 'list'],
    queryFn: async () => {
      try {
        return await apiClient.get<EspoListResponse<BidarProduct>>('/BidarProduct?maxSize=100');
      } catch {
        return { list: [], total: 0 };
      }
    },
    enabled: isOpen,
    staleTime: 1000 * 60 * 5,
  });

  const pipelines = pipelineQuery.data?.list || [];
  const activePipeline = pipelines.find((p) => p.id === pipelineId) || pipelines[0];

  // Stages fallback query
  const stagesQuery = useQuery<EspoListResponse<PipelineStage>>({
    queryKey: ['pipelineStages', pipelineId || activePipeline?.id || 'default'],
    queryFn: async () => {
      try {
        const pId = pipelineId || activePipeline?.id;
        const endpoint =
          pId && pId !== 'default'
            ? `/PipelineStage?maxSize=100&orderBy=order&where[0][type]=equals&where[0][attribute]=pipelineId&where[0][value]=${encodeURIComponent(pId)}`
            : '/PipelineStage?maxSize=100&orderBy=order';
        return await apiClient.get<EspoListResponse<PipelineStage>>(endpoint);
      } catch {
        return { list: [], total: 0 };
      }
    },
    enabled: isOpen && (!propStages || propStages.length === 0),
    staleTime: 1000 * 60 * 5,
  });

  const stages: PipelineStage[] = useMemo(() => {
    if (propStages && propStages.length > 0) {
      return propStages;
    }
    if (activePipeline?.stages && activePipeline.stages.length > 0) {
      return activePipeline.stages;
    }
    if (stagesQuery.data?.list && stagesQuery.data.list.length > 0) {
      return stagesQuery.data.list;
    }
    return DEFAULT_PIPELINE_STAGES;
  }, [propStages, activePipeline, stagesQuery.data]);

  // Set default stage when stages load or change
  useEffect(() => {
    if (stages.length > 0 && !stageId) {
      setStageId(stages[0]!.id);
    }
  }, [stages, stageId]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setName('');
      setAmount('');
      setCloseDate('');
      setDescription('');
      setContactId('');
      setAccountId('');
      setContactSearch('');
      setAccountSearch('');
      setShowContactDropdown(false);
      setShowAccountDropdown(false);
      setSelectedProducts([]);
      setShowProductsPanel(false);
      setError(null);
      if (defaultPipelineId) setPipelineId(defaultPipelineId);
      if (defaultStageId) setStageId(defaultStageId);

      const nowJ = getJalaliParts();
      setJYear(nowJ.year);
      setJMonth(nowJ.month);
      setJDay(nowJ.day);
      const [gy, gm, gd] = jalaliToGregorian(nowJ.year, nowJ.month, nowJ.day);
      const pad = (n: number) => String(n).padStart(2, '0');
      setCloseDate(`${gy}-${pad(gm)}-${pad(gd)}`);
    }
  }, [isOpen, defaultPipelineId, defaultStageId]);

  // Filtered contacts
  const allContacts = contactsQuery.data?.list || [];
  const filteredContacts = useMemo(() => {
    if (!contactSearch.trim()) return allContacts.slice(0, 15);
    const q = contactSearch.toLowerCase();
    return allContacts
      .filter(
        (c) =>
          c.name?.toLowerCase().includes(q) ||
          c.phoneNumber?.includes(q) ||
          c.emailAddress?.toLowerCase().includes(q)
      )
      .slice(0, 15);
  }, [allContacts, contactSearch]);

  // Filtered accounts
  const allAccounts = accountsQuery.data?.list || [];
  const filteredAccounts = useMemo(() => {
    if (!accountSearch.trim()) return allAccounts.slice(0, 15);
    const q = accountSearch.toLowerCase();
    return allAccounts.filter((a) => a.name?.toLowerCase().includes(q)).slice(0, 15);
  }, [allAccounts, accountSearch]);

  // Selected contact and account objects
  const selectedContact = allContacts.find((c) => c.id === contactId);
  const selectedAccount = allAccounts.find((a) => a.id === accountId);

  // Handle contact selection
  const handleSelectContact = (c: Contact) => {
    setContactId(c.id);
    setContactSearch(c.name);
    setShowContactDropdown(false);
    if (c.accountId && !accountId) {
      setAccountId(c.accountId);
      const acc = allAccounts.find((a) => a.id === c.accountId);
      if (acc) setAccountSearch(acc.name);
    }
  };

  // Handle account selection
  const handleSelectAccount = (a: Account) => {
    setAccountId(a.id);
    setAccountSearch(a.name);
    setShowAccountDropdown(false);
  };

  // Sync Jalali date picker change to Gregorian closeDate
  const handleJalaliDateChange = (y: number, m: number, d: number) => {
    setJYear(y);
    setJMonth(m);
    setJDay(d);
    const [gy, gm, gd] = jalaliToGregorian(y, m, d);
    const pad = (n: number) => String(n).padStart(2, '0');
    setCloseDate(`${gy}-${pad(gm)}-${pad(gd)}`);
  };

  // Quick close date helper
  const handleQuickDate = (daysFromNow: number) => {
    const target = new Date();
    target.setDate(target.getDate() + daysFromNow);
    const j = getJalaliParts(target);
    handleJalaliDateChange(j.year, j.month, j.day);
  };

  // Products calculation and handlers
  const allProducts = productsQuery.data?.list || [];

  const handleToggleProduct = (product: BidarProduct) => {
    setSelectedProducts((prev) => {
      const exists = prev.find((item) => item.product.id === product.id);
      let updated: SelectedProductItem[];
      if (exists) {
        updated = prev.filter((item) => item.product.id !== product.id);
      } else {
        updated = [...prev, { product, quantity: 1 }];
      }

      // Auto update total amount
      const newTotal = updated.reduce(
        (sum, item) => sum + (item.product.unitPrice || 0) * item.quantity,
        0
      );
      if (newTotal > 0) {
        setAmount(String(newTotal));
      }
      return updated;
    });
  };

  const handleUpdateProductQty = (productId: string, delta: number) => {
    setSelectedProducts((prev) => {
      const updated = prev
        .map((item) => {
          if (item.product.id === productId) {
            const nextQty = Math.max(1, item.quantity + delta);
            return { ...item, quantity: nextQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0);

      const newTotal = updated.reduce(
        (sum, item) => sum + (item.product.unitPrice || 0) * item.quantity,
        0
      );
      if (newTotal > 0) {
        setAmount(String(newTotal));
      }
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent, asWon: boolean = false) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('نام معامله الزامی است.');
      return;
    }

    const numericAmount = parseTomanAmount(amount);
    const selectedStage =
      stages.find((s) => s.id === stageId) ||
      (stageId ? { id: stageId, mappedStatus: 'Prospecting', name: 'مرحله', order: 1 } : stages[0]);
    const finalStageId = stageId || selectedStage?.id;
    const finalPipelineId = activePipeline?.id || defaultPipelineId || undefined;
    const finalStageMapped = asWon ? 'Closed Won' : (selectedStage?.mappedStatus || 'Prospecting');

    let finalCloseDate = closeDate;
    if (!finalCloseDate) {
      const [gy, gm, gd] = jalaliToGregorian(jYear, jMonth, jDay);
      const pad = (n: number) => String(n).padStart(2, '0');
      finalCloseDate = `${gy}-${pad(gm)}-${pad(gd)}`;
    }

    setIsSubmitting(true);
    try {
      // 1. Stage submission according to WEB-01 / BUG-05:
      // Send pipelineId, pipelineStageId, and stage: asWon ? 'Closed Won' : (selectedStage?.mappedStatus || 'Prospecting')
      const payload: Partial<Opportunity> = {
        name: trimmedName,
        amount: numericAmount,
        stage: finalStageMapped,
        probability: asWon ? 100 : undefined,
        pipelineId: finalPipelineId,
        pipelineStageId: asWon ? undefined : finalStageId,
        closeDate: finalCloseDate,
        description: description.trim() || undefined,
        contactId: contactId || undefined,
        contactName: selectedContact?.name || undefined,
        accountId: accountId || undefined,
        accountName: selectedAccount?.name || undefined,
      };

      const created = await apiClient.post<Opportunity>('/Opportunity', payload);

      // 2. If products were selected, create Deal Items
      if (created?.id && selectedProducts.length > 0) {
        for (const item of selectedProducts) {
          try {
            await apiClient.post('/BidarDealItem', {
              opportunityId: created.id,
              opportunityName: created.name,
              productId: item.product.id,
              productName: item.product.name,
              name: item.product.name,
              quantity: item.quantity,
              unitPrice: item.product.unitPrice || 0,
              lineTotal: (item.product.unitPrice || 0) * item.quantity,
            });
          } catch {
            // Silently continue for items
          }
        }
      }

      // Invalidate queries so Kanban and Dashboard update immediately
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });

      if (onSuccess) {
        await onSuccess(created);
      }
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطا در ثبت معامله جدید';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const amountInWords = useMemo(() => {
    const num = parseTomanAmount(amount);
    return num > 0 ? tomanToWords(num) : '';
  }, [amount]);

  const daysInJMonth = getJalaliMonthLength(jYear, jMonth);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      data-testid="deal-create-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="deal-create-modal-title"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto"
      dir="rtl"
    >
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-5 sm:p-6 space-y-4 my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Briefcase className="w-4 h-4" />
            </div>
            <div>
              <h3
                id="deal-create-modal-title"
                className="text-sm font-bold text-slate-900 dark:text-slate-100"
              >
                ثبت معامله جدید
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                تعریف فرصت فروش در کاریز با اطلاعات مالی و مشتری
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
            title="بستن"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2 flex-shrink-0">
            <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Body - Scrollable */}
        <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4 overflow-y-auto pr-1 flex-1">
          {/* Deal Name */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              نام معامله <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: قرارداد پشتیبانی نرم‌افزار شرکت دماوند"
              data-testid="deal-name-input"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none transition"
              autoFocus
            />
          </div>

          {/* Deal Amount in Toman */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              مبلغ معامله (تومان)
            </label>
            <div className="relative">
              <input
                type="text"
                name="amount"
                dir="ltr"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="مثال: ۲۵,۰۰۰,۰۰۰"
                data-testid="deal-amount-input"
                className="w-full pl-3 pr-14 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none transition font-mono"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 dark:text-slate-500 pointer-events-none">
                تومان
              </span>
            </div>
            {amountInWords && (
              <p
                data-testid="toman-words-preview"
                className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium"
                dir="rtl"
              >
                معادل: {amountInWords}
              </p>
            )}
          </div>

          {/* Contact & Account Selectors (Searchable) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Contact Dropdown */}
            <div className="relative">
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                مخاطب مرتبط
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={contactSearch}
                  onFocus={() => setShowContactDropdown(true)}
                  onChange={(e) => {
                    setContactSearch(e.target.value);
                    setShowContactDropdown(true);
                    if (!e.target.value) setContactId('');
                  }}
                  placeholder="جستجوی شخص مخاطب..."
                  data-testid="deal-contact-selector"
                  className="w-full pr-8 pl-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none transition"
                />
                <User className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                {contactId && (
                  <button
                    type="button"
                    onClick={() => {
                      setContactId('');
                      setContactSearch('');
                    }}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {showContactDropdown && (
                <div className="absolute z-20 mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                  {filteredContacts.length === 0 ? (
                    <div className="p-2 text-[11px] text-slate-400 text-center">مخاطبی یافت نشد</div>
                  ) : (
                    filteredContacts.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSelectContact(c)}
                        className={`w-full text-right px-3 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between ${
                          contactId === c.id
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 font-semibold'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <span>{c.name}</span>
                        {c.phoneNumber && (
                          <span className="text-[10px] text-slate-400 font-mono" dir="ltr">
                            {c.phoneNumber}
                          </span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Account Dropdown */}
            <div className="relative">
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                شرکت / سازمان
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={accountSearch}
                  onFocus={() => setShowAccountDropdown(true)}
                  onChange={(e) => {
                    setAccountSearch(e.target.value);
                    setShowAccountDropdown(true);
                    if (!e.target.value) setAccountId('');
                  }}
                  placeholder="جستجوی شرکت..."
                  data-testid="deal-account-selector"
                  className="w-full pr-8 pl-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none transition"
                />
                <Building2 className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                {accountId && (
                  <button
                    type="button"
                    onClick={() => {
                      setAccountId('');
                      setAccountSearch('');
                    }}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {showAccountDropdown && (
                <div className="absolute z-20 mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                  {filteredAccounts.length === 0 ? (
                    <div className="p-2 text-[11px] text-slate-400 text-center">شرکتی یافت نشد</div>
                  ) : (
                    filteredAccounts.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => handleSelectAccount(a)}
                        className={`w-full text-right px-3 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between ${
                          accountId === a.id
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 font-semibold'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <span>{a.name}</span>
                        {a.industry && (
                          <span className="text-[10px] text-slate-400">{a.industry}</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Pipeline & Stage Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Pipeline Selector */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                کاریز فروش
              </label>
              <div className="relative">
                <select
                  value={pipelineId || activePipeline?.id || ''}
                  onChange={(e) => {
                    setPipelineId(e.target.value);
                    const selected = pipelines.find((p) => p.id === e.target.value);
                    if (selected?.stages && selected.stages.length > 0) {
                      setStageId(selected.stages[0]!.id);
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-xs text-slate-900 dark:text-slate-100 outline-none transition"
                >
                  {pipelines.length === 0 ? (
                    <option value="">کاریز پیش‌فرض فروش</option>
                  ) : (
                    pipelines.map((pipe) => (
                      <option key={pipe.id} value={pipe.id}>
                        {pipe.name}
                      </option>
                    ))
                  )}
                </select>
                <Layers className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Stage Selector Dropdown */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                مرحله کاریز
              </label>
              <select
                value={stageId}
                onChange={(e) => setStageId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-xs text-slate-900 dark:text-slate-100 outline-none transition"
              >
                {stages.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name} {st.probability ? `(${toPersianDigits(st.probability)}٪)` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Interactive Stage Stepper Strip */}
          <div>
            <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1.5">
              جریان مرحله در کاریز (انتخاب مستقیم):
            </label>
            <div className="flex gap-1 overflow-x-auto pb-1" dir="rtl">
              {stages.map((st) => {
                const isSelected = st.id === stageId;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setStageId(st.id)}
                    className={`flex-1 min-w-[70px] py-1.5 px-2 text-[10px] font-medium rounded-lg border text-center transition cursor-pointer truncate ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
                    }`}
                  >
                    {st.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Expected Close Date with Jalali Datepicker */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                تاریخ احتمالی بسته شدن (تقویم شمسی)
              </label>
              {/* Quick suggestions */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleQuickDate(7)}
                  className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline px-1 py-0.5 cursor-pointer"
                >
                  ۱ هفته بعد
                </button>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <button
                  type="button"
                  onClick={() => handleQuickDate(30)}
                  className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline px-1 py-0.5 cursor-pointer"
                >
                  ۱ ماه بعد
                </button>
              </div>
            </div>

            {/* Jalali Date Selector Controls */}
            <div className="grid grid-cols-3 gap-2">
              {/* Day */}
              <select
                value={jDay}
                onChange={(e) => handleJalaliDateChange(jYear, jMonth, parseInt(e.target.value, 10))}
                className="px-2 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 outline-none"
              >
                {Array.from({ length: daysInJMonth }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {toPersianDigits(d)}
                  </option>
                ))}
              </select>

              {/* Month */}
              <select
                value={jMonth}
                onChange={(e) => handleJalaliDateChange(jYear, parseInt(e.target.value, 10), jDay)}
                className="px-2 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 outline-none"
              >
                {PERSIAN_MONTH_NAMES.map((mName, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {mName}
                  </option>
                ))}
              </select>

              {/* Year */}
              <select
                value={jYear}
                onChange={(e) => handleJalaliDateChange(parseInt(e.target.value, 10), jMonth, jDay)}
                className="px-2 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 outline-none font-mono"
              >
                {[currentJalali.year, currentJalali.year + 1, currentJalali.year + 2].map((y) => (
                  <option key={y} value={y}>
                    {toPersianDigits(y)}
                  </option>
                ))}
              </select>
            </div>

            {/* Synced input for compatibility */}
            <input
              type="date"
              value={closeDate}
              onChange={(e) => setCloseDate(e.target.value)}
              data-testid="deal-close-date-input"
              className="sr-only"
            />

            {closeDate && (
              <p className="mt-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium" dir="rtl">
                تاریخ معادل میلادی: <span className="font-mono">{closeDate}</span>
              </p>
            )}
          </div>

          {/* Quick Product Selection Accordion */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-950/50">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowProductsPanel(!showProductsPanel)}
                className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
              >
                <Package className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>اقلام و محصولات معامله (اختیاری)</span>
                {selectedProducts.length > 0 && (
                  <span className="bg-emerald-600 text-white text-[10px] px-2 py-0.5 rounded-full font-mono">
                    {toPersianDigits(selectedProducts.length)}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowProductsPanel(!showProductsPanel)}
                className="text-xs text-emerald-600 dark:text-emerald-400 font-medium cursor-pointer"
              >
                {showProductsPanel ? 'بستن' : 'مشاهده و انتخاب'}
              </button>
            </div>

            {showProductsPanel && (
              <div className="mt-3 space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                {allProducts.length === 0 ? (
                  <p className="text-[11px] text-slate-400 text-center py-2">
                    محصول فعالی در سامانه ثبت نشده است.
                  </p>
                ) : (
                  allProducts.map((prod) => {
                    const selected = selectedProducts.find((p) => p.product.id === prod.id);
                    return (
                      <div
                        key={prod.id}
                        className={`flex items-center justify-between p-2 rounded-lg text-xs border transition ${
                          selected
                            ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-500/40 text-slate-900 dark:text-slate-100'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleProduct(prod)}
                            className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer ${
                              selected
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : 'border-slate-300 dark:border-slate-600'
                            }`}
                          >
                            {selected && <Check className="w-3 h-3" />}
                          </button>
                          <div>
                            <span className="font-medium">{prod.name}</span>
                            {prod.unitPrice && (
                              <span className="text-[10px] text-slate-400 block">
                                {formatCurrency(prod.unitPrice)}
                              </span>
                            )}
                          </div>
                        </div>

                        {selected && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleUpdateProductQty(prod.id, -1)}
                              className="w-5 h-5 rounded bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-300"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="font-mono text-xs font-semibold w-5 text-center">
                              {toPersianDigits(selected.quantity)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateProductQty(prod.id, 1)}
                              className="w-5 h-5 rounded bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-300"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              یادداشت یا توضیحات اولیه
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="نکات کلیدی مذاکره، نیاز مشتری یا تعهدات..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none transition resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
            >
              انصراف
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => handleSubmit(e, true)}
                disabled={isSubmitting}
                data-testid="submit-deal-won-button"
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50"
              >
                <span>ذخیره به صورت فروش موفق</span>
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                data-testid="submit-deal-button"
                className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-sm transition cursor-pointer"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>ایجاد معامله</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DealCreateModal;
