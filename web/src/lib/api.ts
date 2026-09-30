import {
  ApiError,
  AuditResponse,
  Dialplan,
  ResetResponse,
  RouteResponse,
  TenantNumbersResponse,
  type RouteRequest,
  type Rules,
} from '@dialplan/shared';
import type { z } from 'zod';
import { config } from './config';

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiError | undefined,
  ) {
    super(body?.message ?? `The API answered ${status}`);
  }
}

async function request<T extends z.ZodType>(schema: T, path: string, init?: RequestInit): Promise<z.infer<T>> {
  const res = await fetch(`${config.apiUrl}${path}`, {
    ...init,
    // Only requests with a body declare one: a GET stays a simple request, with no CORS preflight.
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
  });
  const data: unknown = await res.json().catch(() => undefined);
  if (!res.ok) {
    const error = ApiError.safeParse(data);
    throw new ApiRequestError(res.status, error.success ? error.data : undefined);
  }
  return schema.parse(data);
}

const numberPath = (did: string) => `/v1/numbers/${encodeURIComponent(did)}`;

export type RouteResult = RouteResponse & { roundTripMs: number };

export const api = {
  numbers: (tenantId: string) => request(TenantNumbersResponse, `/v1/tenants/${tenantId}/numbers`),

  dialplan: (did: string) => request(Dialplan, `${numberPath(did)}/rules`),

  saveRules: (did: string, version: number, rules: Rules) =>
    request(Dialplan, `${numberPath(did)}/rules`, { method: 'PUT', body: JSON.stringify({ version, rules }) }),

  audit: (did: string) => request(AuditResponse, `${numberPath(did)}/audit?limit=20`),

  async route(call: RouteRequest): Promise<RouteResult> {
    const started = performance.now();
    const result = await request(RouteResponse, '/v1/route?explain=true', {
      method: 'POST',
      body: JSON.stringify(call),
    });
    return { ...result, roundTripMs: Math.round(performance.now() - started) };
  },

  reset: () => request(ResetResponse, '/v1/demo/reset', { method: 'POST' }),
};
