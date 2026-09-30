'use client';

import type { VipCaller } from '@dialplan/shared';
import { BatteryFull, LoaderCircle, Phone as PhoneIcon, PhoneCall, Signal, TriangleAlert, Wifi } from 'lucide-react';
import { DateTime } from 'luxon';
import type { RouteResult } from '@/lib/api';
import { DESTINATION_KINDS, formatPhone, RULE_TITLES } from '@/lib/format';
import { DESTINATION_ICONS } from './icons';

export type CallState =
  | { status: 'idle' }
  | { status: 'routing' }
  | { status: 'answered'; result: RouteResult; id: number }
  | { status: 'failed'; message: string };

export const OTHER_CALLERS = [
  { number: '+17605550123', name: 'New customer' },
  { number: '+14425550188', name: 'Returning customer' },
  { number: 'anonymous', name: 'Withheld number' },
] as const;

const OUTCOME_VERB = {
  ring_group: 'Ringing',
  extension: 'Ringing',
  voicemail: 'Sent to voicemail',
  external: 'Forwarding to',
} as const;

interface Props {
  numberName: string | undefined;
  did: string | undefined;
  now: number | undefined;
  timezone: string;
  vipCallers: VipCaller[];
  caller: string;
  onCallerChange: (caller: string) => void;
  onCall: () => void;
  call: CallState;
}

export function Phone({ numberName, did, now, timezone, vipCallers, caller, onCallerChange, onCall, call }: Props) {
  const clock = now === undefined ? '' : DateTime.fromMillis(now, { zone: timezone }).toFormat('h:mm');
  const otherCallers: { number: string; name: string }[] = OTHER_CALLERS.filter(
    (c) => !vipCallers.some((v) => v.number === c.number),
  );
  // Keep the current caller selectable even after it leaves the VIP list.
  if (![...vipCallers, ...otherCallers].some((c) => c.number === caller)) {
    otherCallers.unshift({ number: caller, name: 'Previous caller' });
  }

  return (
    <section aria-label="Phone" className="mx-auto w-full max-w-[330px]">
      <div className="rounded-[2.75rem] bg-slate-900 p-2.5 shadow-2xl ring-1 shadow-slate-950/40 ring-white/10">
        <div className="relative flex min-h-[580px] flex-col overflow-hidden rounded-[2.3rem] bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950 px-5 pt-3 pb-6 text-white">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="w-12 tabular-nums">{clock}</span>
            <span className="h-6 w-24 rounded-full bg-black" />
            <span className="flex w-12 justify-end gap-1">
              <Signal className="size-3.5" />
              <Wifi className="size-3.5" />
              <BatteryFull className="size-3.5" />
            </span>
          </div>

          <div className="mt-7 text-center">
            <p className="text-[11px] font-medium tracking-[0.2em] text-slate-400 uppercase">Calling</p>
            <p className="mt-1 text-2xl font-semibold">Harbor Auto</p>
            <p className="mt-0.5 text-sm text-slate-300">
              {numberName ?? '…'} · {did ? formatPhone(did) : ''}
            </p>
          </div>

          <div className="flex flex-1 items-center justify-center py-6" aria-live="polite">
            <CallScreen call={call} timezone={timezone} />
          </div>

          <label htmlFor="caller" className="text-xs font-medium text-slate-400">
            Call from
          </label>
          <select
            id="caller"
            value={caller}
            onChange={(event) => onCallerChange(event.target.value)}
            className="mt-1 w-full rounded-xl border-0 bg-white/10 px-3 py-2.5 text-sm text-white ring-1 ring-white/15 focus:ring-2 focus:ring-emerald-400 focus:outline-none"
          >
            {vipCallers.length > 0 && (
              <optgroup label="On the VIP list">
                {vipCallers.map((c) => (
                  <option key={c.number} value={c.number} className="text-slate-900">
                    {c.name} · {formatPhone(c.number)}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="Other callers">
              {otherCallers.map((c) => (
                <option key={c.number} value={c.number} className="text-slate-900">
                  {c.name}
                  {c.number === 'anonymous' ? '' : ` · ${formatPhone(c.number)}`}
                </option>
              ))}
            </optgroup>
          </select>

          <button
            type="button"
            onClick={onCall}
            disabled={!did || call.status === 'routing'}
            className="mx-auto mt-5 grid size-16 place-items-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400 focus-visible:ring-4 focus-visible:ring-emerald-300/60 focus-visible:outline-none active:scale-95 disabled:opacity-60"
            aria-label="Place the call"
          >
            <PhoneIcon className="size-7" fill="currentColor" />
          </button>
        </div>
      </div>
      <p className="mx-auto mt-3 max-w-[300px] text-center text-xs text-white/80 drop-shadow">
        This page plays the phone switch: each call asks <code className="font-mono">POST /v1/route</code> where it
        should ring.
      </p>
    </section>
  );
}

function CallScreen({ call, timezone }: { call: CallState; timezone: string }) {
  switch (call.status) {
    case 'idle':
      return (
        <div className="text-center text-sm text-slate-400">
          <PhoneCall className="mx-auto mb-3 size-10 text-slate-500" />
          Pick a caller and press call.
        </div>
      );

    case 'routing':
      return (
        <div className="text-center">
          <div className="relative mx-auto grid size-20 place-items-center">
            <span className="ring-out absolute inset-0 rounded-full bg-emerald-400/40" />
            <LoaderCircle className="size-9 animate-spin text-emerald-300" />
          </div>
          <p className="mt-4 text-sm text-slate-300">Asking the dialplan…</p>
        </div>
      );

    case 'failed':
      return (
        <div className="text-center text-sm text-rose-200">
          <TriangleAlert className="mx-auto mb-3 size-10 text-rose-300" />
          {call.message}
        </div>
      );

    case 'answered': {
      const { decision, matchedRule, localTime } = call.result;
      const Icon = DESTINATION_ICONS[decision.kind];
      const at = DateTime.fromISO(localTime, { zone: timezone });
      return (
        <div key={call.id} className="settle text-center">
          <div className="relative mx-auto grid size-20 place-items-center">
            <span className="ring-out absolute inset-0 rounded-full bg-emerald-400/30" />
            <span className="grid size-20 place-items-center rounded-full bg-emerald-500/20 ring-1 ring-emerald-300/50">
              <Icon className="size-9 text-emerald-200" />
            </span>
          </div>
          <p className="mt-4 text-xs font-medium tracking-wide text-emerald-200 uppercase">
            {OUTCOME_VERB[decision.kind]}
          </p>
          <p className="mt-1 text-xl leading-tight font-semibold">{decision.label}</p>
          <p className="mt-1 text-xs text-slate-400">
            {DESTINATION_KINDS[decision.kind]} · {decision.kind === 'external' ? formatPhone(decision.target) : decision.target}
          </p>
          <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs text-slate-200">
            {RULE_TITLES[matchedRule]} · {at.toFormat('ccc h:mm a')}
          </p>
        </div>
      );
    }
  }
}
