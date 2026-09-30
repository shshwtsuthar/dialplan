import { geoDistance, geoInterpolate, geoOrthographic } from 'd3-geo';
import type { LonLat } from './places';

// The maths behind the globe: an orthographic projection that matches d3's,
// the lifted path a call travels, and where the camera is at each moment of
// the replay. Drawing lives in the component; everything here is pure.

export interface View {
  center: LonLat;
  zoom: number;
}

/** A call's trip across the globe, starting from wherever the view was. */
export interface Flight {
  from: LonLat | undefined;
  to: LonLat;
  start: View;
}

export interface Frame {
  view: View;
  /** How much of the path is drawn, 0 to 1. */
  progress: number;
  landed: boolean;
}

/** Milliseconds for each part of the flight. */
export const TIMING = { turn: 600, fly: 900, land: 500 } as const;

/** Space between the globe and the edge of the canvas at zoom 1. */
const PADDING = 20;
/** How far a path rises, as a fraction of the globe's radius. */
export const MAX_LIFT = 0.3;
const MAX_ZOOM = 2.5;
const LANDING_ZOOM = 4;
/** Where the business sits after landing, in globe radii right and up from the centre: room for the rules below it. */
const LANDING_OFFSET: [number, number] = [-0.11, 0.14];
/** Calls from closer than this (radians, about 1°) have no path to draw. */
const MIN_DISTANCE = Math.PI / 180;

const RAD = Math.PI / 180;

export interface Projector {
  /** The globe's radius in pixels. */
  radius: number;
  /** Screen position of a point `altitude` radii above the surface, or undefined when the globe hides it. */
  point(p: LonLat, altitude?: number): [number, number] | undefined;
  /** Projects unit vectors (x, y, z triples), writing the visible ones as x, y pairs. Returns how many. */
  dots(xyz: Float32Array, out: Float32Array): number;
}

/** d3's geoOrthographic, rotated to centre on the view and fitted to the canvas, without the per-point overhead. */
export function projector(view: View, width: number, height: number): Projector {
  const radius = (Math.min(width, height) / 2 - PADDING) * view.zoom;
  const cx = width / 2;
  const cy = height / 2;
  const cosL = Math.cos(-view.center[0] * RAD);
  const sinL = Math.sin(-view.center[0] * RAD);
  const cosP = Math.cos(-view.center[1] * RAD);
  const sinP = Math.sin(-view.center[1] * RAD);

  return {
    radius,
    point([lon, lat], altitude = 0) {
      const cosφ = Math.cos(lat * RAD);
      const x = cosφ * Math.cos(lon * RAD);
      const y = cosφ * Math.sin(lon * RAD);
      const z = Math.sin(lat * RAD);
      const x1 = x * cosL - y * sinL;
      const y1 = x * sinL + y * cosL;
      const x2 = x1 * cosP - z * sinP;
      const z2 = z * cosP + x1 * sinP;
      const lift = 1 + altitude;
      // Behind the globe, a point stays visible only if it rises past the globe's edge.
      if (x2 < 0 && lift * lift * (y1 * y1 + z2 * z2) <= 1) return undefined;
      return [cx + radius * lift * y1, cy - radius * lift * z2];
    },
    dots(xyz, out) {
      let count = 0;
      for (let i = 0; i < xyz.length; i += 3) {
        const x = xyz[i]!;
        const y = xyz[i + 1]!;
        const z = xyz[i + 2]!;
        const x1 = x * cosL - y * sinL;
        if (x1 * cosP - z * sinP <= 0) continue;
        out[count * 2] = cx + radius * (x * sinL + y * cosL);
        out[count * 2 + 1] = cy - radius * (z * cosP + x1 * sinP);
        count++;
      }
      return count;
    },
  };
}

/** The great-circle path from one place to another, rising higher for longer calls. */
export function arc(from: LonLat, to: LonLat): (t: number) => { coordinates: LonLat; altitude: number } {
  const along = geoInterpolate(from, to);
  const lift = Math.min(MAX_LIFT, 0.25 * geoDistance(from, to));
  return (t) => ({ coordinates: along(t), altitude: lift * Math.sin(Math.PI * t) });
}

