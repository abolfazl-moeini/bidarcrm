import React from 'react';
import { BIDAR_THEME_TOKENS } from './lib/theme-tokens';

export default function App(): React.JSX.Element {
  return (
    <div
      dir="rtl"
      lang="fa"
      className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased"
      style={{ fontFamily: BIDAR_THEME_TOKENS.fontFamily }}
    >
      <header className="border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 space-x-reverse">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
              ب
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              سامانه فروش بیدار
            </h1>
          </div>
          <span className="text-xs text-slate-500 font-medium">Front-Office Headless v1.0.0</span>
        </div>
      </header>
      <main className="p-6 max-w-7xl mx-auto">
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-2">پیشخوان مدیریت فروش</h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            مدیریت کاریزهای فروش، معاملات، فعالیت‌های روزمره و ارتباطات تلفن و پیامک.
          </p>
        </div>
      </main>
    </div>
  );
}
