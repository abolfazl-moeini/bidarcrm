import { describe, it, expect } from 'vitest';
import { BIDAR_THEME_TOKENS } from '../lib/theme-tokens';

describe('BidarCRM Clean-Room Design System & Theme Tokens (INV-14)', () => {
  it('enforces independent primary and neutral brand tokens', () => {
    // Primary: Modern Indigo, Neutral: Deep Slate
    expect(BIDAR_THEME_TOKENS.colors.primary).toBe('#4F46E5');
    expect(BIDAR_THEME_TOKENS.colors.slateDark).toBe('#0F172A');
    expect(BIDAR_THEME_TOKENS.colors.slateLight).toBe('#F8FAFC');
  });

  it('enforces distinct emerald won deal token and rose rotten alert token', () => {
    expect(BIDAR_THEME_TOKENS.colors.dealWon).toBe('#10B981'); // Emerald
    expect(BIDAR_THEME_TOKENS.colors.dealRotten).toBe('#EF4444'); // Rose/Coral
  });

  it('prohibits Didar trademark yellow/purple palette', () => {
    const rawTokens = JSON.stringify(BIDAR_THEME_TOKENS);
    // Didar yellow/orange (#FFB703, #FB8500) and Didar purple (#6F2DBD)
    expect(rawTokens).not.toContain('#FFB703');
    expect(rawTokens).not.toContain('#FB8500');
    expect(rawTokens).not.toContain('#6F2DBD');
  });

  it('specifies Vazirmatn font family', () => {
    expect(BIDAR_THEME_TOKENS.fontFamily).toContain('Vazirmatn');
  });
});
