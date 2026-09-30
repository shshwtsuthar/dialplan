'use client';

import { RULE_ORDER, WEEKDAYS, type Dialplan, type RuleId, type Rules, type TraceStep } from '@dialplan/shared';
import { DateTime } from 'luxon';
import { useState } from 'react';
import { relativeTime } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import { RuleCard, type Outcome } from './RuleCard';

interface Props {
  dialplan: Dialplan | undefined;
  /** Trace of the latest call, used to light up the rules it evaluated. */
  trace: TraceStep[] | undefined;
  now: number | undefined;
  onSave: (rules: Rules) => Promise<void>;
  onReload: () => Promise<void>;
}

export function DialplanPanel({ dialplan, trace, now, onSave, onReload }: Props) {
  const [editing, setEditing] = useState<RuleId>();
  const realNow = useNow();

  const outcomes = new Map<RuleId, Outcome>();
  if (trace) {
    for (const rule of RULE_ORDER) outcomes.set(rule, 'not_reached');
    for (const step of trace) if (step.stage !== 'clock') outcomes.set(step.stage, step.result as Outcome);
  }

  const local = now === undefined || !dialplan ? undefined : DateTime.fromMillis(now, { zone: dialplan.timezone });
  const today = local ? { date: local.toISODate()!, weekday: WEEKDAYS[local.weekday - 1]! } : undefined;

  return (
    <section aria-labelledby="dialplan-title" className="card flex flex-col gap-3 p-4">
      <header className="flex items-baseline justify-between gap-2">
        <div>
          <h2 id="dialplan-title" className="text-base font-semibold text-slate-900">
            Dialplan
          </h2>
          <p className="text-xs text-slate-500">Checked top to bottom; the first rule that matches decides.</p>
        </div>
        {dialplan && (
          <p className="shrink-0 text-right text-xs text-slate-500">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-slate-700">v{dialplan.version}</span>
            {realNow !== undefined && <span className="ml-2">saved {relativeTime(dialplan.updatedAt, realNow)}</span>}
          </p>
        )}
      </header>

      {!dialplan ? (
        <div className="space-y-3" aria-busy>
          {RULE_ORDER.map((rule) => (
            <div key={rule} className="h-24 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : (
        <ol className="flex flex-col">
          {RULE_ORDER.map((rule, index) => (
            <li key={rule}>
              {index > 0 && (
                <p className="py-1 pl-4 text-[11px] font-medium tracking-wide text-slate-400 uppercase">otherwise</p>
              )}
              <RuleCard
                // A fresh editor, with a fresh draft, for every saved version.
                key={`${rule}-${dialplan.version}`}
                rule={rule}
                step={index + 1}
                dialplan={dialplan}
                outcome={outcomes.get(rule)}
                today={today}
                editing={editing === rule}
                onEdit={() => setEditing(rule)}
                onClose={() => setEditing(undefined)}
                onSave={onSave}
                onReload={async () => {
                  setEditing(undefined);
                  await onReload();
                }}
              />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
