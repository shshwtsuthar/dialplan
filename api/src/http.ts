import type { ApiError } from '@dialplan/shared';
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { z } from 'zod';

export type HttpEvent = APIGatewayProxyEventV2;
export type HttpResult = APIGatewayProxyStructuredResultV2;

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly extra: Partial<ApiError> = {},
  ) {
    super(message);
  }
}

export function json(statusCode: number, body: unknown, headers: Record<string, string> = {}): HttpResult {
  return {
    statusCode,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers },
    body: JSON.stringify(body),
  };
}

/** Parses a JSON body against a schema, or throws a 400 listing every problem. */
export function parseBody<T extends z.ZodType>(event: HttpEvent, schema: T): z.infer<T> {
  let raw: unknown;
  try {
    const text = event.isBase64Encoded ? Buffer.from(event.body ?? '', 'base64').toString('utf8') : event.body;
    raw = JSON.parse(text ?? '');
  } catch {
    throw new HttpError(400, 'invalid_json', 'The request body must be JSON');
  }
  return validate(schema, raw, 'The request body is invalid');
}

export function validate<T extends z.ZodType>(schema: T, value: unknown, message: string): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new HttpError(400, 'invalid_request', message, {
      issues: result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    });
  }
  return result.data;
}

export function pathParam(event: HttpEvent, name: string): string {
  return decodeURIComponent(event.pathParameters?.[name] ?? '');
}

/** Turns thrown errors into JSON responses; anything unexpected is a logged 500. */
export async function respond(event: HttpEvent, handle: () => Promise<HttpResult>): Promise<HttpResult> {
  try {
    return await handle();
  } catch (error) {
    if (error instanceof HttpError) {
      return json(error.status, { error: error.code, message: error.message, ...error.extra } satisfies ApiError);
    }
    console.error('Unhandled error', { routeKey: event.routeKey, requestId: event.requestContext?.requestId, error });
    return json(500, { error: 'internal', message: 'Something went wrong' } satisfies ApiError);
  }
}

export function notFound(event: HttpEvent): HttpResult {
  return json(404, { error: 'not_found', message: `No route for ${event.routeKey}` } satisfies ApiError);
}
