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
import { IconAlertTriangle, IconPlus, IconRefresh, IconTrash, IconX } from '@tabler/icons-react';
import { Fragment, useState, type FormEvent, type ReactNode } from 'react';
import { ApiRequestError } from '@/lib/api';
import { DESTINATION_KINDS, normalizePhone, RULE_TITLES } from '@/lib/format';

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
    <form onSubmit={(event) => void submit(event)} className="p-2.5" aria-label={`Edit ${RULE_TITLES[rule]}`}>
      <div className="mb-1.5 flex h-8 items-center justify-between gap-2.5">
        <h3 className="font-semibold">{RULE_TITLES[rule]}</h3>
        <button
          type="button"
          onClick={onClose}
          className="btn btn-ghost btn-icon -mr-2 text-muted-foreground hover:text-foreground"
          aria-label="Cancel editing"
        >
          <IconX size={16} />
        </button>
      </div>

      <div className="space-y-2.5">
        {rule === 'vip' && <VipFields value={rules.vip} onChange={(v) => set('vip', v)} />}
        {rule === 'holidays' && <HolidayFields value={rules.holidays} onChange={(v) => set('holidays', v)} />}
        {rule === 'hours' && <HoursFields value={rules.hours} onChange={(v) => set('hours', v)} />}
        <DestinationFields
          value={rules[rule].destination}
          onChange={(destination) => set(rule, { ...rules[rule], destination })}
        />
      </div>

      {errors.length > 0 && (
        <ul className="mt-2.5 space-y-1 bg-error-surface p-2.5 text-[13px] text-error" role="alert">
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}

      {conflict !== undefined && (
        <div className="mt-2.5 flex items-start gap-1.5 bg-warning-surface p-2.5 text-[13px] text-warning" role="alert">
          <IconAlertTriangle size={16} className="mt-0.5 shrink-0" />
          <p className="flex-1">
            Someone else saved this dialplan while you were editing (it is now v{conflict}). Nothing was overwritten.
          </p>
          <button type="button" onClick={() => void onReload()} className="btn btn-outline text-foreground">
            <IconRefresh size={16} /> Reload
          </button>
        </div>
      )}

      <div className="mt-2.5 flex justify-end gap-1.5">
        <button type="button" onClick={onClose} className="btn btn-outline">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="btn btn-primary">
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
    <label className="flex h-9 items-center gap-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-[var(--primary)]"
      />
      {children}
    </label>
  );
}

function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="btn btn-ghost -ml-2.5">
      <IconPlus size={16} /> {children}
    </button>
  );
}

function RemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="btn btn-ghost btn-icon size-9 text-muted-foreground hover:text-error"
    >
      <IconTrash size={16} />
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
      <div className="space-y-1.5">
        {value.callers.map((caller, index) => (
          <div key={index} className="flex gap-1.5">
            <input
              className="field"
              value={caller.name}
              onChange={(e) => update(index, { name: e.target.value })}
              placeholder="Name"
              aria-label={`VIP caller ${index + 1} name`}
            />
            <input
              className="field max-w-[9.5rem] tabular-nums"
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
      <div className="max-h-64 space-y-1.5 overflow-y-auto">
        {value.dates.map((holiday, index) => (
          <div key={index} className="flex gap-1.5">
            <input
              type="date"
              className="field max-w-[10rem] tabular-nums"
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
      {/* One grid per day, so the opening and closing times line up down the week. */}
      <div className="divide-y border">
        {WEEKDAYS.map((day) => {
          const intervals = value.weekly[day];
          const add =
            intervals.length < 4 ? (
              <button
                type="button"
                onClick={() => setDay(day, [...intervals, { open: intervals.at(-1)?.close ?? '09:00', close: '17:00' }])}
                aria-label={`Add opening hours on ${WEEKDAY_NAMES[day]}`}
                title="Add hours"
                className="btn btn-ghost btn-icon size-9 text-muted-foreground hover:text-foreground"
              >
                <IconPlus size={16} />
              </button>
            ) : (
              <span />
            );
          return (
            <div
              key={day}
              className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto_minmax(0,1fr)_2.25rem_2.25rem] items-center gap-x-1 gap-y-1.5 px-2.5 py-1.5"
            >
              <span
                className="flex h-9 items-center self-start font-medium"
                style={{ gridRow: `span ${Math.max(1, intervals.length)}` }}
                title={WEEKDAY_NAMES[day]}
              >
                {WEEKDAY_NAMES[day].slice(0, 3)}
              </span>
              {intervals.length === 0 && (
                <>
                  <span className="col-span-4 text-muted-foreground">Closed</span>
                  {add}
                </>
              )}
              {intervals.map((interval, index) => (
                <Fragment key={index}>
                  <input
                    type="time"
                    className="field px-1 tabular-nums"
                    value={interval.open}
                    onChange={(e) => setDay(day, intervals.map((x, i) => (i === index ? { ...x, open: e.target.value } : x)))}
                    aria-label={`${WEEKDAY_NAMES[day]} opens`}
                  />
                  <span className="text-muted-foreground">–</span>
                  <input
                    type="time"
                    className="field px-1 tabular-nums"
                    value={interval.close}
                    onChange={(e) => setDay(day, intervals.map((x, i) => (i === index ? { ...x, close: e.target.value } : x)))}
                    aria-label={`${WEEKDAY_NAMES[day]} closes`}
                  />
                  <RemoveButton
                    label={`Remove ${WEEKDAY_NAMES[day]} hours`}
                    onClick={() => setDay(day, intervals.filter((_, i) => i !== index))}
                  />
                  {index === intervals.length - 1 ? add : <span />}
                </Fragment>
              ))}
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
    <fieldset>
      <legend className="sr-only">Destination</legend>
      <p className="label mb-1.5">Send matching calls to</p>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-1.5">
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
          className="field"
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
