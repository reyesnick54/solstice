import { DEFAULT_RETRY_POLICY, shouldRetryRead } from './retry.ts';
import type { ApiErrorEnvelope } from './errors.ts';

export class SdkHttpError extends Error {
  readonly status: number;
  readonly envelope: ApiErrorEnvelope | null;

  constructor(status: number, message: string, envelope: ApiErrorEnvelope | null) {
    super(message);
    this.status = status;
    this.envelope = envelope;
  }
}

export type HttpTransport = {
  readonly baseUrl: string;
  readonly get: <T>(path: string) => Promise<T>;
  readonly post: <T>(path: string, body: unknown, headers?: Readonly<Record<string, string>>) => Promise<T>;
};

async function parse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) {
    return {};
  }
  return JSON.parse(text) as unknown;
}

export function createHttpTransport(baseUrl: string): HttpTransport {
  const root = baseUrl.replace(/\/$/, '');

  async function request(method: 'GET' | 'POST', path: string, body?: unknown, headers?: Readonly<Record<string, string>>): Promise<unknown> {
    const isRead = method === 'GET';
    let lastError: unknown;
    const attempts = isRead ? DEFAULT_RETRY_POLICY.maxAttempts : 1;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const response = await fetch(`${root}${path}`, {
        method,
        headers: {
          accept: 'application/json',
          ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
          ...headers,
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      const parsed = await parse(response);
      if (response.ok) {
        return parsed;
      }
      const envelope = parsed && typeof parsed === 'object' && 'error_code' in parsed
        ? (parsed as ApiErrorEnvelope)
        : null;
      if (isRead && shouldRetryRead(response.status) && attempt + 1 < attempts) {
        lastError = new SdkHttpError(response.status, envelope?.message ?? response.statusText, envelope);
        await new Promise((resolve) => setTimeout(resolve, DEFAULT_RETRY_POLICY.backoffMs[attempt] ?? 50));
        continue;
      }
      throw new SdkHttpError(response.status, envelope?.message ?? response.statusText, envelope);
    }
    throw lastError instanceof Error ? lastError : new Error('request failed');
  }

  return {
    baseUrl: root,
    get: (path) => request('GET', path) as Promise<never>,
    post: (path, body, headers) => request('POST', path, body, headers) as Promise<never>,
  };
}
