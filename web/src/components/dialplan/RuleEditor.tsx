'use client';

import {
  Rules,
  WEEKDAY_NAMES,
  WEEKDAYS,
  type Destination,
  type Dialplan,
  type RuleId,
  type Weekday,
} from '@dialplan/shared';
import { Plus, RotateCcw, Trash2, TriangleAlert, X } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { ApiRequestError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { DESTINATION_KINDS, normalizePhone, RULE_TITLES } from '@/lib/format';
import { RULE_ICONS } from '../icons';
import { RULE_COLORS } from './RuleCard';

interface Props {
  rule: RuleId;
  dialplan: Dialplan;
  onClose: () => void;
  onSave: (rules: Rules) => Promise<void>;
  onReload: () => Promise<void>;
}

/** Inline editor for one rule. Validates with the shared schema before sending. */
export function RuleEditor({ rule, dialplan, onClose, onSave, onReload }: Props) {
  const [rules, setRules] = useState<Rules>(() => structuredClone(dialplan.rules));
  const [errors, setErrors] = useState<string[]>([]);
  const [conflict, setConflict] = useState<number>();
  const [saving, setSaving] = useState(false);
  const Icon = RULE_ICONS[rule];

  async function submit(event: FormEvent) {
    event.preventDefault();
    const candidate: Rules = {
      ...rules,
      vip: { ...rules.vip, callers: rules.vip.callers.map((c) => ({ ...c, number: normalizePhone(c.number) })) },
    };
    const parsed = Rules.safeParse(candidate);
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((issue) => describeIssue(issue.path, issue.message)));
      return;
    }
    setSaving(true);
    setErrors([]);
    try {
      await onSave(parsed.data);
      onClose();
    } catch (error) {
      setSaving(false);
      if (error instanceof ApiRequestError && error.status === 409) {
        setConflict(error.body?.currentVersion ?? dialplan.version + 1);
      } else if (error instanceof ApiRequestError && error.body?.issues) {
        setErrors(error.body.issues.map((issue) => describeIssue(issue.path.split('.').slice(1), issue.message)));
      } else {
        setErrors([error instanceof Error ? error.message : 'Could not save the dialplan']);
      }
    }
  }

  const set = <K extends RuleId>(key: K, value: Rules[K]) => setRules((current) => ({ ...current, [key]: value }));

  return (
    <form onSubmit={(event) => void submit(event)} className="p-3.5" aria-label={`Edit ${RULE_TITLES[rule]}`}>
      <div className="mb-3 flex items-center gap-2.5">
        <Icon className={cn('size-4', RULE_COLORS[rule])} />
        <h3 className="font-medium text-slate-900">{RULE_TITLES[rule]}</h3>
        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-800">Editing</span>
        <button
          type="button"
          onClick={onClose}
          className="button ml-auto px-1.5 text-slate-500 hover:bg-slate-100"
          aria-label="Cancel editing"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="space-y-4">
        {rule === 'vip' && <VipFields value={rules.vip} onChange={(v) => set('vip', v)} />}
        {rule === 'holidays' && <HolidayFields value={rules.holidays} onChange={(v) => set('holidays', v)} />}
        {rule === 'hours' && <HoursFields value={rules.hours} onChange={(v) => set('hours', v)} />}
        <DestinationFields
          value={rules[rule].destination}
          onChange={(destination) => set(rule, { ...rules[rule], destination })}
        />
      </div>

      {errors.length > 0 && (
        <ul className="mt-3 space-y-1 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-800" role="alert">
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}

      {conflict !== undefined && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900" role="alert">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <p className="flex-1">
            Someone else saved this dialplan while you were editing (it is now v{conflict}). Nothing was overwritten.
          </p>
          <button type="button" onClick={() => void onReload()} className="button bg-amber-600 px-2 py-1 text-xs text-white hover:bg-amber-500">
            <RotateCcw className="size-3.5" /> Reload
          </button>
        </div>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="button text-slate-600 hover:bg-slate-100">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="button bg-sky-600 text-white hover:bg-sky-500">
          {saving ? 'Saving…' : `Save as v${dialplan.version + 1}`}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Fields
// ---------------------------------------------------------------------------

function Toggle({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-sky-600" />
      {children}
    </label>
  );
}

function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="button px-2 py-1 text-xs text-sky-700 hover:bg-sky-50">
      <Plus className="size-3.5" /> {children}
    </button>
  );
}

function RemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="button shrink-0 px-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
      <Trash2 className="size-3.5" />
    </button>
  );
}

