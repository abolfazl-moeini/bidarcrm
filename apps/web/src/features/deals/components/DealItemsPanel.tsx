/**
 * BidarCRM - DealItemsPanel Component (GAP-02)
 *
 * Dedicated products and items manager for opportunities/deals:
 * - Displays all associated BidarDealItem records
 * - Allows selecting from BidarProduct catalogue
 * - Adjusts quantity, unit price, and discount percentage
 * - Real-time lineTotal recalculation
 * - Auto-refreshes Opportunity total amount via PATCH /Opportunity/:id
 * - Didar-inspired clean card presentation with light/dark mode support
 */

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Package,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  Percent,
} from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { queryKeys } from '../../../lib/query-keys';
import { BidarDealItem, BidarProduct, EspoListResponse } from '../../../types/espocrm';
import { formatCurrency, toPersianDigits } from '../../../lib/iran-format';

export interface DealItemsPanelProps {
  dealId: string;
  dealName?: string;
  onAmountChange?: (newAmount: number) => void;
  className?: string;
}

export const DealItemsPanel: React.FC<DealItemsPanelProps> = ({
  dealId,
  dealName = '',
  onAmountChange,
  className = '',
}) => {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [customName, setCustomName] = useState('');
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(1);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Fetch Deal Items
  const itemsQuery = useQuery<EspoListResponse<BidarDealItem>>({
    queryKey: ['dealItems', dealId],
    queryFn: async () => {
      try {
        return await apiClient.get<EspoListResponse<BidarDealItem>>(
          `/BidarDealItem?where[0][type]=equals&where[0][attribute]=opportunityId&where[0][value]=${dealId}&maxSize=100`
        );
      } catch {
        return { list: [], total: 0 };
      }
    },
    enabled: Boolean(dealId),
  });

  // 2. Fetch Available Products
  const productsQuery = useQuery<EspoListResponse<BidarProduct>>({
    queryKey: ['products', 'active'],
    queryFn: async () => {
      try {
        return await apiClient.get<EspoListResponse<BidarProduct>>('/BidarProduct?maxSize=100');
      } catch {
        return { list: [], total: 0 };
      }
    },
    staleTime: 1000 * 60 * 5,
  });

  const items = itemsQuery.data?.list || [];
  const products = productsQuery.data?.list || [];

  const totalItemsAmount = items.reduce((sum, item) => sum + (item.lineTotal || 0), 0);

  // Sync opportunity amount when items change
  const syncOpportunityAmount = async (newTotal: number) => {
    try {
      await apiClient.patch(`/Opportunity/${dealId}`, { amount: newTotal });
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.detail(dealId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      onAmountChange?.(newTotal);
    } catch {
      // Ignore
    }
  };

  const handleProductSelect = (productId: string) => {
    setSelectedProductId(productId);
    const prod = products.find((p) => p.id === productId);
    if (prod) {
      setCustomName(prod.name);
      setUnitPrice(prod.unitPrice || 0);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const itemName = customName.trim() || 'آیتم معامله';
    if (quantity <= 0) {
      setError('تعداد باید حداقل ۱ باشد.');
      return;
    }

    const effectiveDiscount = Math.min(100, Math.max(0, discountPercent));
    const lineTotal = Math.round(quantity * unitPrice * (1 - effectiveDiscount / 100));

    setIsSubmitting(true);
    try {
      await apiClient.post('/BidarDealItem', {
        opportunityId: dealId,
        opportunityName: dealName,
        productId: selectedProductId || undefined,
        productName: selectedProductId ? customName : undefined,
        name: itemName,
        quantity,
        unitPrice,
        discountPercent: effectiveDiscount,
        lineTotal,
      });

      // Refetch items and update opportunity amount
      await queryClient.invalidateQueries({ queryKey: ['dealItems', dealId] });
      const updatedTotal = totalItemsAmount + lineTotal;
      await syncOpportunityAmount(updatedTotal);

      // Reset form
      setIsAdding(false);
      setSelectedProductId('');
      setCustomName('');
      setUnitPrice(0);
      setQuantity(1);
      setDiscountPercent(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در ثبت محصول معامله.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteItem = async (itemId: string, itemTotal: number) => {
    try {
      await apiClient.delete(`/BidarDealItem/${itemId}`);
      await queryClient.invalidateQueries({ queryKey: ['dealItems', dealId] });
      const newTotal = Math.max(0, totalItemsAmount - itemTotal);
      await syncOpportunityAmount(newTotal);
    } catch {
      // Revert/ignore
    }
  };

  return (
    <div
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4 ${className}`}
      dir="rtl"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Package className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              اقلام و محصولات معامله
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {toPersianDigits(items.length)} قلم کالا | جمع اقلام: {formatCurrency(totalItemsAmount)}
            </p>
          </div>
        </div>

        {!isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-xl shadow-sm transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>افزودن محصول</span>
          </button>
        )}
      </div>

      {/* Add Item Form */}
      {isAdding && (
        <form
          onSubmit={handleAddItem}
          className="p-3.5 bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3"
        >
          {error && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Product Catalog Dropdown */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                انتخاب از محصولات سامانه
              </label>
              <select
                value={selectedProductId}
                onChange={(e) => handleProductSelect(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 outline-none"
              >
                <option value="">— تعریف دستی یا انتخاب محصول —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.unitPrice ? `(${formatCurrency(p.unitPrice)})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Name */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                عنوان آیتم
              </label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="عنوان کالا یا خدمات..."
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {/* Quantity */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                تعداد
              </label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 outline-none font-mono"
              />
            </div>

            {/* Unit Price */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                قیمت واحد (تومان)
              </label>
              <input
                type="number"
                min="0"
                value={unitPrice}
                onChange={(e) => setUnitPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 outline-none font-mono"
              />
            </div>

            {/* Discount Percent */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                تخفیف (٪)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 outline-none font-mono"
                />
                <Percent className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
              جمع ردیف: {formatCurrency(Math.round(quantity * unitPrice * (1 - discountPercent / 100)))}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-800 rounded-xl"
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                {isSubmitting && <Loader2 className="w-3 h-3 animate-spin" />}
                <span>ثبت آیتم</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Items Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-right border-collapse">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 font-medium">
              <th className="py-2 px-3">ردیف</th>
              <th className="py-2 px-3">شرح کالا / خدمات</th>
              <th className="py-2 px-3">تعداد</th>
              <th className="py-2 px-3">قیمت واحد</th>
              <th className="py-2 px-3">تخفیف</th>
              <th className="py-2 px-3">جمع کل</th>
              <th className="py-2 px-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
            {items.map((item, idx) => (
              <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                <td className="py-2.5 px-3 font-mono text-slate-400">{toPersianDigits(idx + 1)}</td>
                <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-slate-100">
                  {item.name || item.productName || 'کالا'}
                </td>
                <td className="py-2.5 px-3 font-mono">{toPersianDigits(item.quantity || 1)}</td>
                <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400">
                  {formatCurrency(item.unitPrice || 0)}
                </td>
                <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400">
                  {item.discountPercent ? `${toPersianDigits(item.discountPercent)}٪` : '—'}
                </td>
                <td className="py-2.5 px-3 font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(item.lineTotal || (item.quantity || 1) * (item.unitPrice || 0))}
                </td>
                <td className="py-2.5 px-3 text-left">
                  <button
                    type="button"
                    onClick={() => handleDeleteItem(item.id, item.lineTotal || 0)}
                    className="p-1 text-slate-400 hover:text-rose-500 rounded-lg transition cursor-pointer"
                    title="حذف آیتم"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}

            {items.length === 0 && !itemsQuery.isLoading && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-slate-400 text-xs">
                  هنوز محصولی به این معامله اضافه نشده است.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DealItemsPanel;
