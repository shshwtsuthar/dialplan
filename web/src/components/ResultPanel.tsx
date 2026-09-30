'use client';

import type { Dialplan } from '@dialplan/shared';
import { IconAlertTriangle } from '@tabler/icons-react';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { RouteResult } from '@/lib/api';
import { callPath } from '@/lib/callPath';
import type { StopProgress } from '@/lib/checks';
import { describeTarget, formatPhone, RULE_TITLES } from '@/lib/format';
import { placeOf, SAN_DIEGO, type Place } from '@/lib/places';
import { stagePhase, type Replay, type StageMarks, type StagePhase } from '@/lib/replay';
import { Column } from './Column';
import type { Checks } from './route/globeCanvas';

// The globe and its map data load after the page, in a chunk of their own.
const Globe = dynamic(() => import('./route/Globe'), { ssr: false });

/** One placed call: who called, at what simulated time, and how much of its trip to replay. */
export interface CallInfo {
  id: number;
  caller: string;
  at: number;
  replay: Replay;
}

export type CallState =
  | { status: 'idle' }
  | ({ status: 'routing' } & CallInfo)
  | ({ status: 'answered'; result: RouteResult } & CallInfo)
  | ({ status: 'failed'; message: string } & CallInfo);

const OUTCOME_VERB = {
  ring_group: 'Ringing',
  extension: 'Ringing',
  voicemail: 'Sent to voicemail',
  external: 'Forwarding to',
} as const;

const NO_MARKS: StageMarks = { landed: false, finished: false, skipped: false };

interface Props {
  call: CallState;
  dialplan: Dialplan | undefined;
  /** Where a call is among the rules while the globe checks them. */
  onCheck: (id: number, progress: StopProgress) => void;
  /** Called once a call's replay is over and its result is showing. */
  onSettled: (id: number) => void;
  className?: string;
}

export function ResultPanel({ call, dialplan, onCheck, onSettled, className }: Props) {
  const [marks, setMarks] = useState<StageMarks & { id?: number }>(NO_MARKS);

  const id = call.status === 'idle' ? undefined : call.id;
  const phase = stagePhase(call.status === 'idle' ? undefined : call.replay, marks.id === id ? marks : NO_MARKS);
  const result = call.status === 'answered' ? call.result : undefined;
  const settled = phase === 'done' && result !== undefined;
  const replaying = (phase === 'flying' || phase === 'checking') && call.status !== 'failed';

  const mark = useCallback((callId: number, patch: Partial<StageMarks>) => {
    setMarks((prev) => ({ ...(prev.id === callId ? prev : NO_MARKS), ...patch, id: callId }));
  }, []);

  useEffect(() => {
    if (settled && id !== undefined) onSettled(id);
  }, [settled, id, onSettled]);

  // What the globe shows at the business: each rule the call reached, then where it went.
  const checks = useMemo((): Checks | undefined => {
    if (!result?.trace) return undefined;
    const path = callPath(result.trace);
    return {
      stops: path.checked.map(({ rule, outcome }) => ({ label: RULE_TITLES[rule], outcome })),
      destination: path.matched && result.decision.label,
    };
  }, [result]);

  const home = (dialplan && placeOf(dialplan.did)) ?? SAN_DIEGO;
  const from = call.status === 'idle' ? undefined : placeOf(call.caller);

  return (
    <Column
      title="Result"
      className={className}
      aside={
        replaying &&
        id !== undefined && (
          <button type="button" onClick={() => mark(id, { skipped: true })} className="btn btn-ghost -mr-2.5">
            Skip
          </button>
        )
      }
    >
      <div className="h-[400px] border-b">
        <Globe
          home={home}
          call={
            call.status === 'idle'
              ? undefined
              : {
                  id: call.id,
                  from,
                  replay: call.replay,
                  answered: call.status === 'answered',
                  failed: call.status === 'failed',
                  checks,
                }
          }
          play={phase === 'flying' || phase === 'checking'}
          onLanded={() => id !== undefined && mark(id, { landed: true })}
          onCheck={(progress) => id !== undefined && onCheck(id, progress)}
          onFinished={() => id !== undefined && mark(id, { finished: true })}
          label={globeLabel(home, from, result)}
        />
      </div>
      <div aria-live="polite">
        <Outcome call={call} phase={phase} from={from} />
      </div>
    </Column>
  );
}

function globeLabel(home: Place, from: Place | undefined, result: RouteResult | undefined): string {
  if (!from) return `A globe centred on ${home.city}`;
  const call = `A call from ${from.city} to ${home.city}`;
  return result ? `${call}, sent to ${result.decision.label}` : call;
}

function Outcome({ call, phase, from }: { call: CallState; phase: StagePhase; from: Place | undefined }) {
  if (call.status === 'routing' || (call.status === 'answered' && phase !== 'done')) {
    return (
      <p className="p-2.5 text-muted-foreground">
        {phase === 'flying' ? callingFrom(call.caller, from) : 'Checking the dialplan…'}
      </p>
    );
  }

  switch (call.status) {
    case 'idle':
      return <p className="p-2.5 text-muted-foreground">Place a call to see where it rings, and why.</p>;

    case 'failed':
      return (
        <p role="alert" className="flex gap-1.5 p-2.5 text-error">
          <IconAlertTriangle size={16} className="mt-0.5 shrink-0" />
          {call.message}
        </p>
      );

    case 'answered': {
      const { decision, roundTripMs, serverMs, timings, coldStart } = call.result;
      return (
        <div key={call.id} className="settle">
          <div className="p-2.5">
            <p className="label">{OUTCOME_VERB[decision.kind]}</p>
            <p className="mt-1 text-xl leading-tight font-semibold tracking-tight">{decision.label}</p>
            <p className="mt-0.5 text-muted-foreground">{describeTarget(decision)}</p>
          </div>

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

function callingFrom(caller: string, from: Place | undefined): string {
  if (from) return `Calling from ${from.city}…`;
  return caller === 'anonymous' ? 'Calling with caller ID withheld…' : `Calling from ${formatPhone(caller)}…`;
}
