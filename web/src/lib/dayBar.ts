// Layout for the 24-hour bar under the clock: night, today's opening hours, and now.

import { minutesOfDay, type OpenInterval } from '@dialplan/shared';

const SUNRISE = 6 * 60;
const SUNSET = 18 * 60;
const DAY = 24 * 60;

/** A stretch of the bar, in percent of the day. */
export interface Span {
  start: number;
  end: number;
}

export function dayPercent(minutes: number): number {
  return (minutes / DAY) * 100;
}

export function dayBar(intervals: OpenInterval[]): { night: Span[]; open: Span[] } {
  const span = (from: number, to: number): Span => ({ start: dayPercent(from), end: dayPercent(to) });
  return {
    night: [span(0, SUNRISE), span(SUNSET, DAY)],
    open: intervals.map((i) => span(minutesOfDay(i.open), minutesOfDay(i.close))),
  };
}

/** "Open until 18:00", "Opens at 09:00", or why the rest of the day is closed. */
export function openStatus(minutes: number, intervals: OpenInterval[]): string {
  if (intervals.length === 0) return 'Closed today';
  const sorted = [...intervals].sort((a, b) => minutesOfDay(a.open) - minutesOfDay(b.open));
  const current = sorted.find((i) => minutesOfDay(i.open) <= minutes && minutes < minutesOfDay(i.close));
  if (current) return `Open until ${current.close === '24:00' ? 'midnight' : current.close}`;
  const next = sorted.find((i) => minutesOfDay(i.open) > minutes);
  return next ? `Opens at ${next.open}` : 'Closed for the rest of today';
}
