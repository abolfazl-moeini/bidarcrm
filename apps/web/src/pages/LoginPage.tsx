/**
 * BidarCRM - LoginPage
 *
 * Full-screen centered authentication screen with RTL alignment,
 * Didar-inspired clean surfaces, and light/dark mode adaptation.
 */

import React from 'react';
import { LoginForm } from '../features/auth/components/LoginForm';
import { fullNameFa, fullName } from '../lib/brand';

export interface LoginPageProps {
  onSuccess?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSuccess }) => {
  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-[#F4F6F8] dark:bg-[#0B0F19] text-slate-800 dark:text-slate-100 selection:bg-emerald-500 selection:text-white transition-colors duration-150"
      dir="rtl"
      lang="fa"
    >
      {/* Background ambient lighting effects in dark mode */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/10 dark:bg-emerald-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-teal-500/10 dark:bg-teal-600/10 rounded-full blur-3xl" />
      </div>

      {/* Main Login Card Container */}
      <main className="relative z-10 w-full flex items-center justify-center">
        <LoginForm onSuccess={onSuccess} />
      </main>

      {/* Footer Branding */}
      <footer className="relative z-10 mt-6 text-center text-xs text-slate-400 dark:text-slate-500 font-normal">
        <p>{fullNameFa} ({fullName})</p>
      </footer>
    </div>
  );
};

export default LoginPage;
