// @ts-nocheck
/**
 * Consumer BFF Merchant Exchange dispatch — purchase intent marketplace.
 */

import {
  createMerchantExchangeSandbox,
  type MerchantExchangeService,
} from '../../../../packages/sunrey-exchange/src/merchant-exchange/index.ts';
import { bffError, isBffError, type BffErrorEnvelope } from './errors.ts';

type MerchantExchangeDispatchRequest = {
  readonly method: string;
  readonly path: string;
  readonly query?: Readonly<Record<string, string>>;
  readonly body?: unknown;
  readonly principal?: { readonly customerId: string; readonly role: 'USER' | 'MERCHANT' };
};

type MerchantExchangeDispatchResponse = {
  readonly status: number;
  readonly body: unknown;
  readonly headers: Readonly<Record<string, string>>;
};

let defaultService: MerchantExchangeService | undefined;

function resolveService(custom?: MerchantExchangeService): MerchantExchangeService {
  if (custom) return custom;
  if (!defaultService) defaultService = createMerchantExchangeSandbox().service;
  return defaultService;
}

function json(status: number, body: unknown, headers: Record<string, string>): MerchantExchangeDispatchResponse {
  return { status, body, headers };
}

function result(body: unknown, headers: Record<string, string>, okStatus = 200): MerchantExchangeDispatchResponse {
  if (isBffError(body)) {
    return json(body.errorCode === 'NOT_FOUND' ? 404 : 400, body, headers);
  }
  return json(okStatus, body, headers);
}

function failure(requestId: string, message: string, code = 'VALIDATION'): BffErrorEnvelope {
  return bffError({
    errorCode: code,
    category: 'VALIDATION',
    message,
    retryable: false,
    requestId,
  });
}

function parseBody(body: unknown): Record<string, unknown> {
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }
  return {};
}

