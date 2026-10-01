import { afterEach, describe, expect, it, vi } from 'vitest';

async function announceFrom(hostname: string, apiUrl: string) {
  vi.resetModules();
  vi.doMock('./config', () => ({ config: { apiUrl } }));
  const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fetch);
  vi.stubGlobal('window', { location: { hostname } });
  const { announceVisit } = await import('./visit');
  announceVisit();
  return fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.doUnmock('./config');
});

describe('announceVisit', () => {
  it('posts to the API from the deployed site', async () => {
    const fetch = await announceFrom('main.example.amplifyapp.com', 'https://api.example.com');
    expect(fetch).toHaveBeenCalledWith('https://api.example.com/v1/visit', { method: 'POST', keepalive: true });
  });

  it('stays quiet on localhost', async () => {
    expect(await announceFrom('localhost', 'https://api.example.com')).not.toHaveBeenCalled();
  });

  it('stays quiet when no API is configured', async () => {
    expect(await announceFrom('main.example.amplifyapp.com', '')).not.toHaveBeenCalled();
  });

  it('ignores a failed request', async () => {
    vi.resetModules();
    vi.doMock('./config', () => ({ config: { apiUrl: 'https://api.example.com' } }));
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    vi.stubGlobal('window', { location: { hostname: 'main.example.amplifyapp.com' } });
    const { announceVisit } = await import('./visit');
    expect(() => announceVisit()).not.toThrow();
    await Promise.resolve();
  });
});
