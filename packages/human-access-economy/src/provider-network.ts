/**
 * Human Access Economy provider network orchestration.
 */

import {
  AccessProviderGateway,
  InMemoryFundingIntentPort,
  ProviderEconomicMetrics,
  RedemptionWorkflow,
  createAccessProviderGateway,
} from '../../access-economy/src/providers/index.ts';
import type { AccessProviderId } from '../../access-economy/src/providers/types.ts';
import type { RedemptionRecord, RedemptionRequest } from '../../access-economy/src/providers/redemption/types.ts';

export type ProviderNetworkSearchInput = {
  readonly query: string;
  readonly location?: string;
  readonly category: string;
  readonly providerId?: AccessProviderId;
};

export type ProviderNetworkQuoteInput = {
  readonly providerId: AccessProviderId;
  readonly catalogItemId: string;
  readonly quantity: number;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly location?: string;
  readonly idempotencyKey: string;
};

export type ProviderNetworkRedemptionPreviewInput = {
  readonly redemptionId: string;
  readonly customerId: string;
  readonly intentId?: string;
  readonly category: string;
  readonly providerId: AccessProviderId;
  readonly quoteId: string;
  readonly entitlementId: string;
  readonly entitlementClass: string;
  readonly requestedQuantity: number;
  readonly maxUserContributionMinorUnits: string;
};

export class AccessProviderNetworkService {
  readonly gateway: AccessProviderGateway;
  readonly workflow: RedemptionWorkflow;
  readonly metrics: ProviderEconomicMetrics;
  private readonly quotes = new Map<string, import('../../access-economy/src/providers/types.ts').ProviderQuote>();

  constructor(gateway: AccessProviderGateway = createAccessProviderGateway()) {
    this.gateway = gateway;
    this.workflow = new RedemptionWorkflow(gateway, { funding: new InMemoryFundingIntentPort() });
    this.metrics = new ProviderEconomicMetrics();
  }

  listProviders() {
    return this.gateway.listProviders().map((row) =>
      Object.freeze({
        providerId: row.providerId,
        displayName: row.displayName,
        integrationState: row.integrationState,
        categories: row.categories,
        liveEnabled: this.gateway.registry.isLiveEnabled(row.providerId),
      }),
    );
  }

  search(input: ProviderNetworkSearchInput) {
    const outcome = this.gateway.search({
      requestId: `search_${input.query}`,
      category: input.category as import('../../access-economy/src/taxonomy.ts').AccessCapacityCategory,
      query: input.query,
      location: input.location ?? null,
      limit: 10,
      ...(input.providerId ? { providerId: input.providerId } : {}),
    });
    if (!outcome.ok) {
      return outcome;
    }
    return outcome;
  }

  createQuote(input: ProviderNetworkQuoteInput) {
    const outcome = this.gateway.quote({
      requestId: `quote_${input.idempotencyKey}`,
      providerId: input.providerId,
      catalogItemId: input.catalogItemId,
      quantity: BigInt(input.quantity),
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      location: input.location ?? null,
      idempotencyKey: input.idempotencyKey,
    });
    if (outcome.ok) {
      this.quotes.set(outcome.value.quoteId, outcome.value);
      this.metrics.recordQuote(input.providerId, true, outcome.value.providerPriceMinorUnits);
    } else {
      this.metrics.recordQuote(input.providerId, false, 0n);
    }
    return outcome;
  }

  getQuote(quoteId: string) {
    return this.quotes.get(quoteId) ?? null;
  }

  previewRedemption(input: ProviderNetworkRedemptionPreviewInput) {
    const quote = this.quotes.get(input.quoteId);
    if (!quote) {
      return Object.freeze({ ok: false as const, code: 'NOT_FOUND', message: 'provider quote not found' });
    }
    const request = this.toRedemptionRequest(input, quote);
    return Object.freeze({ ok: true as const, value: this.workflow.preview(request).decision });
  }

  startRedemption(input: ProviderNetworkRedemptionPreviewInput, idempotencyKey: string) {
    const quote = this.quotes.get(input.quoteId);
    if (!quote) {
      return Object.freeze({ ok: false as const, code: 'NOT_FOUND', message: 'provider quote not found' });
    }
    const request = this.toRedemptionRequest(input, quote);
    return this.workflow.start(request, idempotencyKey);
  }

  confirmRedemption(redemptionId: string, input?: { readonly userApproved?: boolean; readonly userFiatMinorUnits?: string }) {
    return this.workflow.confirm(redemptionId, {
      ...(input?.userApproved !== undefined ? { userApproved: input.userApproved } : {}),
      ...(input?.userFiatMinorUnits ? { userFiatMinorUnits: BigInt(input.userFiatMinorUnits) } : {}),
    });
  }

  cancelRedemption(redemptionId: string) {
    return this.workflow.cancel(redemptionId);
  }

  getRedemption(redemptionId: string): RedemptionRecord | null {
    return this.workflow.get(redemptionId);
  }

  seedEntitlement(entitlementId: string, customerId: string, availableUnits: number): void {
    this.workflow.entitlements.seed(entitlementId, customerId, BigInt(availableUnits));
  }

  private toRedemptionRequest(
    input: ProviderNetworkRedemptionPreviewInput,
    quote: import('../../access-economy/src/providers/types.ts').ProviderQuote,
  ): RedemptionRequest {
    return Object.freeze({
      redemptionId: input.redemptionId,
      subjectRef: input.customerId,
      intentId: input.intentId ?? null,
      category: input.category,
      providerId: input.providerId,
      providerQuote: quote,
      entitlement: Object.freeze({
        entitlementId: input.entitlementId,
        entitlementClass: input.entitlementClass,
        availableUnits: BigInt(input.requestedQuantity),
        canonicalUnit: quote.canonicalUnit,
      }),
      requestedQuantity: BigInt(input.requestedQuantity),
      jurisdiction: 'SIMULATION',
      maxUserContributionMinorUnits: BigInt(input.maxUserContributionMinorUnits),
      policyContext: Object.freeze({
        benefitSource: 'SIMULATION',
        geographicZone: null,
        serviceLevel: 'STANDARD',
      }),
    });
  }
}

export function createAccessProviderNetworkService(): AccessProviderNetworkService {
  return new AccessProviderNetworkService();
}
