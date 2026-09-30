import { describe, expect, it } from 'vitest';
import { CHECK, checksDuration, hopProgress, stopProgress } from './checks';

const step = CHECK.move + CHECK.pause;

describe('hopProgress', () => {
  it('moves to each rule in turn, pausing at each', () => {
    expect(hopProgress(3, 0)).toEqual([0, 0, 0]);
    expect(hopProgress(3, CHECK.move / 2)[0]).toBeCloseTo(0.5, 6);
    expect(hopProgress(3, CHECK.move)).toEqual([1, 0, 0]);
    expect(hopProgress(3, CHECK.move + CHECK.pause / 2)).toEqual([1, 0, 0]);
    expect(hopProgress(3, step + CHECK.move / 2)[1]).toBeCloseTo(0.5, 6);
    expect(hopProgress(3, 2 * step + CHECK.move)).toEqual([1, 1, 1]);
  });
});

describe('checksDuration', () => {
  it('ends a moment after the last hop arrives', () => {
    expect(checksDuration(3)).toBe(2 * step + CHECK.move + CHECK.hold);
    expect(checksDuration(0)).toBe(0);
  });
});

describe('stopProgress', () => {
  it('counts the rules the call has reached, and whether it is on its way to the next', () => {
    expect(stopProgress([0, 0, 0], 2)).toEqual({ done: 0, moving: false });
    expect(stopProgress([0.4, 0, 0], 2)).toEqual({ done: 0, moving: true });
    expect(stopProgress([1, 0, 0], 2)).toEqual({ done: 1, moving: false });
    expect(stopProgress([1, 0.5, 0], 2)).toEqual({ done: 1, moving: true });
  });

  it('does not count the last hop, which runs to the destination', () => {
    expect(stopProgress([1, 1, 0.5], 2)).toEqual({ done: 2, moving: false });
  });
});
