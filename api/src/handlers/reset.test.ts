import { ResetResponse } from '@dialplan/shared';
import { describe, expect, it } from 'vitest';
import { HARBOR_AUTO } from '../seed';
import { body, httpEvent, MemoryStore } from '../testing';
import { createHandler } from './reset';

const NOW = new Date('2026-09-30T10:00:00Z');
const MAIN_LINE = '+16195550100';

describe('demo reset', () => {
  it('restores the seed rules, keeps versions increasing and clears the audit log', async () => {
    const store = MemoryStore.seeded();
    const edited = (await store.getDialplan(MAIN_LINE))!;
    await store.saveRules(edited, { ...edited.rules, vip: { ...edited.rules.vip, enabled: false } }, ['x'], NOW);

    const handler = createHandler(store, HARBOR_AUTO, () => NOW);
    const res = await handler(httpEvent('POST /v1/demo/reset'));
    expect('statusCode' in res && res.statusCode).toBe(200);
    expect(ResetResponse.parse(body(res as { body?: string })).reset).toEqual(['+16195550100', '+16195550150']);

    const restored = (await store.getDialplan(MAIN_LINE))!;
    expect(restored.rules).toEqual(HARBOR_AUTO.numbers[0]!.rules);
    expect(restored.version).toBe(3);
    expect(await store.listAudit(MAIN_LINE, 10)).toEqual([
      { at: NOW.toISOString(), version: 3, action: 'reset', changes: ['Restored the demo dialplan'] },
    ]);
  });

  it('seeds an empty table when invoked directly', async () => {
    const store = new MemoryStore();
    const handler = createHandler(store, HARBOR_AUTO, () => NOW);
    expect(await handler({ source: 'deploy' })).toEqual({ reset: ['+16195550100', '+16195550150'] });
    expect((await store.getDialplan(MAIN_LINE))?.version).toBe(1);
  });
});
