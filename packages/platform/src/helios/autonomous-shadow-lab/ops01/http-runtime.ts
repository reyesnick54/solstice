import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import type { HeliosDurableShadowLabRuntimeService } from './service.ts';
import { buildShadowLabRuntimeHealth, buildShadowLabRuntimeReadiness } from './health.ts';

export type ShadowLabHttpRuntimeOptions = {
  readonly service: HeliosDurableShadowLabRuntimeService;
  readonly activeCampaigns?: number;
  readonly log?: (line: string) => void;
};

export function createShadowLabHttpRuntime(options: ShadowLabHttpRuntimeOptions): Server {
  const log = options.log ?? (() => undefined);
  return createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? '/';
  if (url === '/health' || url === '/healthz') {
      const health = buildShadowLabRuntimeHealth({
        store: options.service.durableStore,
        activeCampaigns: options.activeCampaigns ?? 0,
        shuttingDown: options.service.isShuttingDown(),
      });
      res.writeHead(health.healthy ? 200 : 503, { 'content-type': 'application/json' });
      res.end(JSON.stringify(health));
      return;
    }
    if (url === '/ready' || url === '/readyz') {
      const readiness = buildShadowLabRuntimeReadiness({
        store: options.service.durableStore,
        shuttingDown: options.service.isShuttingDown(),
      });
      res.writeHead(readiness.ready ? 200 : 503, { 'content-type': 'application/json' });
      res.end(JSON.stringify(readiness));
      return;
    }
    if (url === '/metrics') {
      const metrics = options.service.collectMetrics();
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(metrics));
      return;
    }
    res.writeHead(404);
    res.end();
    log(`shadow-lab-runtime ${req.method} ${url} -> 404`);
  });
}

export async function serveShadowLabHttpRuntime(
  options: ShadowLabHttpRuntimeOptions & { readonly port: number; readonly host?: string },
): Promise<Server> {
  const server = createShadowLabHttpRuntime(options);
  const host = options.host ?? '127.0.0.1';
  await new Promise<void>((resolve) => server.listen(options.port, host, resolve));
  return server;
}
