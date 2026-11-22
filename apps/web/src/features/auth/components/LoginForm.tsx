/**
 * BidarCRM - LoginForm Component
 *
 * Implements accessible, Persian RTL authentication form with client-side
 * validation, loading states, and error handling for EspoCRM 10.1.4.
 */

import React, { useState } from 'react';
import { Loader2, AlertCircle, Lock, User } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { ApiError } from '../../../lib/api-client';

export interface LoginFormProps {
  onSuccess?: () => void;
  className?: string;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSuccess, className = '' }) => {
  const { login } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = (): boolean => {
    const newErrors: { username?: string; password?: string } = {};

    if (!username.trim()) {
      newErrors.username = 'لطفاً نام کاربری را وارد کنید';
    }

    if (!password) {
      newErrors.password = 'لطفاً رمز عبور را وارد کنید';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await login(username.trim(), password);
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        setServerError('نام کاربری یا رمز عبور اشتباه است.');
      } else if (err instanceof ApiError && err.status === 403) {
        setServerError('دسترسی شما به سامانه مسدود یا محدود شده است.');
      } else {
        setServerError('خطا در برقراری ارتباط با سرور. لطفاً دوباره تلاش کنید.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`bidar-login-card w-full max-w-md bg-slate-800/90 border border-slate-700/80 rounded-2xl shadow-2xl p-8 backdrop-blur-md text-right ${className}`} dir="rtl">
      {/* Brand Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 mb-4 shadow-inner">
          <Lock className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-bold text-slate-100 tracking-tight">ورود به سامانه بیدار</h1>
        <p className="text-sm text-slate-400 mt-2">سامانه یکپارچه مدیریت ارتباط با مشتری</p>
      </div>

      {/* Server Error Alert */}
      {serverError && (
        <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-3 transition">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-400" />
          <span className="leading-relaxed">{serverError}</span>
        </div>
      )}

      {/* Login Form */}
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {/* Username Field */}
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-slate-300 mb-2">
            نام کاربری یا ایمیل
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-500">
              <User className="w-5 h-5" />
            </div>
            <input
              id="username"
              name="username"
              type="text"
              dir="ltr"
              autoComplete="username"
              disabled={isSubmitting}
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (errors.username) setErrors((prev) => ({ ...prev, username: undefined }));
              }}
              className={`w-full pr-11 pl-4 py-3 bg-slate-900/80 border rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition duration-150 ${
                errors.username ? 'border-rose-500 focus:border-rose-500' : 'border-slate-700 focus:border-indigo-500'
              }`}
              placeholder="admin"
            />
          </div>
          {errors.username && (
            <p className="mt-1.5 text-xs text-rose-400 font-medium">{errors.username}</p>
          )}
        </div>

        {/* Password Field */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
            رمز عبور
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-500">
              <Lock className="w-5 h-5" />
            </div>
            <input
              id="password"
              name="password"
              type="password"
              dir="ltr"
              autoComplete="current-password"
              disabled={isSubmitting}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
              }}
              className={`w-full pr-11 pl-4 py-3 bg-slate-900/80 border rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition duration-150 ${
                errors.password ? 'border-rose-500 focus:border-rose-500' : 'border-slate-700 focus:border-indigo-500'
              }`}
              placeholder="••••••••"
            />
          </div>
          {errors.password && (
            <p className="mt-1.5 text-xs text-rose-400 font-medium">{errors.password}</p>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full mt-2 py-3.5 px-4 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium rounded-xl shadow-lg shadow-indigo-600/25 transition duration-150 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>در حال ورود...</span>
            </>
          ) : (
            <span>ورود به سامانه</span>
          )}
        </button>
      </form>
    </div>
  );
};

export default LoginForm;
