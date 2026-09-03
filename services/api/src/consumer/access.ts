// @ts-nocheck
/**
 * Consumer BFF Human Access Economy dispatch.
 * Orchestrates packages/human-access-economy product surface.
 * Not a second ledger, Kernel, or live provider connector.
 */

import type { HumanAccessEconomyProduct } from '../../../../packages/human-access-economy/src/service.ts';
import type { AccessActor } from '../../../../packages/human-access-economy/src/access.ts';
import type { AccessCategory } from '../../../../packages/human-access-economy/src/taxonomy.ts';
import {
  createAccessConsumerBffSurface,
  type AccessConsumerBffSurface,
} from '../../../../packages/human-access-economy/src/consumer-bff/index.ts';
import { bffError, isBffError, type BffErrorEnvelope } from './errors.ts';
import { pageSizeOf } from './pagination.ts';
import type { BffPrincipal } from './ports.ts';

const consumerSurfaces = new WeakMap<HumanAccessEconomyProduct, AccessConsumerBffSurface>();

function consumerSurface(product: HumanAccessEconomyProduct): AccessConsumerBffSurface {
  let surface = consumerSurfaces.get(product);
  if (!surface) {
    surface = createAccessConsumerBffSurface(product);
    consumerSurfaces.set(product, surface);
  }
  return surface;
}

function bool(value: unknown): boolean | undefined {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return undefined;
}

type DispatchRequest = {
  readonly method: string;
  readonly path: string;
  readonly body: unknown;
  readonly query?: Readonly<Record<string, string | undefined>>;
};

function epochIdFromQuery(query: Readonly<Record<string, string | undefined>> | undefined): string | undefined {
  return str(query?.epochId);
}

type DispatchResponse = {
  readonly status: number;
  readonly body: unknown;
  readonly headers: Readonly<Record<string, string>>;
};

function json(status: number, body: unknown, headers: Record<string, string>): DispatchResponse {
  return { status, body, headers };
}

function result(body: unknown, headers: Record<string, string>, okStatus = 200): DispatchResponse {
  if (isBffError(body)) {
    const status =
      body.errorCode === 'RESOURCE_NOT_OWNED'
        ? 403
        : body.errorCode === 'NOT_FOUND'
          ? 404
          : body.errorCode === 'FEATURE_UNAVAILABLE'
            ? 503
            : 400;
    return json(status, body, headers);
  }
  return json(okStatus, body, headers);
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function actorFrom(principal: BffPrincipal): AccessActor {
  return Object.freeze({
    actorId: principal.actorId,
    customerId: principal.customerId,
    verified: principal.verification === 'VERIFIED' && principal.customerStatus !== 'PENDING_VERIFICATION',
    restricted: principal.restricted || principal.customerStatus === 'SUSPENDED',
  });
}

export function mapAccessOutcome<T>(
  outcome: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } },
  requestId: string,
): T | BffErrorEnvelope {
  if (outcome.ok) {
    return outcome.value;
  }
  const errorCode =
    outcome.error.code === 'SUBJECT_MISMATCH'
      ? 'RESOURCE_NOT_OWNED'
      : outcome.error.code === 'NOT_FOUND'
        ? 'NOT_FOUND'
        : outcome.error.code === 'FEATURE_DISABLED'
          ? 'FEATURE_UNAVAILABLE'
          : outcome.error.code === 'QUOTE_EXPIRED'
            ? 'VALIDATION'
            : outcome.error.code === 'PROVIDER_UNAVAILABLE' || outcome.error.code === 'REDEMPTION_BLOCKED'
              ? 'VALIDATION'
              : 'VALIDATION';
  return bffError({
    errorCode,
    category:
      errorCode === 'RESOURCE_NOT_OWNED'
        ? 'AUTHORIZATION'
        : errorCode === 'NOT_FOUND'
          ? 'NOT_FOUND'
          : errorCode === 'FEATURE_UNAVAILABLE'
            ? 'TEMPORARY_UNAVAILABLE'
            : 'VALIDATION',
    message: outcome.error.message,
    retryable: errorCode === 'FEATURE_UNAVAILABLE',
    requestId,
    detailsSafeForClient: { code: outcome.error.code },
  });
}

