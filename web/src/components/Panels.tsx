'use client';

import type { AuditEntry, TraceStep } from '@dialplan/shared';
import { Check, Clock3, History, Minus, X, Zap } from 'lucide-react';
import type { ReactNode } from 'react';
import type { RouteResult } from '@/lib/api';
import { cn } from '@/lib/cn';
import { RULE_TITLES, relativeTime } from '@/lib/format';
import { useNow } from '@/lib/useNow';

function Panel({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="card p-4" aria-label={title}>
      <header className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Decision trace
// ---------------------------------------------------------------------------

const STEP_STYLES: Record<TraceStep['result'], { icon: typeof Check; className: string; label: string }> = {
  info: { icon: Clock3, className: 'bg-slate-100 text-slate-600', label: 'Local time' },
  matched: { icon: Check, className: 'bg-emerald-100 text-emerald-700', label: 'Matched' },
  no_match: { icon: X, className: 'bg-slate-100 text-slate-500', label: 'No match' },
  disabled: { icon: Minus, className: 'bg-slate-100 text-slate-400', label: 'Off' },
};

export function TracePanel({ result }: { result: RouteResult | undefined }) {
  return (
    <Panel title="Decision trace" aside={<code className="font-mono text-[11px] text-slate-500">?explain=true</code>}>
      {!result?.trace ? (
        <p className="text-sm text-slate-500">Place a call to see each rule the engine checked, in order.</p>
      ) : (
        <ol className="relative space-y-3">
          {result.trace.map((step, index) => {
            const style = STEP_STYLES[step.result];
            const Icon = style.icon;
            return (
              <li key={`${step.stage}-${index}`} className="settle flex gap-3" style={{ animationDelay: `${index * 60}ms` }}>
                <span className={cn('mt-0.5 grid size-6 shrink-0 place-items-center rounded-full', style.className)}>
                  <Icon className="size-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">
                    {step.stage === 'clock' ? 'Local time' : RULE_TITLES[step.stage]}
                    {step.stage !== 'clock' && (
                      <span
                        className={cn(
                          'ml-2 text-xs font-normal',
                          step.result === 'matched' ? 'text-emerald-700' : 'text-slate-400',
                        )}
                      >
                        {style.label}
                      </span>
                    )}
                  </p>
                  <p className="text-sm break-words text-slate-600">{step.detail}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Timings
// ---------------------------------------------------------------------------

export function TimingsPanel({ history }: { history: RouteResult[] }) {
  const latest = history[0];
  const max = Math.max(...history.map((h) => h.roundTripMs), 1);

  return (
    <Panel
      title="Timings"
      aside={
        latest?.coldStart && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
            <Zap className="size-3" /> Cold start
          </span>
        )
      }
    >
      <dl className="grid grid-cols-2 gap-2">
        <Stat label="Round trip" hint="Browser to API and back" value={latest?.roundTripMs} />
        <Stat label="Server" hint="Inside the Lambda handler" value={latest?.serverMs} />
        <Stat label="DynamoDB read" hint="One consistent GetItem" value={latest?.timings.dbMs} />
        <Stat label="Rule engine" hint="Pure function" value={latest?.timings.engineMs} />
      </dl>
      {history.length > 1 && (
        <div className="mt-3">
          <p className="mb-1 text-xs text-slate-500">Round trip, last {history.length} calls (newest right)</p>
          <div className="flex h-10 items-end gap-1" aria-hidden>
            {[...history].reverse().map((h, index) => (
              <span
                key={index}
                title={`${h.roundTripMs} ms${h.coldStart ? ' (cold start)' : ''}`}
                className={cn('w-full rounded-t-sm', h.coldStart ? 'bg-amber-400' : 'bg-sky-400')}
                style={{ height: `${Math.max(8, (h.roundTripMs / max) * 100)}%` }}
              />
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}

function Stat({ label, hint, value }: { label: string; hint: string; value: number | undefined }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2" title={hint}>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="font-mono text-lg font-semibold text-slate-900 tabular-nums">
        {value === undefined ? '–' : value < 10 ? value.toFixed(2) : Math.round(value)}
        <span className="ml-0.5 text-xs font-normal text-slate-500">ms</span>
      </dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export function AuditPanel({ entries }: { entries: AuditEntry[] }) {
  const now = useNow();
  return (
    <Panel title="Audit log" aside={<History className="size-4 text-slate-400" />}>
      {entries.length === 0 ? (
        <p className="text-sm text-slate-500">No changes yet. Edit a rule to see it here.</p>
      ) : (
        <ol className="max-h-80 space-y-3 overflow-y-auto pr-1">
          {entries.map((entry) => (
            <li key={entry.at} className="text-sm">
              <p className="flex items-center gap-2 text-xs text-slate-500">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-slate-700">v{entry.version}</span>
                <span className="font-medium text-slate-700">{entry.action === 'reset' ? 'Reset' : 'Edited'}</span>
                {now !== undefined && <span>{relativeTime(entry.at, now)}</span>}
              </p>
              <ul className="mt-1 space-y-0.5 pl-1 text-slate-600">
                {entry.changes.map((change) => (
                  <li key={change}>{change}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
