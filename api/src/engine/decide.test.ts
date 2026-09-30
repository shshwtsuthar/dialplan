import { Rules, type Rules as RulesType } from '@dialplan/shared';
import { describe, expect, it } from 'vitest';
import { decide } from './decide';

const LA = 'America/Los_Angeles';
const VIP = '+18585550142';
const STRANGER = '+17605550123';

// Parsed through the shared schema so the fixture is always a valid dialplan.
function rules(overrides: (r: RulesType) => void = () => {}): RulesType {
  const r = Rules.parse({
    vip: {
      enabled: true,
      callers: [{ number: VIP, name: 'Dana Whitfield' }],
      destination: { kind: 'extension', target: '201', label: 'Sales manager' },
    },
    holidays: {
      enabled: true,
      dates: [{ date: '2026-11-26', name: 'Thanksgiving' }],
      destination: { kind: 'voicemail', target: 'holiday', label: 'Holiday voicemail' },
    },
    hours: {
      enabled: true,
      weekly: {
        mon: [{ open: '08:00', close: '18:00' }],
        tue: [{ open: '08:00', close: '18:00' }],
        wed: [{ open: '08:00', close: '18:00' }],
        thu: [{ open: '08:00', close: '18:00' }],
        fri: [{ open: '08:00', close: '12:00' }, { open: '13:00', close: '18:00' }],
        sat: [{ open: '09:00', close: '17:00' }],
        sun: [],
      },
      destination: { kind: 'ring_group', target: 'sales', label: 'Sales floor' },
    },
    afterHours: {
      destination: { kind: 'voicemail', target: 'main', label: 'After-hours voicemail' },
    },
  });
  overrides(r);
  return r;
}

const route = (timestamp: string, caller = STRANGER, r = rules(), tz = LA) => decide(r, tz, { caller, timestamp });

describe('rule order', () => {
  it('rings VIP callers through during opening hours', () => {
    expect(route('2026-11-24T10:00:00-08:00', VIP).matchedRule).toBe('vip');
  });

  it('rings VIP callers through on holidays and after hours', () => {
    expect(route('2026-11-26T10:00:00-08:00', VIP).matchedRule).toBe('vip');
    expect(route('2026-11-24T23:00:00-08:00', VIP).matchedRule).toBe('vip');
  });

  it('puts holidays ahead of opening hours', () => {
    // Thanksgiving is a Thursday, and 10:00 is within Thursday hours.
    const d = route('2026-11-26T10:00:00-08:00');
    expect(d.matchedRule).toBe('holidays');
    expect(d.destination.label).toBe('Holiday voicemail');
  });

  it('routes to the open destination during opening hours', () => {
    const d = route('2026-11-24T10:00:00-08:00');
    expect(d.matchedRule).toBe('hours');
    expect(d.destination.target).toBe('sales');
  });

  it('falls through to after hours', () => {
    const d = route('2026-11-24T19:00:00-08:00');
    expect(d.matchedRule).toBe('afterHours');
    expect(d.destination.label).toBe('After-hours voicemail');
  });
});

describe('VIP callers', () => {
  it('skips the VIP list when it is disabled', () => {
    const d = route('2026-11-24T10:00:00-08:00', VIP, rules((r) => (r.vip.enabled = false)));
    expect(d.matchedRule).toBe('hours');
    expect(d.trace.find((s) => s.stage === 'vip')?.result).toBe('disabled');
  });

  it('never matches a withheld caller ID', () => {
    const d = route('2026-11-24T10:00:00-08:00', 'anonymous');
    expect(d.matchedRule).toBe('hours');
    expect(d.trace.find((s) => s.stage === 'vip')?.detail).toMatch(/withheld/);
  });

  it('names the caller in the trace', () => {
    const d = route('2026-11-24T10:00:00-08:00', VIP);
    expect(d.trace.at(-1)?.detail).toContain('Dana Whitfield');
  });
});

describe('holidays', () => {
  it('uses the local date, not the UTC date', () => {
    // 07:59:59Z on Nov 26 is still 23:59:59 on Nov 25 in San Diego.
    expect(route('2026-11-26T07:59:59Z').matchedRule).not.toBe('holidays');
    // 08:00Z is local midnight: Thanksgiving has started.
    expect(route('2026-11-26T08:00:00Z').matchedRule).toBe('holidays');
    // 07:59:59Z on Nov 27 is 23:59:59 on Thanksgiving, even though UTC says the 27th.
    expect(route('2026-11-27T07:59:59Z').matchedRule).toBe('holidays');
  });

  it('skips holidays when disabled', () => {
    const d = route('2026-11-26T10:00:00-08:00', STRANGER, rules((r) => (r.holidays.enabled = false)));
    expect(d.matchedRule).toBe('hours');
  });
});