function categoryOf(value: unknown): AccessCategory | undefined {
  return typeof value === 'string' ? (value as AccessCategory) : undefined;
}

export function dispatchAccess(
  product: HumanAccessEconomyProduct,
  request: DispatchRequest,
  principal: BffPrincipal,
  requestId: string,
  headers: Record<string, string>,
): DispatchResponse | null {
  const { method, path } = request;
  if (!path.startsWith('/api/v1/access')) {
    return null;
  }
  const rec = request.body && typeof request.body === 'object' ? (request.body as Record<string, unknown>) : {};
  const actor = actorFrom(principal);
  const idempotencyKey = str(rec.idempotencyKey) ?? `${method}:${path}:${principal.actorId}`;
  const pathWithoutQuery = path.split('?')[0] ?? path;
  const queryEpoch = epochIdFromQuery(request.query);
  const query = request.query ?? {};
  const consumer = consumerSurface(product);

  if ((pathWithoutQuery === '/api/v1/access' || path === '/api/v1/access') && method === 'GET') {
    return result(mapAccessOutcome(consumer.dashboard(actor), requestId), headers);
  }
  if (pathWithoutQuery === '/api/v1/access/home-summary' && method === 'GET') {
    return result(mapAccessOutcome(consumer.homeSummary(actor), requestId), headers);
  }
  if (pathWithoutQuery === '/api/v1/access/allocation/explanation' && method === 'GET') {
    return result(mapAccessOutcome(consumer.allocationExplanation(actor), requestId), headers);
  }
  if (pathWithoutQuery === '/api/v1/access/history' && method === 'GET') {
    return result(
      mapAccessOutcome(
        consumer.history(actor, {
          ...(categoryOf(query.category ?? '') ? { category: categoryOf(query.category)! } : {}),
          ...(str(query.status) ? { status: str(query.status) } : {}),
          ...(str(query.fromDate) ? { fromDate: str(query.fromDate) } : {}),
          ...(str(query.toDate) ? { toDate: str(query.toDate) } : {}),
          ...(str(query.cursor) ? { cursor: str(query.cursor) } : {}),
          pageSize: pageSizeOf(query.pageSize ?? query.page_size),
        }),
        requestId,
      ),
      headers,
    );
  }
  if (pathWithoutQuery.startsWith('/api/v1/access/entitlements/') && method === 'GET') {
    const entitlementId = decodeURIComponent(pathWithoutQuery.slice('/api/v1/access/entitlements/'.length));
    return result(mapAccessOutcome(consumer.entitlementDetail(actor, entitlementId), requestId), headers);
  }
  if (pathWithoutQuery.startsWith('/api/v1/access/categories/') && method === 'GET') {
    const category = decodeURIComponent(pathWithoutQuery.slice('/api/v1/access/categories/'.length));
    return result(mapAccessOutcome(consumer.categoryDetail(actor, category), requestId), headers);
  }
  if (pathWithoutQuery.startsWith('/api/v1/access/opportunities/') && method === 'GET') {
    const opportunityId = decodeURIComponent(pathWithoutQuery.slice('/api/v1/access/opportunities/'.length));
    return result(mapAccessOutcome(consumer.opportunityDetail(actor, opportunityId), requestId), headers);
  }
  if (pathWithoutQuery.startsWith('/api/v1/access/transactions/') && pathWithoutQuery.endsWith('/confirm') && method === 'POST') {
    const transactionId = decodeURIComponent(
      pathWithoutQuery.slice('/api/v1/access/transactions/'.length, -'/confirm'.length),
    );
    return result(
      mapAccessOutcome(
        consumer.confirmTransaction(actor, transactionId, {
          ...(rec.userApproved === true ? { userApproved: true } : {}),
          ...(str(rec.paymentMethodId) ? { paymentMethodId: str(rec.paymentMethodId) } : {}),
          idempotencyKey,
        }),
        requestId,
      ),
      headers,
    );
  }
  if (pathWithoutQuery.startsWith('/api/v1/access/transactions/') && pathWithoutQuery.endsWith('/cancel') && method === 'POST') {
    const transactionId = decodeURIComponent(
      pathWithoutQuery.slice('/api/v1/access/transactions/'.length, -'/cancel'.length),
    );
    return result(mapAccessOutcome(consumer.cancelTransaction(actor, transactionId, idempotencyKey), requestId), headers);
  }
  if (pathWithoutQuery.startsWith('/api/v1/access/transactions/') && method === 'GET') {
    const transactionId = decodeURIComponent(pathWithoutQuery.slice('/api/v1/access/transactions/'.length));
    if (!transactionId.includes('/')) {
      return result(mapAccessOutcome(consumer.getTransaction(actor, transactionId), requestId), headers);
    }
  }
  if (pathWithoutQuery.startsWith('/api/v1/access/bookings/') && method === 'GET') {
    const bookingId = decodeURIComponent(pathWithoutQuery.slice('/api/v1/access/bookings/'.length));
    return result(mapAccessOutcome(consumer.getBooking(actor, bookingId), requestId), headers);
  }
  if ((pathWithoutQuery === '/api/v1/access/quote' || pathWithoutQuery === '/api/v1/access/quotes') && method === 'POST') {
    if (str(rec.opportunityId)) {
      return result(
        mapAccessOutcome(
          consumer.createCheckoutQuote(actor, {
            opportunityId: str(rec.opportunityId)!,
            requestedUnits: num(rec.requestedUnits) ?? num(rec.quantity) ?? 1,
            ...(str(rec.start) || str(rec.startsAt) ? { start: str(rec.start) ?? str(rec.startsAt) } : {}),
            ...(str(rec.end) || str(rec.endsAt) ? { end: str(rec.end) ?? str(rec.endsAt) } : {}),
            ...(rec.selectedOptions && typeof rec.selectedOptions === 'object'
              ? { selectedOptions: rec.selectedOptions as Record<string, string> }
              : {}),
            idempotencyKey,
          }),
          requestId,
        ),
        headers,
        201,
      );
    }
  }
  if ((pathWithoutQuery === '/api/v1/access/reserve' || pathWithoutQuery === '/api/v1/access/checkout') && method === 'POST') {
    return result(
      mapAccessOutcome(
        consumer.reserve(actor, {
          checkoutQuoteId: str(rec.checkoutQuoteId) ?? '',
          ...(str(rec.paymentMethodId) ? { paymentMethodId: str(rec.paymentMethodId) } : {}),
          idempotencyKey,
        }),
        requestId,
      ),
      headers,
      201,
    );
  }

  if (path === '/api/v1/access/overview' && method === 'GET') {
    return result(mapAccessOutcome(product.overview(actor), requestId), headers);
  }
  if (pathWithoutQuery === '/api/v1/access/epoch' && method === 'GET') {
    return result(mapAccessOutcome(product.accessEpoch(actor, queryEpoch), requestId), headers);
  }
  if (pathWithoutQuery === '/api/v1/access/participation' && method === 'GET') {
    return result(mapAccessOutcome(product.accessParticipation(actor, queryEpoch), requestId), headers);
  }
  if (pathWithoutQuery === '/api/v1/access/allocation/categories' && method === 'GET') {
    return result(mapAccessOutcome(product.accessAllocationCategories(queryEpoch), requestId), headers);
  }
  if (pathWithoutQuery === '/api/v1/access/allocation/history' && method === 'GET') {
    return result(mapAccessOutcome(product.accessAllocationHistory(actor), requestId), headers);
  }
  if (pathWithoutQuery === '/api/v1/access/allocation/preview' && method === 'POST') {
    const categories = Array.isArray(rec.categories)
      ? rec.categories.filter((value): value is string => typeof value === 'string')
      : undefined;
    return result(
      mapAccessOutcome(
        product.accessAllocationPreview(actor, {
          ...(str(rec.epochId) ? { epochId: str(rec.epochId) } : {}),
          ...(categories ? { categories } : {}),
        }),
        requestId,
      ),
      headers,
    );
  }
  if (pathWithoutQuery === '/api/v1/access/allocation' && method === 'GET') {
    return result(mapAccessOutcome(product.accessAllocation(actor, queryEpoch), requestId), headers);
  }
  if (path === '/api/v1/access/categories' && method === 'GET') {
    return result(mapAccessOutcome(product.categories(), requestId), headers);
  }
  if (pathWithoutQuery === '/api/v1/access/entitlements' && method === 'GET') {
  if (Object.keys(query).length > 0) {
      return result(
        mapAccessOutcome(
          consumer.listEntitlements(actor, {
            ...(categoryOf(query.category ?? '') ? { category: categoryOf(query.category)! } : {}),
            ...(str(query.status) ? { status: str(query.status) } : {}),
            ...(str(query.period) ? { period: str(query.period) } : {}),
            ...(bool(query.expiringSoon) !== undefined ? { expiringSoon: bool(query.expiringSoon) } : {}),
          }),
          requestId,
        ),
        headers,
      );
    }
    return result(mapAccessOutcome(product.entitlements(actor), requestId), headers);
  }
  if (path === '/api/v1/access/reservations' && method === 'GET') {
    return result(mapAccessOutcome(product.reservations(actor), requestId), headers);
  }
  if (path === '/api/v1/access/activity' && method === 'GET') {
    return result(mapAccessOutcome(product.activity(actor), requestId), headers);
  }
  if (path === '/api/v1/access/home-summary' && method === 'GET') {
    return result(mapAccessOutcome(product.homeSummary(actor), requestId), headers);
  }
  if (path === '/api/v1/access/landing' && method === 'GET') {
    return result(mapAccessOutcome(product.landing(actor), requestId), headers);
  }
  if (pathWithoutQuery === '/api/v1/access/history' && method === 'GET') {
    const filter = (request.query?.filter ?? 'ALL') as import('../../../../packages/human-access-economy/src/product/taxonomy.ts').AccessHistoryFilter;
    const category = categoryOf(request.query?.category);
    const fromDate = str(request.query?.from);
    const toDate = str(request.query?.to);
    return result(
      mapAccessOutcome(product.accessHistory(actor, filter, category, fromDate, toDate), requestId),
      headers,
    );
  }
  if (path === '/api/v1/access/upcoming' && method === 'GET') {
    return result(mapAccessOutcome(product.upcoming(actor), requestId), headers);
  }
  if (pathWithoutQuery === '/api/v1/access/receipts' && method === 'GET') {
    return result(mapAccessOutcome(product.listReceipts(actor), requestId), headers);
  }
  if (path.startsWith('/api/v1/access/receipts/') && method === 'GET') {
    const id = path.slice('/api/v1/access/receipts/'.length);
    return result(mapAccessOutcome(product.getReceipt(actor, decodeURIComponent(id)), requestId), headers);
  }
  if (path.startsWith('/api/v1/access/refund-receipts/') && method === 'GET') {
    const id = path.slice('/api/v1/access/refund-receipts/'.length);
    return result(mapAccessOutcome(product.getRefundReceipt(actor, decodeURIComponent(id)), requestId), headers);
  }
  if (path.startsWith('/api/v1/access/transactions/') && path.endsWith('/checkout') && method === 'GET') {
    const id = path.slice('/api/v1/access/transactions/'.length, -'/checkout'.length);
    return result(mapAccessOutcome(product.getCheckout(actor, decodeURIComponent(id)), requestId), headers);
  }
  if (path.startsWith('/api/v1/access/transactions/') && path.endsWith('/checkout') && method === 'POST') {
    const id = path.slice('/api/v1/access/transactions/'.length, -'/checkout'.length);
    return result(mapAccessOutcome(product.startCheckout(actor, decodeURIComponent(id)), requestId), headers);
  }
  if (path.startsWith('/api/v1/access/transactions/') && path.endsWith('/confirm') && method === 'POST') {
    const id = path.slice('/api/v1/access/transactions/'.length, -'/confirm'.length);
    const processing = rec.processing === true;
    return result(mapAccessOutcome(product.confirmBooking(actor, decodeURIComponent(id), processing), requestId), headers);
  }
  if (path.startsWith('/api/v1/access/transactions/') && path.endsWith('/cancel') && method === 'POST') {
    const id = path.slice('/api/v1/access/transactions/'.length, -'/cancel'.length);
    return result(
      mapAccessOutcome(
        product.cancelTransaction(actor, decodeURIComponent(id), {
          ...(str(rec.penaltyMinorUnits) ? { penaltyMinorUnits: str(rec.penaltyMinorUnits) } : {}),
          ...(str(rec.providerRefundMinorUnits) ? { providerRefundMinorUnits: str(rec.providerRefundMinorUnits) } : {}),
        }),
        requestId,
      ),
      headers,
    );
  }
  if (path.startsWith('/api/v1/access/transactions/') && path.endsWith('/support-context') && method === 'GET') {
    const id = path.slice('/api/v1/access/transactions/'.length, -'/support-context'.length);
    return result(mapAccessOutcome(product.getSupportContext(actor, decodeURIComponent(id)), requestId), headers);
  }
  if (path.startsWith('/api/v1/access/transactions/') && method === 'GET') {
    const id = path.slice('/api/v1/access/transactions/'.length);
    if (!id.includes('/')) {
      return result(mapAccessOutcome(product.getTransaction(actor, decodeURIComponent(id)), requestId), headers);
    }
  }
  if (path === '/api/v1/access/intents' && method === 'POST') {
    return result(
      mapAccessOutcome(
        product.createIntent(actor, {
          category: categoryOf(rec.category) ?? 'MOBILITY',
          summary: str(rec.summary) ?? str(rec.description) ?? '',
          ...(str(rec.location) ? { location: str(rec.location) } : {}),
          idempotencyKey,
        }),
        requestId,
      ),
      headers,
      201,
    );
  }
  if (path === '/api/v1/access/availability' && method === 'POST') {
    return result(
      mapAccessOutcome(
        product.checkAvailability(actor, {
          category: categoryOf(rec.category) ?? 'MOBILITY',
          ...(str(rec.summary) ? { summary: str(rec.summary) } : {}),
          ...(str(rec.description) ? { summary: str(rec.description) } : {}),
          ...(str(rec.location) ? { location: str(rec.location) } : {}),
          ...(str(rec.intentId) ? { intentId: str(rec.intentId) } : {}),
        }),
        requestId,
      ),
      headers,
    );
  }
  if (path === '/api/v1/access/providers' && method === 'GET') {
    return result(mapAccessOutcome(product.providers(actor), requestId), headers);
  }
  if (pathWithoutQuery === '/api/v1/access/search' && method === 'POST') {
    return result(
      mapAccessOutcome(
        consumer.search(actor, {
          category: categoryOf(rec.category) ?? 'MOBILITY',
          query: str(rec.query) ?? str(rec.summary) ?? '',
          ...(str(rec.location) ? { location: str(rec.location) } : {}),
          ...(str(rec.startDate) || str(rec.start) ? { startDate: str(rec.startDate) ?? str(rec.start) } : {}),
          ...(str(rec.endDate) || str(rec.end) ? { endDate: str(rec.endDate) ?? str(rec.end) } : {}),
          ...(num(rec.units) !== undefined ? { units: num(rec.units) } : {}),
          ...(str(rec.unit) ? { unit: str(rec.unit) } : {}),
          ...(str(rec.cursor) ? { cursor: str(rec.cursor) } : {}),
          pageSize: pageSizeOf(str(rec.pageSize) ?? str(rec.page_size)),
          ...(rec.filters && typeof rec.filters === 'object' ? { filters: rec.filters as Record<string, string> } : {}),
          ...(str(rec.sort) ? { sort: str(rec.sort) } : {}),
        }),
        requestId,
      ),
      headers,
    );
  }
  if (path === '/api/v1/access/quotes' && method === 'POST') {
    if (str(rec.providerId) && str(rec.catalogItemId)) {
      return result(
        mapAccessOutcome(
          product.createProviderQuote(actor, {
            providerId: str(rec.providerId)!,
            catalogItemId: str(rec.catalogItemId)!,
            quantity: num(rec.quantity) ?? 1,
            startsAt: str(rec.startsAt) ?? '2026-08-29T10:00:00.000Z',
            endsAt: str(rec.endsAt) ?? '2026-09-02T10:00:00.000Z',
            ...(str(rec.location) ? { location: str(rec.location) } : {}),
            idempotencyKey,
          }),
          requestId,
        ),
        headers,
        201,
      );
    }
    return result(
      mapAccessOutcome(
        product.createQuote(actor, {
          category: categoryOf(rec.category) ?? 'MOBILITY',
          summary: str(rec.summary) ?? str(rec.description) ?? '',
          ...(str(rec.location) ? { location: str(rec.location) } : {}),
          ...(str(rec.intentId) ? { intentId: str(rec.intentId) } : {}),
          idempotencyKey,
        }),
        requestId,
      ),
      headers,
      201,
    );
  }
  if (path === '/api/v1/access/reservations' && method === 'POST') {
    return result(
      mapAccessOutcome(
        product.createReservation(actor, {
          quoteId: str(rec.quoteId) ?? '',
          ...(str(rec.startsAt) ? { startsAt: str(rec.startsAt) } : {}),
          ...(str(rec.endsAt) ? { endsAt: str(rec.endsAt) } : {}),
          idempotencyKey,
        }),
        requestId,
      ),
      headers,
      201,
    );
  }
  if (path.startsWith('/api/v1/access/reservations/') && path.endsWith('/confirm') && method === 'POST') {
    const id = path.slice('/api/v1/access/reservations/'.length, -'/confirm'.length);
    return result(mapAccessOutcome(product.confirmReservation(actor, decodeURIComponent(id)), requestId), headers);
  }
  if (path.startsWith('/api/v1/access/reservations/') && path.endsWith('/cancel') && method === 'POST') {
    const id = path.slice('/api/v1/access/reservations/'.length, -'/cancel'.length);
    return result(mapAccessOutcome(product.cancelReservation(actor, decodeURIComponent(id)), requestId), headers);
  }
  if (path === '/api/v1/access/redemptions/preview' && method === 'POST') {
    return result(
      mapAccessOutcome(
        product.previewRedemption(actor, {
          category: categoryOf(rec.category) ?? 'MOBILITY',
          providerId: str(rec.providerId) ?? 'turo',
          quoteId: str(rec.quoteId) ?? '',
          entitlementId: str(rec.entitlementId) ?? '',
          entitlementClass: str(rec.entitlementClass) ?? 'MOBILITY_STANDARD',
          requestedQuantity: num(rec.requestedQuantity) ?? num(rec.quantity) ?? 1,
          ...(str(rec.redemptionId) ? { redemptionId: str(rec.redemptionId) } : {}),
          ...(str(rec.intentId) ? { intentId: str(rec.intentId) } : {}),
          ...(str(rec.maxUserContributionMinorUnits)
            ? { maxUserContributionMinorUnits: str(rec.maxUserContributionMinorUnits) }
            : {}),
          idempotencyKey,
        }),
        requestId,
      ),
      headers,
    );
  }
  if (path === '/api/v1/access/redemptions' && method === 'POST') {
    return result(
      mapAccessOutcome(
        product.startRedemption(actor, {
          category: categoryOf(rec.category) ?? 'MOBILITY',
          providerId: str(rec.providerId) ?? 'turo',
          quoteId: str(rec.quoteId) ?? '',
          entitlementId: str(rec.entitlementId) ?? '',
          entitlementClass: str(rec.entitlementClass) ?? 'MOBILITY_STANDARD',
          requestedQuantity: num(rec.requestedQuantity) ?? num(rec.quantity) ?? 1,
          ...(str(rec.redemptionId) ? { redemptionId: str(rec.redemptionId) } : {}),
          ...(str(rec.intentId) ? { intentId: str(rec.intentId) } : {}),
          ...(str(rec.maxUserContributionMinorUnits)
            ? { maxUserContributionMinorUnits: str(rec.maxUserContributionMinorUnits) }
            : {}),
          idempotencyKey,
        }),
        requestId,
      ),
      headers,
      201,
    );
  }
  if (path.startsWith('/api/v1/access/redemptions/') && path.endsWith('/confirm') && method === 'POST') {
    const id = path.slice('/api/v1/access/redemptions/'.length, -'/confirm'.length);
    return result(
      mapAccessOutcome(
        product.confirmRedemption(actor, decodeURIComponent(id), {
          ...(rec.userApproved === true ? { userApproved: true } : {}),
          ...(str(rec.userFiatMinorUnits) ? { userFiatMinorUnits: str(rec.userFiatMinorUnits) } : {}),
        }),
        requestId,
      ),
      headers,
    );
  }
  if (path.startsWith('/api/v1/access/redemptions/') && path.endsWith('/cancel') && method === 'POST') {
    const id = path.slice('/api/v1/access/redemptions/'.length, -'/cancel'.length);
    return result(mapAccessOutcome(product.cancelRedemption(actor, decodeURIComponent(id)), requestId), headers);
  }
  if (path.startsWith('/api/v1/access/redemptions/') && path.endsWith('/status') && method === 'GET') {
    const id = path.slice('/api/v1/access/redemptions/'.length, -'/status'.length);
    return result(mapAccessOutcome(product.getRedemption(actor, decodeURIComponent(id)), requestId), headers);
  }
  if (path.startsWith('/api/v1/access/redemptions/') && method === 'GET') {
    const id = path.slice('/api/v1/access/redemptions/'.length);
    if (!id.includes('/')) {
      return result(mapAccessOutcome(product.getRedemption(actor, decodeURIComponent(id)), requestId), headers);
    }
  }
  if (path === '/api/v1/access/experiences/quote' && method === 'POST') {
    return result(
      mapAccessOutcome(
        product.quoteExperience(actor, {
          destination: str(rec.destination) ?? '',
          durationDays: num(rec.durationDays) ?? num(rec.duration_days) ?? 0,
          ...(str(rec.title) ? { title: str(rec.title) } : {}),
          idempotencyKey,
        }),
        requestId,
      ),
      headers,
      201,
    );
  }
  if (path.startsWith('/api/v1/access/experiences/') && path.endsWith('/confirm') && method === 'POST') {
    const id = path.slice('/api/v1/access/experiences/'.length, -'/confirm'.length);
    return result(mapAccessOutcome(product.confirmExperience(actor, decodeURIComponent(id)), requestId), headers);
  }

  return json(
    404,
    bffError({
      errorCode: 'NOT_FOUND',
      category: 'NOT_FOUND',
      message: 'access resource not found',
      retryable: false,
      requestId,
    }),
    headers,
  );
}