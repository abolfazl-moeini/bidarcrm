import React, { useState, useEffect, useRef } from 'react';
import {
  Key,
  Package,
  Target,
  MessageSquare,
  Globe,
  Plus,
  Trash2,
  Copy,
  Check,
  Code,
  Settings as SettingsIcon,
  AlertCircle,
} from 'lucide-react';
import { apiClient } from '../lib/api-client';
import {
  BidarApiKey,
  BidarProduct,
  BidarGoal,
  BidarSmsTemplate,
} from '../types/espocrm';
import { formatIranCurrency, toPersianDigits } from '../lib/iran-format';
import { formatJalaliDate } from '../lib/jalali';

type TabType = 'api_keys' | 'products' | 'goals' | 'sms' | 'lead_capture';

export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('api_keys');
  const [tabError, setTabError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clipboardError, setClipboardError] = useState<string | null>(null);
  const clipboardTimerRef = useRef<number | null>(null);

  // Tab 1: API Keys state
  const [apiKeys, setApiKeys] = useState<BidarApiKey[]>([]);
  const [isLoadingKeys, setIsLoadingKeys] = useState(false);
  const [showCreateKeyModal, setShowCreateKeyModal] = useState(false);
  const [confirmRevokeKeyId, setConfirmRevokeKeyId] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyIp, setNewKeyIp] = useState('');
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Tab 2: Products state
  const [products, setProducts] = useState<BidarProduct[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<BidarProduct | null>(null);
  const [productForm, setProductForm] = useState({
    name: '',
    code: '',
    unitPrice: 0,
    unit: 'عدد',
    isActive: true,
  });

  // Tab 3: Sales Goals state
  const [goals, setGoals] = useState<BidarGoal[]>([]);
  const [isLoadingGoals, setIsLoadingGoals] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalForm, setGoalForm] = useState<{
    name: string;
    metricType: 'wonAmount' | 'wonCount' | 'dealsCreated' | 'activitiesHeld';
    scopeType: 'all' | 'user';
    period: 'monthly';
    targetValue: number;
  }>({
    name: '',
    metricType: 'wonAmount',
    scopeType: 'all',
    period: 'monthly',
    targetValue: 100000000,
  });

  // Tab 4: SMS Templates state
  const [smsTemplates, setSmsTemplates] = useState<BidarSmsTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [smsForm, setSmsForm] = useState({ name: '', body: '', isActive: true });

  // Tab 5: Web Lead Capture state
  const [formTitle, setFormTitle] = useState('درخواست مشاوره رایگان');
  const [formFields, setFormFields] = useState({
    name: true,
    phone: true,
    email: true,
    accountName: true,
    description: true,
  });
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  // Cleanup clipboard timer on unmount
  useEffect(() => {
    return () => {
      if (clipboardTimerRef.current !== null) {
        window.clearTimeout(clipboardTimerRef.current);
      }
    };
  }, []);

  // Escape key closes topmost open modal
  useEffect(() => {
    const hasOpenModal =
      Boolean(confirmRevokeKeyId) ||
      showCreateKeyModal ||
      showProductModal ||
      showGoalModal ||
      showSmsModal;
    if (!hasOpenModal) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || isSubmitting) return;
      if (confirmRevokeKeyId) {
        setConfirmRevokeKeyId(null);
        setModalError(null);
      } else if (showCreateKeyModal) {
        setShowCreateKeyModal(false);
        setRevealedKey(null);
        setModalError(null);
      } else if (showProductModal) {
        setShowProductModal(false);
        setModalError(null);
      } else if (showGoalModal) {
        setShowGoalModal(false);
        setModalError(null);
      } else if (showSmsModal) {
        setShowSmsModal(false);
        setModalError(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmRevokeKeyId, showCreateKeyModal, showProductModal, showGoalModal, showSmsModal, isSubmitting]);

  // Load data based on active tab with AbortController
  useEffect(() => {
    const controller = new AbortController();
    setTabError(null);
    if (activeTab === 'api_keys') {
      fetchApiKeys(controller.signal);
    } else if (activeTab === 'products') {
      fetchProducts(controller.signal);
    } else if (activeTab === 'goals') {
      fetchGoals(controller.signal);
    } else if (activeTab === 'sms') {
      fetchSmsTemplates(controller.signal);
    }
    return () => controller.abort();
  }, [activeTab]);

  // Fetch functions
  const fetchApiKeys = async (signal?: AbortSignal) => {
    setIsLoadingKeys(true);
    setTabError(null);
    try {
      const res = await apiClient.get<{ list: BidarApiKey[] }>('/BidarApiKey?maxSize=50', { signal });
      if (!signal?.aborted) {
        setApiKeys(res.list || []);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setTabError(err instanceof Error ? err.message : 'خطا در دریافت کلیدهای دسترسی');
    } finally {
      if (!signal?.aborted) {
        setIsLoadingKeys(false);
      }
    }
  };

  const fetchProducts = async (signal?: AbortSignal) => {
    setIsLoadingProducts(true);
    setTabError(null);
    try {
      const res = await apiClient.get<{ list: BidarProduct[] }>('/BidarProduct?maxSize=100', { signal });
      if (!signal?.aborted) {
        setProducts(res.list || []);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setTabError(err instanceof Error ? err.message : 'خطا در دریافت فهرست محصولات');
    } finally {
      if (!signal?.aborted) {
        setIsLoadingProducts(false);
      }
    }
  };

  const fetchGoals = async (signal?: AbortSignal) => {
    setIsLoadingGoals(true);
    setTabError(null);
    try {
      const res = await apiClient.get<{ list: BidarGoal[] }>('/BidarGoal?maxSize=50', { signal });
      if (!signal?.aborted) {
        setGoals(res.list || []);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setTabError(err instanceof Error ? err.message : 'خطا در دریافت اهداف فروش');
    } finally {
      if (!signal?.aborted) {
        setIsLoadingGoals(false);
      }
    }
  };

  const fetchSmsTemplates = async (signal?: AbortSignal) => {
    setIsLoadingTemplates(true);
    setTabError(null);
    try {
      const res = await apiClient.get<{ list: BidarSmsTemplate[] }>('/BidarSmsTemplate?maxSize=50', { signal });
      if (!signal?.aborted) {
        setSmsTemplates(res.list || []);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setTabError(err instanceof Error ? err.message : 'خطا در دریافت الگوهای پیامک');
    } finally {
      if (!signal?.aborted) {
        setIsLoadingTemplates(false);
      }
    }
  };

  // Actions: API Keys
  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim() || isSubmitting) return;
    setIsSubmitting(true);
    setModalError(null);
    try {
      const res = await apiClient.post<BidarApiKey & { rawKey?: string; plainKey?: string }>('/BidarApiKey', {
        name: newKeyName.trim(),
        allowedIpList: newKeyIp ? newKeyIp.split(',').map((s) => s.trim()).filter(Boolean) : [],
      });
      const generatedKey = res?.rawKey || res?.plainKey;
      if (!generatedKey) {
        throw new Error('پاسخ نامعتبر از سرور هنگام ساخت کلید API');
      }
      setRevealedKey(generatedKey);
      setApiKeys((prev) => [
        {
          id: res.id,
          name: res.name || newKeyName.trim(),
          keyPrefix: res.keyPrefix || generatedKey.substring(0, 14),
          isActive: true,
          createdAt: res.createdAt || new Date().toISOString(),
        },
        ...prev,
      ]);
      setNewKeyName('');
      setNewKeyIp('');
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'خطا در ساخت کلید API');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmRevokeKey = async () => {
    if (!confirmRevokeKeyId || isSubmitting) return;
    setIsSubmitting(true);
    setModalError(null);
    try {
      await apiClient.delete(`/BidarApiKey/${confirmRevokeKeyId}`);
      setApiKeys((prev) => prev.filter((k) => k.id !== confirmRevokeKeyId));
      setConfirmRevokeKeyId(null);
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'خطا در ابطال کلید دسترسی');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Actions: Products
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name.trim() || isSubmitting) return;
    setIsSubmitting(true);
    setModalError(null);
    try {
      if (editingProduct) {
        await apiClient.patch(`/BidarProduct/${editingProduct.id}`, productForm);
        setProducts((prev) =>
          prev.map((p) => (p.id === editingProduct.id ? { ...p, ...productForm } : p))
        );
      } else {
        const res = await apiClient.post<BidarProduct>('/BidarProduct', productForm);
        setProducts((prev) => [res, ...prev]);
      }
      setShowProductModal(false);
      setEditingProduct(null);
      setProductForm({ name: '', code: '', unitPrice: 0, unit: 'عدد', isActive: true });
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'خطا در ذخیره محصول');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Actions: Goals
  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalForm.name.trim() || isSubmitting) return;
    setIsSubmitting(true);
    setModalError(null);
    try {
      const res = await apiClient.post<BidarGoal>('/BidarGoal', goalForm);
      setGoals((prev) => [res, ...prev]);
      setShowGoalModal(false);
      setGoalForm({ name: '', metricType: 'wonAmount', scopeType: 'all', period: 'monthly', targetValue: 100000000 });
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'خطا در ثبت هدف فروش');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Actions: SMS
  const handleSaveSmsTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smsForm.name.trim() || !smsForm.body.trim() || isSubmitting) return;
    setIsSubmitting(true);
    setModalError(null);
    try {
      const res = await apiClient.post<BidarSmsTemplate>('/BidarSmsTemplate', smsForm);
      setSmsTemplates((prev) => [res, ...prev]);
      setShowSmsModal(false);
      setSmsForm({ name: '', body: '', isActive: true });
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'خطا در ذخیره الگوی پیامک');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = async (text: string, type: 'key' | 'embed') => {
    setClipboardError(null);
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('مرورگر دسترسی کپی خودکار را ندارد');
      }
      await navigator.clipboard.writeText(text);
      if (clipboardTimerRef.current !== null) {
        window.clearTimeout(clipboardTimerRef.current);
      }
      if (type === 'key') {
        setCopiedKey(true);
        clipboardTimerRef.current = window.setTimeout(() => setCopiedKey(false), 2000);
      } else {
        setCopiedEmbed(true);
        clipboardTimerRef.current = window.setTimeout(() => setCopiedEmbed(false), 2000);
      }
    } catch {
      setClipboardError('کپی خودکار ناموفق بود؛ لطفاً متن را به‌صورت دستی کپی کنید.');
    }
  };

  const embedSnippet = `<iframe
  src="${window.location.origin}/lead-capture?formTitle=${encodeURIComponent(formTitle)}"
  width="100%"
  height="450"
  frameborder="0"
  style="border-radius: 12px; border: 1px solid #e2e8f0;"
></iframe>`;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <SettingsIcon className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
          تنظیمات سامانه بیدار
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          مدیریت کلیدهای API، محصولات، اهداف فروش، الگوهای پیامک و فرم جذب سرنخ
        </p>
      </div>

      {/* Tabs Bar */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-1 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab('api_keys')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'api_keys'
              ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
              : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Key className="w-4 h-4" />
          کلیدهای دسترسی و API
        </button>

        <button
          onClick={() => setActiveTab('products')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'products'
              ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
              : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Package className="w-4 h-4" />
          محصولات و خدمات
        </button>

        <button
          onClick={() => setActiveTab('goals')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'goals'
              ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
              : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Target className="w-4 h-4" />
          اهداف فروش ماهانه
        </button>

        <button
          onClick={() => setActiveTab('sms')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'sms'
              ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
              : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          الگوها و خروجی پیامک
        </button>

        <button
          onClick={() => setActiveTab('lead_capture')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'lead_capture'
              ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
              : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Globe className="w-4 h-4" />
          فرم وب جذب سرنخ
        </button>
      </div>

      {/* Tab Error Alert */}
      {tabError && (
        <div role="alert" className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-200 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{tabError}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (activeTab === 'api_keys') fetchApiKeys();
              else if (activeTab === 'products') fetchProducts();
              else if (activeTab === 'goals') fetchGoals();
              else if (activeTab === 'sms') fetchSmsTemplates();
            }}
            className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium"
          >
            تلاش مجدد
          </button>
        </div>
      )}

      {clipboardError && (
        <div role="alert" className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs">
          {clipboardError}
        </div>
      )}

      {/* TAB 1: API Keys */}
      {activeTab === 'api_keys' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                کلیدهای اختصاصی وب‌سرویس (API Keys)
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                برای اتصال فروشگاه، وب‌سایت وردپرسی یا ربات تلگرام با هدر <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-emerald-600">X-Api-Key</code>
              </p>
            </div>
            <button
              onClick={() => {
                setShowCreateKeyModal(true);
                setRevealedKey(null);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              تولید کلید جدید
            </button>
          </div>

          {/* Keys Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-right text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-semibold text-xs">
                <tr>
                  <th className="px-6 py-3">نام کلید</th>
                  <th className="px-6 py-3">پیش‌وند کلید</th>
                  <th className="px-6 py-3">وضعیت</th>
                  <th className="px-6 py-3">تاریخ ایجاد</th>
                  <th className="px-6 py-3 text-left">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {isLoadingKeys ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-slate-500">
                      در حال دریافت کلیدها...
                    </td>
                  </tr>
                ) : apiKeys.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-slate-500">
                      کلیدی یافت نشد. برای شروع دکمه «تولید کلید جدید» را بزنید.
                    </td>
                  </tr>
                ) : (
                  apiKeys.map((key) => (
                    <tr key={key.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                        {key.name}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-500" dir="ltr">
                        {key.keyPrefix}...
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center whitespace-nowrap shrink-0 px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400">
                          فعال
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {key.createdAt ? formatJalaliDate(key.createdAt) : '—'}
                      </td>
                      <td className="px-6 py-4 text-left">
                        <button
                          onClick={() => {
                            setModalError(null);
                            setConfirmRevokeKeyId(key.id);
                          }}
                          className="text-rose-600 hover:text-rose-800 p-1 rounded-lg transition-colors"
                          title="ابطال کلید"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* cURL Example */}
          <div className="bg-slate-900 text-slate-100 rounded-xl p-5 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-2">
                <Code className="w-4 h-4 text-emerald-400" />
                نمونه فراخوانی با cURL
              </span>
            </div>
            <pre className="text-xs font-mono bg-slate-950 p-3 rounded-lg overflow-x-auto text-emerald-400" dir="ltr">
{`curl -X POST "${window.location.origin}/api/v1/Lead" \\
  -H "X-Api-Key: YOUR_API_KEY_HERE" \\
  -H "Content-Type: application/json" \\
  -d '{
    "firstName": "سهراب",
    "lastName": "سپهری",
    "phoneNumber": "09121112233",
    "source": "Website"
  }'`}
            </pre>
          </div>

          {/* Create Key Modal */}
          {showCreateKeyModal && (
            <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  تولید کلید دسترسی جدید
                </h3>

                {modalError && (
                  <div role="alert" className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs">
                    {modalError}
                  </div>
                )}

                {revealedKey ? (
                  <div className="space-y-4">
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-300">
                      <strong>توجه بسیار مهم:</strong> این کلید فقط همین یک‌بار نمایش داده می‌شود. لطفاً آن را در محلی امن ذخیره کنید.
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                      <input
                        type="text"
                        readOnly
                        value={revealedKey}
                        className="bg-transparent font-mono text-xs w-full text-slate-900 dark:text-slate-100 focus:outline-none"
                        dir="ltr"
                      />
                      <button
                        onClick={() => copyToClipboard(revealedKey, 'key')}
                        className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition-colors"
                        title="کپی در حافظه"
                      >
                        {copiedKey ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={() => {
                          setShowCreateKeyModal(false);
                          setRevealedKey(null);
                        }}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium rounded-lg"
                      >
                        بستن و اتمام
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleCreateApiKey} className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        نام شناسه کلید
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="مثال: فروشگاه ووکامرس، وب‌سایت"
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        محدودیت آی‌پی مجاز (اختیاری، با کاما جدا کنید)
                      </label>
                      <input
                        type="text"
                        placeholder="185.120.30.1, 10.0.0.5"
                        value={newKeyIp}
                        onChange={(e) => setNewKeyIp(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        dir="ltr"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowCreateKeyModal(false);
                          setModalError(null);
                        }}
                        disabled={isSubmitting}
                        className="px-4 py-2 text-xs text-slate-600 hover:text-slate-800 dark:text-slate-400"
                      >
                        انصراف
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg"
                      >
                        {isSubmitting ? 'در حال تولید...' : 'تولید کلید'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* Revoke Key Confirmation Modal */}
          {confirmRevokeKeyId && (
            <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  ابطال کلید دسترسی
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  آیا از ابطال این کلید دسترسی اطمینان دارید؟ این عملیات غیرقابل بازگشت است.
                </p>
                {modalError && (
                  <div role="alert" className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs">
                    {modalError}
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => {
                      setConfirmRevokeKeyId(null);
                      setModalError(null);
                    }}
                    className="px-4 py-2 text-xs text-slate-600 hover:text-slate-800 dark:text-slate-400"
                  >
                    انصراف
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleConfirmRevokeKey}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg"
                  >
                    {isSubmitting ? 'در حال ابطال...' : 'تایید ابطال کلید'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Products */}
      {activeTab === 'products' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                کاتالوگ کالاها و خدمات
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                مدیریت اقلام قابل عرضه در پیش‌فاکتورها و معاملات کاریز فروش
              </p>
            </div>
            <button
              onClick={() => {
                setEditingProduct(null);
                setProductForm({ name: '', code: '', unitPrice: 0, unit: 'عدد', isActive: true });
                setShowProductModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              افزودن محصول جدید
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-right text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-semibold text-xs">
                <tr>
                  <th className="px-6 py-3">نام محصول / خدمت</th>
                  <th className="px-6 py-3">کد کالا (SKU)</th>
                  <th className="px-6 py-3">قیمت واحد</th>
                  <th className="px-6 py-3">واحد سنجش</th>
                  <th className="px-6 py-3">وضعیت</th>
                  <th className="px-6 py-3 text-left">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {isLoadingProducts ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-500">
                      در حال دریافت لیست محصولات...
                    </td>
                  </tr>
                ) : products.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-500">
                      محصولی تعریف نشده است.
                    </td>
                  </tr>
                ) : (
                  products.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                        {p.name}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-500" dir="ltr">
                        {p.code || '—'}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-100">
                        {formatIranCurrency(p.unitPrice || 0)}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">{p.unit || 'عدد'}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            p.isActive
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          {p.isActive ? 'فعال' : 'غیرفعال'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-left">
                        <button
                          onClick={() => {
                            setEditingProduct(p);
                            setProductForm({
                              name: p.name,
                              code: p.code || '',
                              unitPrice: p.unitPrice || 0,
                              unit: p.unit || 'عدد',
                              isActive: p.isActive ?? true,
                            });
                            setShowProductModal(true);
                          }}
                          className="text-emerald-600 hover:text-emerald-800 text-xs font-medium"
                        >
                          ویرایش
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Product Modal */}
          {showProductModal && (
            <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {editingProduct ? 'ویرایش محصول' : 'تعریف محصول / خدمت جدید'}
                </h3>
                <form onSubmit={handleSaveProduct} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      نام کالا یا خدمت
                    </label>
                    <input
                      type="text"
                      required
                      value={productForm.name}
                      onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      کد شناسه / SKU
                    </label>
                    <input
                      type="text"
                      value={productForm.code}
                      onChange={(e) => setProductForm({ ...productForm, code: e.target.value })}
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                      dir="ltr"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        قیمت واحد (تومان)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={productForm.unitPrice}
                        onChange={(e) =>
                          setProductForm({ ...productForm, unitPrice: Number(e.target.value) })
                        }
                        className="w-full text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        واحد سنجش
                      </label>
                      <input
                        type="text"
                        value={productForm.unit}
                        onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}
                        className="w-full text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isActiveProduct"
                      checked={productForm.isActive}
                      onChange={(e) =>
                        setProductForm({ ...productForm, isActive: e.target.checked })
                      }
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <label htmlFor="isActiveProduct" className="text-xs text-slate-700 dark:text-slate-300">
                      محصول فعال و آماده سفارش‌گذاری است
                    </label>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowProductModal(false)}
                      className="px-4 py-2 text-xs text-slate-600 hover:text-slate-800 dark:text-slate-400"
                    >
                      انصراف
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg"
                    >
                      ذخیره اطلاعات
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Goals */}
      {activeTab === 'goals' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                اهداف فروش و عملکرد تیم
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                تعریف تارگت‌های ماهانه بر اساس مبلغ درآمد، تعداد معاملات موفق یا فعالیت‌های ثبت‌شده
              </p>
            </div>
            <button
              onClick={() => setShowGoalModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              تعریف تارگت جدید
            </button>
          </div>

          {isLoadingGoals ? (
            <div className="text-center py-8 text-slate-500">در حال دریافت اهداف فروش...</div>
          ) : goals.length === 0 ? (
            <div className="text-center py-8 text-slate-500">هیچ هدفی تعریف نشده است.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {goals.map((g) => (
                <div
                  key={g.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Target className="w-5 h-5 text-emerald-600" />
                      <h3 className="font-bold text-slate-900 dark:text-white text-sm">{g.name}</h3>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-medium">
                      {g.metricType === 'wonAmount' ? 'درآمد تحقق یافته' : 'تعداد معامله'}
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                      <span>
                        پیشرفت:{' '}
                        <strong className="text-slate-800 dark:text-slate-100 font-semibold">
                          {toPersianDigits(g.progressPercent || 0)}٪
                        </strong>
                      </span>
                      <span>
                        هدف: {formatIranCurrency(g.targetValue)}
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(g.progressPercent || 0, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span>دوره: ماهانه</span>
                    <span>محدوده: {g.scopeType === 'all' ? 'کل سازمان' : 'کارشناس خاص'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Goal Modal */}
          {showGoalModal && (
            <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  تعریف هدف فروش جدید
                </h3>
                <form onSubmit={handleCreateGoal} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      عنوان هدف
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: هدف فروش بهار ۱۴۰۴"
                      value={goalForm.name}
                      onChange={(e) => setGoalForm({ ...goalForm, name: e.target.value })}
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      نوع متریک
                    </label>
                    <select
                      value={goalForm.metricType}
                      onChange={(e) =>
                        setGoalForm({
                          ...goalForm,
                          metricType: e.target.value as typeof goalForm.metricType,
                        })
                      }
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="wonAmount">مبلغ کل معاملات برنده (تومان)</option>
                      <option value="wonCount">تعداد کل معاملات برنده</option>
                      <option value="dealsCreated">تعداد معاملات جدید ساخته‌شده</option>
                      <option value="activitiesHeld">تعداد جلسات و تماس‌های موفق</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      مقدار تارگت مورد انتظار
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={goalForm.targetValue}
                      onChange={(e) =>
                        setGoalForm({ ...goalForm, targetValue: Number(e.target.value) })
                      }
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                      dir="ltr"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowGoalModal(false)}
                      className="px-4 py-2 text-xs text-slate-600 hover:text-slate-800 dark:text-slate-400"
                    >
                      انصراف
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg"
                    >
                      ذخیره هدف
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: SMS Templates & History */}
      {activeTab === 'sms' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                الگوهای پیامک و تاریخچه ارسال
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                تعریف متن‌های پیش‌فرض با قابلیت متغیرهایی نظیر {'{name}'} و {'{dealNumber}'}
              </p>
            </div>
            <button
              onClick={() => setShowSmsModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              الگوی جدید
            </button>
          </div>

          {isLoadingTemplates ? (
            <div className="text-center py-8 text-slate-500">در حال دریافت الگوها...</div>
          ) : smsTemplates.length === 0 ? (
            <div className="text-center py-8 text-slate-500">هیچ الگوی پیامکی تعریف نشده است.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {smsTemplates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">{tpl.name}</h3>
                    <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400">
                      فعال
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800 leading-relaxed">
                    {tpl.body}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* SMS Template Modal */}
          {showSmsModal && (
            <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  تعریف الگوی پیامک جدید
                </h3>
                <form onSubmit={handleSaveSmsTemplate} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      عنوان الگو
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: پیامک خوش‌آمدگویی"
                      value={smsForm.name}
                      onChange={(e) => setSmsForm({ ...smsForm, name: e.target.value })}
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      متن پیامک
                    </label>
                    <textarea
                      rows={4}
                      required
                      placeholder="متن پیامک... می‌توانید از {name} استفاده کنید."
                      value={smsForm.body}
                      onChange={(e) => setSmsForm({ ...smsForm, body: e.target.value })}
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowSmsModal(false)}
                      className="px-4 py-2 text-xs text-slate-600 hover:text-slate-800 dark:text-slate-400"
                    >
                      انصراف
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg"
                    >
                      ذخیره الگو
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: Web Lead Capture */}
      {activeTab === 'lead_capture' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              فرم وب جذب سرنخ (Web Lead Capture)
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              ساخت و جاسازی فرم ثبت درخواست در وب‌سایت، وبلاگ یا صفحات فرود بدون نیاز به کدنویسی
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Form Builder Settings */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">تنظیمات فیلدهای فرم</h3>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  عنوان نمایشی بالای فرم
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-2 pt-2">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  فیلدهای ورودی:
                </span>
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={formFields.name}
                    onChange={(e) => setFormFields({ ...formFields, name: e.target.checked })}
                    className="rounded border-slate-300 text-emerald-600"
                  />
                  نام و نام خانوادگی (اجباری)
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={formFields.phone}
                    onChange={(e) => setFormFields({ ...formFields, phone: e.target.checked })}
                    className="rounded border-slate-300 text-emerald-600"
                  />
                  شماره موبایل (اجباری)
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={formFields.email}
                    onChange={(e) => setFormFields({ ...formFields, email: e.target.checked })}
                    className="rounded border-slate-300 text-emerald-600"
                  />
                  آدرس ایمیل
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={formFields.accountName}
                    onChange={(e) => setFormFields({ ...formFields, accountName: e.target.checked })}
                    className="rounded border-slate-300 text-emerald-600"
                  />
                  نام شرکت / سازمان
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={formFields.description}
                    onChange={(e) => setFormFields({ ...formFields, description: e.target.checked })}
                    className="rounded border-slate-300 text-emerald-600"
                  />
                  توضیحات و نیازمندی
                </label>
              </div>

              {/* Embed Code Snippet */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    کد آی‌فریم برای قرار دادن در وب‌سایت:
                  </span>
                  <button
                    onClick={() => copyToClipboard(embedSnippet, 'embed')}
                    className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                  >
                    {copiedEmbed ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedEmbed ? 'کپی شد' : 'کپی کد'}
                  </button>
                </div>
                <pre className="text-xs font-mono bg-slate-950 p-3 rounded-lg overflow-x-auto text-emerald-400" dir="ltr">
                  {embedSnippet}
                </pre>
              </div>
            </div>

            {/* Live Form Preview */}
            <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center">
              <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-lg space-y-3">
                <div className="text-center pb-2 border-b border-slate-100 dark:border-slate-800">
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">{formTitle}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">فرم ثبت اطلاعات در بیدار CRM</p>
                </div>

                {formFields.name && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      نام و نام خانوادگی *
                    </label>
                    <input
                      type="text"
                      disabled
                      placeholder="علی رضایی"
                      className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    />
                  </div>
                )}

                {formFields.phone && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      شماره موبایل *
                    </label>
                    <input
                      type="text"
                      disabled
                      placeholder="09123456789"
                      className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                      dir="ltr"
                    />
                  </div>
                )}

                {formFields.accountName && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      نام شرکت
                    </label>
                    <input
                      type="text"
                      disabled
                      placeholder="شرکت فناوران..."
                      className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    />
                  </div>
                )}

                <button
                  disabled
                  className="w-full mt-2 py-2 bg-emerald-600 text-white rounded-lg text-xs font-medium shadow-sm"
                >
                  ارسال درخواست
                </button>
              </div>
              <span className="text-xs text-slate-400 mt-3">پیش‌نمایش زنده ظاهر فرم</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
