import {
  PhoneNumber,
  PutRulesRequest,
  type AuditResponse,
  type Dialplan,
  type TenantNumbersResponse,
} from '@dialplan/shared';
import { z } from 'zod';
import { describeChanges } from '../engine/changes';
import { HttpError, json, notFound, parseBody, pathParam, respond, validate, type HttpEvent, type HttpResult } from '../http';
import { DynamoStore, VersionConflictError, type Store } from '../store';

const AuditLimit = z.coerce.number().int().min(1).max(50).default(20);

/** Reading and editing dialplans, and their audit log. */
export function createHandler(store: Store, now = () => new Date()) {
  async function load(event: HttpEvent): Promise<Dialplan> {
    const did = validate(PhoneNumber, pathParam(event, 'did'), 'The number in the path is invalid');
    const dialplan = await store.getDialplan(did);
    if (!dialplan) throw new HttpError(404, 'unknown_number', `${did} is not a number this service routes`);
    return dialplan;
  }

  return async function handler(event: HttpEvent): Promise<HttpResult> {
    return respond(event, async () => {
      switch (event.routeKey) {
        case 'GET /v1/numbers/{did}/rules':
          return json(200, await load(event));

        case 'PUT /v1/numbers/{did}/rules': {
          const { version, rules } = parseBody(event, PutRulesRequest);
          const current = await load(event);
          if (version !== current.version) {
            throw conflict(current.version);
          }
          const changes = describeChanges(current.rules, rules);
          if (changes.length === 0) {
            return json(200, current);
          }
          try {
            const saved = await store.saveRules(current, rules, changes, now());
            console.info('rules saved', { did: saved.did, version: saved.version, changes });
            return json(200, saved);
          } catch (error) {
            if (error instanceof VersionConflictError) throw conflict(error.currentVersion);
            throw error;
          }
        }

        case 'GET /v1/numbers/{did}/audit': {
          const { did } = await load(event);
          const limit = validate(AuditLimit, event.queryStringParameters?.limit, 'limit must be 1 to 50');
          return json(200, { did, entries: await store.listAudit(did, limit) } satisfies AuditResponse);
        }

        case 'GET /v1/tenants/{tenantId}/numbers': {
          const tenantId = pathParam(event, 'tenantId');
          const numbers = await store.listNumbers(tenantId);
          if (numbers.length === 0) throw new HttpError(404, 'unknown_tenant', `No numbers for tenant ${tenantId}`);
          return json(200, { tenantId, numbers } satisfies TenantNumbersResponse);
        }

        default:
          return notFound(event);
      }
    });
  };
}

function conflict(currentVersion: number): HttpError {
  return new HttpError(
    409,
    'version_conflict',
    `Someone else changed this dialplan; it is now at version ${currentVersion}. Reload and reapply your edit.`,
    { currentVersion },
  );
}

export const handler = createHandler(new DynamoStore(process.env.TABLE_NAME ?? ''));
