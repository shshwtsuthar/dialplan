'use client';

import type { AuditEntry, Dialplan, NumberSummary, Rules } from '@dialplan/shared';
import { IconAlertTriangle, IconRotate } from '@tabler/icons-react';
import { DateTime } from 'luxon';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { nextWeekdayAt, simClock, upcomingThanksgiving, useSimClock } from '@/lib/clock';
import { cn } from '@/lib/cn';
import { DEFAULT_TIMEZONE, TENANT_ID } from '@/lib/config';
import { formatPhone } from '@/lib/format';
import { refreshNow } from '@/lib/useNow';
import { BuildInfo } from './BuildInfo';
import { CallPanel, OTHER_CALLERS, type Preset } from './CallPanel';
import { DialplanPanel } from './dialplan/DialplanPanel';
import { ResultPanel, type CallState } from './ResultPanel';

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
  const [error, setError] = useState<string>();
  const [resetting, setResetting] = useState(false);

  const timezone = dialplan?.timezone ?? DEFAULT_TIMEZONE;

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

  const result = call.status === 'answered' ? call.result : undefined;

  return (
    <div className="mx-auto max-w-[1200px] p-2.5 lg:p-5">
      <div className="border bg-surface">
        <header className="flex min-h-12 flex-wrap items-center gap-x-5 gap-y-1.5 border-b px-2.5 py-2">
          <h1 className="text-lg font-semibold tracking-tight">Harbor Auto</h1>
          <nav aria-label="Phone numbers" className="flex divide-x border">
            {(numbers ?? []).map((n) => (
              <button
                key={n.did}
                type="button"
                onClick={() => selectNumber(n.did)}
                aria-pressed={n.did === did}
                className={cn(
                  'flex h-[30px] items-center gap-1.5 px-2.5 transition-colors',
                  n.did === did ? 'bg-muted font-medium' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {n.name}
                <span className="hidden text-[13px] font-normal text-muted-foreground tabular-nums sm:inline">
                  {formatPhone(n.did)}
                </span>
              </button>
            ))}
          </nav>
          <div className="flex w-full items-center justify-between gap-2.5 lg:ml-auto lg:w-auto">
            <BuildInfo />
            <button type="button" onClick={() => void reset()} disabled={resetting || !did} className="btn btn-outline">
              <IconRotate size={16} className={cn(resetting && 'animate-spin')} />
              {resetting ? 'Resetting…' : 'Reset demo'}
            </button>
          </div>
        </header>

        {error && (
          <div role="alert" className="flex items-center gap-1.5 border-b bg-error-surface px-2.5 py-2 text-error">
            <IconAlertTriangle size={16} className="shrink-0" />
            {error}
          </div>
        )}

        <main className="grid lg:grid-cols-3">
          <CallPanel
            now={clock?.now}
            running={clock?.running ?? true}
            timezone={timezone}
            dialplan={dialplan}
            did={did}
            caller={caller}
            calling={call.status === 'routing'}
            onCallerChange={setCaller}
            onCall={() => void placeCall()}
            onSetClock={(at) => simClock.set(at)}
            onToggleClock={() => simClock.toggle()}
            onPreset={runPreset}
          />
          <DialplanPanel
            className="order-3 border-t lg:order-none lg:border-t-0 lg:border-l"
            dialplan={dialplan}
            audit={audit}
            trace={result?.trace}
            now={clock?.now}
            onSave={saveRules}
            onReload={() => (did ? load(did) : Promise.resolve())}
          />
          <ResultPanel className="order-2 border-t lg:order-none lg:border-t-0 lg:border-l" call={call} />
        </main>
      </div>
    </div>
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
