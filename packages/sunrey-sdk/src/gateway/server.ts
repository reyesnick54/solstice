/**
 * Versioned public RPC gateway.
 *
 * PUBLIC_API lives under /v1. OPERATOR_API lives under /operator/v1
 * and requires an operator token. Public compromise cannot administer
 * validators.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import { apiError, type ApiErrorEnvelope } from '../errors.ts';
import { PUBLIC_REQUEST_LIMITS } from '../limits.ts';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../pagination.ts';
import type { EventType } from '../types.ts';
import { parseApiVersion } from '../versioning.ts';
import { DevelopmentPlatform, errorStatus } from './platform.ts';
import { objectHasPrivateKeyField } from './privacy.ts';

export type GatewayOptions = {
  readonly host?: string;
  readonly port?: number;
  readonly platform?: DevelopmentPlatform;
  readonly autoFinalize?: boolean;
};

export type RunningGateway = {
  readonly url: string;
  readonly eventsUrl: string;
  readonly operatorUrl: string;
  readonly networkId: string;
  readonly apiVersion: 'v1';
  readonly platform: DevelopmentPlatform;
  readonly close: () => Promise<void>;
};

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

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body, (_key, value) => (typeof value === 'bigint' ? value.toString() : value));
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(json),
    'x-sunrey-api-version': 'v1',
    'x-sunrey-surface': 'PUBLIC_API',
  });
  res.end(json);
}

function query(url: URL): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of url.searchParams.entries()) {
    out[key] = value;
  }
  return out;
}

function pageSizeOf(raw: string | undefined): number {
  if (raw === undefined || raw === '') {
    return DEFAULT_PAGE_SIZE;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return DEFAULT_PAGE_SIZE;
  }
  return Math.min(parsed, MAX_PAGE_SIZE);
}

export async function startPublicGateway(options: GatewayOptions = {}): Promise<RunningGateway> {
  const platform = options.platform ?? new DevelopmentPlatform();
  const host = options.host ?? '127.0.0.1';
  const autoFinalize = options.autoFinalize ?? true;

  const server: Server = createServer(async (req, res) => {
    const requestId = platform.requestId();
    const method = req.method ?? 'GET';
    const rawUrl = req.url ?? '/';
    const url = new URL(rawUrl, 'http://127.0.0.1');
    const path = url.pathname;

    if (path === '/health' || path === '/ready') {
      sendJson(res, 200, { ok: true, environment: 'simulation', api_version: 'v1' });
      return;
    }

    const rate = platform.limiter.consume(req.socket.remoteAddress ?? 'local', Date.now());
    if (!rate.allowed) {
      sendJson(
        res,
        429,
        apiError({
          error_code: 'RATE_LIMITED',
          category: 'RATE_LIMIT',
          message: 'public RPC rate limit',
          retryable: true,
          request_id: requestId,
          details_safe_for_client: { retry_after_ms: String(rate.retryAfterMs) },
        }),
      );
      return;
    }

    if (path.startsWith('/v2') || /^\/v[0-9]+/.test(path) && !path.startsWith('/v1') && !path.startsWith('/operator/v1')) {
      const version = parseApiVersion(path.split('/')[1]);
      if (version === null) {
        sendJson(
          res,
          404,
          apiError({
            error_code: 'UNKNOWN_API_VERSION',
            category: 'NOT_FOUND',
            message: 'unknown API version',
            retryable: false,
            request_id: requestId,
          }),
        );
        return;
      }
    }

    if (path.startsWith('/v1/admin') || path.startsWith('/v1/operator') || path.startsWith('/v1/validator/signer')) {
      sendJson(
        res,
        403,
        apiError({
          error_code: 'OPERATOR_NAMESPACE_FORBIDDEN',
          category: 'AUTHORIZATION',
          message: 'operator functionality is unavailable on the public namespace',
          retryable: false,
          request_id: requestId,
        }),
      );
      return;
    }

    const isOperator = path.startsWith('/operator/v1');
    if (isOperator) {
      const token = req.headers['x-sunrey-operator-token'];
      if (token !== platform.operatorToken) {
        sendJson(
          res,
          403,
          apiError({
            error_code: 'OPERATOR_NAMESPACE_FORBIDDEN',
            category: 'AUTHORIZATION',
            message: 'operator token required',
            retryable: false,
            request_id: requestId,
          }),
        );
        return;
      }
    }

    let body: unknown = {};
    if (method === 'POST' || method === 'PUT') {
      try {
        const raw = await readBody(req, PUBLIC_REQUEST_LIMITS.maximumBodyBytes);
        body = raw.length === 0 ? {} : JSON.parse(raw);
      } catch (error) {
        const oversized = error instanceof Error && error.message === 'OVERSIZED_REQUEST';
        sendJson(
          res,
          400,
          apiError({
            error_code: oversized ? 'OVERSIZED_REQUEST' : 'MALFORMED',
            category: 'VALIDATION',
            message: oversized ? 'request body exceeds public maximum' : 'malformed JSON',
            retryable: false,
            request_id: requestId,
          }),
        );
        return;
      }
      const sensitive = platform.rejectSensitive(body, requestId);
      if (sensitive) {
        sendJson(res, errorStatus(sensitive), sensitive);
        return;
      }
    }

    try {
      const result = dispatch(platform, method, path, query(url), body, requestId, autoFinalize);
      if (result.kind === 'sse') {
        writeSse(res, platform, result.types, result.cursor);
        return;
      }
      sendJson(res, result.status, result.body);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'internal';
      if (message === 'INVALID_PAGINATION_CURSOR') {
        const err = apiError({
          error_code: 'INVALID_PAGINATION_CURSOR',
          category: 'VALIDATION',
          message: 'pagination cursor is opaque and invalid',
          retryable: false,
          request_id: requestId,
        });
        sendJson(res, 400, err);
        return;
      }
      sendJson(
        res,
        500,
        apiError({
          error_code: 'MALFORMED',
          category: 'INTERNAL',
          message: 'request failed',
          retryable: true,
          request_id: requestId,
        }),
      );
    }
  });

  await new Promise<void>((resolve) => {
    server.listen(options.port ?? 0, host, () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('gateway failed to bind');
  }
  const url = `http://${host}:${address.port}`;
  return {
    url,
    eventsUrl: `${url}/v1/events`,
    operatorUrl: `${url}/operator/v1`,
    networkId: platform.networkId,
    apiVersion: 'v1',
    platform,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    },
  };
}

type DispatchResult =
  | { readonly kind: 'json'; readonly status: number; readonly body: unknown }
  | { readonly kind: 'sse'; readonly types: readonly EventType[] | undefined; readonly cursor: string | undefined };

function json(status: number, body: unknown): DispatchResult {
  return { kind: 'json', status, body };
}

function pageOrThrow<T>(page: { readonly error: 'INVALID_PAGINATION_CURSOR' } | T): T {
  if (page && typeof page === 'object' && 'error' in page) {
    throw new Error('INVALID_PAGINATION_CURSOR');
  }
  return page;
}

function dispatch(
  platform: DevelopmentPlatform,
  method: string,
  path: string,
  q: Record<string, string>,
  body: unknown,
  requestId: string,
  autoFinalize: boolean,
): DispatchResult {
  const rec = (body ?? {}) as Record<string, unknown>;
  if (objectHasPrivateKeyField(body)) {
    const err = platform.rejectSensitive(body, requestId);
    return json(403, err);
  }

  if (method === 'GET' && path === '/v1/chain/status') {
    return json(200, platform.chainStatus());
  }
  if (method === 'GET' && path === '/v1/chain/network') {
    return json(200, { network_id: platform.networkId, chain_id: platform.chainId, environment: 'simulation' });
  }
  if (method === 'GET' && path === '/v1/chain/protocol') {
    return json(200, { protocol_version: '1', api_version: 'v1', compatibility: 'BACKWARD_COMPATIBLE' });
  }
  if (method === 'GET' && path === '/v1/chain/finality') {
    const status = platform.chainStatus();
    return json(200, {
      finalized_height: status.finalized_height,
      latest_block_id: status.latest_block_id,
      semantics: 'BFT_FINALITY',
      probabilistic_confirmations: false,
    });
  }
  if (method === 'GET' && path === '/v1/chain/blocks') {
    return json(200, pageOrThrow(platform.listBlocks(q.cursor, pageSizeOf(q.page_size))));
  }
  if (method === 'GET' && path.startsWith('/v1/chain/blocks/')) {
    const height = path.slice('/v1/chain/blocks/'.length);
    const block = platform.getBlock(height);
    return block ? json(200, block) : json(404, notFound(requestId));
  }
  if (method === 'GET' && path === '/v1/chain/transactions') {
    return json(200, pageOrThrow(platform.listTransactions(q.cursor, pageSizeOf(q.page_size))));
  }
  if (method === 'GET' && path.startsWith('/v1/chain/transactions/')) {
    return json(200, platform.txStatus(path.slice('/v1/chain/transactions/'.length)));
  }
  if (method === 'GET' && path === '/v1/chain/state-roots') {
    return json(200, { state_root: platform.chainStatus().state_root, consistency: 'FINALIZED' });
  }

  if (method === 'POST' && path === '/v1/accounts') {
    const created = platform.registerAccount({
      account_id: String(rec.account_id ?? ''),
      address: String(rec.address ?? ''),
      public_key_hex: String(rec.public_key_hex ?? ''),
      suite_id: String(rec.suite_id ?? ''),
      authorization_policy: (rec.authorization_policy as 'SINGLE_SIGNATURE') ?? 'SINGLE_SIGNATURE',
      ...(Array.isArray(rec.approved_crypto_suites)
        ? { approved_crypto_suites: rec.approved_crypto_suites.map(String) }
        : {}),
    });
    if ('error_code' in created) {
      return json(errorStatus(created), created);
    }
    return json(200, created);
  }
  if (method === 'GET' && path.startsWith('/v1/accounts/') && path.endsWith('/nonce')) {
    const id = path.slice('/v1/accounts/'.length, -'/nonce'.length);
    const account = platform.getAccount(id);
    return account ? json(200, { account_id: id, nonce: account.nonce, consistency: 'FINALIZED' }) : json(404, notFound(requestId));
  }
  if (method === 'GET' && path.startsWith('/v1/accounts/')) {
    const account = platform.getAccount(path.slice('/v1/accounts/'.length));
    return account ? json(200, account) : json(404, notFound(requestId));
  }

  if (method === 'GET' && path === '/v1/assets') {
    return json(200, {
      assets: [
        { asset_id: 'SUNREY_COIN', ticker_status: 'NOT_ASSIGNED' },
        { asset_id: 'MOONREY_COIN', ticker_status: 'NOT_ASSIGNED' },
      ],
    });
  }
  if (method === 'GET' && path.startsWith('/v1/assets/holdings/')) {
    return json(200, { holdings: platform.holdings(path.slice('/v1/assets/holdings/'.length)) });
  }
  if (method === 'GET' && path.startsWith('/v1/assets/locks/')) {
    return json(200, { locks: platform.locksFor(path.slice('/v1/assets/locks/'.length)) });
  }
  if (method === 'GET' && path === '/v1/assets/supply') {
    return json(200, { SUNREY_COIN: 'development', MOONREY_COIN: 'development', ticker_status: 'NOT_ASSIGNED' });
  }
  if (method === 'GET' && path === '/v1/assets/issuance') {
    return json(200, { attribution: 'verified-productive-contribution', ticker_status: 'NOT_ASSIGNED' });
  }
  if (method === 'GET' && path === '/v1/assets/burns') {
    return json(200, { burns: [] });
  }
  if (method === 'GET' && path === '/v1/monetary/policy') {
    return json(200, {
      ticker_status: 'NOT_ASSIGNED',
      production_activation: 'UNCONFIGURED',
      assets: [
        { asset_id: 'SUNREY_COIN', purpose: 'HUMAN_ECONOMIC_LAYER', policy_version: 'sunrey.monetary.constitution.v1' },
        { asset_id: 'MOONREY_COIN', purpose: 'AUTONOMOUS_PRODUCTIVE_ECONOMY', policy_version: 'sunrey.monetary.constitution.v1' },
      ],
    });
  }
  if (method === 'GET' && path === '/v1/monetary/supply') {
    return json(200, {
      SUNREY_COIN: { genesis: '0', issued: '0', burned: '0', circulating: '0', locked: '0', reconciliation: 'EXACT' },
      MOONREY_COIN: { genesis: '0', issued: '0', burned: '0', circulating: '0', locked: '0', reconciliation: 'EXACT' },
      ticker_status: 'NOT_ASSIGNED',
      not_market_cap: true,
    });
  }
  if (method === 'GET' && path === '/v1/monetary/genesis') {
    return json(200, { SUNREY_COIN: '0', MOONREY_COIN: '0', production_allocation_authorized: false });
  }
  if (method === 'GET' && path.startsWith('/v1/monetary/issuance/')) {
    return json(200, { receipt_id: path.slice('/v1/monetary/issuance/'.length), mint_interface: false });
  }
  if (method === 'GET' && path === '/v1/monetary/burns') {
    return json(200, { burns: [], classes: ['VOLUNTARY_USER_BURN', 'FEE_BURN', 'PROTOCOL_ECONOMIC_PENALTY'] });
  }

  if (method === 'GET' && path === '/v1/fees/schedule') {
    return json(200, platform.estimateFee());
  }
  if (method === 'GET' && path === '/v1/fees/estimate') {
    return json(200, platform.estimateFee(Number(q.bytes ?? '256'), Number(q.sigs ?? '1')));
  }
  if (method === 'GET' && path === '/v1/fees/resources') {
    const signatureClass = q.class === 'HYBRID' || q.class === 'PQ' ? q.class : 'CLASSICAL';
    return json(200, {
      encoded_bytes: q.bytes ?? '256',
      signature_count: q.sigs ?? '1',
      usage: platform.estimateResourcesV2(Number(q.bytes ?? '256'), Number(q.sigs ?? '1'), signatureClass),
    });
  }
  if (method === 'GET' && path === '/v1/fees/policy') {
    return json(200, platform.getFeePolicy());
  }
  if (method === 'GET' && path === '/v1/fees/price') {
    return json(200, platform.getBaseResourcePrice());
  }
  if (method === 'GET' && path === '/v1/fees/estimate-v2') {
    const signatureClass = q.class === 'HYBRID' || q.class === 'PQ' ? q.class : 'CLASSICAL';
    return json(200, platform.estimateFeeV2(Number(q.bytes ?? '256'), Number(q.sigs ?? '1'), signatureClass));
  }
  if (method === 'GET' && path.startsWith('/v1/fees/receipts/')) {
    const receipt = platform.txStatus(path.slice('/v1/fees/receipts/'.length));
    return json(200, { transaction_id: receipt.transaction_id, fee: receipt.fee, consistency: receipt.consistency });
  }

  if (method === 'GET' && path === '/v1/validators') {
    return json(200, { validators: platform.validators() });
  }
  if (method === 'GET' && path === '/v1/validators/epochs') {
    return json(200, { epoch: '1' });
  }
  if (method === 'GET' && path === '/v1/validators/evidence') {
    return json(200, { evidence: [] });
  }
  if (method === 'GET' && path === '/v1/validators/economics/policy') {
    return json(200, platform.validatorEconomicPolicy());
  }
  if (method === 'GET' && path.startsWith('/v1/validators/') && path.endsWith('/bond')) {
    const id = path.slice('/v1/validators/'.length, -'/bond'.length);
    return json(200, platform.validatorBond(id));
  }
  if (method === 'GET' && path.startsWith('/v1/validators/') && path.endsWith('/rewards')) {
    const id = path.slice('/v1/validators/'.length, -'/rewards'.length);
    return json(200, platform.validatorRewardSummary(id));
  }
  if (method === 'GET' && path.startsWith('/v1/validators/') && path.endsWith('/penalties')) {
    const id = path.slice('/v1/validators/'.length, -'/penalties'.length);
    return json(200, platform.validatorPublicPenalties(id));
  }
  if (method === 'GET' && path.startsWith('/v1/validators/') && path.endsWith('/unbond')) {
    const id = path.slice('/v1/validators/'.length, -'/unbond'.length);
    return json(200, platform.validatorUnbondStatus(id));
  }

  if (method === 'GET' && path === '/v1/governance/proposals') {
    return json(200, { proposals: platform.governance() });
  }
  if (method === 'GET' && path === '/v1/governance/upgrades') {
    return json(200, { upgrades: platform.governance() });
  }
  if (method === 'GET' && path === '/v1/governance/votes') {
    return json(200, { votes: [] });
  }
  if (method === 'GET' && path === '/v1/governance/versions') {
    return json(200, { protocol_version: '1' });
  }
  if (method === 'GET' && path === '/v1/governance/activations') {
    return json(200, { scheduled: platform.governance() });
  }
  if (method === 'GET' && path === '/v1/governance/operations/package') {
    return json(200, platform.governanceOperations().package);
  }
  if (method === 'GET' && path === '/v1/governance/operations/diff') {
    return json(200, platform.governanceOperations().diff);
  }
  if (method === 'GET' && path === '/v1/governance/operations/activation') {
    return json(200, platform.governanceOperations().activation);
  }
  if (method === 'GET' && path === '/v1/governance/operations/emergency') {
    return json(200, platform.governanceOperations().emergency);
  }

  if (method === 'GET' && path === '/v1/oracles/providers') {
    return json(200, { providers: platform.oracles() });
  }
  if (method === 'GET' && path === '/v1/oracles/feeds') {
    return json(200, { feeds: platform.oracles() });
  }
  if (method === 'GET' && path === '/v1/oracles/observations') {
    return json(200, pageOrThrow({ items: platform.oracles(), next_cursor: null, page_size: 20 }));
  }
  if (method === 'GET' && path === '/v1/oracles/facts') {
    return json(200, pageOrThrow({ items: platform.oracles(), next_cursor: null, page_size: 20 }));
  }
  if (method === 'GET' && path === '/v1/oracles/quality') {
    return json(200, { quality: 'DEVELOPMENT' });
  }

  if (method === 'GET' && path === '/v1/productive/objects') {
    return json(200, { objects: platform.productive() });
  }
  if (method === 'GET' && path === '/v1/productive/claims') {
    return json(200, { claims: platform.productive() });
  }
  if (method === 'GET' && path === '/v1/productive/contributions') {
    return json(200, pageOrThrow({ items: platform.productive(), next_cursor: null, page_size: 20 }));
  }
  if (method === 'GET' && path === '/v1/productive/lineage') {
    return json(200, { lineage: platform.productive() });
  }
  if (method === 'GET' && path === '/v1/productive/graph') {
    return json(200, { graph: 'derived-rebuildable', nodes: platform.productive() });
  }
  if (method === 'GET' && path === '/v1/productive/moonrey') {
    return json(200, { attribution: platform.productive(), ticker_status: 'NOT_ASSIGNED' });
  }
  if (method === 'GET' && path === '/v1/productive/moonrey/policy') {
    return json(200, platform.moonreyPolicy());
  }
  if (method === 'GET' && path.startsWith('/v1/productive/moonrey/categories/')) {
    return json(200, platform.moonreyCategoryPolicy(path.slice('/v1/productive/moonrey/categories/'.length)));
  }
  if (method === 'GET' && path.startsWith('/v1/productive/contributions/')) {
    return json(200, platform.productiveContribution(path.slice('/v1/productive/contributions/'.length)));
  }
  if (method === 'GET' && path.startsWith('/v1/productive/moonrey/issuance/')) {
    return json(200, platform.moonreyIssuanceReceipt(path.slice('/v1/productive/moonrey/issuance/'.length)));
  }
  if (method === 'GET' && path === '/v1/productive/moonrey/supply-pressure') {
    return json(200, platform.moonreySupplyPressure());
  }

  if (method === 'GET' && path === '/v1/machines') {
    return json(200, { machines: platform.machines() });
  }
  if (method === 'GET' && path === '/v1/machines/capabilities') {
    return json(200, { capabilities: platform.machines() });
  }
  if (method === 'GET' && path === '/v1/machines/offers') {
    return json(200, { offers: platform.machines() });
  }
  if (method === 'GET' && path === '/v1/machines/commerce') {
    return json(200, { commerce: platform.machines() });
  }
  if (method === 'GET' && path === '/v1/machines/deliveries') {
    return json(200, { deliveries: [] });
  }

  if (method === 'GET' && path === '/v1/interop/chains') {
    return json(200, { chains: platform.interop() });
  }
  if (method === 'GET' && path === '/v1/interop/clients') {
    return json(200, { clients: platform.interop() });
  }
  if (method === 'GET' && path === '/v1/interop/connections') {
    return json(200, { connections: platform.interop() });
  }
  if (method === 'GET' && path === '/v1/interop/channels') {
    return json(200, { channels: platform.interop() });
  }
  if (method === 'GET' && path === '/v1/interop/packets') {
    return json(200, { packets: platform.interop() });
  }
  if (method === 'GET' && path === '/v1/interop/security') {
    return json(200, { profile: platform.interop()[0] });
  }

  if (method === 'GET' && path === '/v1/exchange/markets') {
    return json(200, { markets: platform.markets() });
  }
  if (method === 'GET' && path.startsWith('/v1/exchange/instruments/')) {
    const id = path.slice('/v1/exchange/instruments/'.length);
    const market = platform.markets().find((item) => item.instrument_id === id || item.market_id === id);
    return market ? json(200, market) : json(404, notFound(requestId));
  }
  if (method === 'GET' && path.startsWith('/v1/exchange/order-books/')) {
    return json(200, platform.orderBook(path.slice('/v1/exchange/order-books/'.length)));
  }
  if (method === 'POST' && path === '/v1/exchange/orders') {
    const placed = platform.placeSignedOrder({
      market_id: String(rec.market_id ?? ''),
      signed_order_hex: String(rec.signed_order_hex ?? ''),
      actor: String(rec.actor ?? 'public'),
    });
    if (isApiError(placed)) {
      return json(errorStatus(placed), placed);
    }
    return json(200, placed);
  }
  if (method === 'POST' && path.startsWith('/v1/exchange/orders/') && path.endsWith('/cancel')) {
    const orderId = path.slice('/v1/exchange/orders/'.length, -'/cancel'.length);
    return json(200, { order_id: orderId, status: 'CANCELLED' });
  }
  if (method === 'GET' && path.startsWith('/v1/exchange/trades/')) {
    const trade = platform.getTrade(path.slice('/v1/exchange/trades/'.length));
    return trade ? json(200, trade) : json(404, notFound(requestId));
  }
  if (method === 'GET' && path.startsWith('/v1/exchange/settlements/')) {
    return json(200, { settlement_id: path.slice('/v1/exchange/settlements/'.length), status: 'FINALIZED' });
  }
  if (method === 'GET' && path === '/v1/exchange/auctions') {
    return json(200, { auctions: [] });
  }
  if (method === 'GET' && path === '/v1/exchange/capacity-contracts') {
    return json(200, { contracts: [] });
  }
  if (method === 'GET' && path === '/v1/exchange/market-data') {
    return json(200, { markets: platform.markets() });
  }

  if (method === 'POST' && path === '/v1/transactions') {
    const submitted = platform.submitSigned({
      signed_envelope_hex: String(rec.signed_envelope_hex ?? ''),
      network_id: String(rec.network_id ?? platform.networkId),
      actor: String(rec.actor ?? 'public'),
      ...(typeof rec.idempotency_key === 'string' ? { idempotency_key: rec.idempotency_key } : {}),
      ...(typeof rec.from_account_id === 'string' && typeof rec.to_account_id === 'string' && typeof rec.amount === 'string'
        ? { transfer: { from: rec.from_account_id, to: rec.to_account_id, amount: BigInt(rec.amount) } }
        : {}),
    });
    if ('error_code' in submitted) {
      return json(errorStatus(submitted), submitted);
    }
    if (autoFinalize && submitted.submission_status === 'ACCEPTED') {
      platform.produceBlock();
    }
    return json(200, submitted);
  }

  if (method === 'POST' && path === '/v1/dev/faucet') {
    const accountId = String(rec.account_id ?? '');
    const amount = BigInt(String(rec.amount ?? '0'));
    return json(200, platform.faucet(accountId, amount));
  }

  if (method === 'GET' && path === '/v1/events') {
    const types = q.subscribe ? (q.subscribe.split(',') as EventType[]) : undefined;
    if (q.format === 'json') {
      const replay = platform.eventsSince(q.cursor, types);
      if ('error' in replay) {
        throw new Error('INVALID_PAGINATION_CURSOR');
      }
      return json(200, replay);
    }
    return { kind: 'sse', types, cursor: q.cursor };
  }

  if (method === 'POST' && path === '/operator/v1/produce-block') {
    return json(200, platform.produceBlock());
  }
  if (method === 'GET' && path === '/operator/v1/status') {
    return json(200, { surface: 'OPERATOR_API', chain: platform.chainStatus() });
  }

  return json(404, notFound(requestId));
}

function isApiError(value: unknown): value is ApiErrorEnvelope {
  return Boolean(value && typeof value === 'object' && 'error_code' in value && 'category' in value && 'request_id' in value);
}

function notFound(requestId: string): ApiErrorEnvelope {
  return apiError({
    error_code: 'NOT_FOUND',
    category: 'NOT_FOUND',
    message: 'not found',
    retryable: false,
    request_id: requestId,
  });
}

function writeSse(
  res: ServerResponse,
  platform: DevelopmentPlatform,
  types: readonly EventType[] | undefined,
  cursor: string | undefined,
): void {
  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
    'x-sunrey-api-version': 'v1',
  });
  const replay = platform.eventsSince(cursor, types);
  if ('error' in replay) {
    res.write(`event: error\ndata: ${JSON.stringify({ error_code: 'INVALID_PAGINATION_CURSOR' })}\n\n`);
    res.end();
    return;
  }
  for (const event of replay.events) {
    res.write(`id: ${event.cursor}\nevent: ${event.event_type}\ndata: ${JSON.stringify(event)}\n\n`);
  }
  res.write(`event: resume\ndata: ${JSON.stringify({ cursor: replay.cursor, authority: 'PROJECTION' })}\n\n`);
  res.end();
}

export const PUBLIC_ROUTES = [
  'GET /v1/chain/status',
  'GET /v1/chain/network',
  'GET /v1/chain/protocol',
  'GET /v1/chain/finality',
  'GET /v1/chain/blocks',
  'GET /v1/chain/transactions',
  'GET /v1/chain/state-roots',
  'POST /v1/accounts',
  'GET /v1/accounts/{id}',
  'GET /v1/assets',
  'GET /v1/assets/holdings/{id}',
  'GET /v1/monetary/policy',
  'GET /v1/monetary/supply',
  'GET /v1/monetary/genesis',
  'GET /v1/monetary/issuance/{id}',
  'GET /v1/monetary/burns',
  'GET /v1/fees/estimate',
  'GET /v1/fees/policy',
  'GET /v1/fees/price',
  'GET /v1/fees/estimate-v2',
  'GET /v1/validators',
  'GET /v1/validators/economics/policy',
  'GET /v1/validators/{id}/bond',
  'GET /v1/validators/{id}/rewards',
  'GET /v1/validators/{id}/penalties',
  'GET /v1/validators/{id}/unbond',
  'GET /v1/governance/proposals',
  'GET /v1/governance/operations/package',
  'GET /v1/governance/operations/diff',
  'GET /v1/governance/operations/activation',
  'GET /v1/governance/operations/emergency',
  'GET /v1/oracles/facts',
  'GET /v1/productive/moonrey',
  'GET /v1/productive/moonrey/policy',
  'GET /v1/productive/moonrey/supply-pressure',
  'GET /v1/machines',
  'GET /v1/interop/packets',
  'GET /v1/exchange/markets',
  'POST /v1/exchange/orders',
  'POST /v1/transactions',
  'GET /v1/events',
  'POST /v1/dev/faucet',
] as const;

export const OPERATOR_ROUTES = ['POST /operator/v1/produce-block', 'GET /operator/v1/status'] as const;
