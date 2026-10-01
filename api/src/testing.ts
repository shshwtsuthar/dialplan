// Test helpers: an in-memory Store and API Gateway event builder.

import type { AuditEntry, Dialplan, NumberSummary, Rules } from '@dialplan/shared';
import type { HttpEvent } from './http';
import { HARBOR_AUTO } from './seed';
import { VersionConflictError, type Store } from './store';

export class MemoryStore implements Store {
  readonly dialplans = new Map<string, Dialplan>();
  readonly audit = new Map<string, AuditEntry[]>();

  static seeded(now = new Date('2026-09-01T00:00:00Z')): MemoryStore {
    const store = new MemoryStore();
    for (const { did, name, rules } of HARBOR_AUTO.numbers) {
      store.dialplans.set(did, {
        did,
        name,
        rules: structuredClone(rules),
        tenantId: HARBOR_AUTO.tenantId,
        tenantName: HARBOR_AUTO.tenantName,
        timezone: HARBOR_AUTO.timezone,
        version: 1,
        updatedAt: now.toISOString(),
      });
    }
    return store;
  }

  async getDialplan(did: string): Promise<Dialplan | undefined> {
    return structuredClone(this.dialplans.get(did));
  }

  async saveRules(current: Dialplan, rules: Rules, changes: string[], now: Date): Promise<Dialplan> {
    const stored = this.dialplans.get(current.did);
    if (!stored || stored.version !== current.version) {
      throw new VersionConflictError(stored?.version ?? 0);
    }
    const next = { ...current, rules, version: current.version + 1, updatedAt: now.toISOString() };
    this.dialplans.set(next.did, next);
    this.record(next, 'update', changes);
    return structuredClone(next);
  }

  async listAudit(did: string, limit: number): Promise<AuditEntry[]> {
    return [...(this.audit.get(did) ?? [])].reverse().slice(0, limit);
  }

  async listNumbers(tenantId: string): Promise<NumberSummary[]> {
    return [...this.dialplans.values()]
      .filter((d) => d.tenantId === tenantId)
      .map(({ did, name, timezone }) => ({ did, name, timezone }));
  }

  async restore(dialplan: Omit<Dialplan, 'version' | 'updatedAt'>, now: Date): Promise<Dialplan> {
    const version = (this.dialplans.get(dialplan.did)?.version ?? 0) + 1;
    const next = { ...structuredClone(dialplan), version, updatedAt: now.toISOString() };
    this.dialplans.set(next.did, next);
    this.audit.delete(next.did);
    this.record(next, 'reset', ['Restored the demo dialplan']);
    return structuredClone(next);
  }

  private record(dialplan: Dialplan, action: AuditEntry['action'], changes: string[]) {
    const entries = this.audit.get(dialplan.did) ?? [];
    entries.push({ at: dialplan.updatedAt, version: dialplan.version, action, changes });
    this.audit.set(dialplan.did, entries);
  }
}

export function httpEvent(
  routeKey: string,
  init: {
    path?: Record<string, string>;
    query?: Record<string, string>;
    headers?: Record<string, string>;
    ip?: string;
    body?: unknown;
  } = {},
): HttpEvent {
  return {
    routeKey,
    pathParameters: init.path,
    queryStringParameters: init.query,
    body: init.body === undefined ? undefined : typeof init.body === 'string' ? init.body : JSON.stringify(init.body),
    headers: init.headers ?? {},
    isBase64Encoded: false,
    requestContext: { requestId: 'test', http: { sourceIp: init.ip ?? '127.0.0.1' } },
  } as HttpEvent;
}

export function body<T = unknown>(result: { body?: string }): T {
  return JSON.parse(result.body ?? 'null') as T;
}
