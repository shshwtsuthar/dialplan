import { describe, expect, it } from 'vitest';
import { describeTarget, formatCallTime, formatPhone, normalizePhone, relativeTime, summarizeWeek } from './format';

describe('formatPhone', () => {
  it('formats North American numbers', () => {
    expect(formatPhone('+16195550100')).toBe('(619) 555-0100');
    expect(formatPhone('anonymous')).toBe('Withheld');
  });

  it('formats London numbers', () => {
    expect(formatPhone('+442079460123')).toBe('+44 20 7946 0123');
  });

  it('leaves other numbers as they are', () => {
    expect(formatPhone('+33123456789')).toBe('+33123456789');
  });
});

describe('describeTarget', () => {
  it('names the kind of destination and its target', () => {
    expect(describeTarget({ kind: 'extension', target: '201', label: 'Rosa' })).toBe('Extension 201');
    expect(describeTarget({ kind: 'voicemail', target: 'holiday', label: 'Holiday greeting' })).toBe(
      'Voicemail box holiday',
    );
    expect(describeTarget({ kind: 'external', target: '+16195550199', label: 'Answering service' })).toBe(
      'External number (619) 555-0199',
    );
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

describe('formatCallTime', () => {
  it('gives the local time with its zone and offset, on either side of the clock change', () => {
    expect(formatCallTime('2026-09-30T07:01:34.535-07:00', 'America/Los_Angeles')).toBe(
      'Wed 30 Sep 2026, 07:01 PDT (UTC-07:00) in America/Los_Angeles',
    );
    expect(formatCallTime('2026-11-24T19:00:00.000-08:00', 'America/Los_Angeles')).toBe(
      'Tue 24 Nov 2026, 19:00 PST (UTC-08:00) in America/Los_Angeles',
    );
  });
});
