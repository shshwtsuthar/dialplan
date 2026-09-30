import { DateTime } from 'luxon';
import { useSyncExternalStore } from 'react';

/** Twelve simulated hours pass in three real minutes: a 3-minute day, then a 3-minute night. */
export const SPEED = (12 * 60) / 3;

interface ClockState {
  anchorSim: number;
  anchorReal: number;
  running: boolean;
}

export interface ClockSnapshot {
  /** Simulated time, epoch milliseconds. */
  now: number;
  running: boolean;
}

export function simTime(state: ClockState, realNow: number): number {
  return state.running ? state.anchorSim + (realNow - state.anchorReal) * SPEED : state.anchorSim;
}

/**
 * A sped-up clock shared by the whole page, as an external store: it starts
 * at the real time on first read in the browser and never renders on the
 * server, so the static export has no hydration mismatch.
 */
export function createSimClock(realNow: () => number = Date.now, tickMs = 250) {
  let state: ClockState | undefined;
  let snapshot: ClockSnapshot | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  const listeners = new Set<() => void>();

  const current = (): ClockState => (state ??= { anchorSim: realNow(), anchorReal: realNow(), running: true });
  const publish = () => {
    const s = current();
    snapshot = { now: simTime(s, realNow()), running: s.running };
    listeners.forEach((listener) => listener());
  };

  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      timer ??= setInterval(() => current().running && publish(), tickMs);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          clearInterval(timer);
          timer = undefined;
        }
      };
    },
    getSnapshot: (): ClockSnapshot => {
      if (!snapshot) {
        const s = current();
        snapshot = { now: simTime(s, realNow()), running: s.running };
      }
      return snapshot;
    },
    /** Exact simulated time right now, between ticks. */
    now: () => simTime(current(), realNow()),
    set: (sim: number) => {
      state = { ...current(), anchorSim: sim, anchorReal: realNow() };
      publish();
    },
    toggle: () => {
      const s = current();
      const real = realNow();
      state = { anchorSim: simTime(s, real), anchorReal: real, running: !s.running };
      publish();
    },
  };
}

export const simClock = createSimClock();

export function useSimClock(): ClockSnapshot | undefined {
  return useSyncExternalStore(simClock.subscribe, simClock.getSnapshot, () => undefined);
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

/** The next time it is `hour`:00 on `weekday` (Luxon: Monday = 1), from `from` onwards. */
export function nextWeekdayAt(from: DateTime, weekday: number, hour: number): DateTime {
  let candidate = from.set({ hour, minute: 0, second: 0, millisecond: 0 });
  candidate = candidate.plus({ days: (weekday - candidate.weekday + 7) % 7 });
  return candidate < from ? candidate.plus({ weeks: 1 }) : candidate;
}

/** US Thanksgiving: the fourth Thursday of November, at `hour`:00. */
export function thanksgiving(year: number, zone: string, hour = 11): DateTime {
  const first = DateTime.fromObject({ year, month: 11, day: 1, hour }, { zone });
  const firstThursday = first.plus({ days: (4 - first.weekday + 7) % 7 });
  return firstThursday.plus({ weeks: 3 });
}

/** This year's Thanksgiving, or next year's once this year's has passed. */
export function upcomingThanksgiving(from: DateTime, hour = 11): DateTime {
  const thisYear = thanksgiving(from.year, from.zoneName ?? 'UTC', hour);
  return from.startOf('day') > thisYear.startOf('day') ? thanksgiving(from.year + 1, from.zoneName ?? 'UTC', hour) : thisYear;
}
