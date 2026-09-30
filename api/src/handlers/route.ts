import { RouteRequest, type HealthResponse, type RouteResponse } from '@dialplan/shared';
import { decide } from '../engine/decide';
import { HttpError, json, notFound, parseBody, respond, type HttpEvent, type HttpResult } from '../http';
import { DynamoStore, type Store } from '../store';

/** The hot path: one consistent GetItem, then the pure rule engine. */
export function createHandler(store: Pick<Store, 'getDialplan'>) {
  let coldStart = true;

  return async function handler(event: HttpEvent): Promise<HttpResult> {
    const started = performance.now();
    const cold = coldStart;
    coldStart = false;

    return respond(event, async () => {
      switch (event.routeKey) {
        case 'GET /v1/health':
          return json(200, {
            status: 'ok',
            region: process.env.AWS_REGION ?? 'unknown',
            time: new Date().toISOString(),
          } satisfies HealthResponse);

        case 'POST /v1/route': {
          const call = parseBody(event, RouteRequest);
          const explain = event.queryStringParameters?.explain === 'true';

          const dbStarted = performance.now();
          const dialplan = await store.getDialplan(call.did);
          const dbMs = ms(performance.now() - dbStarted);
          if (!dialplan) {
            throw new HttpError(404, 'unknown_number', `${call.did} is not a number this service routes`);
          }

          const engineStarted = performance.now();
          const decision = decide(dialplan.rules, dialplan.timezone, call);
          const engineMs = ms(performance.now() - engineStarted);
          const serverMs = ms(performance.now() - started);

          console.info('route', { did: call.did, matchedRule: decision.matchedRule, serverMs, dbMs, cold });
          const body: RouteResponse = {
            did: call.did,
            caller: call.caller,
            decision: decision.destination,
            matchedRule: decision.matchedRule,
            localTime: decision.localTime,
            timezone: dialplan.timezone,
            dialplanVersion: dialplan.version,
            serverMs,
            timings: { dbMs, engineMs },
            coldStart: cold,
            ...(explain && { trace: decision.trace }),
          };
          return json(200, body, {
            'server-timing': `db;dur=${dbMs}, engine;dur=${engineMs}, total;dur=${serverMs}`,
          });
        }

        default:
          return notFound(event);
      }
    });
  };
}

function ms(value: number): number {
  return Math.round(value * 100) / 100;
}

export const handler = createHandler(new DynamoStore(process.env.TABLE_NAME ?? ''));
