import { geoEquirectangular, geoGraticule, geoOrthographic, geoPath, type GeoPermissibleObjects } from 'd3-geo';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { arc, projector, sampleSphere, type View } from '@/lib/globe';
import type { Outcome } from '@/lib/callPath';
import type { LonLat } from '@/lib/places';

export interface Land {
  outline: GeoPermissibleObjects;
  /** Unit vectors for the dots on land, as x, y, z triples. */
  dots: Float32Array;
}

/** The rules a call was checked against at the business, hanging below its marker. */
export interface Checks {
  stops: { label: string; outcome: Exclude<Outcome, 'not_reached'> }[];
  /** Where the matched rule sends the call. */
  destination: string | undefined;
}

export interface Scene {
  view: View;
  path?: { from: LonLat; to: LonLat; progress: number };
  markers: { at: LonLat; label: string; tone: 'foreground' | 'success' }[];
  /** Progress along each hop, 0 to 1: one per stop, then one to the destination. */
  checks?: Checks & { at: LonLat; hops: number[] };
}

/** Degrees between land dots. */
const DOT_SPACING = 1.4;
const PATH_SAMPLES = 96;
/** Distance between rule stops below the business. */
const ROW = 34;
const GRATICULE = geoGraticule().step([15, 15])();

let land: Promise<Land> | undefined;

/** Natural Earth's land at 1:110m, loaded once and shared by every globe on the page. */
export function loadLand(): Promise<Land> {
  land ??= import('world-atlas/land-110m.json').then(({ default: json }) => {
    const topology = json as unknown as Topology<{ land: GeometryCollection }>;
    const outline = feature(topology, topology.objects.land);
    return { outline, dots: sampleSphere(DOT_SPACING, rasterize(outline)) };
  });
  return land;
}

/** Paints the land onto a small world map once, so testing a dot is one pixel lookup. */
function rasterize(outline: GeoPermissibleObjects): (lon: number, lat: number) => boolean {
  const width = 720;
  const height = 360;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const projection = geoEquirectangular()
    .scale(width / (2 * Math.PI))
    .translate([width / 2, height / 2]);
  ctx.beginPath();
  geoPath(projection, ctx)(outline);
  ctx.fill();
  const alpha = ctx.getImageData(0, 0, width, height).data;
  return (lon, lat) => {
    const x = Math.min(width - 1, Math.floor(((lon + 180) / 360) * width));
    const y = Math.min(height - 1, Math.floor(((90 - lat) / 180) * height));
    return alpha[(y * width + x) * 4 + 3]! > 127;
  };
}

/** Screen positions of the visible dots, reused between frames. */
let scratch = new Float32Array(0);

export function drawGlobe(canvas: HTMLCanvasElement, scene: Scene, land: Land | undefined) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (width === 0 || height === 0) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  // Theme tokens, read every frame so the globe follows the light and dark crossfade.
  const style = getComputedStyle(canvas);
  const token = (name: string) => style.getPropertyValue(name).trim();
  const colors = {
    surface: token('--surface'),
    foreground: token('--foreground'),
    muted: token('--muted-foreground'),
    border: token('--border'),
    success: token('--success'),
    successSurface: token('--success-surface'),
    successBorder: token('--success-border'),
  };

  const project = projector(scene.view, width, height);
  const [lon, lat] = scene.view.center;
  const outline = geoPath(
    geoOrthographic()
      .rotate([-lon, -lat])
      .scale(project.radius)
      .translate([width / 2, height / 2])
      .clipExtent([
        [0, 0],
        [width, height],
      ]),
    ctx,
  );

  ctx.lineWidth = 1;
  ctx.strokeStyle = colors.border;
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, project.radius, 0, 2 * Math.PI);
  outline(GRATICULE);
  ctx.stroke();

  if (land) {
    if (scratch.length < (land.dots.length / 3) * 2) scratch = new Float32Array((land.dots.length / 3) * 2);
    const count = project.dots(land.dots, scratch);
    const size = Math.min(2.4, 1.3 * Math.sqrt(scene.view.zoom));
    ctx.fillStyle = colors.muted;
    for (let i = 0; i < count; i++) ctx.fillRect(scratch[i * 2]! - size / 2, scratch[i * 2 + 1]! - size / 2, size, size);

    ctx.strokeStyle = colors.muted;
    ctx.beginPath();
    outline(land.outline);
    ctx.stroke();
  }

  if (scene.path && scene.path.progress > 0) drawPath(ctx, project, scene.path, colors.foreground);

  ctx.textBaseline = 'middle';
  if (scene.checks) {
    const anchor = project.point(scene.checks.at);
    if (anchor) drawChecks(ctx, anchor, scene.checks, colors, style.fontFamily);
  }

  ctx.font = `500 12px ${style.fontFamily}`;
  for (const marker of scene.markers) {
    const point = project.point(marker.at);
    if (!point) continue;
    const [x, y] = point;
    ctx.fillStyle = marker.tone === 'success' ? colors.success : colors.foreground;
    ctx.fillRect(x - 3, y - 3, 6, 6);
    // The label sits on a surface-coloured plate so the dots behind it don't cross the text.
    const textWidth = ctx.measureText(marker.label).width;
    ctx.fillStyle = colors.surface;
    ctx.fillRect(x + 7, y - 9, textWidth + 8, 18);
    ctx.fillStyle = colors.foreground;
    ctx.fillText(marker.label, x + 11, y + 0.5);
  }
}

