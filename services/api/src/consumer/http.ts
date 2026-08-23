/**
 * Mountable Node HTTP adapter for the Consumer BFF.
 * Phase B platform API runtime may host this handler; this is not a
 * second ledger, Kernel, or Exchange.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import { handleConsumerBff, type ConsumerBffRuntime } from './handler.ts';

const BODY_LIMIT = 64 * 1024;

export type RunningConsumerBff = {
  readonly url: string;
  readonly close: () => Promise<void>;
};

export async function startConsumerBff(input: {
  readonly runtime: ConsumerBffRuntime;
  readonly host?: string;
  readonly port?: number;
}): Promise<RunningConsumerBff> {
  const host = input.host ?? '127.0.0.1';
  const server: Server = createServer(async (req, res) => {
    await serve(input.runtime, req, res);
  });
  await new Promise<void>((resolve) => {
    server.listen(input.port ?? 0, host, () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('consumer BFF failed to bind');
  }
  return {
    url: `http://${host}:${address.port}`,
    close: async () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

export async function serve(runtime: ConsumerBffRuntime, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const method = req.method ?? 'GET';
  const rawUrl = req.url ?? '/';
  const url = new URL(rawUrl, 'http://127.0.0.1');
  let body: unknown = {};
  if (method === 'PATCH' || method === 'POST' || method === 'PUT') {
    try {
      const raw = await readBody(req, BODY_LIMIT);
      body = raw.length === 0 ? {} : JSON.parse(raw);
    } catch {
      write(res, 400, {
        errorCode: 'MALFORMED',
        category: 'VALIDATION',
        message: 'malformed JSON',
        retryable: false,
        detailsSafeForClient: {},
        requestId: 'req_malformed',
        apiVersion: 'v1',
      });
      return;
    }
  }
  const authorization = typeof req.headers.authorization === 'string' ? req.headers.authorization : undefined;
  const query: Record<string, string> = {};
  for (const [key, value] of url.searchParams.entries()) {
    query[key] = value;
  }
  const idempotencyKey =
    typeof req.headers['idempotency-key'] === 'string' ? req.headers['idempotency-key'] : undefined;
  const accept = typeof req.headers.accept === 'string' ? req.headers.accept : undefined;
  const result = handleConsumerBff(runtime, {
    method,
    path: url.pathname,
    query,
    body,
    authorization,
    ...(idempotencyKey ? { idempotencyKey } : {}),
    ...(accept ? { accept } : {}),
  });
  write(res, result.status, result.body, result.headers);
}

function write(res: ServerResponse, status: number, body: unknown, headers: Readonly<Record<string, string>> = {}): void {
  if (typeof body === 'string' && (headers['content-type'] ?? '').startsWith('text/event-stream')) {
    res.writeHead(status, {
      ...headers,
      'content-type': headers['content-type'] ?? 'text/event-stream; charset=utf-8',
      'content-length': Buffer.byteLength(body),
    });
    res.end(body);
    return;
  }
  const json = JSON.stringify(body, (_key, value) => (typeof value === 'bigint' ? value.toString() : value));
  res.writeHead(status, {
    ...headers,
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(json),
  });
  res.end(json);
}

function readBody(req: IncomingMessage, limit: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let oversized = false;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        oversized = true;
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (oversized) {
        reject(new Error('OVERSIZED_REQUEST'));
        return;
      }
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', reject);
  });
}
