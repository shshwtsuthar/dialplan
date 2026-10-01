import { describe, expect, it } from 'vitest';
import { httpEvent } from '../testing';
import { createHandler } from './visit';

const ORIGIN = 'https://main.example.amplifyapp.com';
const FIREFOX = 'Mozilla/5.0 (X11; Linux x86_64; rv:155.0) Gecko/20100101 Firefox/155.0';
const NOW = new Date('2026-10-01T03:00:00Z');

function setup() {
  const sent: { subject: string; message: string }[] = [];
  const handler = createHandler(async (subject, message) => void sent.push({ subject, message }), ORIGIN, () => NOW);
  return { sent, handler };
}

describe('visit notification', () => {
  it('emails the owner when a browser opens the page', async () => {
    const { sent, handler } = setup();
    const res = await handler(
      httpEvent('POST /v1/visit', {
        ip: '203.0.113.9',
        headers: { origin: ORIGIN, 'user-agent': FIREFOX, referer: 'https://www.linkedin.com/' },
      }),
    );
    expect(res).toEqual({ statusCode: 204 });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.message).toContain('IP: 203.0.113.9');
    expect(sent[0]!.message).toContain('Time: 2026-10-01T03:00:00.000Z');
    expect(sent[0]!.message).toContain('Came from: https://www.linkedin.com/');
  });

  it.each([
    ['another origin', { origin: 'https://evil.example', 'user-agent': FIREFOX }],
    ['no origin', { 'user-agent': FIREFOX }],
    ['a crawler', { origin: ORIGIN, 'user-agent': 'Mozilla/5.0 (compatible; bingbot/2.0)' }],
    ['a headless browser', { origin: ORIGIN, 'user-agent': 'Mozilla/5.0 HeadlessChrome/153.0' }],
    ['curl', { origin: ORIGIN, 'user-agent': 'curl/8.15.0' }],
  ])('stays quiet for %s', async (_name, headers) => {
    const { sent, handler } = setup();
    const res = await handler(httpEvent('POST /v1/visit', { ip: '203.0.113.9', headers }));
    expect(res).toEqual({ statusCode: 204 });
    expect(sent).toEqual([]);
  });

  it('answers 404 for other routes', async () => {
    const { handler } = setup();
    const res = await handler(httpEvent('GET /v1/visit'));
    expect('statusCode' in res && res.statusCode).toBe(404);
  });
});