function drawPath(
  ctx: CanvasRenderingContext2D,
  project: ReturnType<typeof projector>,
  path: NonNullable<Scene['path']>,
  color: string,
) {
  const along = arc(path.from, path.to);
  const steps = Math.max(1, Math.ceil(PATH_SAMPLES * path.progress));
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  let drawing = false;
  let head: [number, number] | undefined;
  for (let i = 0; i <= steps; i++) {
    const { coordinates, altitude } = along((i / steps) * path.progress);
    head = project.point(coordinates, altitude);
    if (!head) {
      drawing = false;
      continue;
    }
    if (drawing) ctx.lineTo(...head);
    else ctx.moveTo(...head);
    drawing = true;
  }
  ctx.stroke();
  // A small square leads the path while it is still travelling.
  if (head && path.progress < 1) {
    ctx.fillStyle = color;
    ctx.fillRect(head[0] - 2.5, head[1] - 2.5, 5, 5);
  }
}

type Colors = Record<'surface' | 'foreground' | 'muted' | 'border' | 'success' | 'successSurface' | 'successBorder', string>;

/**
 * The call's walk down the rules: a stop for each rule it was checked
 * against, marked as it arrives, then a turn into the matched rule's
 * destination. Only the path taken is drawn.
 */
function drawChecks(
  ctx: CanvasRenderingContext2D,
  [x, top]: [number, number],
  checks: NonNullable<Scene['checks']>,
  colors: Colors,
  font: string,
) {
  // The call itself: a small square at the front of the path, as on its flight.
  const lead = (lx: number, ly: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(lx - 2.5, ly - 2.5, 5, 5);
  };
  ctx.lineWidth = 1.5;
  let from = top + 4;

  for (const [i, stop] of checks.stops.entries()) {
    const progress = checks.hops[i] ?? 0;
    if (progress === 0) return;
    const y = top + (i + 1) * ROW;
    const reach = from + (y - 3 - from) * progress;
    ctx.strokeStyle = colors.foreground;
    ctx.beginPath();
    ctx.moveTo(x, from);
    ctx.lineTo(x, reach);
    ctx.stroke();
    if (progress < 1) {
      lead(x, reach, colors.foreground);
      return;
    }

    const matched = stop.outcome === 'matched';
    ctx.fillStyle = matched ? colors.success : colors.foreground;
    ctx.fillRect(x - 3, y - 3, 6, 6);
    ctx.font = `500 12px ${font}`;
    const plate = plateAt(ctx, x + 10, y, 20, stop.label, 22);
    ctx.fillStyle = colors.surface;
    ctx.fillRect(plate.x, plate.y, plate.width, plate.height);
    ctx.lineWidth = 1;
    ctx.strokeStyle = colors.border;
    ctx.strokeRect(plate.x + 0.5, plate.y + 0.5, plate.width - 1, plate.height - 1);
    ctx.fillStyle = colors.foreground;
    ctx.fillText(stop.label, plate.x + 6, y + 0.5);
    drawOutcome(ctx, plate.x + plate.width - 14, y, stop.outcome, matched ? colors.success : colors.muted);
    ctx.lineWidth = 1.5;
    from = y + 4;
  }

  const progress = checks.hops[checks.stops.length] ?? 0;
  if (!checks.destination || progress === 0) return;
  // Down from the matched rule, then across into its destination.
  const y = from - 4 + ROW;
  const down = y - from;
  const across = 14;
  const reach = (down + across) * progress;
  ctx.strokeStyle = colors.success;
  ctx.beginPath();
  ctx.moveTo(x, from);
  ctx.lineTo(x, from + Math.min(reach, down));
  if (reach > down) ctx.lineTo(x + reach - down, y);
  ctx.stroke();
  if (progress < 1) {
    if (reach > down) lead(x + reach - down, y, colors.success);
    else lead(x, from + reach, colors.success);
    return;
  }

  ctx.fillStyle = colors.success;
  ctx.beginPath();
  ctx.moveTo(x + across - 5, y - 3.5);
  ctx.lineTo(x + across, y);
  ctx.lineTo(x + across - 5, y + 3.5);
  ctx.fill();
  ctx.font = `500 13px ${font}`;
  const plate = plateAt(ctx, x + across + 1, y, 24, checks.destination, 0);
  ctx.fillStyle = colors.successSurface;
  ctx.fillRect(plate.x, plate.y, plate.width, plate.height);
  ctx.lineWidth = 1;
  ctx.strokeStyle = colors.successBorder;
  ctx.strokeRect(plate.x + 0.5, plate.y + 0.5, plate.width - 1, plate.height - 1);
  ctx.fillStyle = colors.foreground;
  ctx.fillText(checks.destination, plate.x + 7, y + 0.5);
}

/** A label's plate, on whole pixels so its border stays crisp; `extra` leaves room after the text. */
function plateAt(ctx: CanvasRenderingContext2D, left: number, middle: number, height: number, text: string, extra: number) {
  const width = Math.ceil(ctx.measureText(text).width) + 14 + extra;
  return { x: Math.round(left), y: Math.round(middle - height / 2), width, height };
}

/** A tick for the match, a cross for no match, a dash for a rule that is off. */
function drawOutcome(ctx: CanvasRenderingContext2D, x: number, y: number, outcome: Exclude<Outcome, 'not_reached'>, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (outcome === 'matched') {
    ctx.moveTo(x - 4, y);
    ctx.lineTo(x - 1, y + 3);
    ctx.lineTo(x + 4, y - 3);
  } else if (outcome === 'no_match') {
    ctx.moveTo(x - 3.5, y - 3.5);
    ctx.lineTo(x + 3.5, y + 3.5);
    ctx.moveTo(x + 3.5, y - 3.5);
    ctx.lineTo(x - 3.5, y + 3.5);
  } else {
    ctx.moveTo(x - 3.5, y);
    ctx.lineTo(x + 3.5, y);
  }
  ctx.stroke();
}
