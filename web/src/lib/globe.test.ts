import { geoDistance, geoOrthographic } from 'd3-geo';
import { describe, expect, it } from 'vitest';
import {
  arc,
  arrival,
  frameAt,
  landing,
  MAX_LIFT,
  overview,
  projector,
  returnAt,
  sampleSphere,
  TIMING,
  type Flight,
  type View,
} from './globe';
import { placeOf, SAN_DIEGO, type LonLat } from './places';

const W = 400;
const H = 400;
const NEW_YORK = placeOf('+12125550123')!.coordinates;
const SEATTLE = placeOf('+12065550188')!.coordinates;
const CHICAGO = placeOf('+13125550142')!.coordinates;
const LONDON = placeOf('+442079460123')!.coordinates;
const HOME = SAN_DIEGO.coordinates;

function expectView(actual: View, expected: View) {
  expect(geoDistance(actual.center, expected.center)).toBeLessThan(1e-6);
  expect(actual.zoom).toBeCloseTo(expected.zoom, 6);
}

describe('projector', () => {
  const view: View = { center: [-100, 35], zoom: 1.5 };
  const project = projector(view, W, H);

  it('puts the centre of the view in the middle', () => {
    const [x, y] = project.point(view.center)!;
    expect(x).toBeCloseTo(W / 2, 6);
    expect(y).toBeCloseTo(H / 2, 6);
  });

  it("agrees with d3's orthographic projection", () => {
    const d3 = geoOrthographic()
      .rotate([-view.center[0], -view.center[1]])
      .scale(project.radius)
      .translate([W / 2, H / 2]);
    for (const p of [HOME, NEW_YORK, SEATTLE, CHICAGO, [-60, -10], [-150, 60]] as LonLat[]) {
      const [x, y] = project.point(p)!;
      const [dx, dy] = d3(p)!;
      expect(x).toBeCloseTo(dx, 6);
      expect(y).toBeCloseTo(dy, 6);
    }
  });

  it('hides the far side of the globe', () => {
    expect(project.point([80, -35])).toBeUndefined();
    expect(project.point([-100, -60])).toBeUndefined();
  });

  it('shows a lifted point once it clears the edge of the globe', () => {
    const behind: LonLat = [-100, -58];
    expect(project.point(behind)).toBeUndefined();
    const [x, y] = project.point(behind, 0.3)!;
    expect(Math.hypot(x - W / 2, y - H / 2)).toBeGreaterThan(project.radius);
  });

  it('projects dots the same way as points, skipping hidden ones', () => {
    const points: LonLat[] = [HOME, [80, -35], LONDON, NEW_YORK];
    const xyz = new Float32Array(points.flatMap(toVector));
    const out = new Float32Array(points.length * 2);
    const visible = points.map((p) => project.point(p)).filter((p) => p !== undefined);

    expect(project.dots(xyz, out)).toBe(visible.length);
    visible.forEach(([x, y], i) => {
      expect(out[i * 2]).toBeCloseTo(x, 3);
      expect(out[i * 2 + 1]).toBeCloseTo(y, 3);
    });
  });

  it('scales the globe with the zoom', () => {
    expect(projector({ center: HOME, zoom: 2 }, W, H).radius).toBeCloseTo(2 * projector({ center: HOME, zoom: 1 }, W, H).radius);
  });
});

describe('arc', () => {
  it('starts and ends on the surface at each end', () => {
    const path = arc(NEW_YORK, HOME);
    expect(geoDistance(path(0).coordinates, NEW_YORK)).toBeLessThan(1e-6);
    expect(geoDistance(path(1).coordinates, HOME)).toBeLessThan(1e-6);
    expect(path(0).altitude).toBeCloseTo(0, 6);
    expect(path(1).altitude).toBeCloseTo(0, 6);
  });

  it('rises highest halfway, and higher for longer calls', () => {
    const near = arc(SEATTLE, HOME);
    const far = arc(LONDON, HOME);
    expect(near(0.5).altitude).toBeGreaterThan(near(0.25).altitude);
    expect(far(0.5).altitude).toBeGreaterThan(near(0.5).altitude);
    expect(far(0.5).altitude).toBeLessThanOrEqual(MAX_LIFT);
  });
});