export function hasPath(from: LonLat | undefined, to: LonLat): from is LonLat {
  return from !== undefined && geoDistance(from, to) >= MIN_DISTANCE;
}

/** A view of the whole call: both ends on screen, looked at from a little to the south so the path stands up. */
export function overview(from: LonLat | undefined, to: LonLat): View {
  if (!hasPath(from, to)) return { center: to, zoom: 1 };
  const distance = geoDistance(from, to);
  const [lon, lat] = geoInterpolate(from, to)(0.5);
  const zoom = Math.min(MAX_ZOOM, Math.max(1, 0.6 / Math.sin(distance / 2)));
  return { center: [lon, lat - Math.min(10, distance / RAD / 4)], zoom };
}

/** Close in on the business, where the dialplan takes over, with the business up and to the left. */
export function landing(to: LonLat): View {
  // Seen from the business, the new centre sits opposite the offset the business should have.
  const [dx, dy] = LANDING_OFFSET;
  const fromBusiness = geoOrthographic()
    .rotate([-to[0], -to[1]])
    .scale(1)
    .translate([0, 0]);
  return { center: fromBusiness.invert!([-dx, dy])!, zoom: LANDING_ZOOM };
}

/** When the path reaches the business, in milliseconds from the start of the flight. */
export function arrival(flight: Flight): number {
  return TIMING.turn + (hasPath(flight.from, flight.to) ? TIMING.fly : 0);
}

/**
 * Where the camera is and how much of the path is drawn, `elapsed` ms into
 * the flight. Landing starts at `landingSince`, once the path has arrived
 * and the API has answered; until then the view waits over the whole call.
 */
export function frameAt(flight: Flight, elapsed: number, landingSince?: number): Frame {
  const whole = overview(flight.from, flight.to);
  if (landingSince !== undefined) {
    const t = clamp01((elapsed - landingSince) / TIMING.land);
    return { view: mix(whole, landing(flight.to), ease(t)), progress: 1, landed: t >= 1 };
  }
  if (elapsed < TIMING.turn) {
    return { view: mix(flight.start, whole, ease(elapsed / TIMING.turn)), progress: 0, landed: false };
  }
  const fly = arrival(flight) - TIMING.turn;
  const progress = fly === 0 ? 1 : ease(clamp01((elapsed - TIMING.turn) / fly));
  return { view: whole, progress, landed: false };
}

/** Back to the landing view from wherever the view was, for a call re-routed at the business. */
export function returnAt(start: View, to: LonLat, elapsed: number): { view: View; landed: boolean } {
  const t = clamp01(elapsed / TIMING.land);
  return { view: mix(start, landing(to), ease(t)), landed: t >= 1 };
}

/**
 * Unit vectors (x, y, z triples) for points `step` degrees apart, spread
 * evenly over the sphere rather than bunched at the poles, keeping those
 * `isLand` accepts.
 */
export function sampleSphere(step: number, isLand: (lon: number, lat: number) => boolean): Float32Array {
  const xyz: number[] = [];
  for (let row = 0; row < 180 / step; row++) {
    const lat = -90 + (row + 0.5) * step;
    const count = Math.max(1, Math.round((360 * Math.cos(lat * RAD)) / step));
    for (let i = 0; i < count; i++) {
      const lon = -180 + ((i + 0.5) * 360) / count;
      if (!isLand(lon, lat)) continue;
      xyz.push(Math.cos(lat * RAD) * Math.cos(lon * RAD), Math.cos(lat * RAD) * Math.sin(lon * RAD), Math.sin(lat * RAD));
    }
  }
  return new Float32Array(xyz);
}

function mix(a: View, b: View, t: number): View {
  return { center: geoInterpolate(a.center, b.center)(t), zoom: a.zoom * (b.zoom / a.zoom) ** t };
}

/** Cubic ease in and out, shared by everything that moves in the replay. */
export function ease(t: number): number {
  return t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
}

function clamp01(t: number): number {
  return Math.min(1, Math.max(0, t));
}
