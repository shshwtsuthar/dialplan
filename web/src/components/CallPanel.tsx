'use client';

import { WEEKDAYS, type Dialplan } from '@dialplan/shared';
import { IconPencil, IconPhone, IconPlayerPause, IconPlayerPlay, IconX } from '@tabler/icons-react';
import { DateTime } from 'luxon';
import { useState, type FormEvent } from 'react';
import { SPEED } from '@/lib/clock';
import { dayBar, dayPercent, openStatus } from '@/lib/dayBar';
import { formatPhone } from '@/lib/format';
import { Column } from './Column';

export type Preset = 'tuesday-evening' | 'vip-call' | 'thanksgiving';

const PRESETS: { id: Preset; label: string; hint: string }[] = [
  { id: 'tuesday-evening', label: 'Tuesday 7pm', hint: 'New customer, after closing' },
  { id: 'vip-call', label: 'VIP call', hint: 'A VIP caller, right now' },
  { id: 'thanksgiving', label: 'Thanksgiving', hint: '11am on the holiday' },
];

export const OTHER_CALLERS = [
  { number: '+17605550123', name: 'New customer' },
  { number: '+14425550188', name: 'Returning customer' },
  { number: 'anonymous', name: 'Withheld number' },
] as const;

interface Props {
  now: number | undefined;
  running: boolean;
  timezone: string;
  dialplan: Dialplan | undefined;
  did: string | undefined;
  caller: string;
  calling: boolean;
  onCallerChange: (caller: string) => void;
  onCall: () => void;
  onSetClock: (epochMs: number) => void;
  onToggleClock: () => void;
  onPreset: (preset: Preset) => void;
  className?: string;
}

