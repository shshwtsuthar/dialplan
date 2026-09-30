'use client';

import { useEffect, useState } from 'react';
import { HealthResponse } from '@dialplan/shared';
import { BuildInfo } from '@/components/BuildInfo';
import { config } from '@/lib/config';

type Status = { state: 'loading' } | { state: 'ok'; health: HealthResponse } | { state: 'error'; message: string };

export default function Home() {
  const [status, setStatus] = useState<Status>({ state: 'loading' });

  useEffect(() => {
    fetch(`${config.apiUrl}/v1/health`)
      .then(async (res) => HealthResponse.parse(await res.json()))
      .then((health) => setStatus({ state: 'ok', health }))
      .catch((error: unknown) => setStatus({ state: 'error', message: String(error) }));
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 px-4">
      <h1 className="text-3xl font-semibold">Harbor Auto · Call routing</h1>
      <p className="text-slate-400">
        API:{' '}
        {status.state === 'loading' && 'checking…'}
        {status.state === 'ok' && `ok (${status.health.region})`}
        {status.state === 'error' && `unreachable: ${status.message}`}
      </p>
      <footer className="text-sm text-slate-500">
        <BuildInfo />
      </footer>
    </main>
  );
}
