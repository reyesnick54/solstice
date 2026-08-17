import type { ExplorerQueryService } from './queries.ts';
import { explorerExposurePolicy } from './privacy.ts';
import type { ExplorerIndexer } from './indexer.ts';

export type ExplorerRequest = {
  readonly method: string;
  readonly path: string;
  readonly query: Readonly<Record<string, string>>;
};

export type ExplorerResponse = {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
};

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

export function handleExplorerRequest(
  request: ExplorerRequest,
  queries: ExplorerQueryService,
  indexer: ExplorerIndexer,
): ExplorerResponse {
  const path = request.path.split('?')[0] ?? request.path;
  if (request.method !== 'GET') {
    return json(405, { error: 'METHOD_NOT_ALLOWED' });
  }
  if (path === '/v1/status' || path === '/v1/health') {
    return json(200, { ok: true, environment: 'simulation', network: 'DEVELOPMENT', ...queries.lag() });
  }
  if (path === '/v1/home') {
    return json(200, queries.home());
  }
  if (path === '/v1/blocks') {
    return json(200, queries.blocks(request.query['cursor'], parseLimit(request.query['limit'])));
  }
  if (path.startsWith('/v1/blocks/')) {
    const found = queries.block(path.slice('/v1/blocks/'.length));
    return found ? json(200, found) : json(404, { error: 'NOT_FOUND' });
  }
  if (path === '/v1/transactions') {
    return json(200, queries.transactions(request.query['cursor'], parseLimit(request.query['limit'])));
  }
  if (path.startsWith('/v1/transactions/')) {
    const found = queries.transaction(path.slice('/v1/transactions/'.length));
    return found ? json(200, found) : json(404, { error: 'NOT_FOUND' });
  }
  if (path === '/v1/accounts') {
    return json(200, queries.accounts(request.query['cursor'], parseLimit(request.query['limit'])));
  }
  if (path.startsWith('/v1/accounts/')) {
    const found = queries.account(path.slice('/v1/accounts/'.length));
    return found ? json(200, found) : json(404, { error: 'NOT_FOUND' });
  }
  if (path === '/v1/assets') {
    return json(200, queries.assets());
  }
  if (path.startsWith('/v1/assets/')) {
    const found = queries.asset(path.slice('/v1/assets/'.length));
    return found ? json(200, found) : json(404, { error: 'NOT_FOUND' });
  }
  if (path === '/v1/validators') {
    return json(200, queries.collection('validators', request.query['cursor'], parseLimit(request.query['limit'])));
  }
  if (path === '/v1/governance') {
    return json(200, queries.collection('governance', request.query['cursor'], parseLimit(request.query['limit'])));
  }
  if (path === '/v1/oracles' || path === '/v1/oracles/facts') {
    return json(200, queries.collection('oracleFacts', request.query['cursor'], parseLimit(request.query['limit'])));
  }
  if (path === '/v1/oracles/providers') {
    return json(200, queries.collection('oracleProviders', request.query['cursor'], parseLimit(request.query['limit'])));
  }
  if (path === '/v1/oracles/feeds') {
    return json(200, queries.collection('oracleFeeds', request.query['cursor'], parseLimit(request.query['limit'])));
  }
  if (path === '/v1/productive') {
    return json(200, {
      objects: queries.collection('productiveObjects'),
      contributions: queries.collection('contributions'),
    });
  }
  if (path === '/v1/moonrey') {
    return json(200, queries.collection('moonrey', request.query['cursor'], parseLimit(request.query['limit'])));
  }
  if (path === '/v1/dual-economy') {
    return json(200, {
      label: 'SIMULATION',
      environment: 'simulation',
      note: 'Development-only dual-economy view. Not a price forecast or production authorization.',
      sunreySupply: queries.home().sunreyDevelopmentSupply,
      moonreySupply: queries.home().moonreyDevelopmentSupply,
      ...queries.lag(),
    });
  }
  if (path === '/v1/machines') {
    return json(200, queries.collection('machines', request.query['cursor'], parseLimit(request.query['limit'])));
  }
  if (path === '/v1/interop') {
    return json(200, {
      clients: queries.collection('interopClients'),
      packets: queries.collection('interopPackets'),
    });
  }
  if (path === '/v1/settlements') {
    return json(200, queries.collection('settlements', request.query['cursor'], parseLimit(request.query['limit'])));
  }
  if (path === '/v1/evidence') {
    return json(200, queries.collection('evidence', request.query['cursor'], parseLimit(request.query['limit'])));
  }
  if (path === '/v1/search') {
    const result = queries.search(request.query['q'] ?? '');
    if ('code' in result) {
      return json(400, result);
    }
    return json(200, result);
  }
  if (path === '/v1/metrics') {
    return {
      status: 200,
      headers: { 'content-type': 'text/plain; version=0.0.4' },
      body: indexer.metrics.renderPrometheus(),
    };
  }
  return json(404, { error: 'NOT_FOUND' });
}

function parseLimit(raw: string | undefined): number | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const value = Number.parseInt(raw, 10);
  return Number.isInteger(value) ? value : undefined;
}

function json(status: number, body: unknown): ExplorerResponse {
  return {
    status,
    headers: JSON_HEADERS,
    body: JSON.stringify(explorerExposurePolicy.project(body)),
  };
}