function VipFields({ value, onChange }: { value: Rules['vip']; onChange: (v: Rules['vip']) => void }) {
  const update = (index: number, patch: Partial<Rules['vip']['callers'][number]>) =>
    onChange({ ...value, callers: value.callers.map((c, i) => (i === index ? { ...c, ...patch } : c)) });

  return (
    <>
      <Toggle checked={value.enabled} onChange={(enabled) => onChange({ ...value, enabled })}>
        Ring VIP callers straight through, whatever the time
      </Toggle>
      <div className="space-y-2">
        {value.callers.map((caller, index) => (
          <div key={index} className="flex gap-2">
            <input
              className="field"
              value={caller.name}
              onChange={(e) => update(index, { name: e.target.value })}
              placeholder="Name"
              aria-label={`VIP caller ${index + 1} name`}
            />
            <input
              className="field max-w-[9.5rem] font-mono"
              value={caller.number}
              onChange={(e) => update(index, { number: e.target.value })}
              placeholder="+16195550166"
              inputMode="tel"
              aria-label={`VIP caller ${index + 1} number`}
            />
            <RemoveButton
              label={`Remove ${caller.name || 'caller'}`}
              onClick={() => onChange({ ...value, callers: value.callers.filter((_, i) => i !== index) })}
            />
          </div>
        ))}
        <AddButton onClick={() => onChange({ ...value, callers: [...value.callers, { name: '', number: '' }] })}>
          Add VIP caller
        </AddButton>
      </div>
    </>
  );
}

function HolidayFields({ value, onChange }: { value: Rules['holidays']; onChange: (v: Rules['holidays']) => void }) {
  const update = (index: number, patch: Partial<Rules['holidays']['dates'][number]>) =>
    onChange({ ...value, dates: value.dates.map((h, i) => (i === index ? { ...h, ...patch } : h)) });

  return (
    <>
      <Toggle checked={value.enabled} onChange={(enabled) => onChange({ ...value, enabled })}>
        Use the holiday greeting on these dates
      </Toggle>
      <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
        {value.dates.map((holiday, index) => (
          <div key={index} className="flex gap-2">
            <input
              type="date"
              className="field max-w-[10rem]"
              value={holiday.date}
              onChange={(e) => update(index, { date: e.target.value })}
              aria-label={`Holiday ${index + 1} date`}
            />
            <input
              className="field"
              value={holiday.name}
              onChange={(e) => update(index, { name: e.target.value })}
              placeholder="Name"
              aria-label={`Holiday ${index + 1} name`}
            />
            <RemoveButton
              label={`Remove ${holiday.name || 'holiday'}`}
              onClick={() => onChange({ ...value, dates: value.dates.filter((_, i) => i !== index) })}
            />
          </div>
        ))}
      </div>
      <AddButton onClick={() => onChange({ ...value, dates: [...value.dates, { date: '', name: '' }] })}>
        Add holiday
      </AddButton>
    </>
  );
}

