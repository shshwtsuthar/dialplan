'use client';

import { RULE_ORDER, WEEKDAYS, type Dialplan, type RuleId, type Rules } from '@dialplan/shared';
import { DateTime } from 'luxon';
import { useState } from 'react';
import type { RouteResult } from '@/lib/api';
import { callPath, ruleStates } from '@/lib/callPath';
import type { StopProgress } from '@/lib/checks';
import { formatCallTime, relativeTime } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import { Column } from '../Column';
import { RuleRow } from './RuleRow';

/** A call in progress: when it came in, its answer once the API has replied, and how far down the rules its replay has got. */
export interface RuleCheck {
  at: number;
  result: RouteResult | undefined;
  progress: StopProgress | 'all' | undefined;
}

interface Props {
  dialplan: Dialplan | undefined;
  /** Marks each rule as the call reaches it. */
  check: RuleCheck | undefined;
  now: number | undefined;
  onSave: (rules: Rules) => Promise<void>;
  onReload: () => Promise<void>;
  className?: string;
}

export function DialplanPanel({ dialplan, check, now, onSave, onReload, className }: Props) {
  const [editing, setEditing] = useState<RuleId>();
  const realNow = useNow();

  const started = check?.result && check.progress !== undefined ? { result: check.result, progress: check.progress } : undefined;
  const path = started?.result.trace && callPath(started.result.trace);
  const states = path && started && ruleStates(path, started.progress);
  const reasons = new Map(path?.checked.map(({ rule, detail }) => [rule, detail]));

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
        {check && dialplan ? (
          <>
            Call at{' '}
            <span className="text-foreground">
              {formatCallTime(DateTime.fromMillis(check.at).toISO()!, dialplan.timezone)}
            </span>
            .
            Rules are checked from the top; the first match decides.
          </>
        ) : (
          'Rules are checked from the top. The first one that matches decides where the call goes.'
        )}
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
              state={states?.[rule]}
              reason={reasons.get(rule)}
              reserve={check !== undefined}
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
    </Column>
  );
}
