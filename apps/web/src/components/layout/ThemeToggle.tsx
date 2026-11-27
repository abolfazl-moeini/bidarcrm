/**
 * BidarCRM - ThemeToggle Component
 *
 * Toggles between Dark and Light display modes with smooth icon transition.
 */

import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../lib/theme';

export interface ThemeToggleProps {
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '' }) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`relative p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 rounded-xl transition-all duration-150 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${className}`}
      title={isDark ? 'تغییر به حالت روشن' : 'تغییر به حالت تاریک'}
      aria-label={isDark ? 'تغییر به حالت روشن' : 'تغییر به حالت تاریک'}
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-amber-400 transition-transform duration-150 hover:rotate-45" />
      ) : (
        <Moon className="w-4 h-4 text-slate-300 transition-transform duration-150 hover:-rotate-12" />
      )}
    </button>
  );
};

export default ThemeToggle;
