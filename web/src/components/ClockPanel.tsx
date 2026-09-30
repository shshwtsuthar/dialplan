'use client';

import { Check, Pause, Pencil, Play, X } from 'lucide-react';
import { DateTime } from 'luxon';
import { useState, type FormEvent } from 'react';
import { SPEED } from '@/lib/clock';

export type Preset = 'tuesday-evening' | 'vip-call' | 'thanksgiving';

const PRESETS: { id: Preset; label: string; hint: string }[] = [
  { id: 'tuesday-evening', label: 'Tuesday 7pm', hint: 'A new customer calls after closing' },
  { id: 'vip-call', label: 'VIP call', hint: 'A VIP calls now' },
  { id: 'thanksgiving', label: 'Thanksgiving', hint: 'A call at 11am on Thanksgiving' },
];

interface Props {
  now: number | undefined;
  running: boolean;
  timezone: string;
  onSet: (epochMs: number) => void;
  onToggle: () => void;
  onPreset: (preset: Preset) => void;
  vipAvailable: boolean;
}

export function ClockPanel({ now, running, timezone, onSet, onToggle, onPreset, vipAvailable }: Props) {
  const [editing, setEditing] = useState(false);
  const local = now === undefined ? undefined : DateTime.fromMillis(now, { zone: timezone });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get('at');
    const chosen = typeof value === 'string' ? DateTime.fromISO(value, { zone: timezone }) : undefined;
    if (chosen?.isValid) {
      onSet(chosen.toMillis());
      setEditing(false);
    }
  }

  return (
    <section aria-label="Simulated clock" className="card flex flex-col gap-3 p-4 lg:w-[400px]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Time in San Diego</p>
          <p className="font-mono text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">
            {local ? local.toFormat('h:mm') : '–:––'}
            <span className="ml-1 text-lg text-slate-500">{local?.toFormat('a')}</span>
          </p>
          <p className="truncate text-sm text-slate-600">
            {local ? `${local.toFormat('cccc, d LLLL yyyy')} · ${local.offsetNameShort}` : ' '}
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <button
            type="button"
            onClick={onToggle}
            className="button bg-slate-900 text-white hover:bg-slate-700"
            aria-label={running ? 'Pause the clock' : 'Start the clock'}
          >
            {running ? <Pause className="size-4" /> : <Play className="size-4" />}
          </button>
          <button
            type="button"
            onClick={() => setEditing((e) => !e)}
            className="button bg-slate-100 text-slate-700 hover:bg-slate-200"
            aria-label="Set the clock"
            aria-expanded={editing}
          >
            <Pencil className="size-4" />
          </button>
        </div>
      </div>

      {editing && local && (
        <form onSubmit={submit} className="flex items-center gap-2">
          <input
            type="datetime-local"
            name="at"
            required
            defaultValue={local.toFormat("yyyy-LL-dd'T'HH:mm")}
            className="field"
            aria-label="Date and time in San Diego"
          />
          <button type="submit" className="button bg-sky-600 text-white hover:bg-sky-500" aria-label="Set time">
            <Check className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="button bg-slate-100 text-slate-700 hover:bg-slate-200"
            aria-label="Cancel"
          >
            <X className="size-4" />
          </button>
        </form>
      )}

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            title={preset.hint}
            disabled={preset.id === 'vip-call' && !vipAvailable}
            onClick={() => onPreset(preset.id)}
            className="button border border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800"
          >
            {preset.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-slate-500">
        {running ? `Running at ${SPEED}×: three minutes of day, three of night.` : 'Paused.'} Calls use this time.
      </p>
    </section>
  );
}
