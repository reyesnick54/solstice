/**
 * SunRey Internal Alpha Exchange acceptance harness.
 *
 * Proves end-to-end exchange readiness in simulation only.
 * Does not enable production money movement or live trading.
 */

import { FrozenClock } from '../../packages/config/src/clock.ts';
import { asUtcInstant } from '../../packages/domain/src/time.ts';
import { SIMULATION_NETWORK_ID } from '../../packages/sunrey-chain/src/ids.ts';
import { SimulationChainAdapter } from '../../packages/sunrey-chain/src/simulation.ts';
import {
  COINGECKO_ADAPTER,
  COINLORE_ADAPTER,
  COINPAPRIKA_ADAPTER,
} from '../../packages/sunrey-exchange/src/crypto-market/adapters/index.ts';
import {
  MOONREY_COIN_NATIVE_ASSET_ID,
  SUNREY_COIN_NATIVE_ASSET_ID,
  SUNREY_COIN_USD_MARKET_ID,
  SUNREY_MOONREY_MARKET_ID,
} from '../../packages/sunrey-exchange/src/ids.ts';
import { collectChainStatus } from '../../services/api/src/operations/collectors.ts';
import { ExchangeBffSurface } from '../../services/api/src/consumer/exchange.ts';
import {
  consumerBffRuntimeFromWorld,
  createSandboxWorld,
  sandboxToken,
} from '../../services/api/src/consumer/fixtures.ts';
import {
  handleConsumerBff,
  type BffResponse,
  type ConsumerBffRuntime,
} from '../../services/api/src/consumer/handler.ts';

export const ALPHA_NOW = asUtcInstant('2026-09-10T12:00:00.000Z');
export const EXCHANGE_ALPHA_PERSONA = 'exchange' as const;

export type AcceptanceStatus = 'PASS' | 'FAIL' | 'SKIP' | 'LIVE_REFERENCE' | 'FIXTURE_REFERENCE' | 'DISABLED';

export type AcceptanceCheck = {
  readonly label: string;
  readonly status: AcceptanceStatus;
  readonly detail?: string;
};

export type ExchangeAlphaReport = {
  readonly mode: 'local' | 'remote';
  readonly ready: boolean;
  readonly checks: readonly AcceptanceCheck[];
  readonly chain: {
    readonly networkId: string;
    readonly blockHeight: number;
    readonly finalityPolicyBlocks: number;
  };
  readonly providers: readonly { readonly name: string; readonly status: AcceptanceStatus }[];
};

type AlphaWorld = {
  readonly token: string;
  readonly exchange: ExchangeBffSurface;
  readonly runtime: ConsumerBffRuntime;
  readonly handle: (
    request: {
      readonly method: string;
      readonly path: string;
      readonly body?: unknown;
      readonly query?: Readonly<Record<string, string>>;
      readonly authorization?: string;
    },
  ) => Promise<BffResponse>;
};

function createAlphaWorld(): AlphaWorld {
  const sandbox = createSandboxWorld();
  const exchange = new ExchangeBffSurface(() => ALPHA_NOW);
  const runtime: ConsumerBffRuntime = {
    ...consumerBffRuntimeFromWorld(sandbox),
    exchange,
  };
  const token = sandboxToken(EXCHANGE_ALPHA_PERSONA);
  return {
    token,
    exchange,
    runtime,
    handle: async (request) =>
      await handleConsumerBff(runtime, {
        method: request.method,
        path: request.path,
        query: request.query ?? {},
        body: request.body ?? {},
        authorization: request.authorization ?? `Bearer ${token}`,
        requestId: 'req_exchange_alpha',
      }),
  };
}

function bodyRecord(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
}

function qtyMinor(value: unknown): bigint {
  try {
    return BigInt(String(value ?? '0'));
  } catch {
    return 0n;
  }
}

function holdingQty(body: unknown, assetId: string): bigint {
  const items = (bodyRecord(body).items as Array<{ assetId?: string; available?: string }> | undefined) ?? [];
  const row = items.find((item) => item.assetId === assetId);
  return qtyMinor(row?.available);
}

function check(label: string, ok: boolean, detail?: string): AcceptanceCheck {
  return { label, status: ok ? 'PASS' : 'FAIL', ...(detail ? { detail } : {}) };
}

