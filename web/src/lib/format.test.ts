import { describe, expect, it } from 'vitest';
import { formatPhone, normalizePhone, relativeTime, summarizeWeek } from './format';

describe('formatPhone', () => {
  it('formats North American numbers', () => {
    expect(formatPhone('+16195550100')).toBe('(619) 555-0100');
    expect(formatPhone('anonymous')).toBe('Withheld');
    expect(formatPhone('+442071838750')).toBe('+442071838750');
  });
});

describe('summarizeWeek', () => {
  it('groups consecutive days with the same hours', () => {
    const weekday = [{ open: '08:00', close: '18:00' }];
    const rows = summarizeWeek({
      mon: weekday,
      tue: weekday,
      wed: weekday,
      thu: weekday,
      fri: [{ open: '08:00', close: '12:00' }, { open: '13:00', close: '18:00' }],
      sat: [],
      sun: [],
    });
    expect(rows.map(({ days, hours }) => [days, hours])).toEqual([
      ['Mon–Thu', '08:00–18:00'],
      ['Fri', '08:00–12:00, 13:00–18:00'],
      ['Sat–Sun', 'Closed'],
    ]);
  });
});

describe('relativeTime', () => {
  const now = Date.parse('2026-09-30T12:00:00Z');
  it('describes recent times', () => {
    expect(relativeTime('2026-09-30T11:59:50Z', now)).toBe('just now');
    expect(relativeTime('2026-09-30T11:55:00Z', now)).toBe('5 min ago');
    expect(relativeTime('2026-09-30T09:00:00Z', now)).toBe('3 h ago');
  });
});

describe('normalizePhone', () => {
  it('turns common North American formats into E.164', () => {
    expect(normalizePhone('(619) 555-0166')).toBe('+16195550166');
    expect(normalizePhone('1-619-555-0166')).toBe('+16195550166');
    expect(normalizePhone('+1 619 555 0166')).toBe('+16195550166');
    expect(normalizePhone('555-0166')).toBe('555-0166');
  });
});
