'use client';

import type { TraceStep } from '@dialplan/shared';
import { IconAlertTriangle, IconCheck, IconClock, IconLoader2, IconMinus, IconX } from '@tabler/icons-react';
import type { RouteResult } from '@/lib/api';
import { cn } from '@/lib/cn';
import { describeTarget, RULE_TITLES } from '@/lib/format';
import { Column } from './Column';

export type CallState =
  | { status: 'idle' }
  | { status: 'routing' }
  | { status: 'answered'; result: RouteResult; id: number }
  | { status: 'failed'; message: string };

const OUTCOME_VERB = {
  ring_group: 'Ringing',
  extension: 'Ringing',
  voicemail: 'Sent to voicemail',
  external: 'Forwarding to',
} as const;

const STEPS: Record<TraceStep['result'], { icon: typeof IconCheck; className: string; label: string }> = {
  info: { icon: IconClock, className: 'text-muted-foreground', label: '' },
  matched: { icon: IconCheck, className: 'text-success', label: 'Matched' },
  no_match: { icon: IconX, className: 'text-muted-foreground', label: 'No match' },
  disabled: { icon: IconMinus, className: 'text-muted-foreground', label: 'Off' },
};

export function ResultPanel({ call, className }: { call: CallState; className?: string }) {
  return (
    <Column title="Result" className={className}>
      <div aria-live="polite">
        <Outcome call={call} />
      </div>
    </Column>
  );
}

function Outcome({ call }: { call: CallState }) {
  switch (call.status) {
    case 'idle':
      return <p className="p-2.5 text-muted-foreground">Place a call to see where it rings, and why.</p>;

    case 'routing':
      return (
        <p className="flex items-center gap-1.5 p-2.5 text-muted-foreground">
          <IconLoader2 size={16} className="animate-spin" />
          Asking the dialplan…
        </p>
      );

    case 'failed':
      return (
        <p role="alert" className="flex gap-1.5 p-2.5 text-error">
          <IconAlertTriangle size={16} className="mt-0.5 shrink-0" />
          {call.message}
        </p>
      );

    case 'answered': {
      const { decision, trace, roundTripMs, serverMs, timings, coldStart } = call.result;
      return (
        <div key={call.id} className="settle">
          <div className="p-2.5">
            <p className="label">{OUTCOME_VERB[decision.kind]}</p>
            <p className="mt-1 text-xl leading-tight font-semibold tracking-tight">{decision.label}</p>
            <p className="mt-0.5 text-muted-foreground">{describeTarget(decision)}</p>
          </div>

          {trace && (
            <div className="border-t p-2.5">
              <p className="label">Why</p>
              <ol className="mt-1.5 space-y-2">
                {trace.map((step, index) => {
                  const style = STEPS[step.result];
                  const Icon = style.icon;
                  return (
                    <li key={`${step.stage}-${index}`} className="flex gap-1.5">
                      <Icon size={16} className={cn('mt-0.5 shrink-0', style.className)} />
                      <div className="min-w-0">
                        <p className="font-medium">
                          {step.stage === 'clock' ? 'Local time' : RULE_TITLES[step.stage]}
                          {style.label && (
                            <span className={cn('ml-1.5 text-[13px] font-normal', style.className)}>{style.label}</span>
                          )}
                        </p>
                        <p className="text-[13px] break-words text-muted-foreground">{step.detail}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          <div className="border-t p-2.5">
            <p className="label flex items-center gap-1.5">
              Timings
              {coldStart && <span className="badge bg-warning-surface text-warning">Cold start</span>}
            </p>
            <dl className="mt-1.5">
              <Timing label="Round trip" hint="Browser to the API and back" value={roundTripMs} />
              <Timing label="Server" hint="Inside the Lambda handler" value={serverMs} />
              <Timing label="DynamoDB read" hint="One consistent GetItem" value={timings.dbMs} />
              <Timing label="Rule engine" hint="A pure function" value={timings.engineMs} />
            </dl>
          </div>
        </div>
      );
    }
  }
}

function Timing({ label, hint, value }: { label: string; hint: string; value: number }) {
  return (
    <div className="flex h-8 items-center justify-between gap-2.5 border-b last:border-b-0" title={hint}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">
        {value < 10 ? value.toFixed(2) : Math.round(value)}
        <span className="ml-0.5 text-muted-foreground">ms</span>
      </dd>
    </div>
  );
}