export function CallPanel(props: Props) {
  const { dialplan, did, caller, calling, onCallerChange, onCall, onPreset, className } = props;
  const vipCallers = dialplan?.rules.vip.callers ?? [];
  const otherCallers: { number: string; name: string }[] = OTHER_CALLERS.filter(
    (c) => !vipCallers.some((v) => v.number === c.number),
  );
  // Keep the current caller selectable even after it leaves the VIP list.
  if (![...vipCallers, ...otherCallers].some((c) => c.number === caller)) {
    otherCallers.unshift({ number: caller, name: 'Previous caller' });
  }

  return (
    <Column title="Call" className={className}>
      <Clock {...props} />

      <div className="space-y-2.5 border-t p-2.5">
        <div className="space-y-1.5">
          <label htmlFor="caller" className="label block">
            From
          </label>
          <select id="caller" value={caller} onChange={(event) => onCallerChange(event.target.value)} className="field">
            {vipCallers.length > 0 && (
              <optgroup label="On the VIP list">
                {vipCallers.map((c) => (
                  <option key={c.number} value={c.number}>
                    {c.name}, {formatPhone(c.number)}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="Other callers">
              {otherCallers.map((c) => (
                <option key={c.number} value={c.number}>
                  {c.name}
                  {c.number === 'anonymous' ? '' : `, ${formatPhone(c.number)}`}
                </option>
              ))}
            </optgroup>
          </select>
        </div>
        <button type="button" onClick={onCall} disabled={!did || calling} className="btn btn-primary h-9 w-full">
          <IconPhone size={16} />
          {did ? `Call ${formatPhone(did)}` : 'Call'}
        </button>
      </div>

      <div className="border-t py-1.5">
        <p className="label px-2.5 py-1">Try a scenario</p>
        <ul>
          {PRESETS.map((preset) => (
            <li key={preset.id}>
              <button
                type="button"
                disabled={!did || (preset.id === 'vip-call' && vipCallers.length === 0)}
                onClick={() => onPreset(preset.id)}
                className="btn btn-ghost w-full justify-between gap-2.5 text-left"
              >
                <span>{preset.label}</span>
                <span className="truncate text-[13px] font-normal text-muted-foreground">{preset.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

    </Column>
  );
}

function Clock({ now, running, timezone, dialplan, onSetClock, onToggleClock }: Props) {
  const [editing, setEditing] = useState(false);
  const local = now === undefined ? undefined : DateTime.fromMillis(now, { zone: timezone });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get('at');
    const chosen = typeof value === 'string' ? DateTime.fromISO(value, { zone: timezone }) : undefined;
    if (chosen?.isValid) {
      onSetClock(chosen.toMillis());
      setEditing(false);
    }
  }

  return (
    <section aria-label="Simulated clock" className="space-y-2.5 p-2.5">
      <div>
        <p className="label">{local ? `${local.toFormat('cccc d LLLL yyyy')} in San Diego` : ' '}</p>
        <div className="mt-1 flex items-center justify-between gap-2.5">
          <p className="text-[32px] leading-none font-semibold tracking-tight tabular-nums">
            {local ? local.toFormat('h:mm') : '–:––'}
            <span className="ml-1 text-base font-medium text-muted-foreground">{local?.toFormat('a')}</span>
          </p>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={onToggleClock}
              className="btn btn-outline btn-icon"
              aria-label={running ? 'Pause the clock' : 'Start the clock'}
            >
              {running ? <IconPlayerPause size={16} /> : <IconPlayerPlay size={16} />}
            </button>
            <button
              type="button"
              onClick={() => setEditing((e) => !e)}
              className="btn btn-outline btn-icon"
              aria-label="Set the clock"
              aria-expanded={editing}
            >
              <IconPencil size={16} />
            </button>
          </div>
        </div>
      </div>

      {editing && local && (
        <form onSubmit={submit} className="flex gap-1">
          <input
            type="datetime-local"
            name="at"
            required
            defaultValue={local.toFormat("yyyy-LL-dd'T'HH:mm")}
            className="field"
            aria-label="Date and time in San Diego"
          />
          <button type="submit" className="btn btn-outline h-9">
            Set time
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="btn btn-ghost btn-icon size-9"
            aria-label="Cancel"
          >
            <IconX size={16} />
          </button>
        </form>
      )}

      <DayBar local={local} dialplan={dialplan} running={running} />
    </section>
  );
}

/** Today at a glance: night, opening hours, and where the clock is now. */
function DayBar({ local, dialplan, running }: { local: DateTime | undefined; dialplan: Dialplan | undefined; running: boolean }) {
  const minutes = local ? local.hour * 60 + local.minute : 0;
  const rules = dialplan?.rules;
  const holiday =
    local && rules?.holidays.enabled ? rules.holidays.dates.find((h) => h.date === local.toISODate()) : undefined;
  const intervals =
    local && rules?.hours.enabled && !holiday ? rules.hours.weekly[WEEKDAYS[local.weekday - 1]!] : [];
  const { night, open } = dayBar(intervals);

  let status = '';
  if (local && rules) {
    if (holiday) status = `${holiday.name}: closed for the holiday`;
    else if (!rules.hours.enabled) status = 'Opening hours are off';
    else status = openStatus(minutes, intervals);
  }

  return (
    <div>
      <div aria-hidden className="relative h-6 border bg-surface">
        {night.map((s) => (
          <div key={s.start} className="absolute inset-y-0 bg-muted" style={place(s.start, s.end)} />
        ))}
        {open.map((s) => (
          <div
            key={s.start}
            className="absolute inset-y-0 border-x border-success-border bg-success-surface"
            style={place(s.start, s.end)}
          />
        ))}
        {local && (
          <div
            className="absolute -inset-y-1 w-0.5 -translate-x-1/2 bg-foreground"
            style={{ left: `${dayPercent(minutes)}%` }}
          />
        )}
      </div>
      <div aria-hidden className="relative mt-1 h-4 text-xs text-muted-foreground tabular-nums">
        <span className="absolute left-0">00</span>
        {['06', '12', '18'].map((hour) => (
          <span key={hour} className="absolute -translate-x-1/2" style={{ left: `${dayPercent(Number(hour) * 60)}%` }}>
            {hour}
          </span>
        ))}
        <span className="absolute right-0">24</span>
      </div>
      <p className="mt-1.5 flex justify-between gap-2.5 text-[13px]">
        <span className={holiday ? 'text-warning' : undefined}>{status}</span>
        <span className="shrink-0 text-muted-foreground">{running ? `${SPEED}× speed` : 'Paused'}</span>
      </p>
    </div>
  );
}

function place(start: number, end: number) {
  return { left: `${start}%`, width: `${end - start}%` };
}
