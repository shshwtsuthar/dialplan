import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import { notFound, respond, type HttpEvent, type HttpResult } from '../http';

export type Notify = (subject: string, message: string) => Promise<void>;

// Crawlers and scripted clients that happen to run the page's JavaScript.
const AUTOMATED = /bot|crawl|spider|slurp|headless|curl|wget|python|go-http|java\//i;

/** POST /v1/visit: the page calls this once per load, and the owner gets an email. */
export function createHandler(notify: Notify, webOrigin: string, now = () => new Date()) {
  return async function handler(event: HttpEvent): Promise<HttpResult> {
    return respond(event, async () => {
      if (event.routeKey !== 'POST /v1/visit') return notFound(event);

      const userAgent = event.headers['user-agent'] ?? '';
      // Browsers always send Origin on a cross-origin POST; anything else is not our page.
      if (event.headers.origin === webOrigin && !AUTOMATED.test(userAgent)) {
        const ip = event.requestContext.http.sourceIp;
        console.info('visit', { ip, userAgent });
        await notify(
          'Someone opened the dialplan demo',
          [
            `Time: ${now().toISOString()}`,
            `IP: ${ip}`,
            `Browser: ${userAgent || 'unknown'}`,
            `Language: ${event.headers['accept-language'] ?? 'unknown'}`,
            `Came from: ${event.headers.referer ?? 'unknown'}`,
          ].join('\n'),
        );
      }
      return { statusCode: 204 };
    });
  };
}

const sns = new SNSClient({});

export const handler = createHandler(
  async (subject, message) => {
    await sns.send(new PublishCommand({ TopicArn: process.env.TOPIC_ARN, Subject: subject, Message: message }));
  },
  process.env.WEB_ORIGIN ?? '',
);
