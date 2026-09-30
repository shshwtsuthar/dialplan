'use client';

import type { Destination, Dialplan, RuleId, Rules, Weekday } from '@dialplan/shared';
import { Pencil } from 'lucide-react';
import { DateTime } from 'luxon';
import { cn } from '@/lib/cn';
import { DESTINATION_KINDS, formatPhone, RULE_TITLES, summarizeWeek } from '@/lib/format';
import { DESTINATION_ICONS, RULE_ICONS } from '../icons';
import { RuleEditor } from './RuleEditor';

export type Outcome = 'matched' | 'no_match' | 'disabled' | 'not_reached';

export const RULE_COLORS: Record<RuleId, string> = {
  vip: 'text-violet-600',
  holidays: 'text-amber-600',
  hours: 'text-sky-600',
  afterHours: 'text-indigo-600',
};

interface Props {
  rule: RuleId;
  step: number;
  dialplan: Dialplan;
  outcome: Outcome | undefined;
  today: { date: string; weekday: Weekday } | undefined;
  editing: boolean;
  onEdit: () => void;
  onClose: () => void;
  onSave: (rules: Rules) => Promise<void>;
  onReload: () => Promise<void>;
}

export function RuleCard({ rule, step, dialplan, outcome, today, editing, onEdit, onClose, onSave, onReload }: Props) {
  const Icon = RULE_ICONS[rule];
  const settings = dialplan.rules[rule];
  const enabled = !('enabled' in settings) || settings.enabled;

  return (
    <article
      className={cn(
        'rounded-xl border bg-white transition-all duration-300',
        editing
          ? 'border-sky-400 ring-2 ring-sky-400/40'
          : outcome === 'matched'
            ? 'border-emerald-400 shadow-lg ring-2 shadow-emerald-500/25 ring-emerald-400/50'
            : 'border-slate-200',
        !editing && outcome === 'not_reached' && 'opacity-45',
      )}
    >
      {editing ? (
        <RuleEditor rule={rule} dialplan={dialplan} onClose={onClose} onSave={onSave} onReload={onReload} />
      ) : (
        <button
          type="button"
          onClick={onEdit}
          aria-label={`${RULE_TITLES[rule]}: edit`}
          className="group w-full rounded-xl p-3.5 text-left transition hover:bg-sky-50/60 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none"
        >
          <div className="flex items-center gap-2.5">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
              {step}
            </span>
            <Icon className={cn('size-4 shrink-0', RULE_COLORS[rule])} />
            <h3 className="truncate font-medium text-slate-900">{RULE_TITLES[rule]}</h3>
            <span className="ml-auto flex shrink-0 items-center gap-1.5">
              {!enabled && <Badge className="bg-slate-100 text-slate-500">Off</Badge>}
              {outcome === 'matched' && <Badge className="bg-emerald-100 text-emerald-800">Matched</Badge>}
              {outcome === 'no_match' && <Badge className="bg-slate-100 text-slate-600">No match</Badge>}
              <span className="flex items-center gap-1 text-xs font-medium text-sky-700 opacity-100 transition lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-visible:opacity-100">
                <Pencil className="size-3.5" />
                <span className="hidden lg:inline">Edit</span>
              </span>
            </span>
          </div>
          <div className={cn('mt-2 pl-[2.125rem] text-sm text-slate-600', !enabled && 'opacity-60')}>
            <RuleSummary rule={rule} rules={dialplan.rules} today={today} />
            <DestinationPill destination={settings.destination} />
          </div>
        </button>
      )}
    </article>
  );
}

function Badge({ className, children }: { className: string; children: string }) {
  return <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', className)}>{children}</span>;
}

function DestinationPill({ destination }: { destination: Destination }) {
  const Icon = DESTINATION_ICONS[destination.kind];
  return (
    <p className="mt-2.5 inline-flex max-w-full items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700">
      <span aria-hidden>→</span>
      <Icon className="size-3.5 shrink-0" />
      <span className="truncate font-medium">{destination.label}</span>
      <span className="shrink-0 text-slate-400">{DESTINATION_KINDS[destination.kind]}</span>
    </p>
  );
}

function RuleSummary({ rule, rules, today }: { rule: RuleId; rules: Rules; today: Props['today'] }) {
  switch (rule) {
    case 'vip': {
      const { callers, enabled } = rules.vip;
      if (!enabled) return <p>Off: VIP callers follow the rules below.</p>;
      if (callers.length === 0) return <p>No VIP callers yet.</p>;
      return (
        <ul className="space-y-0.5">
          {callers.slice(0, 3).map((c) => (
            <li key={c.number} className="flex justify-between gap-3">
              <span className="truncate">{c.name}</span>
              <span className="shrink-0 font-mono text-xs text-slate-500">{formatPhone(c.number)}</span>
            </li>
          ))}
          {callers.length > 3 && <li className="text-xs text-slate-500">and {callers.length - 3} more</li>}
        </ul>
      );
    }

    case 'holidays': {
      const { dates, enabled } = rules.holidays;
      if (!enabled) return <p>Off: holidays are treated like any other day.</p>;
      const upcoming = [...dates].filter((h) => !today || h.date >= today.date).sort((a, b) => a.date.localeCompare(b.date));
      return (
        <div>
          <ul className="space-y-0.5">
            {upcoming.slice(0, 2).map((h) => (
              <li key={h.date} className={cn('flex justify-between gap-3', h.date === today?.date && 'font-semibold text-amber-700')}>
                <span className="truncate">
                  {h.date === today?.date ? 'Today: ' : ''}
                  {h.name}
                </span>
                <span className="shrink-0 text-xs text-slate-500">{DateTime.fromISO(h.date).toFormat('ccc d LLL yyyy')}</span>
              </li>
            ))}
            {upcoming.length === 0 && <li>No upcoming holidays.</li>}
          </ul>
          <p className="mt-1 text-xs text-slate-500">{dates.length} dates on the calendar</p>
        </div>
      );
    }

    case 'hours': {
      if (!rules.hours.enabled) return <p>Off: every call goes to after hours.</p>;
      return (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5">
          {summarizeWeek(rules.hours.weekly).map((row) => {
            const isToday = today !== undefined && row.keys.includes(today.weekday);
            return (
              <div key={row.days} className={cn('contents', isToday && 'font-semibold text-sky-800')}>
                <dt>{row.days}</dt>
                <dd className="font-mono text-xs leading-5">{row.hours}</dd>
              </div>
            );
          })}
        </dl>
      );
    }

    case 'afterHours':
      return <p>Every call the rules above didn&apos;t catch.</p>;
  }
}
