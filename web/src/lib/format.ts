import {
  formatInterval,
  WEEKDAYS,
  type Destination,
  type DestinationKind,
  type OpenInterval,
  type RuleId,
  type WeeklyHours,
} from '@dialplan/shared';
import { DateTime } from 'luxon';

export const RULE_TITLES: Record<RuleId, string> = {
  vip: 'VIP callers',
  holidays: 'Holidays',
  hours: 'Opening hours',
  afterHours: 'After hours',
};

export const DESTINATION_KINDS: Record<DestinationKind, string> = {
  ring_group: 'Ring group',
  extension: 'Extension',
  voicemail: 'Voicemail',
  external: 'External number',
};

const SHORT_DAYS = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' } as const;

/** "Wed 30 Sep 2026, 07:01 PDT (UTC-07:00) in America/Los_Angeles": when a call arrived, in the business's time zone. */
export function formatCallTime(localTime: string, timezone: string): string {
  const local = DateTime.fromISO(localTime, { zone: timezone });
  return `${local.toFormat("ccc d LLL yyyy, HH:mm ZZZZ '(UTC'ZZ')'")} in ${timezone}`;
}

/** "+16195550100" → "(619) 555-0100", "+442079460123" → "+44 20 7946 0123". Anything else is returned as is. */
export function formatPhone(number: string): string {
  if (number === 'anonymous') return 'Withheld';
  const nanp = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(number);
  if (nanp) return `(${nanp[1]}) ${nanp[2]}-${nanp[3]}`;
  const london = /^\+4420(\d{4})(\d{4})$/.exec(number);
  return london ? `+44 20 ${london[1]} ${london[2]}` : number;
}

/** "Extension 201", "Voicemail box holiday", "External number (619) 555-0199". */
export function describeTarget({ kind, target }: Destination): string {
  if (kind === 'voicemail') return `Voicemail box ${target}`;
  return `${DESTINATION_KINDS[kind]} ${kind === 'external' ? formatPhone(target) : target}`;
}

/** Groups consecutive days with the same hours: [["Mon–Fri", "08:00–18:00"], ["Sun", "Closed"]]. */
export function summarizeWeek(weekly: WeeklyHours): { days: string; hours: string; keys: string[] }[] {
  const describe = (intervals: OpenInterval[]) =>
    intervals.length === 0 ? 'Closed' : intervals.map(formatInterval).join(', ');

  const rows: { days: string; hours: string; keys: string[] }[] = [];
  for (const day of WEEKDAYS) {
    const hours = describe(weekly[day]);
    const last = rows.at(-1);
    if (last && last.hours === hours) {
      last.keys.push(day);
    } else {
      rows.push({ days: '', hours, keys: [day] });
    }
  }
  for (const row of rows) {
    const first = SHORT_DAYS[row.keys[0] as keyof typeof SHORT_DAYS];
    const last = SHORT_DAYS[row.keys.at(-1) as keyof typeof SHORT_DAYS];
    row.days = row.keys.length === 1 ? first : `${first}–${last}`;
  }
  return rows;
}

export function relativeTime(iso: string, now: number): string {
  const seconds = Math.round((now - Date.parse(iso)) / 1000);
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Accepts "(619) 555-0166", "619-555-0166" or "+1 619 555 0166" and returns E.164 when it can. */
export function normalizePhone(input: string): string {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (trimmed.startsWith('+')) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return trimmed;
}
