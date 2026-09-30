import { formatInterval, WEEKDAY_NAMES, WEEKDAYS, type Destination, type Rules } from '@dialplan/shared';

const RULE_NAMES = {
  vip: 'VIP callers',
  holidays: 'Holidays',
  hours: 'Opening hours',
  afterHours: 'After hours',
} as const;

/** Human-readable summary of what an edit changed, for the audit log. */
export function describeChanges(before: Rules, after: Rules): string[] {
  const changes: string[] = [];

  for (const rule of ['vip', 'holidays', 'hours'] as const) {
    if (before[rule].enabled !== after[rule].enabled) {
      changes.push(`${RULE_NAMES[rule]}: turned ${after[rule].enabled ? 'on' : 'off'}`);
    }
  }

  const callers = diffBy(before.vip.callers, after.vip.callers, (c) => c.number);
  changes.push(...callers.added.map((c) => `VIP callers: added ${c.name} (${c.number})`));
  changes.push(...callers.removed.map((c) => `VIP callers: removed ${c.name} (${c.number})`));
  changes.push(
    ...callers.changed.map(([from, to]) => `VIP callers: renamed ${to.number} from ${from.name} to ${to.name}`),
  );

  const dates = diffBy(before.holidays.dates, after.holidays.dates, (h) => h.date);
  changes.push(...dates.added.map((h) => `Holidays: added ${h.date} ${h.name}`));
  changes.push(...dates.removed.map((h) => `Holidays: removed ${h.date} ${h.name}`));
  changes.push(...dates.changed.map(([from, to]) => `Holidays: renamed ${to.date} from ${from.name} to ${to.name}`));

  for (const day of WEEKDAYS) {
    const from = formatDay(before.hours.weekly[day]);
    const to = formatDay(after.hours.weekly[day]);
    if (from !== to) changes.push(`Opening hours: ${WEEKDAY_NAMES[day]} ${from} → ${to}`);
  }

  for (const rule of ['vip', 'holidays', 'hours', 'afterHours'] as const) {
    const from = before[rule].destination;
    const to = after[rule].destination;
    if (!sameDestination(from, to)) {
      changes.push(`${RULE_NAMES[rule]}: destination ${formatDestination(from)} → ${formatDestination(to)}`);
    }
  }

  return changes;
}

function diffBy<T>(before: T[], after: T[], key: (item: T) => string) {
  const old = new Map(before.map((item) => [key(item), item]));
  const now = new Map(after.map((item) => [key(item), item]));
  return {
    added: after.filter((item) => !old.has(key(item))),
    removed: before.filter((item) => !now.has(key(item))),
    changed: after
      .map((item) => [old.get(key(item)), item] as const)
      .filter((pair): pair is readonly [T, T] => pair[0] !== undefined && JSON.stringify(pair[0]) !== JSON.stringify(pair[1])),
  };
}

function formatDay(intervals: { open: string; close: string }[]): string {
  return intervals.length === 0 ? 'closed' : intervals.map(formatInterval).join(', ');
}

function sameDestination(a: Destination, b: Destination): boolean {
  return a.kind === b.kind && a.target === b.target && a.label === b.label;
}

function formatDestination(d: Destination): string {
  return `"${d.label}"`;
}
