import { describe, expect, it } from 'vitest';
import { themeAt } from './theme';

describe('themeAt', () => {
  it('is light from 06:00 until 18:00, and dark otherwise', () => {
    expect(themeAt(5.99)).toBe('dark');
    expect(themeAt(6)).toBe('light');
    expect(themeAt(17.99)).toBe('light');
    expect(themeAt(18)).toBe('dark');
    expect(themeAt(0)).toBe('dark');
  });

  it('wraps around midnight', () => {
    expect(themeAt(24 + 12)).toBe('light');
    expect(themeAt(-1)).toBe('dark');
  });
});
