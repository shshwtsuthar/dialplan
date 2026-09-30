'use client';

import type { Destination, Dialplan, DestinationKind, RuleId, Rules, Weekday } from '@dialplan/shared';
import { IconPencil } from '@tabler/icons-react';
import { DateTime } from 'luxon';
import { cn } from '@/lib/cn';
import type { RuleState } from '@/lib/callPath';
import { DESTINATION_KINDS, formatPhone, RULE_TITLES, summarizeWeek } from '@/lib/format';
import { RuleEditor } from './RuleEditor';

const DESTINATION_VERB: Record<DestinationKind, string> = {
  ring_group: 'Rings',
  extension: 'Rings',
  voicemail: 'Plays',
  external: 'Forwards to',
};

interface Props {
  rule: RuleId;
  step: number;
  dialplan: Dialplan;
  /** How the latest call fared here, as the replay reaches this rule. */
  state: RuleState;
  /** The rule engine's reason, once the call has been checked here. */
  reason: string | undefined;
  /** A call is in progress: keep a line for the outcome from the start, so the column doesn't grow as the call is checked. */
  reserve: boolean;
  today: { date: string; weekday: Weekday } | undefined;
  editing: boolean;
  onEdit: () => void;
  onClose: () => void;
  onSave: (rules: Rules) => Promise<void>;
  onReload: () => Promise<void>;
}

export function RuleRow({ rule, step, dialplan, state, reason, reserve, today, editing, onEdit, onClose, onSave, onReload }: Props) {
  const settings = dialplan.rules[rule];
  const enabled = !('enabled' in settings) || settings.enabled;
  const matched = !editing && state === 'matched';
  const checking = !editing && state === 'checking';
  const checked = state === 'matched' || state === 'no_match' || state === 'disabled';

  return (
    <li className={cn('relative transition-colors', matched && 'bg-success-surface')}>
      {(matched || checking || editing) && (
        <span aria-hidden className={cn('absolute inset-y-0 left-0 w-0.5', matched ? 'bg-success' : 'bg-foreground')} />
      )}
      {editing ? (
        <RuleEditor rule={rule} dialplan={dialplan} onClose={onClose} onSave={onSave} onReload={onReload} />
      ) : (
        <div className="p-2.5">
          <div className="flex h-8 items-center gap-2.5">
            <span className="w-4 shrink-0 text-muted-foreground tabular-nums">{step}</span>
            <h3 className="truncate font-semibold">{RULE_TITLES[rule]}</h3>
            {!enabled && <span className="badge bg-muted text-muted-foreground">Off</span>}
            {state === 'matched' && (
              <span className="settle badge border border-success-border text-success">Matched</span>
            )}
            {state === 'no_match' && <span className="settle badge bg-muted text-muted-foreground">No match</span>}
            <button
              type="button"
              onClick={onEdit}
              className="btn btn-ghost btn-icon -mr-2 ml-auto text-muted-foreground hover:text-foreground"
              aria-label={`Edit ${RULE_TITLES[rule]}`}
              title="Edit"
            >
              <IconPencil size={16} />
            </button>
          </div>
          <div className={cn('space-y-1.5 pl-[26px]', !enabled && 'text-muted-foreground')}>
            {reserve && (
              <p className={cn('text-[13px] break-words text-muted-foreground', (checked || state === 'not_reached') && 'settle')}>
                {state === 'checking' && 'Checking…'}
                {state === 'not_reached' && 'Not checked: an earlier rule matched.'}
                {checked && reason}
                {state === undefined && '\u00a0'}
              </p>
            )}
            <RuleSummary rule={rule} rules={dialplan.rules} today={today} />
            <DestinationLine destination={settings.destination} />
          </div>
        </div>
      )}
    </li>
  );
}

function DestinationLine({ destination }: { destination: Destination }) {
  return (
    <p className="flex items-baseline justify-between gap-2.5">
      <span className="min-w-0">
        <span className="text-muted-foreground">{DESTINATION_VERB[destination.kind]}</span>{' '}
        <span className="font-medium">{destination.label}</span>
      </span>
      <span className="shrink-0 text-[13px] text-muted-foreground">{DESTINATION_KINDS[destination.kind]}</span>
    </p>
  );
}

function RuleSummary({ rule, rules, today }: { rule: RuleId; rules: Rules; today: Props['today'] }) {
  switch (rule) {
    case 'vip': {
      const { callers, enabled } = rules.vip;
      if (!enabled) return <p>Off: VIP callers follow the rules below.</p>;
      if (callers.length === 0) return <p className="text-muted-foreground">No VIP callers yet.</p>;
      return (
        <ul>
          {callers.slice(0, 3).map((c) => (
            <li key={c.number} className="flex justify-between gap-2.5">
              <span className="truncate">{c.name}</span>
              <span className="shrink-0 text-[13px] text-muted-foreground tabular-nums">{formatPhone(c.number)}</span>
            </li>
          ))}
          {callers.length > 3 && <li className="text-[13px] text-muted-foreground">and {callers.length - 3} more</li>}
        </ul>
      );
    }

    case 'holidays': {
      const { dates, enabled } = rules.holidays;
      if (!enabled) return <p>Off: holidays are treated like any other day.</p>;
      const upcoming = [...dates].filter((h) => !today || h.date >= today.date).sort((a, b) => a.date.localeCompare(b.date));
      return (
        <ul>
          {upcoming.slice(0, 2).map((h) => (
            <li key={h.date} className={cn('flex justify-between gap-2.5', h.date === today?.date && 'text-warning')}>
              <span className="truncate">
                {h.date === today?.date ? 'Today: ' : ''}
                {h.name}
              </span>
              <span className="shrink-0 text-[13px] text-muted-foreground tabular-nums">
                {DateTime.fromISO(h.date).toFormat('ccc d LLL yyyy')}
              </span>
            </li>
          ))}
          {upcoming.length === 0 && <li className="text-muted-foreground">No upcoming holidays.</li>}
          {dates.length > upcoming.slice(0, 2).length && (
            <li className="text-[13px] text-muted-foreground">{dates.length} dates on the calendar</li>
          )}
        </ul>
      );
    }

    case 'hours': {
      if (!rules.hours.enabled) return <p>Off: every call goes to after hours.</p>;
      return (
        <dl className="grid grid-cols-[4.5rem_1fr]">
          {summarizeWeek(rules.hours.weekly).map((row) => {
            const isToday = today !== undefined && row.keys.includes(today.weekday);
            return (
              <div key={row.days} className={cn('contents', isToday && 'font-semibold')}>
                <dt>{row.days}</dt>
                <dd className={cn('tabular-nums', !isToday && 'text-muted-foreground')}>{row.hours}</dd>
              </div>
            );
          })}
        </dl>
      );
    }

    case 'afterHours':
      return <p>Every call the rules above did not catch.</p>;
  }
}
