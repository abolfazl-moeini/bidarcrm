/**
 * BidarCRM - LoginPage
 *
 * Full-screen centered authentication screen with RTL alignment and Bidar design tokens.
 */

import React from 'react';
import { LoginForm } from '../features/auth/components/LoginForm';

export interface LoginPageProps {
  onSuccess?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSuccess }) => {
  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white"
      dir="rtl"
      lang="fa"
    >
      {/* Background ambient lighting effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-sky-600/10 rounded-full blur-3xl" />
      </div>

      {/* Main Login Card Container */}
      <main className="relative z-10 w-full flex items-center justify-center">
        <LoginForm onSuccess={onSuccess} />
      </main>

      {/* Footer Branding */}
      <footer className="relative z-10 mt-8 text-center text-xs text-slate-500 font-normal">
        <p>تمامی حقوق محفوظ است © ۱۴۰۳ بیدار (BidarCRM)</p>
      </footer>
    </div>
  );
};

export default LoginPage;
