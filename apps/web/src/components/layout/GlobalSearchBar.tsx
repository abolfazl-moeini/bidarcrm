/**
 * BidarCRM - GlobalSearchBar Component
 *
 * Provides global entity lookup with Ctrl+K / Cmd+K instant keyboard focus.
 */

import React, { useRef, useEffect, useState } from 'react';
import { Search } from 'lucide-react';

export interface GlobalSearchBarProps {
  onSearch?: (query: string) => void;
  className?: string;
}

export const GlobalSearchBar: React.FC<GlobalSearchBarProps> = ({ onSearch, className = '' }) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (onSearch) {
      onSearch(val);
    }
  };

  return (
    <div className={`relative w-full max-w-md ${className}`} dir="rtl">
      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-500">
        <Search className="w-4 h-4" />
      </div>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={handleChange}
        placeholder="جستجو در معاملات، مخاطبان و شرکت‌ها... (Ctrl+K)"
        className="w-full pr-10 pl-16 py-2 bg-slate-900/70 border border-slate-700/80 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition duration-150"
      />
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <kbd className="hidden sm:inline-block text-[10px] font-mono bg-slate-800 text-slate-400 border border-slate-700 px-1.5 py-0.5 rounded shadow-sm">
          Ctrl+K
        </kbd>
      </div>
    </div>
  );
};

export default GlobalSearchBar;
