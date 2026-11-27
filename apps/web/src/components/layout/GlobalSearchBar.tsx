/**
 * BidarCRM - GlobalSearchBar & Command Palette Component
 *
 * Real floating Ctrl+K / Cmd+K modal fetching GET /api/v1/GlobalSearch?q=...
 * with results grouped by Deals, Contacts, and Accounts, keyboard navigation
 * (Up/Down/Enter/Escape), and clean instant selection.
 */

import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  Search,
  X,
  Briefcase,
  User,
  Building2,
  Loader2,
  CornerDownLeft,
} from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { GlobalSearchResult } from '../../types/espocrm';
import { toPersianDigits } from '../../lib/iran-format';

export interface GlobalSearchBarProps {
  currentPath?: string;
  onSearch?: (query: string) => void;
  onNavigate?: (path: string) => void;
  className?: string;
}

export const GlobalSearchBar: React.FC<GlobalSearchBarProps> = ({
  currentPath,
  onSearch,
  onNavigate,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const headerInputRef = useRef<HTMLInputElement>(null);
  const modalInputRef = useRef<HTMLInputElement>(null);

  const handleClose = () => {
    headerInputRef.current?.blur();
    modalInputRef.current?.blur();
    setIsOpen(false);
  };

  // Close search modal whenever route/path changes
  useEffect(() => {
    handleClose();
  }, [currentPath]);

  // Global Ctrl+K / Cmd+K and Escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        headerInputRef.current?.focus();
        setIsOpen(true);
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('popstate', handleClose);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('popstate', handleClose);
    };
  }, [isOpen]);

  // Sync focus to modal input when opened
  useEffect(() => {
    if (!isOpen) return;
    setSelectedIndex(0);
    const focusTimer = window.setTimeout(() => {
      modalInputRef.current?.focus();
    }, 50);
    return () => window.clearTimeout(focusTimer);
  }, [isOpen]);

  // Debounced search fetching with AbortController
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const q = encodeURIComponent(query.trim());
        const data = await apiClient.get<GlobalSearchResult[] | { list: GlobalSearchResult[] }>(
          `/GlobalSearch?q=${q}`,
          { signal: controller.signal }
        );
        if (controller.signal.aborted) return;
        const list = Array.isArray(data) ? data : data?.list || [];
        setResults(list);
        setSelectedIndex(0);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setResults([]);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, 200);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  // Grouped results
  const grouped = useMemo(() => {
    const deals: GlobalSearchResult[] = [];
    const contacts: GlobalSearchResult[] = [];
    const accounts: GlobalSearchResult[] = [];
    const others: GlobalSearchResult[] = [];

    for (const r of results) {
      const type = (r.entityType || r._scope || '').toLowerCase();
      if (type === 'opportunity' || type === 'deal') deals.push(r);
      else if (type === 'contact') contacts.push(r);
      else if (type === 'account') accounts.push(r);
      else others.push(r);
    }

    return { deals, contacts, accounts, others };
  }, [results]);

  // Flat list for linear keyboard navigation
  const flatList = useMemo(() => {
    return [...grouped.deals, ...grouped.contacts, ...grouped.accounts, ...grouped.others];
  }, [grouped]);

  const handleSelectResult = (item: GlobalSearchResult) => {
    handleClose();
    const type = (item.entityType || item._scope || '').toLowerCase();
    let target = '/dashboard';

    if (type === 'opportunity' || type === 'deal') {
      target = `/deals/${encodeURIComponent(item.id)}`;
    } else if (type === 'contact') {
      target = `/contacts?id=${encodeURIComponent(item.id)}&search=${encodeURIComponent(item.name || '')}`;
    } else if (type === 'account') {
      target = `/accounts?id=${encodeURIComponent(item.id)}&search=${encodeURIComponent(item.name || '')}`;
    } else if (type === 'lead') {
      target = `/leads?id=${encodeURIComponent(item.id)}&search=${encodeURIComponent(item.name || '')}`;
    }

    if (onNavigate) {
      onNavigate(target);
    } else if (onSearch) {
      onSearch(item.name);
    } else if (typeof window !== 'undefined') {
      window.location.href = target;
    }
  };

  const handleModalKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (flatList.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % flatList.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (flatList.length > 0) {
        setSelectedIndex((prev) => (prev - 1 + flatList.length) % flatList.length);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flatList[selectedIndex]) {
        handleSelectResult(flatList[selectedIndex]!);
      }
    }
  };

  let runningIndex = -1;

  return (
    <>
      {/* Header Search Input */}
      <div className={`relative w-full max-w-xs sm:max-w-md ${className}`} dir="rtl">
        <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
          <Search className="w-4 h-4" />
        </div>
        <input
          ref={headerInputRef}
          type="text"
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            const val = e.target.value;
            setQuery(val);
            setIsOpen(true);
            onSearch?.(val);
          }}
          placeholder="جستجو در معاملات، مخاطبان و شرکت‌ها... (Ctrl+K)"
          className="w-full pr-10 pl-14 py-1.5 sm:py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition duration-150"
        />
        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
          <kbd className="hidden sm:inline-block text-[10px] font-mono bg-slate-700 text-slate-300 border border-slate-600 px-1.5 py-0.5 rounded shadow-sm">
            Ctrl+K
          </kbd>
        </div>
      </div>

      {/* Floating Modal Command Palette */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-950/70 backdrop-blur-sm transition-opacity duration-100"
          onClick={handleClose}
          dir="rtl"
        >
          <div
            className="relative w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh]"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleModalKeyDown}
          >
            {/* Search Input Bar */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-slate-800">
              <Search className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <input
                ref={modalInputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  onSearch?.(e.target.value);
                }}
                placeholder="جستجو در معاملات، مخاطبان، شرکت‌ها و سرنخ‌ها..."
                className="flex-1 bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none"
              />
              {isLoading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
              {query && !isLoading && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    onSearch?.('');
                  }}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <kbd className="hidden sm:inline-block text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded">
                Esc
              </kbd>
            </div>

            {/* Results Body */}
            <div className="overflow-y-auto p-2 space-y-3 flex-1">
              {!query.trim() && (
                <div className="p-8 text-center text-xs text-slate-400">
                  <p>عبارت مورد نظر خود را تایپ کنید.</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    جستجو در تمام موجودیت‌های سامانه با امکان ناوبری با کلیدهای جهت‌نما
                  </p>
                </div>
              )}

              {query.trim() && !isLoading && flatList.length === 0 && (
                <div className="p-8 text-center text-xs text-slate-400">
                  نتیجه‌ای برای «{query}» یافت نشد.
                </div>
              )}

              {/* Deals Group */}
              {grouped.deals.length > 0 && (
                <div>
                  <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-indigo-500" />
                    <span>معاملات ({toPersianDigits(grouped.deals.length)})</span>
                  </div>
                  <div className="space-y-0.5">
                    {grouped.deals.map((item) => {
                      runningIndex++;
                      const isSelected = runningIndex === selectedIndex;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectResult(item)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition cursor-pointer text-right ${
                            isSelected
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Briefcase className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-white' : 'text-indigo-500'}`} />
                            <div className="min-w-0">
                              <span className="font-semibold truncate block">{item.name}</span>
                              {item.description && (
                                <span className={`text-[10px] truncate block ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                                  {item.description}
                                </span>
                              )}
                            </div>
                          </div>
                          {isSelected && <CornerDownLeft className="w-3.5 h-3.5 text-white/90" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Contacts Group */}
              {grouped.contacts.length > 0 && (
                <div>
                  <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-emerald-500" />
                    <span>مخاطبان ({toPersianDigits(grouped.contacts.length)})</span>
                  </div>
                  <div className="space-y-0.5">
                    {grouped.contacts.map((item) => {
                      runningIndex++;
                      const isSelected = runningIndex === selectedIndex;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectResult(item)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition cursor-pointer text-right ${
                            isSelected
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <User className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-white' : 'text-emerald-500'}`} />
                            <div className="min-w-0">
                              <span className="font-semibold truncate block">{item.name}</span>
                              {item.description && (
                                <span className={`text-[10px] truncate block ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                                  {item.description}
                                </span>
                              )}
                            </div>
                          </div>
                          {isSelected && <CornerDownLeft className="w-3.5 h-3.5 text-white/90" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Accounts Group */}
              {grouped.accounts.length > 0 && (
                <div>
                  <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-amber-500" />
                    <span>شرکت‌ها ({toPersianDigits(grouped.accounts.length)})</span>
                  </div>
                  <div className="space-y-0.5">
                    {grouped.accounts.map((item) => {
                      runningIndex++;
                      const isSelected = runningIndex === selectedIndex;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectResult(item)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition cursor-pointer text-right ${
                            isSelected
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Building2 className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-white' : 'text-amber-500'}`} />
                            <div className="min-w-0">
                              <span className="font-semibold truncate block">{item.name}</span>
                              {item.description && (
                                <span className={`text-[10px] truncate block ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                                  {item.description}
                                </span>
                              )}
                            </div>
                          </div>
                          {isSelected && <CornerDownLeft className="w-3.5 h-3.5 text-white/90" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Others Group */}
              {grouped.others.length > 0 && (
                <div>
                  <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                    سایر نتایج ({toPersianDigits(grouped.others.length)})
                  </div>
                  <div className="space-y-0.5">
                    {grouped.others.map((item) => {
                      runningIndex++;
                      const isSelected = runningIndex === selectedIndex;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectResult(item)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition cursor-pointer text-right ${
                            isSelected
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                          }`}
                        >
                          <span className="font-semibold truncate">{item.name}</span>
                          {isSelected && <CornerDownLeft className="w-3.5 h-3.5 text-white/90" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Keyboard Guide */}
            <div className="px-4 py-2 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="font-mono bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded text-[10px]">↑</kbd>
                  <kbd className="font-mono bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded text-[10px]">↓</kbd>
                  <span>جابجایی</span>
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="font-mono bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded text-[10px]">↵</kbd>
                  <span>انتخاب</span>
                </span>
              </div>
              <span className="text-[10px]">سامانه جستجوی بیدار</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GlobalSearchBar;
