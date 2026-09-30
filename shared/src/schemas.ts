import { z } from 'zod';
import { minutesOfDay, WEEKDAYS } from './time';

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

/** A phone number in E.164 form, e.g. +16195550100. */
export const PhoneNumber = z.e164('Use E.164 format, e.g. +16195550100');

/** Callers can withhold their number. */
export const CallerId = z.union([PhoneNumber, z.literal('anonymous')]);

/** 24-hour wall-clock time, "00:00" to "24:00". */
export const TimeOfDay = z
  .string()
  .regex(/^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/, 'Use 24-hour HH:MM');

export const TimeZone = z.string().refine((zone) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}, 'Unknown IANA time zone');

export const DestinationKind = z.enum(['ring_group', 'extension', 'voicemail', 'external']);
export type DestinationKind = z.infer<typeof DestinationKind>;

export const Destination = z
  .object({
    kind: DestinationKind,
    target: z.string().trim().min(1).max(40),
    label: z.string().trim().min(1).max(60),
  })
  .refine((d) => d.kind !== 'external' || PhoneNumber.safeParse(d.target).success, {
    message: 'External destinations need an E.164 number',
    path: ['target'],
  });
export type Destination = z.infer<typeof Destination>;

// ---------------------------------------------------------------------------
// Rules, evaluated in this order: VIP callers, holidays, opening hours, and
// after hours as the fallback that always matches.
// ---------------------------------------------------------------------------

export const RULE_ORDER = ['vip', 'holidays', 'hours', 'afterHours'] as const;
export const RuleId = z.enum(RULE_ORDER);
export type RuleId = z.infer<typeof RuleId>;

function unique<T>(key: (item: T) => string) {
  return (items: T[]) => new Set(items.map(key)).size === items.length;
}

export const VipCaller = z.object({
  number: PhoneNumber,
  name: z.string().trim().min(1).max(60),
});
export type VipCaller = z.infer<typeof VipCaller>;

export const VipRule = z.object({
  enabled: z.boolean(),
  callers: z
    .array(VipCaller)
    .max(50)
    .refine(unique((c: VipCaller) => c.number), 'Each VIP number can only be listed once'),
  destination: Destination,
});

export const Holiday = z.object({
  date: z.iso.date(),
  name: z.string().trim().min(1).max(60),
});
export type Holiday = z.infer<typeof Holiday>;

export const HolidayRule = z.object({
  enabled: z.boolean(),
  dates: z
    .array(Holiday)
    .max(100)
    .refine(unique((h: Holiday) => h.date), 'Each date can only be listed once'),
  destination: Destination,
});

export const OpenInterval = z
  .object({ open: TimeOfDay, close: TimeOfDay })
  .refine((i) => minutesOfDay(i.close) > minutesOfDay(i.open), {
    message: 'Closing time must be after opening time',
    path: ['close'],
  });
export type OpenInterval = z.infer<typeof OpenInterval>;

const DayHours = z
  .array(OpenInterval)
  .max(4)
  .refine((intervals) => {
    const sorted = [...intervals].sort((a, b) => minutesOfDay(a.open) - minutesOfDay(b.open));
    return sorted.every((i, n) => n === 0 || minutesOfDay(i.open) >= minutesOfDay(sorted[n - 1]!.close));
  }, 'Opening intervals on the same day must not overlap');

export const WeeklyHours = z.object(
  Object.fromEntries(WEEKDAYS.map((day) => [day, DayHours])) as Record<
    (typeof WEEKDAYS)[number],
    typeof DayHours
  >,
);
export type WeeklyHours = z.infer<typeof WeeklyHours>;

export const HoursRule = z.object({
  enabled: z.boolean(),
  weekly: WeeklyHours,
  destination: Destination,
});

export const AfterHoursRule = z.object({
  destination: Destination,
});

export const Rules = z.object({
  vip: VipRule,
  holidays: HolidayRule,
  hours: HoursRule,
  afterHours: AfterHoursRule,
});
export type Rules = z.infer<typeof Rules>;

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

export const Dialplan = z.object({
  did: PhoneNumber,
  name: z.string(),
  tenantId: z.string(),
  tenantName: z.string(),
  timezone: TimeZone,
  version: z.number().int().positive(),
  updatedAt: z.iso.datetime(),
  rules: Rules,
});
export type Dialplan = z.infer<typeof Dialplan>;

export const AuditEntry = z.object({
  at: z.iso.datetime(),
  version: z.number().int().positive(),
  action: z.enum(['update', 'reset']),
  changes: z.array(z.string()),
});
export type AuditEntry = z.infer<typeof AuditEntry>;

export const NumberSummary = z.object({
  did: PhoneNumber,
  name: z.string(),
  timezone: TimeZone,
});
export type NumberSummary = z.infer<typeof NumberSummary>;

// ---------------------------------------------------------------------------
// API requests and responses
// ---------------------------------------------------------------------------

export const RouteRequest = z.object({
  did: PhoneNumber,
  caller: CallerId,
  timestamp: z.iso.datetime({ offset: true }),
});
export type RouteRequest = z.infer<typeof RouteRequest>;

export const TraceStep = z.object({
  stage: z.enum(['clock', ...RULE_ORDER]),
  result: z.enum(['info', 'matched', 'no_match', 'disabled']),
  detail: z.string(),
});
export type TraceStep = z.infer<typeof TraceStep>;

export const RouteResponse = z.object({
  did: PhoneNumber,
  caller: CallerId,
  decision: Destination,
  matchedRule: RuleId,
  localTime: z.iso.datetime({ offset: true }),
  timezone: TimeZone,
  dialplanVersion: z.number().int().positive(),
  serverMs: z.number(),
  timings: z.object({ dbMs: z.number(), engineMs: z.number() }),
  coldStart: z.boolean(),
  trace: z.array(TraceStep).optional(),
});
export type RouteResponse = z.infer<typeof RouteResponse>;

export const PutRulesRequest = z.object({
  /** The version the client edited; the write fails with 409 if it is stale. */
  version: z.number().int().positive(),
  rules: Rules,
});
export type PutRulesRequest = z.infer<typeof PutRulesRequest>;

export const AuditResponse = z.object({
  did: PhoneNumber,
  entries: z.array(AuditEntry),
});
export type AuditResponse = z.infer<typeof AuditResponse>;

export const TenantNumbersResponse = z.object({
  tenantId: z.string(),
  numbers: z.array(NumberSummary),
});
export type TenantNumbersResponse = z.infer<typeof TenantNumbersResponse>;

export const ResetResponse = z.object({
  reset: z.array(PhoneNumber),
});
export type ResetResponse = z.infer<typeof ResetResponse>;

export const HealthResponse = z.object({
  status: z.literal('ok'),
  region: z.string(),
  time: z.iso.datetime(),
});
export type HealthResponse = z.infer<typeof HealthResponse>;

export const ApiError = z.object({
  error: z.string(),
  message: z.string(),
  issues: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
  currentVersion: z.number().int().optional(),
});
export type ApiError = z.infer<typeof ApiError>;
