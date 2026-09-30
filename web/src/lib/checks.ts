import { ease } from './globe';

// After landing, the call runs down the dialplan's rules at the business: it
// moves to each rule it is checked against, pauses there, then moves on to
// the matched rule's destination. The globe draws this, and the Dialplan
// column marks each rule as the call reaches it.

/** Milliseconds for each move and pause, and the hold on the destination before the result shows. */
export const CHECK = { move: 350, pause: 150, hold: 400 } as const;

/** How far along each hop the call is, `elapsed` ms after landing: one hop per rule it is checked against, then one to the destination. */
export function hopProgress(hops: number, elapsed: number): number[] {
  return Array.from({ length: hops }, (_, i) =>
    ease(Math.min(1, Math.max(0, (elapsed - i * (CHECK.move + CHECK.pause)) / CHECK.move))),
  );
}

/** When the rule checks are over, in ms after landing. */
export function checksDuration(hops: number): number {
  return hops === 0 ? 0 : (hops - 1) * (CHECK.move + CHECK.pause) + CHECK.move + CHECK.hold;
}

export interface StopProgress {
  /** How many rules the call has reached. */
  done: number;
  /** Whether it is on its way to the next rule. */
  moving: boolean;
}

/** Where the call is among the `stops` rules, from its hop progress; the hop after them runs to the destination. */
export function stopProgress(hops: number[], stops: number): StopProgress {
  const rules = hops.slice(0, stops);
  return {
    done: rules.filter((p) => p >= 1).length,
    moving: rules.some((p) => p > 0 && p < 1),
  };
}
