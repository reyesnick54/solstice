import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join } from 'node:path';

import { handleExplorerRequest } from './api.ts';
import type { ExplorerIndexer } from './indexer.ts';
import type { ExplorerQueryService } from './queries.ts';

export type ExplorerServer = {
  readonly listen: string;
  readonly close: () => Promise<void>;
};

const MIME: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
};

export function startExplorerServer(
  listen: string,
  queries: ExplorerQueryService,
  indexer: ExplorerIndexer,
  webRoot: string,
): Promise<ExplorerServer> {
  const [host, portRaw] = listen.split(':');
  const port = Number.parseInt(portRaw ?? '8787', 10);
  const subscribers = new Set<ServerResponse>();

  indexer.startLive();
  indexer.chain.subscribe((event) => {
    const payload = `event: ${event.kind}\ndata: ${JSON.stringify(event)}\n\n`;
    for (const res of subscribers) {
      res.write(payload);
    }
  });

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://${listen}`);
    if (url.pathname === '/v1/events') {
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      });
      res.write('event: ready\ndata: {}\n\n');
      subscribers.add(res);
      req.on('close', () => subscribers.delete(res));
      return;
    }
    if (url.pathname.startsWith('/v1/')) {
      const handled = handleExplorerRequest(
        {
          method: req.method ?? 'GET',
          path: url.pathname,
          query: Object.fromEntries(url.searchParams.entries()),
        },
        queries,
        indexer,
      );
      res.writeHead(handled.status, handled.headers);
      res.end(handled.body);
      return;
    }
    serveStatic(req, res, webRoot, url.pathname);
  });

  return new Promise((resolve, reject) => {
    server.listen(port, host ?? '127.0.0.1', () => {
      resolve({
        listen: `${host ?? '127.0.0.1'}:${port}`,
        close: () => closeServer(server, indexer),
      });
    });
    server.on('error', reject);
  });
}

function serveStatic(req: IncomingMessage, res: ServerResponse, webRoot: string, pathname: string): void {
  const relative = pathname === '/' ? '/index.html' : pathname;
  const file = join(webRoot, relative.replace(/^\/+/, ''));
  if (!file.startsWith(webRoot) || !existsSync(file)) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('NOT_FOUND');
    return;
  }
  const type = MIME[extname(file)] ?? 'application/octet-stream';
  res.writeHead(200, { 'content-type': type });
  res.end(readFileSync(file));
  void req;
}

function closeServer(server: Server, indexer: ExplorerIndexer): Promise<void> {
  indexer.stopLive();
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}