describe('overview', () => {
  it('centres on the business when there is no path to show', () => {
    expectView(overview(undefined, HOME), { center: HOME, zoom: 1 });
    expectView(overview(HOME, HOME), { center: HOME, zoom: 1 });
  });

  it.each([
    ['New York', NEW_YORK],
    ['Seattle', SEATTLE],
    ['Chicago', CHICAGO],
    ['London', LONDON],
  ])('keeps both ends of a call from %s on screen', (_, from) => {
    const project = projector(overview(from, HOME), W, H);
    for (const p of [from, HOME]) {
      const [x, y] = project.point(p)!;
      expect(x).toBeGreaterThan(20);
      expect(x).toBeLessThan(W - 20);
      expect(y).toBeGreaterThan(20);
      expect(y).toBeLessThan(H - 20);
    }
  });

  it('zooms in on short calls', () => {
    expect(overview(SEATTLE, HOME).zoom).toBeGreaterThan(overview(LONDON, HOME).zoom);
    expect(overview(LONDON, HOME).zoom).toBe(1);
  });
});

describe('landing', () => {
  it.each([
    [400, 400],
    [348, 400],
  ])('puts the business up and to the left on a %ix%i stage, leaving room for the rules below it', (width, height) => {
    const [x, y] = projector(landing(HOME), width, height).point(HOME)!;
    expect(x).toBeGreaterThan(width * 0.2);
    expect(x).toBeLessThan(width * 0.4);
    expect(y).toBeGreaterThan(height * 0.15);
    expect(y).toBeLessThan(height * 0.35);
  });
});

describe('frameAt', () => {
  const start: View = { center: [0, 0], zoom: 1 };
  const flight: Flight = { from: NEW_YORK, to: HOME, start };

  it('starts from the current view', () => {
    const frame = frameAt(flight, 0);
    expectView(frame.view, start);
    expect(frame.progress).toBe(0);
  });

  it('turns to the overview, then draws the path', () => {
    expectView(frameAt(flight, TIMING.turn).view, overview(NEW_YORK, HOME));
    expect(frameAt(flight, TIMING.turn).progress).toBe(0);
    expect(frameAt(flight, TIMING.turn + TIMING.fly / 2).progress).toBeCloseTo(0.5, 6);
    expect(frameAt(flight, arrival(flight)).progress).toBe(1);
  });

  it('waits over the overview until landing starts', () => {
    const frame = frameAt(flight, arrival(flight) + 5000);
    expectView(frame.view, overview(NEW_YORK, HOME));
    expect(frame.progress).toBe(1);
    expect(frame.landed).toBe(false);
  });

  it('lands on the business', () => {
    const since = arrival(flight) + 300;
    expect(frameAt(flight, since + TIMING.land / 2, since).landed).toBe(false);
    const frame = frameAt(flight, since + TIMING.land, since);
    expectView(frame.view, landing(HOME));
    expect(frame.landed).toBe(true);
  });

  it('skips the path when the caller has no known place', () => {
    const local: Flight = { from: undefined, to: HOME, start };
    expect(arrival(local)).toBe(TIMING.turn);
    expectView(frameAt(local, TIMING.turn).view, overview(undefined, HOME));
  });
});

describe('returnAt', () => {
  it('comes back to the landing view from wherever the view was', () => {
    const dragged: View = { center: [-60, 10], zoom: 1.5 };
    expectView(returnAt(dragged, HOME, 0).view, dragged);
    expect(returnAt(dragged, HOME, TIMING.land / 2).landed).toBe(false);
    const back = returnAt(dragged, HOME, TIMING.land);
    expectView(back.view, landing(HOME));
    expect(back.landed).toBe(true);
  });
});

describe('sampleSphere', () => {
  it('spreads points evenly over the whole sphere', () => {
    const step = 2;
    const xyz = sampleSphere(step, () => true);
    const expected = (4 * Math.PI) / ((step * Math.PI) / 180) ** 2;
    expect(xyz.length / 3).toBeGreaterThan(expected * 0.95);
    expect(xyz.length / 3).toBeLessThan(expected * 1.05);
    for (let i = 0; i < xyz.length; i += 3) {
      expect(Math.hypot(xyz[i]!, xyz[i + 1]!, xyz[i + 2]!)).toBeCloseTo(1, 5);
    }
  });

  it('keeps only the points on land', () => {
    const xyz = sampleSphere(2, (_, lat) => lat > 0);
    expect(xyz.length).toBeGreaterThan(0);
    for (let i = 2; i < xyz.length; i += 3) expect(xyz[i]).toBeGreaterThan(0);
  });
});

function toVector([lon, lat]: LonLat): number[] {
  const λ = (lon * Math.PI) / 180;
  const φ = (lat * Math.PI) / 180;
  return [Math.cos(φ) * Math.cos(λ), Math.cos(φ) * Math.sin(λ), Math.sin(φ)];
}
