'use client';

import type { AuditEntry, Dialplan, NumberSummary, Rules } from '@dialplan/shared';
import { Anchor, RotateCcw, TriangleAlert } from 'lucide-react';
import { DateTime } from 'luxon';
import { useCallback, useEffect, useState } from 'react';
import { api, type RouteResult } from '@/lib/api';
import { nextWeekdayAt, simClock, upcomingThanksgiving, useSimClock } from '@/lib/clock';
import { cn } from '@/lib/cn';
import { DEFAULT_TIMEZONE, TENANT_ID } from '@/lib/config';
import { formatPhone } from '@/lib/format';
import { refreshNow } from '@/lib/useNow';
import { BuildInfo } from './BuildInfo';
import { ClockPanel, type Preset } from './ClockPanel';
import { DialplanPanel } from './dialplan/DialplanPanel';
import { AuditPanel, TimingsPanel, TracePanel } from './Panels';
import { OTHER_CALLERS, Phone, type CallState } from './Phone';
import { Sky } from './Sky';

const NEW_CUSTOMER = OTHER_CALLERS[0].number;

export function Demo() {
  const clock = useSimClock();
  const [numbers, setNumbers] = useState<NumberSummary[]>();
  const [did, setDid] = useState<string>();
  const [dialplan, setDialplan] = useState<Dialplan>();
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [caller, setCaller] = useState<string>(NEW_CUSTOMER);
  const [call, setCall] = useState<CallState>({ status: 'idle' });
  const [lastCall, setLastCall] = useState<{ caller: string; at: number }>();
  const [history, setHistory] = useState<RouteResult[]>([]);
  const [error, setError] = useState<string>();
  const [resetting, setResetting] = useState(false);

  const timezone = dialplan?.timezone ?? DEFAULT_TIMEZONE;
  const hour = clock ? DateTime.fromMillis(clock.now, { zone: timezone }).toFormat('H:m').split(':') : undefined;
  const hourOfDay = hour ? Number(hour[0]) + Number(hour[1]) / 60 : 12;

  const show = useCallback(([plan, log]: [Dialplan, AuditEntry[]]) => {
    setDialplan(plan);
    setAudit(log);
    refreshNow();
  }, []);
  const load = useCallback(async (number: string) => show(await fetchNumber(number)), [show]);

  useEffect(() => {
    api
      .numbers(TENANT_ID)
      .then(({ numbers }) => {
        setNumbers(numbers);
        setDid((current) => current ?? numbers[0]?.did);
      })
      .catch((e: unknown) => setError(errorMessage(e)));
  }, []);

  useEffect(() => {
    if (!did) return;
    let stale = false;
    fetchNumber(did)
      .then((data) => stale || show(data))
      .catch((e: unknown) => stale || setError(errorMessage(e)));
    return () => {
      stale = true;
    };
  }, [did, show]);

  async function placeCall(options: { caller?: string; at?: number } = {}) {
    if (!did) return;
    const who = options.caller ?? caller;
    const at = options.at ?? simClock.now();
    const timestamp = DateTime.fromMillis(at, { zone: timezone }).toISO({ suppressMilliseconds: true })!;
    setCall({ status: 'routing' });
    setLastCall({ caller: who, at });
    try {
      const result = await api.route({ did, caller: who, timestamp });
      setCall({ status: 'answered', result, id: Date.now() });
      setHistory((h) => [result, ...h].slice(0, 12));
    } catch (e) {
      setCall({ status: 'failed', message: errorMessage(e) });
    }
  }

  function runPreset(preset: Preset) {
    const now = DateTime.fromMillis(simClock.now(), { zone: timezone });
    switch (preset) {
      case 'tuesday-evening': {
        const at = nextWeekdayAt(now, 2, 19).toMillis();
        simClock.set(at);
        setCaller(NEW_CUSTOMER);
        void placeCall({ caller: NEW_CUSTOMER, at });
        break;
      }
      case 'vip-call': {
        const vip = dialplan?.rules.vip.callers[0]?.number;
        if (!vip) return;
        setCaller(vip);
        void placeCall({ caller: vip });
        break;
      }
      case 'thanksgiving': {
        const at = upcomingThanksgiving(now).toMillis();
        simClock.set(at);
        setCaller(NEW_CUSTOMER);
        void placeCall({ caller: NEW_CUSTOMER, at });
        break;
      }
    }
  }

  async function saveRules(rules: Rules) {
    if (!dialplan) return;
    const saved = await api.saveRules(dialplan.did, dialplan.version, rules);
    setDialplan(saved);
    refreshNow();
    api
      .audit(saved.did)
      .then((log) => setAudit(log.entries))
      .catch(() => undefined);
    // Re-route the last call against the new rules, so the effect is visible.
    if (lastCall) void placeCall(lastCall);
  }

  function selectNumber(number: string) {
    if (number === did) return;
    setDid(number);
    setDialplan(undefined);
    setCall({ status: 'idle' });
    setLastCall(undefined);
  }

  async function reset() {
    if (!did) return;
    setResetting(true);
    try {
      await api.reset();
      await load(did);
      setCall({ status: 'idle' });
      setLastCall(undefined);
      setError(undefined);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setResetting(false);
    }
  }

  const current = numbers?.find((n) => n.did === did);
  const result = call.status === 'answered' ? call.result : undefined;

  return (
    <>
      <Sky hour={hourOfDay} />
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:py-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:justify-between">
          <div className="card flex flex-col justify-between gap-4 p-4">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-xl bg-sky-600 text-white shadow-md shadow-sky-600/30">
                <Anchor className="size-6" />
              </span>
              <div>
                <h1 className="text-xl font-semibold text-slate-900">Harbor Auto</h1>
                <p className="text-sm text-slate-500">Call routing · San Diego, CA</p>
              </div>
            </div>
            <nav aria-label="Phone numbers" className="flex flex-wrap gap-2">
              {(numbers ?? []).map((n) => (
                <button
                  key={n.did}
                  type="button"
                  onClick={() => selectNumber(n.did)}
                  aria-pressed={n.did === did}
                  className={cn(
                    'button border text-left',
                    n.did === did
                      ? 'border-sky-600 bg-sky-600 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-sky-300',
                  )}
                >
                  <span>{n.name}</span>
                  <span className={cn('font-mono text-xs', n.did === did ? 'text-sky-100' : 'text-slate-400')}>
                    {formatPhone(n.did)}
                  </span>
                </button>
              ))}
            </nav>
          </div>
          <ClockPanel
            now={clock?.now}
            running={clock?.running ?? true}
            timezone={timezone}
            onSet={(at) => simClock.set(at)}
            onToggle={() => simClock.toggle()}
            onPreset={runPreset}
            vipAvailable={(dialplan?.rules.vip.callers.length ?? 0) > 0}
          />
        </header>

        {error && (
          <div role="alert" className="card flex items-center gap-2 border-l-4 border-rose-500 p-3 text-sm text-rose-800">
            <TriangleAlert className="size-4 shrink-0" />
            {error}
          </div>
        )}

        <main className="grid gap-4 [grid-template-areas:'phone''decision''dialplan''audit'] lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:[grid-template-areas:'dialplan_phone_decision'_'dialplan_phone_audit']">
          <div className="[grid-area:dialplan]">
            <DialplanPanel
              dialplan={dialplan}
              trace={result?.trace}
              now={clock?.now}
              onSave={saveRules}
              onReload={() => (did ? load(did) : Promise.resolve())}
            />
          </div>
          <div className="[grid-area:phone] lg:sticky lg:top-6 lg:self-start">
            <Phone
              numberName={current?.name}
              did={did}
              now={clock?.now}
              timezone={timezone}
              vipCallers={dialplan?.rules.vip.callers ?? []}
              caller={caller}
              onCallerChange={setCaller}
              onCall={() => void placeCall()}
              call={call}
            />
          </div>
          <div className="flex flex-col gap-4 [grid-area:decision]">
            <TracePanel result={result} />
            <TimingsPanel history={history} />
          </div>
          <div className="[grid-area:audit]">
            <AuditPanel entries={audit} />
          </div>
        </main>

        <footer className="card mt-auto flex flex-col gap-3 px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <BuildInfo />
          <button
            type="button"
            onClick={() => void reset()}
            disabled={resetting || !did}
            className="button border border-slate-200 bg-white text-slate-700 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
          >
            <RotateCcw className={cn('size-4', resetting && 'animate-spin')} />
            {resetting ? 'Resetting…' : 'Reset demo data'}
          </button>
        </footer>
      </div>
    </>
  );
}

async function fetchNumber(did: string): Promise<[Dialplan, AuditEntry[]]> {
  const [plan, log] = await Promise.all([api.dialplan(did), api.audit(did)]);
  return [plan, log.entries];
}

function errorMessage(error: unknown): string {
  if (error instanceof TypeError) return 'Could not reach the API. Check your connection and try again.';
  return error instanceof Error ? error.message : 'Something went wrong';
}