describe('opening hours', () => {
  it('opens exactly at the opening time and closes exactly at the closing time', () => {
    expect(route('2026-11-24T07:59:59-08:00').matchedRule).toBe('afterHours');
    expect(route('2026-11-24T08:00:00-08:00').matchedRule).toBe('hours');
    expect(route('2026-11-24T17:59:59-08:00').matchedRule).toBe('hours');
    expect(route('2026-11-24T18:00:00-08:00').matchedRule).toBe('afterHours');
  });

  it('supports several intervals in a day', () => {
    // Friday closes 12:00 to 13:00 for lunch.
    expect(route('2026-11-27T11:30:00-08:00').matchedRule).toBe('hours');
    expect(route('2026-11-27T12:30:00-08:00').matchedRule).toBe('afterHours');
    expect(route('2026-11-27T13:00:00-08:00').matchedRule).toBe('hours');
  });

  it('treats a day with no intervals as closed', () => {
    const d = route('2026-11-29T12:00:00-08:00');
    expect(d.matchedRule).toBe('afterHours');
    expect(d.trace.find((s) => s.stage === 'hours')?.detail).toBe('Closed all day on Sunday');
  });

  it('allows 24:00 as a closing time', () => {
    const r = rules((x) => (x.hours.weekly.tue = [{ open: '20:00', close: '24:00' }]));
    expect(route('2026-11-24T23:59:59-08:00', STRANGER, r).matchedRule).toBe('hours');
    expect(route('2026-11-25T00:00:00-08:00', STRANGER, r).matchedRule).toBe('afterHours');
  });

  it('skips opening hours when disabled', () => {
    const d = route('2026-11-24T10:00:00-08:00', STRANGER, rules((r) => (r.hours.enabled = false)));
    expect(d.matchedRule).toBe('afterHours');
    expect(d.trace.find((s) => s.stage === 'hours')?.result).toBe('disabled');
  });
});

describe('time zones', () => {
  it('gives the same answer for the same instant written with any offset', () => {
    const a = route('2026-11-24T19:00:00-08:00');
    const b = route('2026-11-25T03:00:00Z');
    const c = route('2026-11-25T08:30:00+05:30');
    expect(b).toEqual({ ...a, trace: b.trace });
    expect(c.localTime).toBe(a.localTime);
    expect(c.matchedRule).toBe(a.matchedRule);
  });

  it("evaluates in the dialplan's zone, not the caller's", () => {
    // 10:00 in New York is 07:00 in San Diego: not open yet.
    const d = route('2026-11-24T10:00:00-05:00');
    expect(d.localTime).toBe('2026-11-24T07:00:00.000-08:00');
    expect(d.matchedRule).toBe('afterHours');
    // The same instant for a New York dialplan is within hours.
    expect(route('2026-11-24T10:00:00-05:00', STRANGER, rules(), 'America/New_York').matchedRule).toBe('hours');
  });

  it('rejects timestamps it cannot interpret', () => {
    expect(() => route('not a time')).toThrow(RangeError);
  });
});

