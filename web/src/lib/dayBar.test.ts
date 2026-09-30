import { describe, expect, it } from 'vitest';
import { dayBar, dayPercent, openStatus } from './dayBar';

const nineToSix = [{ open: '09:00', close: '18:00' }];
const splitDay = [
  { open: '09:00', close: '12:00' },
  { open: '13:00', close: '17:00' },
];

describe('dayPercent', () => {
  it('places minutes of the day on a 0–100 scale', () => {
    expect(dayPercent(0)).toBe(0);
    expect(dayPercent(6 * 60)).toBe(25);
    expect(dayPercent(24 * 60)).toBe(100);
  });
});

describe('dayBar', () => {
  it('shades the night before 06:00 and after 18:00', () => {
    expect(dayBar([]).night).toEqual([
      { start: 0, end: 25 },
      { start: 75, end: 100 },
    ]);
  });

  it('draws each opening interval', () => {
    expect(dayBar(splitDay).open).toEqual([
      { start: 37.5, end: 50 },
      { start: 100 * (13 / 24), end: 100 * (17 / 24) },
    ]);
  });

  it('runs an interval that closes at 24:00 to the end of the bar', () => {
    expect(dayBar([{ open: '18:00', close: '24:00' }]).open).toEqual([{ start: 75, end: 100 }]);
  });
});

describe('openStatus', () => {
  it('says when an open interval ends', () => {
    expect(openStatus(10 * 60, nineToSix)).toBe('Open until 18:00');
  });

  it('treats the closing minute as closed, like the engine', () => {
    expect(openStatus(18 * 60, nineToSix)).toBe('Closed for the rest of today');
  });

  it('names the next opening later today', () => {
    expect(openStatus(7 * 60, nineToSix)).toBe('Opens at 09:00');
    expect(openStatus(12 * 60 + 30, splitDay)).toBe('Opens at 13:00');
  });

  it('says when the day has no opening hours', () => {
    expect(openStatus(10 * 60, [])).toBe('Closed today');
  });

  it('reads 24:00 as midnight', () => {
    expect(openStatus(20 * 60, [{ open: '18:00', close: '24:00' }])).toBe('Open until midnight');
  });
});
