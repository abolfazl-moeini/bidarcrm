/**
 * BidarCRM Clean-Room Independent Design System Tokens (INV-14)
 * Strict separation from Didar visual branding.
 */
export const BIDAR_THEME_TOKENS = {
  name: 'BidarCRM Slate-Indigo',
  fontFamily: 'Vazirmatn, system-ui, -apple-system, sans-serif',
  colors: {
    primary: '#4F46E5', // Indigo-600
    primaryHover: '#4338CA', // Indigo-700
    primaryLight: '#EEF2FF', // Indigo-50
    slateDark: '#0F172A', // Slate-900
    slateSurface: '#1E293B', // Slate-800
    slateLight: '#F8FAFC', // Slate-50
    border: '#E2E8F0', // Slate-200
    dealWon: '#10B981', // Emerald-500
    dealLost: '#64748B', // Slate-500
    dealRotten: '#EF4444', // Rose-500
    dealRottenBg: '#FEF2F2', // Rose-50
    dealRottenBorder: '#FECACA', // Rose-200
  },
  radii: {
    sm: '0.375rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    full: '9999px',
  },
  shadows: {
    card: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    cardHover: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    modal: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  },
} as const;
