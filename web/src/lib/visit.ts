import { config } from './config';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

/** Lets the API know the page was opened, so the owner gets an email. Never runs locally. */
export function announceVisit(): void {
  if (!config.apiUrl || LOCAL_HOSTS.has(window.location.hostname)) return;
  // No body or custom headers, so this stays a simple request with no CORS preflight.
  fetch(`${config.apiUrl}/v1/visit`, { method: 'POST', keepalive: true }).catch(() => {});
}
