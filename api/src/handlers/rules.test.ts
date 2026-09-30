import { ApiError, AuditResponse, Dialplan, TenantNumbersResponse, type Rules } from '@dialplan/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { VersionConflictError } from '../store';
import { body, httpEvent, MemoryStore } from '../testing';
import { createHandler } from './rules';

const MAIN_LINE = '+16195550100';
const path = { did: encodeURIComponent(MAIN_LINE) };
const NOW = new Date('2026-09-30T12:00:00Z');

let store: MemoryStore;
let handler: ReturnType<typeof createHandler>;
beforeEach(() => {
  store = MemoryStore.seeded();
  handler = createHandler(store, () => NOW);
});

const getRules = async () => Dialplan.parse(body(await handler(httpEvent('GET /v1/numbers/{did}/rules', { path }))));
const putRules = (version: number, rules: Rules) =>
  handler(httpEvent('PUT /v1/numbers/{did}/rules', { path, body: { version, rules } }));

describe('GET /v1/numbers/{did}/rules', () => {
  it('returns the dialplan, decoding the number in the path', async () => {
    const dialplan = await getRules();
    expect(dialplan).toMatchObject({ did: MAIN_LINE, name: 'Main line', version: 1 });
  });

  it('returns 404 for an unknown number and 400 for a malformed one', async () => {
    const unknown = await handler(httpEvent('GET /v1/numbers/{did}/rules', { path: { did: '+16195550111' } }));
    expect(unknown.statusCode).toBe(404);
    const malformed = await handler(httpEvent('GET /v1/numbers/{did}/rules', { path: { did: 'main' } }));
    expect(malformed.statusCode).toBe(400);
  });
});

describe('PUT /v1/numbers/{did}/rules', () => {
  it('saves the rules, bumps the version and records what changed', async () => {
    const { rules } = await getRules();
    rules.hours.weekly.tue = [{ open: '08:00', close: '20:00' }];

    const res = await putRules(1, rules);
    expect(res.statusCode).toBe(200);
    expect(Dialplan.parse(body(res))).toMatchObject({ version: 2, updatedAt: NOW.toISOString() });

    expect(await store.listAudit(MAIN_LINE, 10)).toEqual([
      { at: NOW.toISOString(), version: 2, action: 'update', changes: ['Opening hours: Tuesday 08:00–18:00 → 08:00–20:00'] },
    ]);
  });

  it('rejects an edit made to a stale version with 409', async () => {
    const { rules } = await getRules();
    rules.vip.enabled = false;
    await putRules(1, rules);

    rules.holidays.enabled = false;
    const res = await putRules(1, rules);
    expect(res.statusCode).toBe(409);
    expect(ApiError.parse(body(res))).toMatchObject({ error: 'version_conflict', currentVersion: 2 });
    expect((await getRules()).rules.holidays.enabled).toBe(true);
  });

  it('returns 409 when another write wins the race after the version check', async () => {
    const racing = createHandler(
      Object.assign(MemoryStore.seeded(), {
        saveRules: () => Promise.reject(new VersionConflictError(2)),
      }),
    );
    const { rules } = await getRules();
    rules.vip.enabled = false;
    const res = await racing(httpEvent('PUT /v1/numbers/{did}/rules', { path, body: { version: 1, rules } }));
    expect(res.statusCode).toBe(409);
  });

  it('rejects invalid rules with 400 and the path of each problem', async () => {
    const { rules } = await getRules();
    rules.hours.weekly.mon = [{ open: '18:00', close: '08:00' }];
    const res = await putRules(1, rules);
    expect(res.statusCode).toBe(400);
    expect(ApiError.parse(body(res)).issues).toEqual([
      { path: 'rules.hours.weekly.mon.0.close', message: 'Closing time must be after opening time' },
    ]);
  });

  it('does not write or audit an edit that changes nothing', async () => {
    const { rules } = await getRules();
    const res = await putRules(1, rules);
    expect(Dialplan.parse(body(res)).version).toBe(1);
    expect(await store.listAudit(MAIN_LINE, 10)).toEqual([]);
  });
});

describe('GET /v1/numbers/{did}/audit', () => {
  it('lists entries newest first, up to the limit', async () => {
    const { rules } = await getRules();
    rules.vip.enabled = false;
    await putRules(1, rules);
    rules.vip.enabled = true;
    await putRules(2, rules);

    const res = await handler(httpEvent('GET /v1/numbers/{did}/audit', { path, query: { limit: '1' } }));
    const audit = AuditResponse.parse(body(res));
    expect(audit.entries.map((e) => [e.version, e.changes])).toEqual([[3, ['VIP callers: turned on']]]);
  });

  it('rejects an out-of-range limit', async () => {
    const res = await handler(httpEvent('GET /v1/numbers/{did}/audit', { path, query: { limit: '500' } }));
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /v1/tenants/{tenantId}/numbers', () => {
  it("lists the tenant's numbers", async () => {
    const res = await handler(httpEvent('GET /v1/tenants/{tenantId}/numbers', { path: { tenantId: 'harbor-auto' } }));
    expect(TenantNumbersResponse.parse(body(res)).numbers.map((n) => n.name)).toEqual([
      'Main line',
      'Service department',
    ]);
  });

  it('returns 404 for an unknown tenant', async () => {
    const res = await handler(httpEvent('GET /v1/tenants/{tenantId}/numbers', { path: { tenantId: 'nobody' } }));
    expect(res.statusCode).toBe(404);
  });
});
