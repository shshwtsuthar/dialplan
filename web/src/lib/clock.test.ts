import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import { createSimClock, nextWeekdayAt, SPEED, thanksgiving, upcomingThanksgiving } from './clock';

const LA = 'America/Los_Angeles';
const at = (iso: string) => DateTime.fromISO(iso, { zone: LA });

describe('simulated clock', () => {
  it('runs twelve hours in three real minutes', () => {
    expect(SPEED).toBe(240);
    let real = 1_000_000;
    const clock = createSimClock(() => real);
    const start = clock.now();
    real += 3 * 60_000;
    expect(clock.now() - start).toBe(12 * 3_600_000);
  });

  it('can be set, paused and resumed', () => {
    let real = 0;
    const clock = createSimClock(() => real);
    clock.set(5_000);
    clock.toggle();
    real += 60_000;
    expect(clock.now()).toBe(5_000);
    clock.toggle();
    real += 1_000;
    expect(clock.now()).toBe(5_000 + 1_000 * SPEED);
    expect(clock.getSnapshot().running).toBe(true);
  });
});

describe('presets', () => {
  it('finds the next Tuesday at 7pm', () => {
    expect(nextWeekdayAt(at('2026-09-30T10:00'), 2, 19).toISO()).toBe('2026-10-06T19:00:00.000-07:00');
    expect(nextWeekdayAt(at('2026-10-06T18:00'), 2, 19).toISO()).toBe('2026-10-06T19:00:00.000-07:00');
    expect(nextWeekdayAt(at('2026-10-06T20:00'), 2, 19).toISO()).toBe('2026-10-13T19:00:00.000-07:00');
  });

  it('lands on the right side of a daylight saving change', () => {
    // Tuesday after clocks fall back is in PST.
    expect(nextWeekdayAt(at('2026-10-29T12:00'), 2, 19).toISO()).toBe('2026-11-03T19:00:00.000-08:00');
  });

  it('finds Thanksgiving', () => {
    expect(thanksgiving(2026, LA).toISODate()).toBe('2026-11-26');
    expect(thanksgiving(2027, LA).toISODate()).toBe('2027-11-25');
    expect(thanksgiving(2028, LA).toISODate()).toBe('2028-11-23');
    expect(upcomingThanksgiving(at('2026-09-30T10:00')).toISO()).toBe('2026-11-26T11:00:00.000-08:00');
    expect(upcomingThanksgiving(at('2026-11-26T23:00')).toISODate()).toBe('2026-11-26');
    expect(upcomingThanksgiving(at('2026-11-27T09:00')).toISODate()).toBe('2027-11-25');
  });
});
