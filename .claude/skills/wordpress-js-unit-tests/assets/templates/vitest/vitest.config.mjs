import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/unit-js/setup.js'],
    include: [
      'tests/unit-js/**/*.test.[jt]s?(x)',
      'src/**/__tests__/*.[jt]s?(x)',
    ],
    exclude: [
      '**/tests/e2e/**',
      '**/build/**',
      '**/vendor/**',
      '**/node_modules/**',
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx,ts,tsx}'],
      exclude: ['src/**/*.d.ts', 'src/**/__tests__/**'],
    },
  },
});