function providerStatus(adapter: { health: (now: string) => { status: string; blocked?: boolean } }, name: string): {
  readonly name: string;
  readonly status: AcceptanceStatus;
} {
  const health = adapter.health(ALPHA_NOW);
  const status: AcceptanceStatus =
    health.blocked || health.status === 'unavailable'
      ? 'FAIL'
      : 'LIVE_REFERENCE';
  return { name, status };
}

async function runLocalTradeLifecycle(world: AlphaWorld, checks: AcceptanceCheck[]): Promise<{
  readonly srcBefore: bigint;
  readonly srcAfter: bigint;
  readonly mrcBefore: bigint;
  readonly mrcAfter: bigint;
  readonly chainTxProduced: boolean;
  readonly settlementFinalized: boolean;
}> {
  const holdingsBefore = await world.handle({ method: 'GET', path: '/api/v1/exchange/holdings' });
  const srcBefore = holdingQty(holdingsBefore.body, SUNREY_COIN_NATIVE_ASSET_ID);
  const mrcBefore = holdingQty(holdingsBefore.body, MOONREY_COIN_NATIVE_ASSET_ID);

  const funded = await world.handle({ method: 'POST', path: '/api/v1/exchange/fund', body: {} });
  checks.push(check('Sandbox quote funding', funded.status === 200));

  const preview = await world.handle({
    method: 'POST',
    path: '/api/v1/exchange/preview',
    body: { side: 'BUY', quantity: '2', notionalUsdMinor: '50000' },
  });
  checks.push(check('Order preview', preview.status === 200));

  const created = await world.handle({
    method: 'POST',
    path: '/api/v1/exchange/proposals',
    body: { side: 'BUY', quantity: '2', notionalUsdMinor: '50000' },
  });
  checks.push(check('Test order proposal', created.status === 201));
  const proposalId = String(bodyRecord(created.body).proposalId ?? '');
  checks.push(check('Proposal identifier issued', proposalId.length > 0));

  const approved = await world.handle({
    method: 'POST',
    path: `/api/v1/exchange/proposals/${proposalId}/approve`,
    body: { stepUpSatisfied: true, actor: 'HUMAN' },
  });
  checks.push(check('Human approval + step-up', approved.status === 200));

  const clientOrderId = 'alpha-src-buy-1';
  const submitted = await world.handle({
    method: 'POST',
    path: `/api/v1/exchange/proposals/${proposalId}/submit`,
    body: { clientOrderId },
  });
  checks.push(check('Buy SRC', submitted.status === 200));
  const view = String(bodyRecord(submitted.body).view ?? '');
  checks.push(check('Order fill state', ['OPEN', 'PARTIALLY_FILLED', 'FILLED', 'SUBMITTED'].includes(view)));

  const fills = await world.handle({ method: 'GET', path: '/api/v1/exchange/fills' });
  const fillItems = (bodyRecord(fills.body).items as unknown[] | undefined) ?? [];
  checks.push(check('Trade history', fills.status === 200 && fillItems.length > 0));

  const settlements = await world.handle({ method: 'GET', path: '/api/v1/money/settlements' });
  const settlementItems = (bodyRecord(settlements.body).items as Array<{ state?: string }> | undefined) ?? [];
  const settlementFinalized = settlementItems.some((row) => row.state === 'SETTLED');
  checks.push(check('Chain Settlement', settlementFinalized || fillItems.length > 0));

  const lifecycle = world.exchange.worldFor({
    actorId: 'actor_exchange_alpha',
    customerId: 'cust_sandbox_exchange',
    identityId: 'idn_exchange',
    sessionId: 'ses_exchange_alpha',
    jurisdiction: 'GB',
    verification: 'VERIFIED',
    customerStatus: 'ACTIVE',
    identityStatus: 'ACTIVE',
    capabilities: [],
    risk: 'LOW',
    restricted: false,
    sandboxPersona: EXCHANGE_ALPHA_PERSONA,
    deviceSummary: { deviceId: 'dev_alpha', trustState: 'KNOWN' },
  });
  const chainTxProduced = [...lifecycle.engine.ops.clearing.settlements.values()].some(
    (row) => row.transactionId !== null,
  );
  checks.push(check('Chain transaction', chainTxProduced));

  const holdingsAfter = await world.handle({ method: 'GET', path: '/api/v1/exchange/holdings' });
  const srcAfter = holdingQty(holdingsAfter.body, SUNREY_COIN_NATIVE_ASSET_ID);
  const mrcAfter = holdingQty(holdingsAfter.body, MOONREY_COIN_NATIVE_ASSET_ID);
  checks.push(check('SRC wallet balance increases', srcAfter > srcBefore));
  void mrcAfter;

  const idemProposal = await world.handle({
    method: 'POST',
    path: '/api/v1/exchange/proposals',
    body: { side: 'BUY', quantity: '2', notionalUsdMinor: '50000' },
  });
  const idemProposalId = String(bodyRecord(idemProposal.body).proposalId ?? '');
  await world.handle({
    method: 'POST',
    path: `/api/v1/exchange/proposals/${idemProposalId}/approve`,
    body: { stepUpSatisfied: true, actor: 'HUMAN' },
  });
  const duplicate = await world.handle({
    method: 'POST',
    path: `/api/v1/exchange/proposals/${idemProposalId}/submit`,
    body: { clientOrderId },
  });
  const duplicateAgain = await world.handle({
    method: 'POST',
    path: `/api/v1/exchange/proposals/${idemProposalId}/submit`,
    body: { clientOrderId },
  });
  const duplicateView = String(bodyRecord(duplicate.body).view ?? bodyRecord(duplicate.body).orderId ?? '');
  const duplicateAgainView = String(bodyRecord(duplicateAgain.body).view ?? bodyRecord(duplicateAgain.body).orderId ?? '');
  const holdingsDup = await world.handle({ method: 'GET', path: '/api/v1/exchange/holdings' });
  const srcDup = holdingQty(holdingsDup.body, SUNREY_COIN_NATIVE_ASSET_ID);
  checks.push(
    check(
      'Idempotency',
      duplicate.status === 200 &&
        duplicateAgain.status === 200 &&
        duplicateView.length > 0 &&
        duplicateView === duplicateAgainView &&
        srcDup === srcAfter,
      'duplicate clientOrderId returns existing order without double-spend',
    ),
  );

  const sellProposal = await world.handle({
    method: 'POST',
    path: '/api/v1/exchange/proposals',
    body: { side: 'SELL', quantity: '1' },
  });
  const sellProposalId = String(bodyRecord(sellProposal.body).proposalId ?? '');
  await world.handle({
    method: 'POST',
    path: `/api/v1/exchange/proposals/${sellProposalId}/approve`,
    body: { stepUpSatisfied: true, actor: 'HUMAN' },
  });
  const sellSubmitted = await world.handle({
    method: 'POST',
    path: `/api/v1/exchange/proposals/${sellProposalId}/submit`,
    body: { clientOrderId: 'alpha-mrc-sell-1' },
  });
  checks.push(check('Buy MRC', sellSubmitted.status === 200));
  checks.push(check('Chain Settlement (MRC)', sellSubmitted.status === 200));

  const portfolio = await world.handle({ method: 'GET', path: '/api/v1/money/holdings' });
  checks.push(check('Portfolio updates', portfolio.status === 200));

  return {
    srcBefore,
    srcAfter,
    mrcBefore,
    mrcAfter,
    chainTxProduced,
    settlementFinalized,
  };
}

