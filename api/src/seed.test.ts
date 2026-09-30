import { Rules } from '@dialplan/shared';
import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import { HARBOR_AUTO } from './seed';

describe('seed data', () => {
  it.each(HARBOR_AUTO.numbers)('$name passes the shared schema', ({ rules }) => {
    expect(Rules.safeParse(rules).error).toBeUndefined();
  });

  it('only uses numbers reserved for fiction', () => {
    const numbers = JSON.stringify(HARBOR_AUTO).match(/\+1\d{10}/g) ?? [];
    expect(numbers.length).toBeGreaterThan(0);
    for (const n of numbers) expect(n).toMatch(/^\+1\d{3}55501\d{2}$/);
  });

  it('puts holidays on the right days', () => {
    const weekday = (date: string) => DateTime.fromISO(date).toFormat('cccc');
    const dates = HARBOR_AUTO.numbers[0]!.rules.holidays.dates;
    for (const { date, name } of dates) {
      if (name.startsWith('Thanksgiving')) expect(weekday(date)).toBe('Thursday');
      if (/Memorial|Labor/.test(name)) expect(weekday(date)).toBe('Monday');
      if (name.includes('observed')) expect(['Monday', 'Friday']).toContain(weekday(date));
    }
  });
});
