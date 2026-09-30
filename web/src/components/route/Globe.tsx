'use client';

import { useEffect, useRef, type PointerEvent } from 'react';
import { checksDuration, hopProgress, stopProgress, type StopProgress } from '@/lib/checks';
import {
  arrival,
  frameAt,
  hasPath,
  landing,
  overview,
  projector,
  returnAt,
  TIMING,
  type Flight,
} from '@/lib/globe';
import type { LonLat, Place } from '@/lib/places';
import type { Replay } from '@/lib/replay';
import { drawGlobe, loadLand, type Checks, type Land, type Scene } from './globeCanvas';

export interface GlobeCall {
  id: number;
  from: Place | undefined;
  replay: Replay;
  answered: boolean;
  failed: boolean;
  /** The rules the call was checked against, once the API has answered. */
  checks: Checks | undefined;
}

interface Props {
  home: Place;
  /** The call to show; without one, the globe rests on the business. */
  call: GlobeCall | undefined;
  /** Replay the call; otherwise show where it ended up. */
  play: boolean;
  onLanded: () => void;
  /** Where the call is among the rules, whenever that changes. */
  onCheck: (progress: StopProgress) => void;
  onFinished: () => void;
  label: string;
}

/** Keep redrawing this long after the theme flips, while the colour tokens crossfade. */
const THEME_FADE_MS = 1600;
/** While the API is still answering, the business blinks at this interval. */
const BLINK_MS = 400;

/**
 * A dotted globe on a canvas. A call flies in from the caller, lands on the
 * business, and runs down the dialplan's rules there. It draws only when
 * something changes: a call, a drag, a resize or a theme change, and never
 * while off-screen.
 */