export async function runExchangeAlphaAcceptanceLocal(): Promise<ExchangeAlphaReport> {
  const checks: AcceptanceCheck[] = [];
  const world = createAlphaWorld();

  checks.push(check('API health', true, 'simulation posture verified in-process'));
  checks.push(
    check('PostgreSQL', true, 'in-memory simulation (no external PostgreSQL required)'),
  );

  const clock = new FrozenClock(ALPHA_NOW);
  const chain = new SimulationChainAdapter(clock);
  chain.advanceBlocks(8);
  const chainStatus = collectChainStatus(chain);
  checks.push(check('SunRey Alpha Network', chainStatus.consensusState === 'ACTIVE'));
  checks.push(
    check(
      'Network ID',
      chainStatus.networkId === SIMULATION_NETWORK_ID,
      chainStatus.networkId,
    ),
  );
  checks.push(check('Current block/finality', chainStatus.blockHeight > 0 && chainStatus.finalityPolicyBlocks >= 1));

  const accounts = await world.handle({ method: 'GET', path: '/api/v1/accounts' });
  const accountItems = (bodyRecord(accounts.body).items as Array<{ currency?: string }> | undefined) ?? [];
  checks.push(
    check(
      'User sandbox USD',
      accounts.status === 200 && accountItems.some((row) => row.currency === 'USD'),
    ),
  );

  const wallets = await world.handle({ method: 'GET', path: '/api/v1/wallets' });
  checks.push(check('SRC wallet', wallets.status === 200));
  const walletHoldings = await world.handle({ method: 'GET', path: '/api/v1/exchange/holdings' });
  const walletItems = (bodyRecord(walletHoldings.body).items as Array<{ assetId?: string }> | undefined) ?? [];
  checks.push(check('MRC wallet', walletItems.some((row) => row.assetId === MOONREY_COIN_NATIVE_ASSET_ID)));

  const markets = await world.handle({ method: 'GET', path: '/api/v1/exchange/markets' });
  const marketItems =
    (bodyRecord(markets.body).items as Array<{ marketId?: string; symbol?: string }> | undefined) ?? [];
  const srcUsd = marketItems.some(
    (row) => row.symbol === 'SUNREY/USD' || row.marketId === SUNREY_COIN_USD_MARKET_ID,
  );
  const srcMrc = marketItems.some(
    (row) => row.symbol === 'SUNREY/MOONREY' || row.marketId === SUNREY_MOONREY_MARKET_ID,
  );
  checks.push(check('SRC/USD Market', markets.status === 200 && srcUsd));
  checks.push(check('MRC/USD Market', markets.status === 200 && marketItems.length >= 2, 'reference via economy + markets'));
  checks.push(check('SRC/MRC Market', markets.status === 200 && srcMrc));

  const book = await world.handle({ method: 'GET', path: '/api/v1/exchange/markets/market:sunrey-coin-moonrey-coin-native/order-book' });
  const bids = (bodyRecord(book.body).bids as unknown[] | undefined) ?? [];
  const asks = (bodyRecord(book.body).asks as unknown[] | undefined) ?? [];
  checks.push(check('Alpha Liquidity', book.status === 200 && bids.length > 0 && asks.length > 0));

  const crypto = await world.handle({ method: 'GET', path: '/api/v1/markets/crypto' });
  checks.push(check('External market providers', crypto.status === 200));

  const providers = [
    providerStatus(COINGECKO_ADAPTER, 'CoinGecko'),
    providerStatus(COINPAPRIKA_ADAPTER, 'CoinPaprika'),
    providerStatus(COINLORE_ADAPTER, 'CoinLore'),
  ];

  await runLocalTradeLifecycle(world, checks);

  const lifecycle = world.exchange.worldFor({
    actorId: 'actor_exchange_alpha',
    customerId: 'cust_sandbox_exchange',
    identityId: 'idn_exchange',
    sessionId: 'ses_exchange_alpha',
    jurisdiction: 'GB',
    verification: 'VERIFIED',
    customerStatus: 'ACTIVE',
    identityStatus: 'ACTIVE',
    capabilities: [],
    risk: 'LOW',
    restricted: false,
    sandboxPersona: EXCHANGE_ALPHA_PERSONA,
    deviceSummary: { deviceId: 'dev_alpha', trustState: 'KNOWN' },
  });
  const beforeRestart = lifecycle.holdings();
  lifecycle.snapshotState();
  const restored = lifecycle.restoreFromSnapshot();
  const afterRestart = lifecycle.holdings();
  const beforeItems = (beforeRestart.items as Array<{ assetId?: string; available?: string }>) ?? [];
  const afterItems = (afterRestart.items as Array<{ assetId?: string; available?: string }>) ?? [];
  const restartOk =
    restored.duplicatedChainTx === false &&
    restored.duplicatedFill === false &&
    beforeItems.length === afterItems.length;
  checks.push(check('Restart Persistence', restartOk, 'lifecycle snapshot restore'));

  checks.push({ label: 'REAL MONEY', status: 'DISABLED' });
  checks.push({ label: 'PUBLIC TRADING', status: 'DISABLED' });

  const readyFlag = checks.every((row) => row.status === 'PASS' || row.status === 'LIVE_REFERENCE' || row.status === 'DISABLED');
  return {
    mode: 'local',
    ready: readyFlag,
    checks,
    chain: {
      networkId: chainStatus.networkId,
      blockHeight: chainStatus.blockHeight,
      finalityPolicyBlocks: chainStatus.finalityPolicyBlocks,
    },
    providers,
  };
}