// America/Los_Angeles in 2026: clocks spring forward from 02:00 PST to 03:00
// PDT on Sunday March 8 (10:00Z), and fall back from 02:00 PDT to 01:00 PST
// on Sunday November 1 (09:00Z).
describe('daylight saving time in America/Los_Angeles', () => {
  const sunday = (intervals: { open: string; close: string }[]) =>
    rules((r) => (r.hours.weekly.sun = intervals));

  describe('spring forward', () => {
    it('jumps from 01:59:59 PST straight to 03:00:00 PDT', () => {
      expect(route('2026-03-08T09:59:59Z').localTime).toBe('2026-03-08T01:59:59.000-08:00');
      expect(route('2026-03-08T10:00:00Z').localTime).toBe('2026-03-08T03:00:00.000-07:00');
    });

    it('never opens an interval that falls entirely in the skipped hour', () => {
      const r = sunday([{ open: '02:00', close: '03:00' }]);
      for (let minute = 0; minute <= 120; minute += 5) {
        const instant = new Date(Date.parse('2026-03-08T09:00:00Z') + minute * 60_000).toISOString();
        expect(route(instant, STRANGER, r).matchedRule).toBe('afterHours');
      }
    });

    it('keeps an interval that spans the gap open on both sides of it', () => {
      const r = sunday([{ open: '01:00', close: '03:30' }]);
      expect(route('2026-03-08T09:30:00Z', STRANGER, r).matchedRule).toBe('hours'); // 01:30 PST
      expect(route('2026-03-08T10:15:00Z', STRANGER, r).matchedRule).toBe('hours'); // 03:15 PDT
      expect(route('2026-03-08T10:30:00Z', STRANGER, r).matchedRule).toBe('afterHours'); // 03:30 PDT
    });

    it('opens at 08:00 local on both sides of the change, a different UTC hour each', () => {
      // Friday before: 08:00 PST is 16:00Z. Monday after: 08:00 PDT is 15:00Z.
      expect(route('2026-03-06T15:00:00Z').matchedRule).toBe('afterHours'); // 07:00 PST
      expect(route('2026-03-06T16:00:00Z').matchedRule).toBe('hours'); // 08:00 PST
      expect(route('2026-03-09T15:00:00Z').matchedRule).toBe('hours'); // 08:00 PDT
      expect(route('2026-03-09T14:59:59Z').matchedRule).toBe('afterHours'); // 07:59:59 PDT
    });
  });

  describe('fall back', () => {
    it('passes through 01:30 twice, once in PDT and once in PST', () => {
      expect(route('2026-11-01T08:30:00Z').localTime).toBe('2026-11-01T01:30:00.000-07:00');
      expect(route('2026-11-01T09:30:00Z').localTime).toBe('2026-11-01T01:30:00.000-08:00');
    });

    it('gives both 01:30s the same answer, because rules are wall-clock', () => {
      const r = sunday([{ open: '01:00', close: '01:45' }]);
      expect(route('2026-11-01T08:30:00Z', STRANGER, r).matchedRule).toBe('hours'); // 01:30 PDT
      expect(route('2026-11-01T09:30:00Z', STRANGER, r).matchedRule).toBe('hours'); // 01:30 PST
      expect(route('2026-11-01T08:50:00Z', STRANGER, r).matchedRule).toBe('afterHours'); // 01:50 PDT
      expect(route('2026-11-01T09:50:00Z', STRANGER, r).matchedRule).toBe('afterHours'); // 01:50 PST
    });

    it('opens at 08:00 local on both sides of the change, a different UTC hour each', () => {
      // Friday before: 08:00 PDT is 15:00Z. Monday after: 08:00 PST is 16:00Z.
      expect(route('2026-10-30T15:00:00Z').matchedRule).toBe('hours');
      expect(route('2026-11-02T15:00:00Z').matchedRule).toBe('afterHours'); // 07:00 PST
      expect(route('2026-11-02T16:00:00Z').matchedRule).toBe('hours');
    });

    it('shows the offset in the trace', () => {
      const [clock] = route('2026-11-01T09:30:00Z').trace;
      expect(clock?.detail).toContain('01:30:00 PST (UTC-08:00)');
    });
  });
});

describe('trace', () => {
  it('lists the clock and every rule evaluated, in order, ending at the match', () => {
    const d = route('2026-11-24T19:00:00-08:00');
    expect(d.trace.map((s) => [s.stage, s.result])).toEqual([
      ['clock', 'info'],
      ['vip', 'no_match'],
      ['holidays', 'no_match'],
      ['hours', 'no_match'],
      ['afterHours', 'matched'],
    ]);
  });

  it('stops at the first match', () => {
    const d = route('2026-11-24T10:00:00-08:00', VIP);
    expect(d.trace.map((s) => s.stage)).toEqual(['clock', 'vip']);
  });

  it('explains the decision in words', () => {
    const d = route('2026-11-24T19:00:00-08:00');
    expect(d.trace.map((s) => s.detail)).toEqual([
      '2026-11-24T19:00:00-08:00 is Tue 24 Nov 2026, 19:00:00 PST (UTC-08:00) in America/Los_Angeles',
      '+17605550123 is not among 1 VIP caller',
      '2026-11-24 is not a holiday',
      '19:00 is outside Tuesday hours (08:00–18:00)',
      'No earlier rule matched → After-hours voicemail',
    ]);
  });
});