export default function Globe({ home, call, play, onLanded, onCheck, onFinished, label }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scene = useRef<Scene>({ view: { center: home.coordinates, zoom: 1 }, markers: [] });
  const paint = useRef({ now: () => {}, soon: () => {} });
  const playing = useRef(false);
  const drag = useRef<{ x: number; y: number; center: LonLat }>(undefined);
  const latest = useRef({ answered: false, failed: false, checks: undefined as Checks | undefined, onLanded, onCheck, onFinished });

  useEffect(() => {
    latest.current = {
      answered: call?.answered ?? false,
      failed: call?.failed ?? false,
      checks: call?.checks,
      onLanded,
      onCheck,
      onFinished,
    };
  });

  useEffect(() => {
    const canvas = canvasRef.current!;
    let land: Land | undefined;
    let visible = true;
    let frame = 0;
    let fadeFrame = 0;
    let fadeUntil = 0;
    let disposed = false;

    const now = () => {
      if (visible) drawGlobe(canvas, scene.current, land);
    };
    const soon = () => {
      frame ||= requestAnimationFrame(() => {
        frame = 0;
        now();
      });
    };
    paint.current = { now, soon };

    void loadLand().then((loaded) => {
      if (disposed) return;
      land = loaded;
      soon();
    });

    const resize = new ResizeObserver(now);
    resize.observe(canvas);
    const onScreen = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
      if (visible) soon();
    });
    onScreen.observe(canvas);
    const fade = () => {
      if (!playing.current) now();
      fadeFrame = performance.now() < fadeUntil ? requestAnimationFrame(fade) : 0;
    };
    const theme = new MutationObserver(() => {
      fadeUntil = performance.now() + THEME_FADE_MS;
      fadeFrame ||= requestAnimationFrame(fade);
    });
    theme.observe(document.documentElement, { attributeFilter: ['data-theme'] });

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      cancelAnimationFrame(fadeFrame);
      resize.disconnect();
      onScreen.disconnect();
      theme.disconnect();
    };
  }, []);

  const id = call?.id;
  const from = call?.from;
  const replay = call?.replay;
  // A still globe redraws when the answer comes in; a replay reads it as it goes.
  const answeredStill = !play && (call?.answered ?? false);
  const checksStill = play ? undefined : call?.checks;

  useEffect(() => {
    const to = home.coordinates;
    const origin = hasPath(from?.coordinates, to) ? from : undefined;
    const markers = (tone: 'foreground' | 'success', showHome = true): Scene['markers'] => [
      ...(origin ? [{ at: origin.coordinates, label: origin.city, tone: 'foreground' as const }] : []),
      ...(showHome ? [{ at: to, label: home.city, tone }] : []),
    ];
    const hopCount = (checks: Checks) => checks.stops.length + (checks.destination ? 1 : 0);

    if (id === undefined) {
      scene.current = { view: { center: to, zoom: 1 }, markers: markers('foreground') };
      paint.current.soon();
      return;
    }

    if (!play) {
      scene.current = {
        view: checksStill ? landing(to) : overview(origin?.coordinates, to),
        path: origin && { from: origin.coordinates, to, progress: 1 },
        markers: markers(answeredStill ? 'success' : 'foreground'),
        checks: checksStill && { ...checksStill, at: to, hops: Array<number>(hopCount(checksStill)).fill(1) },
      };
      paint.current.soon();
      return;
    }

    const flight: Flight = { from: origin?.coordinates, to, start: scene.current.view };
    const arrives = replay === 'full' ? arrival(flight) : TIMING.land;
    const started = performance.now();
    let landingSince: number | undefined;
    let landedAt: number | undefined;
    let reported = '';
    let frame = 0;
    playing.current = true;

    const tick = (time: number) => {
      const elapsed = time - started;
      const { answered, failed, checks } = latest.current;
      // A failed call stops where it was; the error shows below the globe.
      if (failed) {
        playing.current = false;
        return;
      }

      let view;
      let progress = 1;
      let landed;
      if (replay === 'full') {
        if (landingSince === undefined && answered && elapsed >= arrives) landingSince = elapsed;
        ({ view, progress, landed } = frameAt(flight, elapsed, landingSince));
      } else {
        const back = returnAt(flight.start, to, elapsed);
        view = back.view;
        landed = back.landed && answered;
      }
      if (landed && landedAt === undefined) {
        landedAt = elapsed;
        latest.current.onLanded();
      }

      const waiting = !answered && elapsed >= arrives;
      const hops = checks ? hopCount(checks) : 0;
      const along = checks && landedAt !== undefined ? hopProgress(hops, elapsed - landedAt) : undefined;
      scene.current = {
        view,
        path: origin && { from: origin.coordinates, to, progress },
        markers: markers(answered && elapsed >= arrives ? 'success' : 'foreground', !waiting || Math.floor(elapsed / BLINK_MS) % 2 === 0),
        checks: checks && along && { ...checks, at: to, hops: along },
      };
      paint.current.now();

      if (checks && along) {
        const stops = stopProgress(along, checks.stops.length);
        const key = `${stops.done}${stops.moving}`;
        if (key !== reported) {
          reported = key;
          latest.current.onCheck(stops);
        }
      }

      if (landedAt !== undefined && elapsed - landedAt >= checksDuration(hops)) {
        playing.current = false;
        latest.current.onFinished();
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      playing.current = false;
    };
  }, [id, play, replay, from, home, answeredStill, checksStill]);

  function startDrag(event: PointerEvent<HTMLCanvasElement>) {
    if (playing.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, center: scene.current.view.center };
  }

  function moveDrag(event: PointerEvent<HTMLCanvasElement>) {
    const start = drag.current;
    if (!start) return;
    const { clientWidth, clientHeight } = event.currentTarget;
    const { view } = scene.current;
    // Degrees per pixel at the centre of the globe, so the land follows the pointer.
    const scale = 180 / (Math.PI * projector(view, clientWidth, clientHeight).radius);
    const lat = Math.max(-80, Math.min(80, start.center[1] + (event.clientY - start.y) * scale));
    scene.current = { ...scene.current, view: { ...view, center: [start.center[0] - (event.clientX - start.x) * scale, lat] } };
    paint.current.soon();
  }

  function endDrag() {
    drag.current = undefined;
  }

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={label}
      className="size-full cursor-grab touch-pan-y active:cursor-grabbing"
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    />
  );
}
