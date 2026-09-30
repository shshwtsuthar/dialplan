// Sky colours for the day/night background, keyed by local hour of day.

type Stop = readonly [hour: number, top: string, bottom: string];

const STOPS: readonly Stop[] = [
  [0, '#070b1f', '#151d3d'],
  [4.75, '#070b1f', '#151d3d'],
  [5.5, '#27285e', '#9c5476'],
  [6.25, '#4f79c7', '#f3a86f'],
  [7.5, '#3f86dc', '#b9dcff'],
  [12, '#2a78e4', '#a7d2ff'],
  [16.5, '#3d82d8', '#c7e2ff'],
  [17.5, '#5566b8', '#f5a46a'],
  [18.25, '#352a64', '#de6b69'],
  [19.25, '#10163a', '#262c5c'],
  [24, '#070b1f', '#151d3d'],
];

export const SUNRISE = 6;
export const SUNSET = 18;

export interface Sky {
  top: string;
  bottom: string;
  /** 0 by day, 1 at night. */
  stars: number;
  /** Position along the sun's arc (0 at sunrise, 1 at sunset), or null at night. */
  sun: number | null;
  isDay: boolean;
}

export function skyAt(hour: number): Sky {
  const h = ((hour % 24) + 24) % 24;
  const index = STOPS.findIndex(([stop]) => stop > h);
  const [h0, top0, bottom0] = STOPS[index - 1]!;
  const [h1, top1, bottom1] = STOPS[index]!;
  const t = (h - h0) / (h1 - h0);

  const isDay = h >= SUNRISE && h < SUNSET;
  return {
    top: mix(top0, top1, t),
    bottom: mix(bottom0, bottom1, t),
    stars: clamp(Math.max(fade(h, 6.5, 5), fade(h, 17.75, 19.5))),
    sun: isDay ? (h - SUNRISE) / (SUNSET - SUNRISE) : null,
    isDay,
  };
}

/** 0 at `from`, 1 at `to` (either direction), clamped outside. */
function fade(h: number, from: number, to: number): number {
  return clamp((h - from) / (to - from));
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function mix(a: string, b: string, t: number): string {
  const ca = rgb(a);
  const cb = rgb(b);
  const channel = (i: number) => Math.round(ca[i]! + (cb[i]! - ca[i]!) * t);
  return `#${[0, 1, 2].map((i) => channel(i).toString(16).padStart(2, '0')).join('')}`;
}

function rgb(hex: string): number[] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}