export function dispatchMerchantExchange(
  request: MerchantExchangeDispatchRequest,
  requestId: string,
  headers: Record<string, string>,
  service?: MerchantExchangeService,
): MerchantExchangeDispatchResponse | null {
  const { method, path, body } = request;
  if (!path.startsWith('/api/v1/merchant-exchange')) return null;

  const svc = resolveService(service);
  const principal = request.principal ?? { customerId: 'sandbox_user', role: 'USER' as const };
  const payload = parseBody(body);

  try {
    // User: create purchase intent
    if (path === '/api/v1/merchant-exchange/intents' && method === 'POST') {
      if (principal.role !== 'USER') {
        return json(403, failure(requestId, 'only users can create purchase intents', 'FORBIDDEN'), headers);
      }
      const created = svc.createIntent({
        userId: principal.customerId,
        required: {
          category: String(payload.category ?? 'OTHER') as never,
          productOrService: String(payload.productOrService ?? ''),
          quantity: Number(payload.quantity ?? 1),
          currency: String(payload.currency ?? 'USD'),
        },
        locationConstraint: {
          regionCode: String(payload.regionCode ?? 'US-CA'),
          countryCode: String(payload.countryCode ?? 'US'),
          postalPrefix: payload.postalPrefix ? String(payload.postalPrefix) : undefined,
        },
        deliveryConstraint: {
          method: (payload.deliveryMethod as never) ?? 'DELIVERY',
        },
        budgetMinorUnits: payload.budgetMinorUnits ? String(payload.budgetMinorUnits) : undefined,
        expiresAt: String(payload.expiresAt ?? new Date(Date.now() + 7 * 86400000).toISOString()),
        submit: payload.submit !== false,
      });
      if (created.outcome === 'REJECTED') {
        return result(failure(requestId, created.message, created.code), headers);
      }
      return result(
        Object.freeze({ intent: created.value, simulation: true, readOnly: false }),
        headers,
        201,
      );
    }

    // User: view intent
    const intentMatch = path.match(/^\/api\/v1\/merchant-exchange\/intents\/([^/]+)$/);
    if (intentMatch && method === 'GET') {
      const intentId = intentMatch[1]!;
      const got = svc.getIntent(principal.customerId, intentId);
      if (got.outcome === 'REJECTED') {
        return result(failure(requestId, got.message, got.code), headers);
      }
      return result(Object.freeze({ intent: got.value, simulation: true }), headers);
    }

    // User: view ranked offers
    const offersMatch = path.match(/^\/api\/v1\/merchant-exchange\/intents\/([^/]+)\/offers$/);
    if (offersMatch && method === 'GET') {
      const intentId = offersMatch[1]!;
      const ranked = svc.getRankedOffers(principal.customerId, intentId);
      if (ranked.outcome === 'REJECTED') {
        return result(failure(requestId, ranked.message, ranked.code), headers);
      }
      return result(Object.freeze({ ranked: ranked.value, simulation: true }), headers);
    }

    // User: select offer
    const selectMatch = path.match(/^\/api\/v1\/merchant-exchange\/intents\/([^/]+)\/select$/);
    if (selectMatch && method === 'POST') {
      if (principal.role !== 'USER') {
        return json(403, failure(requestId, 'only users can select offers', 'FORBIDDEN'), headers);
      }
      const intentId = selectMatch[1]!;
      const selected = svc.selectOffer({
        userId: principal.customerId,
        intentId,
        offerId: String(payload.offerId ?? ''),
        authorizationContext: String(payload.authorizationContext ?? 'bff_user_selection'),
      });
      if (selected.outcome === 'REJECTED') {
        return result(failure(requestId, selected.message, selected.code), headers);
      }
      return result(Object.freeze({ purchase: selected.value, simulation: true }), headers, 201);
    }

    // Merchant: submit offer
    if (path === '/api/v1/merchant-exchange/offers' && method === 'POST') {
      if (principal.role !== 'MERCHANT') {
        return json(403, failure(requestId, 'only merchants can submit offers', 'FORBIDDEN'), headers);
      }
      const merchantId = String(payload.merchantId ?? principal.customerId);
      const submitted = svc.submitOffer({
        merchantId,
        intentId: String(payload.intentId ?? ''),
        priceMinorUnits: String(payload.priceMinorUnits ?? ''),
        currency: String(payload.currency ?? 'USD'),
        discountMinorUnits: payload.discountMinorUnits ? String(payload.discountMinorUnits) : undefined,
        deliveryTerms: String(payload.deliveryTerms ?? ''),
        availability: String(payload.availability ?? ''),
        warranty: payload.warranty ? String(payload.warranty) : null,
        serviceTerms: payload.serviceTerms ? String(payload.serviceTerms) : null,
        expiresAt: String(payload.expiresAt ?? new Date(Date.now() + 7 * 86400000).toISOString()),
      });
      if (submitted.outcome === 'REJECTED') {
        return result(failure(requestId, submitted.message, submitted.code), headers);
      }
      return result(Object.freeze({ offer: submitted.value, simulation: true }), headers, 201);
    }

    // Merchant: withdraw offer
    const withdrawMatch = path.match(/^\/api\/v1\/merchant-exchange\/offers\/([^/]+)\/withdraw$/);
    if (withdrawMatch && method === 'POST') {
      if (principal.role !== 'MERCHANT') {
        return json(403, failure(requestId, 'only merchants can withdraw offers', 'FORBIDDEN'), headers);
      }
      const offerId = withdrawMatch[1]!;
      const merchantId = String(payload.merchantId ?? principal.customerId);
      const withdrawn = svc.withdrawOffer(merchantId, offerId);
      if (withdrawn.outcome === 'REJECTED') {
        return result(failure(requestId, withdrawn.message, withdrawn.code), headers);
      }
      return result(Object.freeze({ offer: withdrawn.value, simulation: true }), headers);
    }

    // Merchant: view own offers for intent
    const merchantOffersMatch = path.match(/^\/api\/v1\/merchant-exchange\/merchant\/([^/]+)\/intents\/([^/]+)\/offers$/);
    if (merchantOffersMatch && method === 'GET') {
      const merchantId = merchantOffersMatch[1]!;
      const intentId = merchantOffersMatch[2]!;
      const visibility = svc.getMerchantOffers(merchantId, intentId);
      if (visibility.outcome === 'REJECTED') {
        return result(failure(requestId, visibility.message, visibility.code), headers);
      }
      return result(Object.freeze({ visibility: visibility.value, sealed: true, simulation: true }), headers);
    }

    // User: authorize purchase
    const authMatch = path.match(/^\/api\/v1\/merchant-exchange\/purchases\/([^/]+)\/authorize$/);
    if (authMatch && method === 'POST') {
      const purchaseId = authMatch[1]!;
      const authResult = svc.authorizePurchase(principal.customerId, purchaseId);
      if (authResult instanceof Promise) {
        return result(failure(requestId, 'async authorization not supported in sync dispatch'), headers);
      }
      if (authResult.outcome === 'REJECTED') {
        return result(failure(requestId, authResult.message, authResult.code), headers);
      }
      return result(Object.freeze({ purchase: authResult.value, simulation: true }), headers);
    }

    // User: view purchase / fulfillment / settlement status
    const purchaseMatch = path.match(/^\/api\/v1\/merchant-exchange\/purchases\/([^/]+)$/);
    if (purchaseMatch && method === 'GET') {
      const purchaseId = purchaseMatch[1]!;
      const purchase = svc.getPurchase(principal.customerId, purchaseId);
      if (purchase.outcome === 'REJECTED') {
        return result(failure(requestId, purchase.message, purchase.code), headers);
      }
      return result(
        Object.freeze({
          purchase: purchase.value,
          fulfillmentStatus: purchase.value.fulfillmentStatus,
          settlementStatus: purchase.value.settlementStatus,
          authorizationStatus: purchase.value.authorizationStatus,
          simulation: true,
        }),
        headers,
      );
    }

    return json(404, failure(requestId, `unknown merchant exchange route: ${method} ${path}`, 'NOT_FOUND'), headers);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'merchant exchange dispatch failed';
    return result(failure(requestId, message, 'INTERNAL'), headers, 500);
  }
}

export const MERCHANT_EXCHANGE_BFF_ROUTES = Object.freeze([
  'POST /api/v1/merchant-exchange/intents',
  'GET /api/v1/merchant-exchange/intents/{intentId}',
  'GET /api/v1/merchant-exchange/intents/{intentId}/offers',
  'POST /api/v1/merchant-exchange/intents/{intentId}/select',
  'POST /api/v1/merchant-exchange/offers',
  'POST /api/v1/merchant-exchange/offers/{offerId}/withdraw',
  'GET /api/v1/merchant-exchange/merchant/{merchantId}/intents/{intentId}/offers',
  'POST /api/v1/merchant-exchange/purchases/{purchaseId}/authorize',
  'GET /api/v1/merchant-exchange/purchases/{purchaseId}',
]);
