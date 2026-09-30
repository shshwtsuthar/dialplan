import type { ResetResponse } from '@dialplan/shared';
import { json, notFound, respond, type HttpEvent, type HttpResult } from '../http';
import { HARBOR_AUTO, type SeedTenant } from '../seed';
import { DynamoStore, type Store } from '../store';

/** Invoked by EventBridge Scheduler (nightly) and by Terraform (after a deploy). */
export interface DirectInvocation {
  source: 'schedule' | 'deploy';
}

/** Restores the demo tenant: POST /v1/demo/reset, the nightly schedule, and seeding on deploy. */
export function createHandler(store: Store, tenant: SeedTenant = HARBOR_AUTO, now = () => new Date()) {
  async function reset(source: string): Promise<ResetResponse> {
    const at = now();
    const restored = await Promise.all(
      tenant.numbers.map(({ did, name, rules }) =>
        store.restore(
          { did, name, rules, tenantId: tenant.tenantId, tenantName: tenant.tenantName, timezone: tenant.timezone },
          at,
        ),
      ),
    );
    console.info('demo reset', { source, numbers: restored.map((d) => [d.did, d.version]) });
    return { reset: restored.map((d) => d.did) };
  }

  return async function handler(event: HttpEvent | DirectInvocation): Promise<HttpResult | ResetResponse> {
    if (!('routeKey' in event)) {
      return reset(event.source);
    }
    return respond(event, async () => {
      if (event.routeKey !== 'POST /v1/demo/reset') return notFound(event);
      return json(200, await reset('api'));
    });
  };
}

export const handler = createHandler(new DynamoStore(process.env.TABLE_NAME ?? ''));