function HoursFields({ value, onChange }: { value: Rules['hours']; onChange: (v: Rules['hours']) => void }) {
  const setDay = (day: Weekday, intervals: Rules['hours']['weekly'][Weekday]) =>
    onChange({ ...value, weekly: { ...value.weekly, [day]: intervals } });

  return (
    <>
      <Toggle checked={value.enabled} onChange={(enabled) => onChange({ ...value, enabled })}>
        Route calls by opening hours
      </Toggle>
      <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
        {WEEKDAYS.map((day) => {
          const intervals = value.weekly[day];
          return (
            <div key={day} className="flex items-start gap-2 px-2.5 py-2">
              <span className="w-10 shrink-0 pt-1.5 text-sm font-medium text-slate-700" title={WEEKDAY_NAMES[day]}>
                {WEEKDAY_NAMES[day].slice(0, 3)}
              </span>
              <div className="flex flex-1 flex-wrap items-center gap-2">
                {intervals.length === 0 && <span className="pt-1 text-sm text-slate-400">Closed</span>}
                {intervals.map((interval, index) => (
                  <div key={index} className="flex items-center gap-1">
                    <input
                      type="time"
                      className="field w-[6.75rem] px-1.5 font-mono"
                      value={interval.open}
                      onChange={(e) => setDay(day, intervals.map((x, i) => (i === index ? { ...x, open: e.target.value } : x)))}
                      aria-label={`${WEEKDAY_NAMES[day]} opens`}
                    />
                    <span className="text-slate-400">–</span>
                    <input
                      type="time"
                      className="field w-[6.75rem] px-1.5 font-mono"
                      value={interval.close}
                      onChange={(e) => setDay(day, intervals.map((x, i) => (i === index ? { ...x, close: e.target.value } : x)))}
                      aria-label={`${WEEKDAY_NAMES[day]} closes`}
                    />
                    <RemoveButton
                      label={`Remove ${WEEKDAY_NAMES[day]} hours`}
                      onClick={() => setDay(day, intervals.filter((_, i) => i !== index))}
                    />
                  </div>
                ))}
                {intervals.length < 4 && (
                  <AddButton
                    onClick={() => setDay(day, [...intervals, { open: intervals.at(-1)?.close ?? '09:00', close: '17:00' }])}
                  >
                    {intervals.length === 0 ? 'Open' : 'Add'}
                  </AddButton>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function DestinationFields({ value, onChange }: { value: Destination; onChange: (v: Destination) => void }) {
  const placeholders = { ring_group: 'sales', extension: '201', voicemail: 'main', external: '+16195550199' };
  return (
    <fieldset className="rounded-lg bg-slate-50 p-2.5">
      <legend className="sr-only">Destination</legend>
      <p className="mb-2 text-xs font-medium text-slate-500">Send matching calls to</p>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
        <select
          className="field"
          value={value.kind}
          onChange={(e) => onChange({ ...value, kind: e.target.value as Destination['kind'] })}
          aria-label="Destination type"
        >
          {Object.entries(DESTINATION_KINDS).map(([kind, label]) => (
            <option key={kind} value={kind}>
              {label}
            </option>
          ))}
        </select>
        <input
          className="field font-mono"
          value={value.target}
          onChange={(e) => onChange({ ...value, target: e.target.value })}
          placeholder={placeholders[value.kind]}
          aria-label="Destination target"
        />
        <input
          className="field col-span-2"
          value={value.label}
          onChange={(e) => onChange({ ...value, label: e.target.value })}
          placeholder="Label, e.g. Sales floor"
          aria-label="Destination label"
        />
      </div>
    </fieldset>
  );
}

/** "hours.weekly.mon.0.close" + message → "Monday, hours 1: message". */
function describeIssue(path: PropertyKey[], message: string): string {
  const [, section, index, field] = path.map(String);
  let where = '';
  if (section === 'callers') where = `VIP caller ${Number(index) + 1}${field ? ` ${field}` : ''}`;
  else if (section === 'dates') where = `Holiday ${Number(index) + 1}${field ? ` ${field}` : ''}`;
  else if (section === 'weekly' && index) {
    where = `${WEEKDAY_NAMES[index as Weekday] ?? index}${field ? `, hours ${Number(field) + 1}` : ''}`;
  } else if (section === 'destination') where = `Destination${index ? ` ${index}` : ''}`;
  return where ? `${where}: ${message}` : message;
}
