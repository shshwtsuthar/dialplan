import {
  formatInterval,
  minutesOfDay,
  WEEKDAY_NAMES,
  WEEKDAYS,
  type Destination,
  type RuleId,
  type Rules,
  type TraceStep,
} from '@dialplan/shared';
import { DateTime } from 'luxon';

export interface Call {
  /** E.164 number, or "anonymous" when caller ID is withheld. */
  caller: string;
  /** The instant the call arrived: ISO 8601 with a UTC offset. */
  timestamp: string;
}

export interface Decision {
  destination: Destination;
  matchedRule: RuleId;
  /** The call's instant in the dialplan's time zone, ISO 8601 with offset. */
  localTime: string;
  trace: TraceStep[];
}

/**
 * Decides where a call should ring. Pure: the same rules, time zone and call
 * always produce the same decision.
 *
 * Rules are evaluated in a fixed order and the first match wins:
 * VIP callers, then holidays, then opening hours, then after hours.
 * Holidays and opening hours are wall-clock rules in the dialplan's time
 * zone, so the call's instant is converted to local time first. That
 * conversion is what makes daylight saving transitions come out right.
 */
export function decide(rules: Rules, timezone: string, call: Call): Decision {
  const local = DateTime.fromISO(call.timestamp, { setZone: true }).setZone(timezone);
  if (!local.isValid) {
    throw new RangeError(`Cannot place ${call.timestamp} in ${timezone}: ${local.invalidExplanation}`);
  }

  const localTime = local.toISO({ includeOffset: true });
  const trace: TraceStep[] = [
    {
      stage: 'clock',
      result: 'info',
      detail: `${call.timestamp} is ${local.toFormat('ccc d LLL yyyy, HH:mm:ss')} ${local.offsetNameShort} (UTC${local.toFormat('ZZ')}) in ${timezone}`,
    },
  ];
  const matched = (rule: RuleId, destination: Destination, detail: string): Decision => {
    trace.push({ stage: rule, result: 'matched', detail: `${detail} → ${destination.label}` });
    return { destination, matchedRule: rule, localTime, trace };
  };

  // 1. VIP callers ring through whatever the time.
  const { vip } = rules;
  if (!vip.enabled) {
    trace.push({ stage: 'vip', result: 'disabled', detail: 'VIP routing is turned off' });
  } else if (call.caller === 'anonymous') {
    trace.push({ stage: 'vip', result: 'no_match', detail: 'Caller ID is withheld, so the VIP list cannot match' });
  } else {
    const entry = vip.callers.find((c) => c.number === call.caller);
    if (entry) {
      return matched('vip', vip.destination, `${call.caller} is ${entry.name}, on the VIP list`);
    }
    trace.push({
      stage: 'vip',
      result: 'no_match',
      detail: `${call.caller} is not among ${plural(vip.callers.length, 'VIP caller')}`,
    });
  }

  // 2. Holidays match on the local calendar date, not the UTC one.
  const { holidays } = rules;
  const date = local.toISODate();
  if (!holidays.enabled) {
    trace.push({ stage: 'holidays', result: 'disabled', detail: 'Holiday routing is turned off' });
  } else {
    const holiday = holidays.dates.find((h) => h.date === date);
    if (holiday) {
      return matched('holidays', holidays.destination, `${date} is ${holiday.name}`);
    }
    trace.push({ stage: 'holidays', result: 'no_match', detail: `${date} is not a holiday` });
  }

  // 3. Opening hours: [open, close) in local wall-clock time.
  const { hours } = rules;
  const weekday = WEEKDAYS[local.weekday - 1]!;
  const dayName = WEEKDAY_NAMES[weekday];
  const intervals = hours.weekly[weekday];
  const clock = local.toFormat('HH:mm');
  if (!hours.enabled) {
    trace.push({ stage: 'hours', result: 'disabled', detail: 'Opening hours are turned off' });
  } else if (intervals.length === 0) {
    trace.push({ stage: 'hours', result: 'no_match', detail: `Closed all day on ${dayName}` });
  } else {
    const minute = local.hour * 60 + local.minute + local.second / 60;
    const open = intervals.find((i) => minutesOfDay(i.open) <= minute && minute < minutesOfDay(i.close));
    const schedule = intervals.map(formatInterval).join(', ');
    if (open) {
      return matched('hours', hours.destination, `${clock} is within ${dayName} hours (${schedule})`);
    }
    trace.push({ stage: 'hours', result: 'no_match', detail: `${clock} is outside ${dayName} hours (${schedule})` });
  }

  // 4. After hours always matches.
  return matched('afterHours', rules.afterHours.destination, 'No earlier rule matched');
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}
