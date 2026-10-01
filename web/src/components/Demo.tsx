'use client';

import type { Dialplan, NumberSummary, Rules } from '@dialplan/shared';
import { IconAlertTriangle, IconInfoCircle, IconRotate } from '@tabler/icons-react';
import { DateTime } from 'luxon';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { StopProgress } from '@/lib/checks';
import { nextWeekdayAt, simClock, upcomingThanksgiving, useSimClock } from '@/lib/clock';
import { cn } from '@/lib/cn';
import { DEFAULT_TIMEZONE, TENANT_ID } from '@/lib/config';
import { formatPhone } from '@/lib/format';
import type { Replay } from '@/lib/replay';
import { themeAt } from '@/lib/theme';
import { refreshNow } from '@/lib/useNow';
import { announceVisit } from '@/lib/visit';
import { AboutDialog } from './AboutDialog';
import { BuildInfo } from './BuildInfo';
import { CallPanel, OTHER_CALLERS, type Preset } from './CallPanel';
import { DialplanPanel, type RuleCheck } from './dialplan/DialplanPanel';
import { ResultPanel, type CallState } from './ResultPanel';

const NEW_CUSTOMER = OTHER_CALLERS[0].number;

export function Demo() {
  const clock = useSimClock();
  const [numbers, setNumbers] = useState<NumberSummary[]>();
  const [did, setDid] = useState<string>();
  const [dialplan, setDialplan] = useState<Dialplan>();
  const [caller, setCaller] = useState<string>(NEW_CUSTOMER);
  const [call, setCall] = useState<CallState>({ status: 'idle' });
  // How far down the rules the globe has taken a call, and the last call whose replay has finished.
  const [checking, setChecking] = useState<{ id: number; progress: StopProgress }>();
  const [settled, setSettled] = useState<number>();
  const about = useRef<HTMLDialogElement>(null);
  // Each call gets the next id; an answer for anything but the latest call is dropped.
  const latestCall = useRef(0);
  const [lastCall, setLastCall] = useState<{ caller: string; at: number }>();
  const [error, setError] = useState<string>();
  const [resetting, setResetting] = useState(false);

  const timezone = dialplan?.timezone ?? DEFAULT_TIMEZONE;
  const local = clock ? DateTime.fromMillis(clock.now, { zone: timezone }) : undefined;
  const hour = local ? local.hour + local.minute / 60 : undefined;
  const theme = hour === undefined ? undefined : themeAt(hour);

  // Light while the sun is up in San Diego, dark at night; the colours crossfade in CSS.
  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(announceVisit, []);

  const show = useCallback((plan: Dialplan) => {
    setDialplan(plan);
    refreshNow();
  }, []);
  const load = useCallback(async (number: string) => show(await api.dialplan(number)), [show]);

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
    api
      .dialplan(did)
      .then((plan) => stale || show(plan))
      .catch((e: unknown) => stale || setError(errorMessage(e)));
    return () => {
      stale = true;
    };
  }, [did, show]);

  async function placeCall(options: { caller?: string; at?: number; replay?: Replay } = {}) {
    if (!did) return;
    const info = {
      id: ++latestCall.current,
      caller: options.caller ?? caller,
      at: options.at ?? simClock.now(),
      replay: options.replay ?? 'full',
    };
    const timestamp = DateTime.fromMillis(info.at, { zone: timezone }).toISO({ suppressMilliseconds: true })!;
    setCall({ status: 'routing', ...info });
    setLastCall({ caller: info.caller, at: info.at });
    try {
      const result = await api.route({ did, caller: info.caller, timestamp });
      if (latestCall.current === info.id) setCall({ status: 'answered', result, ...info });
    } catch (e) {
      if (latestCall.current === info.id) setCall({ status: 'failed', message: errorMessage(e), ...info });
    }
  }

  function clearCall() {
    latestCall.current++;
    setCall({ status: 'idle' });
    setLastCall(undefined);
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
    // Re-route the last call against the new rules, so the effect is visible. It is
    // already at the business, so only the rule checks replay.
    if (lastCall) void placeCall({ ...lastCall, replay: 'checks' });
  }

  function selectNumber(number: string) {
    if (number === did) return;
    setDid(number);
    setDialplan(undefined);
    clearCall();
  }

  async function reset() {
    if (!did) return;
    setResetting(true);
    try {
      await api.reset();
      await load(did);
      clearCall();
      setError(undefined);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setResetting(false);
    }
  }

  // The Dialplan column marks each rule as the globe's replay reaches it, and all of them once it is over.
  let check: RuleCheck | undefined;
  if (call.status === 'routing' || call.status === 'answered') {
    const result = call.status === 'answered' ? call.result : undefined;
    let progress: RuleCheck['progress'];
    if (result && call.id === settled) progress = 'all';
    else if (result && call.id === checking?.id) progress = checking.progress;
    check = { at: call.at, result, progress };
  }

  return (
    <div className="flex min-h-dvh flex-col p-2.5 lg:p-5">
      {/* Centred both ways while it fits; taller than the window, it starts at the top and scrolls. */}
      <div className="m-auto w-full max-w-[1200px] border bg-surface">
        <header className="flex min-h-12 flex-wrap items-center gap-x-5 gap-y-1.5 border-b px-2.5 py-2">
          <h1 className="text-lg font-semibold tracking-tight">Harbor Auto</h1>
          <div className="flex items-center gap-2.5">
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
            <button
              type="button"
              onClick={() => about.current?.showModal()}
              className="btn btn-outline btn-icon"
              aria-label="About this demo"
              title="About this demo"
            >
              <IconInfoCircle size={16} />
            </button>
          </div>
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
            check={check}
            now={clock?.now}
            onSave={saveRules}
            onReload={() => (did ? load(did) : Promise.resolve())}
          />
          <ResultPanel
            className="order-2 border-t lg:order-none lg:border-t-0 lg:border-l"
            call={call}
            dialplan={dialplan}
            onCheck={(id, progress) => setChecking({ id, progress })}
            onSettled={setSettled}
          />
        </main>
      </div>
      <AboutDialog ref={about} />
    </div>
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof TypeError) return 'Could not reach the API. Check your connection and try again.';
  return error instanceof Error ? error.message : 'Something went wrong';
}
