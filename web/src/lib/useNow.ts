import { useSyncExternalStore } from 'react';

// Real (not simulated) time, refreshed every 30 seconds, for "5 min ago" labels.
let now = 0;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(listener: () => void) {
  listeners.add(listener);
  timer ??= setInterval(() => {
    now = Date.now();
    listeners.forEach((l) => l());
  }, 30_000);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

function getSnapshot() {
  if (now === 0) now = Date.now();
  return now;
}

export function useNow(): number | undefined {
  return useSyncExternalStore(subscribe, getSnapshot, () => undefined);
}

/** Call after something changes that should read as "just now" immediately. */
export function refreshNow() {
  now = Date.now();
  listeners.forEach((l) => l());
}
