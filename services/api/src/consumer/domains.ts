/**
 * Wave 8 — canonical Consumer API domain catalog.
 * Orchestration metadata only. Does not become domain authority.
 */

export const ENDPOINT_CLASSIFICATIONS = [
  'LIVE',
  'SANDBOX',
  'SIMULATION',
  'PARTIAL',
  'LEGACY',
  'UNUSED',
] as const;
export type EndpointClassification = (typeof ENDPOINT_CLASSIFICATIONS)[number];

export type ConsumerApiDomain = {
  readonly domain: string;
  readonly basePath: string;
  readonly classification: EndpointClassification;
  readonly owner: string;
  readonly description: string;
  readonly primaryRoutes: readonly string[];
  readonly deprecatedRoutes: readonly string[];
};

export const CONSUMER_API_DOMAINS: readonly ConsumerApiDomain[] = Object.freeze([
  domain('identity', '/api/v1/me', 'SIMULATION', 'packages/identity', 'Profile, session, capabilities, bootstrap', ['GET /api/v1/me', 'PATCH /api/v1/me', 'GET /api/v1/me/capabilities'], []),
  domain('home', '/api/v1/me/home', 'SIMULATION', 'services/accounts + orchestrator', 'Aggregated home read model', ['GET /api/v1/me/home', 'GET /api/v1/me/bootstrap'], []),
  domain('money', '/api/v1/accounts', 'SIMULATION', 'services/accounts + Ledger reads', 'Fiat accounts, activity, statements, payments, FX, cards', ['GET /api/v1/accounts', 'GET /api/v1/payments', 'GET /api/v1/fx'], []),
  domain('wallet', '/api/v1/wallets', 'SIMULATION', 'packages/custody product', 'Custody wallets, deposits, withdrawals', ['GET /api/v1/wallets', 'POST /api/v1/wallets/withdrawals'], []),
  domain('grow', '/api/v1/grow', 'SIMULATION', 'packages/platform Growth Orchestrator', 'Grow plans, goals, portfolio, proposals', ['GET /api/v1/grow', 'GET /api/v1/grow/portfolio'], ['GET /api/v1/portfolio', 'GET /api/v1/goals']),
  domain('vault', '/api/v1/data/vault', 'SIMULATION', 'packages/personal-data-vault', 'Subject-bound PDV read/write', ['GET /api/v1/data/vault'], []),
  domain('exchange', '/api/v1/exchange', 'SIMULATION', 'packages/sunrey-exchange consumer', 'Markets, orders, holdings, stream', ['GET /api/v1/exchange', 'GET /api/v1/exchange/stream'], []),
  domain('sunrey', '/api/v1/sunrey', 'SIMULATION', 'packages/sunrey-chain native-assets + HIN', 'SunRey balance, supply, contributions, PEVE (authorized)', ['GET /api/v1/sunrey/balance', 'GET /api/v1/sunrey/supply'], ['GET /api/v1/economy/sunrey-coin']),
  domain('moonrey', '/api/v1/moonrey', 'SIMULATION', 'packages/sunrey-chain productive/economy-data', 'MoonRey balance, supply, GPUV, productive claims', ['GET /api/v1/moonrey/balance', 'GET /api/v1/moonrey/supply'], ['GET /api/v1/economy/moonrey-coin', 'GET /api/v1/economy/productive']),
  domain('economy', '/api/v1/economy', 'SIMULATION', 'packages/sunrey-chain economics', 'Combined native economy overview (legacy alias)', ['GET /api/v1/economy'], []),
  domain('providers', '/api/v1/world', 'SANDBOX', 'packages/external-data wave7', 'World external data, provider status', ['GET /api/v1/world/snapshot', 'GET /api/v1/world/provider-risk'], []),
  domain('claims', '/api/v1/hin/contributions', 'SIMULATION', 'packages/human-economic-contribution', 'HIN contributions and verification status', ['GET /api/v1/hin/contributions'], []),
  domain('hin', '/api/v1/hin', 'SIMULATION', 'packages/information-market', 'HIN rights marketplace and participation', ['GET /api/v1/hin/rights', 'GET /api/v1/hin/licenses'], []),
  domain('evidence', '/api/v1/agent/external-evidence', 'SIMULATION', 'packages/external-data bridges', 'Agent-safe external evidence catalog', ['GET /api/v1/agent/external-evidence'], []),
  domain('consent', '/api/v1/data', 'SIMULATION', 'packages/consent', 'Consent, rights, permissions', ['GET /api/v1/data/consent', 'GET /api/v1/data/permissions'], []),
  domain('actions', '/api/v1/actions', 'SIMULATION', 'packages/sunrey-agent + orchestrator', 'Unified Action Center (durable backend state)', ['GET /api/v1/actions', 'GET /api/v1/actions/stream'], ['GET /api/v1/me/actions']),
  domain('notifications', '/api/v1/notifications', 'UNUSED', 'none', 'Not productized', [], []),
  domain('network', '/api/v1/blockchain', 'SANDBOX', 'packages/sunrey-chain blockchain-intelligence', 'External chain intelligence (read-only)', ['GET /api/v1/blockchain/networks'], []),
  domain('access', '/api/v1/access', 'SIMULATION', 'packages/human-access-economy', 'Human Access Economy', ['GET /api/v1/access'], []),
  domain('agent', '/api/v1/agent', 'SIMULATION', 'packages/sunrey-agent', 'Agent conversation and proposals', ['GET /api/v1/agent/actions', 'POST /api/v1/agent/conversations'], []),
]);

export const ADMIN_API_PREFIXES = Object.freeze([
  '/api/v1/internal',
  '/internal',
]);

export function domainForPath(path: string): ConsumerApiDomain | undefined {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (ADMIN_API_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return undefined;
  }
  return CONSUMER_API_DOMAINS.find((row) => normalized.startsWith(row.basePath) || row.primaryRoutes.some((route) => {
    const routePath = route.split(' ')[1];
    return routePath && normalized.startsWith(routePath.replace(/\{[^}]+\}/g, ''));
  }));
}

export function classifyEndpoint(path: string, method: string): EndpointClassification {
  const row = domainForPath(path);
  if (row) {
    return row.classification;
  }
  if (path === '/health' || path === '/ready' || path === '/api/v1/version' || path === '/api/v1/catalog/resources') {
    return 'SIMULATION';
  }
  if (path.startsWith('/api/v1/_test')) {
    return 'SANDBOX';
  }
  void method;
  return 'PARTIAL';
}

function domain(
  name: string,
  basePath: string,
  classification: EndpointClassification,
  owner: string,
  description: string,
  primaryRoutes: readonly string[],
  deprecatedRoutes: readonly string[],
): ConsumerApiDomain {
  return Object.freeze({
    domain: name,
    basePath,
    classification,
    owner,
    description,
    primaryRoutes,
    deprecatedRoutes,
  });
}