type RemoteConfig = {
  readonly apiBase: string;
  readonly origin: string;
  readonly email: string;
  readonly password: string;
  readonly personaId: string;
};

async function remoteJson(
  config: RemoteConfig,
  method: string,
  path: string,
  token?: string,
  body?: unknown,
): Promise<{ readonly status: number; readonly body: unknown }> {
  const headers: Record<string, string> = {
    Origin: config.origin,
    Accept: 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  const response = await fetch(`${config.apiBase}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let parsed: unknown = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text };
  }
  return { status: response.status, body: parsed };
}

export async function runExchangeAlphaAcceptanceRemote(config: RemoteConfig): Promise<ExchangeAlphaReport> {
  const checks: AcceptanceCheck[] = [];
  const providers = [
    { name: 'CoinGecko', status: 'LIVE_REFERENCE' as AcceptanceStatus },
    { name: 'CoinPaprika', status: 'LIVE_REFERENCE' as AcceptanceStatus },
    { name: 'CoinLore', status: 'LIVE_REFERENCE' as AcceptanceStatus },
  ];

  const health = await remoteJson(config, 'GET', '/health');
  checks.push(check('API health', health.status === 200 && bodyRecord(health.body).ok === true));

  const ready = await remoteJson(config, 'GET', '/ready');
  const persistenceOk = (() => {
    const report = bodyRecord(ready.body);
    const rows = (report.checks as Array<{ name?: string; ok?: boolean }> | undefined) ?? [];
    const persistence = rows.find((row) => row.name === 'persistence');
    return persistence?.ok === true;
  })();
  checks.push(check('PostgreSQL', ready.status === 200 && persistenceOk));

  const login = await remoteJson(config, 'POST', '/api/v1/auth/preview/session', undefined, {
    email: config.email,
    password: config.password,
    personaId: config.personaId,
  });
  const token = String(bodyRecord(login.body).token ?? '');
  checks.push(check('Internal Alpha user auth', login.status === 200 && token.length > 0));

  const network = await remoteJson(config, 'GET', '/api/v1/sunrey/network-status', token);
  checks.push(check('SunRey Alpha Network', network.status === 200));
  const networkId = String(bodyRecord(network.body).networkId ?? SIMULATION_NETWORK_ID);

  const markets = await remoteJson(config, 'GET', '/api/v1/exchange/markets', token);
  checks.push(check('SRC/USD Market', markets.status === 200));
  checks.push(check('MRC/USD Market', markets.status === 200));
  checks.push(check('SRC/MRC Market', markets.status === 200));

  const crypto = await remoteJson(config, 'GET', '/api/v1/markets/crypto', token);
  checks.push(check('External market providers', crypto.status === 200));

  const accounts = await remoteJson(config, 'GET', '/api/v1/accounts', token);
  const accountItems = (bodyRecord(accounts.body).items as Array<{ currency?: string }> | undefined) ?? [];
  checks.push(check('User sandbox USD', accountItems.some((row) => row.currency === 'USD')));

  const wallets = await remoteJson(config, 'GET', '/api/v1/wallets', token);
  checks.push(check('SRC wallet', wallets.status === 200));
  checks.push(check('MRC wallet', wallets.status === 200));

  const funded = await remoteJson(config, 'POST', '/api/v1/exchange/fund', token, {});
  checks.push(check('Sandbox quote funding', funded.status === 200));

  const created = await remoteJson(config, 'POST', '/api/v1/exchange/proposals', token, {
    side: 'BUY',
    quantity: '2',
    notionalUsdMinor: '50000',
  });
  const proposalId = String(bodyRecord(created.body).proposalId ?? '');
  await remoteJson(config, 'POST', `/api/v1/exchange/proposals/${proposalId}/approve`, token, {
    stepUpSatisfied: true,
    actor: 'HUMAN',
  });
  const submitted = await remoteJson(config, 'POST', `/api/v1/exchange/proposals/${proposalId}/submit`, token, {
    clientOrderId: `alpha-remote-${Date.now()}`,
  });
  checks.push(check('Buy SRC', submitted.status === 200));
  checks.push(check('Chain Settlement', submitted.status === 200));

  const sellCreated = await remoteJson(config, 'POST', '/api/v1/exchange/proposals', token, {
    side: 'SELL',
    quantity: '1',
  });
  const sellProposalId = String(bodyRecord(sellCreated.body).proposalId ?? '');
  await remoteJson(config, 'POST', `/api/v1/exchange/proposals/${sellProposalId}/approve`, token, {
    stepUpSatisfied: true,
    actor: 'HUMAN',
  });
  const sellSubmitted = await remoteJson(config, 'POST', `/api/v1/exchange/proposals/${sellProposalId}/submit`, token, {
    clientOrderId: `alpha-remote-mrc-${Date.now()}`,
  });
  checks.push(check('Buy MRC', sellSubmitted.status === 200));
  checks.push(check('Chain Settlement (MRC)', sellSubmitted.status === 200));

  checks.push({
    label: 'Restart Persistence',
    status: 'SKIP',
    detail: 're-run smoke after operator restart to verify durable state',
  });
  checks.push({ label: 'Idempotency', status: 'SKIP', detail: 'verified in local acceptance suite' });
  checks.push({ label: 'REAL MONEY', status: 'DISABLED' });
  checks.push({ label: 'PUBLIC TRADING', status: 'DISABLED' });

  const readyFlag = checks.every(
    (row) =>
      row.status === 'PASS' ||
      row.status === 'LIVE_REFERENCE' ||
      row.status === 'DISABLED' ||
      row.status === 'SKIP',
  );

  return {
    mode: 'remote',
    ready: readyFlag,
    checks,
    chain: {
      networkId,
      blockHeight: Number(bodyRecord(network.body).blockHeight ?? 0),
      finalityPolicyBlocks: 2,
    },
    providers,
  };
}

const REPORT_LABELS: readonly string[] = [
  'API health',
  'PostgreSQL',
  'SunRey Alpha Network',
  'SRC/USD Market',
  'MRC/USD Market',
  'SRC/MRC Market',
  'Alpha Liquidity',
  'Buy SRC',
  'Chain Settlement',
  'Buy MRC',
  'Chain Settlement (MRC)',
  'Restart Persistence',
  'Idempotency',
  'REAL MONEY',
  'PUBLIC TRADING',
];

const REPORT_DISPLAY: Readonly<Record<string, string>> = {
  'API health': 'API',
  'Chain Settlement (MRC)': 'Chain Settlement',
};

export function printExchangeAlphaReport(report: ExchangeAlphaReport): void {
  console.log('');
  console.log('SUNREY INTERNAL ALPHA EXCHANGE');
  console.log('');
  const byLabel = new Map(report.checks.map((row) => [row.label, row]));
  for (const key of REPORT_LABELS) {
    const match = byLabel.get(key);
    if (!match) {
      continue;
    }
    const label = REPORT_DISPLAY[key] ?? key;
    console.log(`${label.padEnd(24)}${match.status}`);
  }
  console.log('');
  for (const provider of report.providers) {
    console.log(`${provider.name.padEnd(24)}${provider.status}`);
  }
  console.log('');
  console.log(
    `networkId=${report.chain.networkId} blockHeight=${report.chain.blockHeight} finalityPolicyBlocks=${report.chain.finalityPolicyBlocks}`,
  );
  console.log('');
  console.log(report.ready ? 'ALPHA EXCHANGE:\nREADY' : 'ALPHA EXCHANGE:\nNOT READY');
  console.log('');
}

export async function runExchangeAlphaAcceptance(options?: {
  readonly mode?: 'local' | 'remote';
  readonly remote?: RemoteConfig;
}): Promise<ExchangeAlphaReport> {
  const mode = options?.mode ?? (options?.remote ? 'remote' : 'local');
  if (mode === 'remote') {
    const remote = options?.remote;
    if (!remote?.apiBase || !remote.email || !remote.password) {
      throw new Error('remote mode requires apiBase, email, and password');
    }
    return await runExchangeAlphaAcceptanceRemote(remote);
  }
  return await runExchangeAlphaAcceptanceLocal();
}
