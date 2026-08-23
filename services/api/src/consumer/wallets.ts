/**
 * Consumer BFF wallet dispatch. Orchestrates packages/custody product.
 * Vendor custody details do not leak onto this surface.
 */

import type { WalletProductService } from '../../../../packages/custody/src/product/index.ts';
import type { WalletActorInput } from '../../../../packages/custody/src/product/service.ts';
import { bffError, isBffError, type BffErrorEnvelope } from './errors.ts';
import type { BffPrincipal } from './ports.ts';

type WalletDispatchRequest = {
  readonly method: string;
  readonly path: string;
  readonly body: unknown;
};

type WalletDispatchResponse = {
  readonly status: number;
  readonly body: unknown;
  readonly headers: Readonly<Record<string, string>>;
};

function json(status: number, body: unknown, headers: Record<string, string>): WalletDispatchResponse {
  return { status, body, headers };
}

function result(body: unknown, headers: Record<string, string>, okStatus = 200): WalletDispatchResponse {
  if (isBffError(body)) {
    const status =
      body.errorCode === 'STEP_UP_REQUIRED'
        ? 401
        : body.errorCode === 'RESOURCE_NOT_OWNED'
          ? 403
          : body.errorCode === 'NOT_FOUND'
            ? 404
            : body.errorCode === 'KERNEL_REFUSED' || body.errorCode === 'KERNEL_DENIED'
              ? 403
              : 400;
    return json(status, body, headers);
  }
  return json(okStatus, body, headers);
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function mapWalletOutcome<T>(
  outcome: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly code: string; readonly message: string },
  requestId: string,
): T | BffErrorEnvelope {
  if (outcome.ok) {
    return outcome.value;
  }
  const errorCode =
    outcome.code === 'RESOURCE_NOT_OWNED'
      ? 'RESOURCE_NOT_OWNED'
      : outcome.code === 'STEP_UP_REQUIRED'
        ? 'STEP_UP_REQUIRED'
        : outcome.code === 'KERNEL_REFUSED'
          ? 'KERNEL_REFUSED'
          : outcome.code === 'NOT_FOUND'
            ? 'NOT_FOUND'
            : 'VALIDATION';
  return bffError({
    errorCode,
    category: errorCode === 'STEP_UP_REQUIRED' ? 'AUTHENTICATION' : errorCode === 'RESOURCE_NOT_OWNED' ? 'AUTHORIZATION' : 'VALIDATION',
    message: outcome.message,
    retryable: false,
    requestId,
    detailsSafeForClient: { code: outcome.code },
  });
}

function actorFrom(principal: BffPrincipal, body: Record<string, unknown>, identity?: { resolveActorContext(actorId: string): { ok: boolean; value?: unknown } }): WalletActorInput {
  const resolved = identity?.resolveActorContext(principal.actorId);
  return {
    actorId: principal.actorId,
    customerId: principal.customerId,
    ...(resolved?.ok === true && resolved.value ? { verified: resolved.value as WalletActorInput['verified'] } : {}),
    stepUpSatisfied: body.stepUpSatisfied === true,
    originatedFromAgent: body.originatedFromAgent === true,
  };
}

export function dispatchWallets(
  product: WalletProductService,
  request: WalletDispatchRequest,
  principal: BffPrincipal,
  requestId: string,
  headers: Record<string, string>,
  identity?: { resolveActorContext(actorId: string): { ok: boolean; value?: unknown } },
): WalletDispatchResponse | null {
  const { method, path, body } = request;
  const rec = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};

  if (path === '/api/v1/wallets' && method === 'GET') {
    return json(
      200,
      {
        schema: 'sunrey.consumer.wallets.v1',
        items: product.listWallets(principal.customerId),
        productionSigningAuthorized: false,
        productionMoneyMovement: false,
      },
      headers,
    );
  }

  if (path === '/api/v1/assets' && method === 'GET') {
    const sunrey = mapWalletOutcome(product.assetDetail(principal.customerId, 'SUNREY_COIN'), requestId);
    const moonrey = mapWalletOutcome(product.assetDetail(principal.customerId, 'MOONREY_COIN'), requestId);
    if (isBffError(sunrey) || isBffError(moonrey)) {
      return result(isBffError(sunrey) ? sunrey : moonrey, headers);
    }
    return json(200, { schema: 'sunrey.consumer.assets.v1', items: [sunrey, moonrey], productionMoneyMovement: false }, headers);
  }

  if (path.startsWith('/api/v1/assets/') && method === 'GET') {
    const assetId = path.slice('/api/v1/assets/'.length);
    return result(mapWalletOutcome(product.assetDetail(principal.customerId, assetId), requestId), headers);
  }

  if (!path.startsWith('/api/v1/wallets/')) {
    return null;
  }

  const rest = path.slice('/api/v1/wallets/'.length);
  const parts = rest.split('/');
  const walletId = parts[0] ?? '';
  if (!walletId) {
    return null;
  }

  if (parts.length === 1 && method === 'GET') {
    return result(mapWalletOutcome(product.getWallet(principal.customerId, walletId), requestId), headers);
  }
  if (parts.length === 2 && parts[1] === 'deposit-address' && method === 'GET') {
    return result(mapWalletOutcome(product.depositAddress(principal.customerId, walletId), requestId), headers);
  }
  if (parts.length === 2 && parts[1] === 'transactions' && method === 'GET') {
    const listed = mapWalletOutcome(product.listTransactions(principal.customerId, walletId), requestId);
    if (isBffError(listed)) {
      return result(listed, headers);
    }
    return json(200, { items: listed, productionMoneyMovement: false }, headers);
  }
  if (parts.length === 2 && parts[1] === 'withdrawal-quote' && method === 'POST') {
    return result(
      mapWalletOutcome(product.quoteWithdrawal(principal.customerId, walletId, rec, actorFrom(principal, rec, identity)), requestId),
      headers,
    );
  }
  if (parts.length === 2 && parts[1] === 'withdrawals' && method === 'POST') {
    const created = mapWalletOutcome(
      product.createWithdrawal(principal.customerId, walletId, rec, actorFrom(principal, rec, identity)),
      requestId,
    );
    return result(created, headers, 201);
  }
  if (parts.length === 3 && parts[1] === 'withdrawals' && method === 'GET') {
    const withdrawalId = parts[2] ?? '';
    return result(mapWalletOutcome(product.getWithdrawal(principal.customerId, walletId, withdrawalId), requestId), headers);
  }

  void str;
  return null;
}
