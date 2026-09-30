import type { TraceStep } from '@dialplan/shared';
import { describe, expect, it } from 'vitest';
import { callPath, ruleStates } from './callPath';

const clock: TraceStep = { stage: 'clock', result: 'info', detail: 'Tue 24 Nov 2026, 19:00' };

describe('callPath', () => {
  it('marks every rule the call was checked against, and the ones it never reached', () => {
    const path = callPath([
      clock,
      { stage: 'vip', result: 'disabled', detail: 'VIP routing is turned off' },
      { stage: 'holidays', result: 'matched', detail: '2026-11-26 is Thanksgiving → Holiday greeting' },
    ]);
    expect(path.matched).toBe('holidays');
    expect(path.outcomes).toEqual({
      vip: 'disabled',
      holidays: 'matched',
      hours: 'not_reached',
      afterHours: 'not_reached',
    });
  });

  it('has no match without a trace', () => {
    expect(callPath([]).matched).toBeUndefined();
  });

  it('lists the rules the call was checked against, in order, with the reason', () => {
    const path = callPath([
      clock,
      { stage: 'vip', result: 'no_match', detail: 'Not a VIP' },
      { stage: 'holidays', result: 'disabled', detail: 'Holiday routing is turned off' },
      { stage: 'hours', result: 'matched', detail: 'Open' },
    ]);
    expect(path.checked).toEqual([
      { rule: 'vip', outcome: 'no_match', detail: 'Not a VIP' },
      { rule: 'holidays', outcome: 'disabled', detail: 'Holiday routing is turned off' },
      { rule: 'hours', outcome: 'matched', detail: 'Open' },
    ]);
  });
});

describe('ruleStates', () => {
  const path = callPath([
    clock,
    { stage: 'vip', result: 'no_match', detail: '' },
    { stage: 'holidays', result: 'matched', detail: '' },
  ]);
  const none = { vip: undefined, holidays: undefined, hours: undefined, afterHours: undefined };

  it('shows nothing before the checks start', () => {
    expect(ruleStates(path, undefined)).toEqual(none);
  });

  it('resolves each rule as the call reaches it, and shows the one being checked', () => {
    expect(ruleStates(path, { done: 0, moving: true })).toEqual({ ...none, vip: 'checking' });
    expect(ruleStates(path, { done: 1, moving: false })).toEqual({ ...none, vip: 'no_match' });
    expect(ruleStates(path, { done: 1, moving: true })).toEqual({ ...none, vip: 'no_match', holidays: 'checking' });
  });

  it('marks the rest as not checked once the match is found', () => {
    expect(ruleStates(path, { done: 2, moving: false })).toEqual(path.outcomes);
  });

  it('shows every outcome once the replay is over', () => {
    expect(ruleStates(path, 'all')).toEqual(path.outcomes);
  });
});
