'use client';

import { RULE_ORDER, WEEKDAYS, type AuditEntry, type Dialplan, type RuleId, type Rules, type TraceStep } from '@dialplan/shared';
import { DateTime } from 'luxon';
import { useState } from 'react';
import { relativeTime } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import { Column } from '../Column';
import { RuleRow, type Outcome } from './RuleRow';

interface Props {
  dialplan: Dialplan | undefined;
  audit: AuditEntry[];
  /** Trace of the latest call, used to mark the rules it evaluated. */
  trace: TraceStep[] | undefined;
  now: number | undefined;
  onSave: (rules: Rules) => Promise<void>;
  onReload: () => Promise<void>;
  className?: string;
}

export function DialplanPanel({ dialplan, audit, trace, now, onSave, onReload, className }: Props) {
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
    <Column
      title="Dialplan"
      className={className}
      aside={
        dialplan && (
          <p className="text-[13px] text-muted-foreground tabular-nums">
            v{dialplan.version}
            {realNow !== undefined && `, saved ${relativeTime(dialplan.updatedAt, realNow)}`}
          </p>
        )
      }
    >
      <p className="border-b p-2.5 text-[13px] text-muted-foreground">
        Rules are checked from the top. The first one that matches decides where the call goes.
      </p>

      {!dialplan ? (
        <div className="divide-y" aria-busy>
          {RULE_ORDER.map((rule) => (
            <div key={rule} className="h-24 animate-pulse bg-muted/60" />
          ))}
        </div>
      ) : (
        <ol className="divide-y">
          {RULE_ORDER.map((rule, index) => (
            <RuleRow
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
          ))}
        </ol>
      )}

      <Changes entries={audit} now={realNow} />
    </Column>
  );
}

function Changes({ entries, now }: { entries: AuditEntry[]; now: number | undefined }) {
  return (
    <div className="border-t p-2.5">
      <p className="label">Changes</p>
      {entries.length === 0 ? (
        <p className="mt-1.5 text-muted-foreground">No changes yet. Edit a rule to see it here.</p>
      ) : (
        <ol className="mt-1.5 max-h-60 divide-y overflow-y-auto">
          {entries.map((entry) => (
            <li key={entry.at} className="py-1.5 first:pt-0 last:pb-0">
              <p className="flex items-baseline justify-between gap-2.5">
                <span className="font-medium tabular-nums">
                  v{entry.version} {entry.action === 'reset' ? 'reset' : 'edited'}
                </span>
                {now !== undefined && (
                  <span className="shrink-0 text-[13px] text-muted-foreground">{relativeTime(entry.at, now)}</span>
                )}
              </p>
              <ul className="text-[13px] text-muted-foreground">
                {entry.changes.map((change) => (
                  <li key={change}>{change}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
