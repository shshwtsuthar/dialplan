import { ApiError, HealthResponse, RouteResponse } from '@dialplan/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { body, httpEvent, MemoryStore } from '../testing';
import { createHandler } from './route';

const MAIN_LINE = '+16195550100';
const tuesday7pm = { did: MAIN_LINE, caller: '+17605550123', timestamp: '2026-11-24T19:00:00-08:00' };

let handler: ReturnType<typeof createHandler>;
beforeEach(() => {
  handler = createHandler(MemoryStore.seeded());
});

const route = (payload: unknown, query?: Record<string, string>) =>
  handler(httpEvent('POST /v1/route', { body: payload, query }));

describe('GET /v1/health', () => {
  it('reports health', async () => {
    const res = await handler(httpEvent('GET /v1/health'));
    expect(res.statusCode).toBe(200);
    expect(HealthResponse.safeParse(body(res)).success).toBe(true);
  });
});

describe('POST /v1/route', () => {
  it('answers with the decision, matched rule, local time and timings', async () => {
    const res = await route(tuesday7pm);
    expect(res.statusCode).toBe(200);
    const decision = RouteResponse.parse(body(res));
    expect(decision).toMatchObject({
      decision: { kind: 'external', label: 'Answering service' },
      matchedRule: 'afterHours',
      localTime: '2026-11-24T19:00:00.000-08:00',
      timezone: 'America/Los_Angeles',
      dialplanVersion: 1,
      coldStart: true,
    });
    expect(decision.serverMs).toBeGreaterThanOrEqual(0);
    expect(decision.trace).toBeUndefined();
    expect(res.headers?.['server-timing']).toMatch(/^db;dur=[\d.]+, engine;dur=[\d.]+, total;dur=[\d.]+$/);
  });

  it('reports a cold start only on the first call', async () => {
    await route(tuesday7pm);
    expect(RouteResponse.parse(body(await route(tuesday7pm))).coldStart).toBe(false);
  });

  it('adds the trace when asked to explain', async () => {
    const decision = RouteResponse.parse(body(await route(tuesday7pm, { explain: 'true' })));
    expect(decision.trace?.map((s) => s.stage)).toEqual(['clock', 'vip', 'holidays', 'hours', 'afterHours']);
  });

  it('returns 404 for a number it does not route', async () => {
    const res = await route({ ...tuesday7pm, did: '+16195550111' });
    expect(res.statusCode).toBe(404);
    expect(ApiError.parse(body(res)).error).toBe('unknown_number');
  });

  it('returns 400 with every problem for an invalid request', async () => {
    const res = await route({ did: '619-555-0100', caller: '+17605550123', timestamp: 'tuesday' });
    expect(res.statusCode).toBe(400);
    const error = ApiError.parse(body(res));
    expect(error.issues?.map((i) => i.path)).toEqual(['did', 'timestamp']);
  });

  it('returns 400 for a body that is not JSON', async () => {
    const res = await route('{nope');
    expect(res.statusCode).toBe(400);
    expect(ApiError.parse(body(res)).error).toBe('invalid_json');
  });

  it('turns unexpected failures into a 500 without leaking details', async () => {
    const failing = createHandler({ getDialplan: () => Promise.reject(new Error('boom')) });
    const res = await failing(httpEvent('POST /v1/route', { body: tuesday7pm }));
    expect(res.statusCode).toBe(500);
    expect(body(res)).toEqual({ error: 'internal', message: 'Something went wrong' });
  });
});

it('returns 404 for routes it does not serve', async () => {
  expect((await handler(httpEvent('GET /nope'))).statusCode).toBe(404);
});
