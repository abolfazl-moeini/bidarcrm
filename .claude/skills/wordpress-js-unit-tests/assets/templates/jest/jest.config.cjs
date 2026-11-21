const baseConfig = require('@wordpress/scripts/config/jest-unit.config.js');

module.exports = {
  ...baseConfig,
  testMatch: [
    '**/tests/unit-js/**/*.test.[jt]s?(x)',
    '**/src/**/__tests__/*.[jt]s?(x)',
    '!**/tests/e2e/**',
    '!**/build/**',
    '!**/vendor/**',
    '!**/node_modules/**',
  ],
  setupFilesAfterEnv: [
    ...(baseConfig.setupFilesAfterEnv || []),
    '<rootDir>/tests/unit-js/setup.js',
  ],
  testEnvironment: 'jsdom',
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
  ],
};
