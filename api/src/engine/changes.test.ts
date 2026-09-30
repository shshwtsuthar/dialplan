import { describe, expect, it } from 'vitest';
import { HARBOR_AUTO } from '../seed';
import { describeChanges } from './changes';

const base = () => structuredClone(HARBOR_AUTO.numbers[0]!.rules);

describe('describeChanges', () => {
  it('reports nothing for identical rules', () => {
    expect(describeChanges(base(), base())).toEqual([]);
  });

  it('reports rules turned on and off', () => {
    const after = base();
    after.vip.enabled = false;
    expect(describeChanges(base(), after)).toEqual(['VIP callers: turned off']);
  });

  it('reports VIP callers added, removed and renamed', () => {
    const before = base();
    const after = base();
    const [first, second] = before.vip.callers;
    after.vip.callers = [
      { number: first!.number, name: 'Dana W.' },
      { number: '+16195550166', name: 'Priya Shah' },
    ];
    expect(describeChanges(before, after)).toEqual([
      'VIP callers: added Priya Shah (+16195550166)',
      `VIP callers: removed ${second!.name} (${second!.number})`,
      `VIP callers: renamed ${first!.number} from ${first!.name} to Dana W.`,
    ]);
  });

  it('reports holidays added and removed', () => {
    const before = base();
    const after = base();
    after.holidays.dates = after.holidays.dates.filter((h) => h.date !== '2026-11-26');
    after.holidays.dates.push({ date: '2026-12-24', name: 'Christmas Eve' });
    expect(describeChanges(before, after)).toEqual([
      'Holidays: added 2026-12-24 Christmas Eve',
      'Holidays: removed 2026-11-26 Thanksgiving',
    ]);
  });

  it('reports changed opening hours per day', () => {
    const after = base();
    after.hours.weekly.tue = [{ open: '08:00', close: '20:00' }];
    after.hours.weekly.sun = [{ open: '10:00', close: '16:00' }];
    expect(describeChanges(base(), after)).toEqual([
      'Opening hours: Tuesday 08:00–18:00 → 08:00–20:00',
      'Opening hours: Sunday closed → 10:00–16:00',
    ]);
  });

  it('reports changed destinations', () => {
    const after = base();
    after.afterHours.destination = { kind: 'voicemail', target: 'sales', label: 'Sales voicemail' };
    expect(describeChanges(base(), after)).toEqual([
      'After hours: destination "Answering service" → "Sales voicemail"',
    ]);
  });
});
