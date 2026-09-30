import { HealthResponse } from '@dialplan/shared';
import { describe, expect, it } from 'vitest';
import type { HttpEvent } from '../http';
import { handler } from './route';

const event = (routeKey: string) => ({ routeKey }) as HttpEvent;

describe('route handler', () => {
  it('reports health', async () => {
    const res = await handler(event('GET /v1/health'));
    expect(res.statusCode).toBe(200);
    expect(HealthResponse.safeParse(JSON.parse(res.body ?? '')).success).toBe(true);
  });

  it('returns 404 for unknown routes', async () => {
    const res = await handler(event('GET /nope'));
    expect(res.statusCode).toBe(404);
  });
});
