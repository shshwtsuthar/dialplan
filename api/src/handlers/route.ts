import type { HealthResponse } from '@dialplan/shared';
import { json, type HttpEvent, type HttpResult } from '../http';

export async function handler(event: HttpEvent): Promise<HttpResult> {
  switch (event.routeKey) {
    case 'GET /v1/health':
      return json(200, {
        status: 'ok',
        region: process.env.AWS_REGION ?? 'unknown',
        time: new Date().toISOString(),
      } satisfies HealthResponse);
    default:
      return json(404, { error: 'not_found' });
  }
}
