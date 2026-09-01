/**
 * ACCESS Prompt 38 — Consumer BFF surface for canonical /api/v1/access routes.
 * Orchestration and presentation only; domain math remains in access-economy providers.
 */

import { randomUUID } from 'node:crypto';
import { asUtcInstant } from '../../../domain/src/time.ts';
import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { AccessActor } from '../access.ts';
import { authorizeAccessMutate, authorizeAccessView } from '../access.ts';
import type { HumanAccessEconomyProduct } from '../service.ts';
import { ACCESS_CATEGORIES, ACCESS_CATEGORY_LABELS, ACCESS_POSTURE, type AccessCategory } from '../taxonomy.ts';
import type { AccessFailure } from '../types.ts';
import { projectConsumerSolvencyPosture } from '../consumer-solvency.ts';
import {
  categoryDescription,
  categoryUnit,
  defaultDiscoveryForCategory,
  defaultFundingForCategory,
  isExpiringSoon,
  projectActivityAsHistory,
  projectAllCategorySummaries,
  projectBookingSummary,
  projectEntitlementView,
  providerDisplayName,
  providerType,
  supportedGeographies,
  travelAccessLink,
} from './views.ts';
import {
  consumerStatusMessage,
  mapProviderErrorCode,
  mapRedemptionToConsumerStatus,
  mapReconciliationRequiredStatus,
  overallProductStatus,
} from './state-mapping.ts';
import type {
  AccessAllocationExplanation,
  AccessBookingView,
  AccessCategoryDetailView,
  AccessCheckoutQuoteInput,
  AccessCheckoutQuoteView,
  AccessConfirmTransactionInput,
  AccessEntitlementDetailView,
  AccessEntitlementFilters,
  AccessHistoryFilters,
  AccessHistoryItemView,
  AccessHomeSummary,
  AccessOpportunityView,
  AccessOverviewResponse,
  AccessReserveInput,
  AccessSearchInput,
  AccessTransactionView,
} from './types.ts';

const NOW = asUtcInstant('2026-08-23T12:00:00.000Z');
const ALLOCATION_PERIOD = '2026-08';
const NEXT_ALLOCATION_DATE = '2026-09-01T00:00:00.000Z';

type StoredOpportunity = AccessOpportunityView & {
  readonly catalogItemId: string;
  readonly providerId: string;
  readonly customerId: string;
};

type StoredCheckoutQuote = AccessCheckoutQuoteView & {
  readonly customerId: string;
  readonly providerQuoteId: string;
  readonly providerId: string;
  readonly catalogItemId: string;
  readonly entitlementId: string;
  readonly entitlementClass: string;
  readonly requestedUnits: number;
  readonly redemptionId: string | null;
};

type StoredTransaction = {
  readonly transactionId: string;
  readonly customerId: string;
  readonly checkoutQuoteId: string;
  readonly redemptionId: string | null;
  readonly reservationId: string | null;
  readonly bookingId: string | null;
  readonly category: AccessCategory;
  readonly summary: string;
  readonly status: import('./types.ts').ConsumerTransactionStatus;
  readonly paymentMethodId: string | null;
  readonly reconciliationRequired: boolean;
  readonly updatedAt: string;
};

type StoredBooking = AccessBookingView;

function newOpportunityId(catalogItemId: string): string {
  return `acc_opp_${catalogItemId}`;
}

function newCheckoutQuoteId(): string {
  return `acc_ckq_${randomUUID()}`;
}

function newTransactionId(): string {
  return `acc_txn_${randomUUID()}`;
}

function newBookingId(): string {
  return `acc_bkg_${randomUUID()}`;
}

function parseCategory(value: string): AccessCategory | null {
  return (ACCESS_CATEGORIES as readonly string[]).includes(value) ? (value as AccessCategory) : null;
}

function capabilityEnabled(actor: AccessActor): boolean {
  return actor.verified && !actor.restricted;
}

function paginate<T>(items: readonly T[], cursor: string | undefined, pageSize: number): {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
} {
  const size = Math.min(Math.max(pageSize, 1), 100);
  const offset = cursor ? Number.parseInt(Buffer.from(cursor, 'base64url').toString('utf8'), 10) : 0;
  const safeOffset = Number.isInteger(offset) && offset >= 0 ? offset : 0;
  const slice = items.slice(safeOffset, safeOffset + size);
  const next = safeOffset + slice.length;
  return Object.freeze({
    items: slice,
    nextCursor: next < items.length ? Buffer.from(String(next), 'utf8').toString('base64url') : null,
    hasMore: next < items.length,
  });
}

export class AccessConsumerBffSurface {
  private readonly opportunities = new Map<string, StoredOpportunity>();
  private readonly checkoutQuotes = new Map<string, StoredCheckoutQuote>();
  private readonly transactions = new Map<string, StoredTransaction>();
  private readonly bookings = new Map<string, StoredBooking>();
  private readonly confirmIdempotency = new Map<string, string>();
  private readonly product: HumanAccessEconomyProduct;

  constructor(product: HumanAccessEconomyProduct) {
    this.product = product;
  }

  dashboard(actor: AccessActor): Result<AccessOverviewResponse, AccessFailure> {
    const auth = authorizeAccessView(actor, actor.customerId);
    if (!auth.ok) return err(auth.error);
    const enabled = capabilityEnabled(actor);
    const overview = this.product.overview(actor);
    if (!overview.ok) return err(overview.error);
    const entitlements = enabled ? this.entitlementRows(actor) : [];
    const reservations = enabled ? this.reservationRows(actor) : [];
    const activities = enabled ? this.activityRows(actor) : [];
    const categories = projectAllCategorySummaries({
      entitlements,
      enabled,
      fundingByCategory: Object.fromEntries(
        ACCESS_CATEGORIES.map((category) => [category, defaultFundingForCategory(category, enabled)]),
      ) as Partial<Record<AccessCategory, import('./types.ts').ConsumerFundingStatus>>,
      discoveryByCategory: Object.fromEntries(
        ACCESS_CATEGORIES.map((category) => [category, defaultDiscoveryForCategory(category, enabled)]),
      ) as Partial<Record<AccessCategory, import('./types.ts').ConsumerDiscoveryStatus>>,
      reservedByCategory: {},
    });
    const expiringSoonCount = entitlements.filter((row) => isExpiringSoon(row.validUntil)).length;
    const activeBookings = reservations.filter((row) => ['HELD', 'CONFIRMED', 'IN_PROGRESS'].includes(row.status));
    const pendingActions = this.transactionsFor(actor).filter((row) => row.status === 'ACTION_REQUIRED').length;
    const recommended = enabled
      ? [...this.opportunities.values()]
          .filter((row) => row.customerId === actor.customerId)
          .slice(0, 3)
      : [];
    return ok(
      Object.freeze({
        schema: 'sunrey.consumer.access.dashboard.v1',
        ...ACCESS_POSTURE,
        user: Object.freeze({
          accessEnabled: enabled,
          allocationPeriod: ALLOCATION_PERIOD,
          nextAllocationDate: enabled ? NEXT_ALLOCATION_DATE : null,
        }),
        summary: Object.freeze({
          totalActiveEntitlements: entitlements.filter((row) => row.status === 'ACTIVE').length,
          expiringSoonCount,
          activeBookingsCount: activeBookings.length,
          pendingActionsCount: pendingActions,
        }),
        categories,
        recentActivity: activities.slice(0, 5).map((row) => projectActivityAsHistory(row)),
        upcomingBookings: activeBookings.map(projectBookingSummary),
        recommendedOpportunities: recommended.length > 0 ? recommended : null,
        overallStatus: overallProductStatus(true, enabled),
        updatedAt: NOW,
      }),
    );
  }

  homeSummary(actor: AccessActor): Result<AccessHomeSummary, AccessFailure> {
    const dash = this.dashboard(actor);
    if (!dash.ok) return err(dash.error);
    const highlights = dash.value.categories
      .filter((row) => row.availableUnits > 0)
      .slice(0, 3)
      .map((row) =>
        Object.freeze({
          category: row.category,
          label: `${row.availableUnits} ${row.displayName}`,
          remainingUnits: row.availableUnits,
          unit: row.unit,
        }),
      );
    const activeBooking = dash.value.upcomingBookings[0] ?? null;
    const actionRequired = dash.value.summary.pendingActionsCount > 0;
    return ok(
      Object.freeze({
        schema: 'sunrey.consumer.access.home-summary.v1',
        accessEnabled: dash.value.user.accessEnabled,
        overallStatus: dash.value.overallStatus,
        categoryHighlights: highlights,
        nextExpiration: dash.value.categories.reduce<string | null>((earliest, row) => {
          if (!row.expiresAt) return earliest;
          if (!earliest || row.expiresAt < earliest) return row.expiresAt;
          return earliest;
        }, null),
        activeBooking,
        actionRequired,
        actionRequiredMessage: actionRequired ? 'An Access transaction requires your attention.' : null,
      }),
    );
  }

  listEntitlements(actor: AccessActor, filters: AccessEntitlementFilters = {}) {
    const auth = authorizeAccessView(actor, actor.customerId);
    if (!auth.ok) return err(auth.error);
    const enabled = capabilityEnabled(actor);
    let rows = enabled ? this.entitlementRows(actor).map((row) => projectEntitlementView(row)) : [];
    if (filters.category) rows = rows.filter((row) => row.category === filters.category);
    if (filters.status) rows = rows.filter((row) => row.status === filters.status);
    if (filters.period) rows = rows.filter((row) => row.allocationPeriod === filters.period);
    if (filters.expiringSoon) rows = rows.filter((row) => isExpiringSoon(row.expiresAt));
    return ok(
      Object.freeze({
        schema: 'sunrey.consumer.access.entitlements.v1',
        ...ACCESS_POSTURE,
        items: rows,
      }),
    );
  }

  entitlementDetail(actor: AccessActor, entitlementId: string): Result<AccessEntitlementDetailView, AccessFailure> {
    const auth = authorizeAccessView(actor, actor.customerId);
    if (!auth.ok) return err(auth.error);
    const row = this.entitlementRows(actor).find((item) => item.entitlementId === entitlementId);
    if (!row) return err({ code: 'NOT_FOUND', message: 'entitlement not found' });
    const entitlement = projectEntitlementView(row);
    const activities = this.activityRows(actor).filter((item) => item.referenceId === entitlementId);
    return ok(
      Object.freeze({
        schema: 'sunrey.consumer.access.entitlement-detail.v1',
        entitlement,
        usageHistory: activities.map((item) => projectActivityAsHistory(item, row.category)),
        reservationHistory: [],
        expiration: Object.freeze({
          expiresAt: entitlement.expiresAt,
          expiringSoon: isExpiringSoon(entitlement.expiresAt),
        }),
        categoryRules: Object.freeze([
          `${ACCESS_CATEGORY_LABELS[row.category]} access units are non-withdrawable settlement economics.`,
          'Coverage is subject to funded availability and provider eligibility.',
        ]),
        termsReference: 'sunrey://access/terms/simulation',
        allocationExplanation:
          'Your monthly Access allocation is based on your eligible SunRey and MoonRey participation and available Access capacity.',
      }),
    );
  }

  categoryDetail(actor: AccessActor, categoryRaw: string): Result<AccessCategoryDetailView, AccessFailure> {
    const auth = authorizeAccessView(actor, actor.customerId);
    if (!auth.ok) return err(auth.error);
    const category = parseCategory(categoryRaw);
    if (!category) return err({ code: 'INVALID_CATEGORY', message: 'access category is invalid' });
    const enabled = capabilityEnabled(actor);
    const entitlements = this.entitlementRows(actor).filter((row) => row.category === category && row.status === 'ACTIVE');
    const remainingUnits = entitlements.reduce((sum, row) => sum + (row.remainingUses ?? 0), 0);
    const providers = this.product.providers(actor);
    const providerRows =
      providers.ok && enabled
        ? providers.value.items
            .filter((row) => (row.categories as readonly string[]).includes(category) || category === 'MOBILITY')
            .map((row) =>
              Object.freeze({
                providerDisplayName: row.displayName,
                providerType: providerType(row.providerId),
                status: overallProductStatus(true, enabled),
              }),
            )
        : [];
    const oppCount = [...this.opportunities.values()].filter(
      (row) => row.customerId === actor.customerId && row.category === category,
    ).length;
    return ok(
      Object.freeze({
        schema: 'sunrey.consumer.access.category-detail.v1',
        category,
        displayName: ACCESS_CATEGORY_LABELS[category],
        description: categoryDescription(category),
        unit: categoryUnit(category),
        userAvailability: Object.freeze({
          remainingUnits,
          reservedUnits: 0,
          expiresAt: entitlements[0]?.validUntil ?? null,
        }),
        fundingStatus: defaultFundingForCategory(category, enabled),
        discoveryStatus: defaultDiscoveryForCategory(category, enabled),
        supportedGeographies: supportedGeographies(category),
        providerAvailability: providerRows,
        opportunitiesSummary: Object.freeze({
          count: oppCount,
          status: overallProductStatus(true, enabled),
        }),
      }),
    );
  }

  search(actor: AccessActor, input: AccessSearchInput) {
    const auth = authorizeAccessMutate(actor, actor.customerId);
    if (!auth.ok) return err(auth.error);
    if (!capabilityEnabled(actor)) return err({ code: 'FEATURE_DISABLED', message: 'access economy is disabled' });
    const category = parseCategory(input.category);
    if (!category) return err({ code: 'INVALID_CATEGORY', message: 'access category is invalid' });
    const query = input.query ?? input.location ?? category;
    const outcome = this.product.searchProviders(actor, {
      category,
      query,
      ...(input.location ? { location: input.location } : {}),
    });
    if (!outcome.ok) {
      const mapped = mapProviderErrorCode(outcome.error.code);
      return err({
        code: outcome.error.code === 'PROVIDER_UNAVAILABLE' ? 'PROVIDER_UNAVAILABLE' : outcome.error.code,
        message: mapped ? `Provider search unavailable: ${mapped}` : outcome.error.message,
      });
    }
    const opportunities: StoredOpportunity[] = outcome.value.items.map((item) => {
      const opportunityId = newOpportunityId(item.catalogItemId);
      const row: StoredOpportunity = Object.freeze({
        opportunityId,
        category,
        title: item.title,
        description: item.description,
        providerDisplayName: providerDisplayName(item.providerId),
        providerType: providerType(item.providerId),
        providerTermsReference: 'sunrey://access/provider-terms/simulation',
        location: item.location,
        start: input.startDate ?? null,
        end: input.endDate ?? null,
        availabilityStatus: 'AVAILABLE_SIMULATION',
        unit: item.canonicalUnit,
        referencePrice: null,
        imageReference: null,
        sourceType: 'SIMULATION',
        fulfillmentCapability: true,
        bookingCapability: true,
        status: overallProductStatus(true, true),
        freshness: NOW,
        travelAccessLink: travelAccessLink(category, opportunityId),
        catalogItemId: item.catalogItemId,
        providerId: item.providerId,
        customerId: actor.customerId,
      });
      this.opportunities.set(opportunityId, row);
      return row;
    });
  const page = paginate(opportunities, input.cursor, input.pageSize ?? 20);
    return ok(
      Object.freeze({
        schema: 'sunrey.consumer.access.search.v1',
        ...ACCESS_POSTURE,
        items: page.items.map((row) =>
          Object.freeze({
            opportunityId: row.opportunityId,
            category: row.category,
            title: row.title,
            description: row.description,
            providerDisplayName: row.providerDisplayName,
            providerType: row.providerType,
            providerTermsReference: row.providerTermsReference,
            providerId: row.providerId,
            catalogItemId: row.catalogItemId,
            location: row.location,
            start: row.start,
            end: row.end,
            availabilityStatus: row.availabilityStatus,
            unit: row.unit,
            referencePrice: row.referencePrice,
            imageReference: row.imageReference,
            sourceType: row.sourceType,
            fulfillmentCapability: row.fulfillmentCapability,
            bookingCapability: row.bookingCapability,
            status: row.status,
            freshness: row.freshness,
            travelAccessLink: row.travelAccessLink,
          }),
        ),
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
        priceDisclaimer: 'Search results show reference availability only. Firm pricing requires a quote.',
      }),
    );
  }

  opportunityDetail(actor: AccessActor, opportunityId: string): Result<AccessOpportunityView, AccessFailure> {
    const auth = authorizeAccessView(actor, actor.customerId);
    if (!auth.ok) return err(auth.error);
    const row = this.opportunities.get(opportunityId);
    if (!row || row.customerId !== actor.customerId) {
      return err({ code: 'NOT_FOUND', message: 'opportunity not found' });
    }
    const entitlement = this.entitlementRows(actor).find((item) => item.category === row.category);
    const solvency = projectConsumerSolvencyPosture({
      poolSolvent: true,
      allocatableUnits: 10n,
      publishedUnits: 100n,
      providerAvailable: true,
    });
    return ok(
      Object.freeze({
        opportunityId: row.opportunityId,
        category: row.category,
        title: row.title,
        description: `${row.description} User entitlement availability: ${entitlement?.remainingUses ?? 0} ${categoryUnit(row.category)}(s). Funded coverage: ${solvency.posture}.`,
        providerDisplayName: row.providerDisplayName,
        providerType: row.providerType,
        providerTermsReference: row.providerTermsReference,
        location: row.location,
        start: row.start,
        end: row.end,
        availabilityStatus: row.availabilityStatus,
        unit: row.unit,
        referencePrice: row.referencePrice,
        imageReference: row.imageReference,
        sourceType: row.sourceType,
        fulfillmentCapability: row.fulfillmentCapability,
        bookingCapability: row.bookingCapability,
        status: row.status,
        freshness: row.freshness,
        travelAccessLink: row.travelAccessLink,
      }),
    );
  }

  createCheckoutQuote(actor: AccessActor, input: AccessCheckoutQuoteInput): Result<AccessCheckoutQuoteView, AccessFailure> {
    const auth = authorizeAccessMutate(actor, actor.customerId);
    if (!auth.ok) return err(auth.error);
    if (!capabilityEnabled(actor)) return err({ code: 'FEATURE_DISABLED', message: 'access economy is disabled' });
    const existingKey = `checkout-quote:${input.idempotencyKey}`;
    const prior = this.findCheckoutQuoteByIdempotency(existingKey);
    if (prior) return ok(prior);
    const opportunity = this.opportunities.get(input.opportunityId);
    if (!opportunity || opportunity.customerId !== actor.customerId) {
      return err({ code: 'NOT_FOUND', message: 'opportunity not found' });
    }
    const entitlement = this.entitlementRows(actor).find((row) => row.category === opportunity.category);
    if (!entitlement) return err({ code: 'NOT_FOUND', message: 'matching entitlement not found' });
    const providerQuote = this.product.createProviderQuote(actor, {
      providerId: opportunity.providerId,
      catalogItemId: opportunity.catalogItemId,
      quantity: input.requestedUnits,
      startsAt: input.start ?? opportunity.start ?? '2026-08-29T10:00:00.000Z',
      endsAt: input.end ?? opportunity.end ?? '2026-09-02T10:00:00.000Z',
      ...(opportunity.location ? { location: opportunity.location } : {}),
      idempotencyKey: input.idempotencyKey,
    });
    if (!providerQuote.ok) return err({ code: 'PROVIDER_UNAVAILABLE', message: providerQuote.error.message });
    const preview = this.product.previewRedemption(actor, {
      category: opportunity.category,
      providerId: opportunity.providerId,
      quoteId: providerQuote.value.quoteId,
      entitlementId: entitlement.entitlementId,
      entitlementClass: `${opportunity.category}_STANDARD`,
      requestedQuantity: input.requestedUnits,
      idempotencyKey: input.idempotencyKey,
    });
    if (!preview.ok) return err({ code: 'REDEMPTION_BLOCKED', message: preview.error.message });
    const providerPrice = BigInt(providerQuote.value.providerPriceMinorUnits);
    const coverage = BigInt(preview.value.coverageMinorUnits ?? '0');
    const userContribution = BigInt(preview.value.userContributionMinorUnits);
    const securityDeposit = opportunity.category === 'MOBILITY' ? 50_000n : 0n;
    const taxes = providerPrice / 10n;
    const mandatoryFees = 0n;
    const totalProvider = providerPrice + taxes + mandatoryFees;
    const excluded = securityDeposit;
    const breakdown = Object.freeze({
      currency: providerQuote.value.currency,
      baseAmountMinorUnits: providerPrice.toString(),
      taxesMinorUnits: taxes.toString(),
      mandatoryFeesMinorUnits: mandatoryFees.toString(),
      optionalFeesMinorUnits: '0',
      securityDepositMinorUnits: securityDeposit.toString(),
      totalProviderAmountMinorUnits: totalProvider.toString(),
      accessEligibleAmountMinorUnits: providerPrice.toString(),
      accessCoverageAmountMinorUnits: coverage.toString(),
      userContributionMinorUnits: userContribution.toString(),
      excludedAmountMinorUnits: excluded.toString(),
    });
    const depositWarning =
      securityDeposit > 0n
        ? Object.freeze({
            required: true,
            amountMinorUnits: securityDeposit.toString(),
            currency: providerQuote.value.currency,
            paidSeparately: true,
            accessCovered: false as const,
            message: `Provider may require a refundable $${(Number(securityDeposit) / 100).toFixed(0)} deposit on your personal payment method.`,
          })
        : null;
    const remaining = (entitlement.remainingUses ?? 0) - input.requestedUnits;
    const checkoutQuoteId = newCheckoutQuoteId();
    const view: StoredCheckoutQuote = Object.freeze({
      schema: 'sunrey.consumer.access.checkout-quote.v1',
      checkoutQuoteId,
      opportunityId: input.opportunityId,
      priceKind: 'FIRM',
      currency: providerQuote.value.currency,
      breakdown,
      depositWarning,
      accessUsed: Object.freeze({ unit: categoryUnit(opportunity.category), quantity: input.requestedUnits }),
      remainingAfterPurchase:
        remaining >= 0
          ? Object.freeze({ unit: categoryUnit(opportunity.category), quantity: remaining })
          : null,
      expiresAt: providerQuote.value.expiresAt,
      displayLines: Object.freeze([
        Object.freeze({ label: 'Provider price', amountMinorUnits: totalProvider.toString() }),
        Object.freeze({ label: 'Access covers', amountMinorUnits: coverage.toString(), emphasis: 'ACCESS' as const }),
        Object.freeze({ label: 'You pay', amountMinorUnits: userContribution.toString(), emphasis: 'USER' as const }),
        ...(depositWarning
          ? [Object.freeze({ label: 'Refundable deposit (paid separately)', amountMinorUnits: securityDeposit.toString() })]
          : []),
      ]),
      simulationOnly: true,
      customerId: actor.customerId,
      providerQuoteId: providerQuote.value.quoteId,
      providerId: opportunity.providerId,
      catalogItemId: opportunity.catalogItemId,
      entitlementId: entitlement.entitlementId,
      entitlementClass: `${opportunity.category}_STANDARD`,
      requestedUnits: input.requestedUnits,
      redemptionId: preview.value.redemptionId,
    });
    this.checkoutQuotes.set(checkoutQuoteId, view);
    this.storeIdempotency(existingKey, checkoutQuoteId);
    return ok(
      Object.freeze({
        schema: view.schema,
        checkoutQuoteId: view.checkoutQuoteId,
        opportunityId: view.opportunityId,
        priceKind: view.priceKind,
        currency: view.currency,
        breakdown: view.breakdown,
        depositWarning: view.depositWarning,
        accessUsed: view.accessUsed,
        remainingAfterPurchase: view.remainingAfterPurchase,
        expiresAt: view.expiresAt,
        displayLines: view.displayLines,
        simulationOnly: view.simulationOnly,
      }),
    );
  }

  reserve(actor: AccessActor, input: AccessReserveInput): Result<AccessTransactionView, AccessFailure> {
    const auth = authorizeAccessMutate(actor, actor.customerId);
    if (!auth.ok) return err(auth.error);
    if (!capabilityEnabled(actor)) return err({ code: 'FEATURE_DISABLED', message: 'access economy is disabled' });
    const existingTxn = this.findTransactionByIdempotency(`reserve:${input.idempotencyKey}`);
    if (existingTxn) return ok(this.projectTransaction(existingTxn));
    const quote = this.checkoutQuotes.get(input.checkoutQuoteId);
    if (!quote || quote.customerId !== actor.customerId) {
      return err({ code: 'NOT_FOUND', message: 'checkout quote not found' });
    }
    if (quote.expiresAt < NOW) return err({ code: 'QUOTE_EXPIRED', message: 'checkout quote has expired' });
    const started = this.product.startRedemption(actor, {
      category: this.opportunityCategory(quote.opportunityId) ?? 'MOBILITY',
      providerId: quote.providerId,
      quoteId: quote.providerQuoteId,
      entitlementId: quote.entitlementId,
      entitlementClass: quote.entitlementClass,
      requestedQuantity: quote.requestedUnits,
      redemptionId: quote.redemptionId ?? undefined,
      idempotencyKey: input.idempotencyKey,
    });
    if (!started.ok) return err({ code: 'REDEMPTION_BLOCKED', message: started.error.message });
    const transactionId = newTransactionId();
    const txn: StoredTransaction = Object.freeze({
      transactionId,
      customerId: actor.customerId,
      checkoutQuoteId: quote.checkoutQuoteId,
      redemptionId: started.value.redemptionId,
      reservationId: null,
      bookingId: null,
      category: this.opportunityCategory(quote.opportunityId) ?? 'MOBILITY',
      summary: this.opportunities.get(quote.opportunityId)?.title ?? 'Access transaction',
      status: mapRedemptionToConsumerStatus(started.value.status as import('../../../access-economy/src/providers/redemption/types.ts').RedemptionStatus),
      paymentMethodId: input.paymentMethodId ?? null,
      reconciliationRequired: false,
      updatedAt: NOW,
    });
    this.transactions.set(transactionId, txn);
    this.storeIdempotency(`reserve:${input.idempotencyKey}`, transactionId);
    return ok(this.projectTransaction(txn));
  }

  confirmTransaction(
    actor: AccessActor,
    transactionId: string,
    input: AccessConfirmTransactionInput,
  ): Result<AccessTransactionView, AccessFailure> {
    const auth = authorizeAccessMutate(actor, actor.customerId);
    if (!auth.ok) return err(auth.error);
    const priorTxnId = this.confirmIdempotency.get(`confirm:${input.idempotencyKey}`);
    if (priorTxnId) {
      const prior = this.transactions.get(priorTxnId);
      if (prior) return ok(this.projectTransaction(prior));
    }
    const txn = this.transactions.get(transactionId);
    if (!txn || txn.customerId !== actor.customerId) {
      return err({ code: 'NOT_FOUND', message: 'transaction not found' });
    }
    if (!txn.redemptionId) return err({ code: 'INVALID_TRANSITION', message: 'transaction has no redemption' });
    const confirmed = this.product.confirmRedemption(actor, txn.redemptionId, {
      ...(input.userApproved === true ? { userApproved: true } : {}),
    });
    if (!confirmed.ok) {
      if (confirmed.error.message.includes('reconciliation')) {
        const reconciled: StoredTransaction = Object.freeze({
          ...txn,
          status: mapReconciliationRequiredStatus(),
          reconciliationRequired: true,
          updatedAt: NOW,
        });
        this.transactions.set(transactionId, reconciled);
        this.confirmIdempotency.set(`confirm:${input.idempotencyKey}`, transactionId);
        return ok(this.projectTransaction(reconciled));
      }
      return err({ code: 'REDEMPTION_BLOCKED', message: confirmed.error.message });
    }
    const bookingId = newBookingId();
    const quote = this.checkoutQuotes.get(txn.checkoutQuoteId);
    const opportunity = quote ? this.opportunities.get(quote.opportunityId) : undefined;
    const booking: StoredBooking = Object.freeze({
      schema: 'sunrey.consumer.access.booking.v1',
      bookingId,
      transactionId,
      providerDisplayName: opportunity ? opportunity.providerDisplayName : 'Partner provider',
      service: txn.summary,
      location: opportunity?.location ?? null,
      startsAt: opportunity?.start ?? null,
      endsAt: opportunity?.end ?? null,
      confirmationReference: confirmed.value.providerBookingId,
      accessUnits: quote
        ? Object.freeze({ unit: quote.accessUsed.unit, quantity: quote.accessUsed.quantity })
        : Object.freeze({ unit: 'unit', quantity: 1 }),
      accessCoverage: Object.freeze({
        currency: quote?.currency ?? 'USD',
        minorUnits: quote?.breakdown.accessCoverageAmountMinorUnits ?? '0',
      }),
      userContribution: Object.freeze({
        currency: quote?.currency ?? 'USD',
        minorUnits: quote?.breakdown.userContributionMinorUnits ?? '0',
      }),
      deposit: quote?.depositWarning ?? null,
      termsReference: 'sunrey://access/terms/simulation',
      cancellationPolicy: 'Cancellation terms follow provider policy; refunds are not guaranteed until confirmed.',
      status: 'CONFIRMED',
      simulationOnly: true,
    });
    this.bookings.set(bookingId, booking);
    const updated: StoredTransaction = Object.freeze({
      ...txn,
      bookingId,
      status: 'CONFIRMED',
      paymentMethodId: input.paymentMethodId ?? txn.paymentMethodId,
      updatedAt: NOW,
    });
    this.transactions.set(transactionId, updated);
    this.confirmIdempotency.set(`confirm:${input.idempotencyKey}`, transactionId);
    return ok(this.projectTransaction(updated));
  }

  getTransaction(actor: AccessActor, transactionId: string): Result<AccessTransactionView, AccessFailure> {
    const auth = authorizeAccessView(actor, actor.customerId);
    if (!auth.ok) return err(auth.error);
    const txn = this.transactions.get(transactionId);
    if (!txn || txn.customerId !== actor.customerId) {
      return err({ code: 'NOT_FOUND', message: 'transaction not found' });
    }
    if (txn.redemptionId) {
      const redemption = this.product.getRedemption(actor, txn.redemptionId);
      if (redemption.ok) {
        const updated: StoredTransaction = Object.freeze({
          ...txn,
          status: txn.reconciliationRequired
            ? mapReconciliationRequiredStatus()
            : mapRedemptionToConsumerStatus(redemption.value.status as import('../../../access-economy/src/providers/redemption/types.ts').RedemptionStatus),
          updatedAt: NOW,
        });
        this.transactions.set(transactionId, updated);
        return ok(this.projectTransaction(updated));
      }
    }
    return ok(this.projectTransaction(txn));
  }

  getBooking(actor: AccessActor, bookingId: string): Result<AccessBookingView, AccessFailure> {
    const auth = authorizeAccessView(actor, actor.customerId);
    if (!auth.ok) return err(auth.error);
    const booking = this.bookings.get(bookingId);
    if (!booking) return err({ code: 'NOT_FOUND', message: 'booking not found' });
    const txn = this.transactions.get(booking.transactionId);
    if (!txn || txn.customerId !== actor.customerId) {
      return err({ code: 'SUBJECT_MISMATCH', message: 'booking not owned by caller' });
    }
    return ok(booking);
  }

  cancelTransaction(actor: AccessActor, transactionId: string, idempotencyKey: string): Result<AccessTransactionView, AccessFailure> {
    const auth = authorizeAccessMutate(actor, actor.customerId);
    if (!auth.ok) return err(auth.error);
    const prior = this.findTransactionByIdempotency(`cancel:${idempotencyKey}`);
    if (prior) return ok(this.projectTransaction(prior));
    const txn = this.transactions.get(transactionId);
    if (!txn || txn.customerId !== actor.customerId) {
      return err({ code: 'NOT_FOUND', message: 'transaction not found' });
    }
    if (txn.redemptionId) {
      const cancelled = this.product.cancelRedemption(actor, txn.redemptionId);
      if (!cancelled.ok) return err({ code: 'REDEMPTION_BLOCKED', message: cancelled.error.message });
    }
    const updated: StoredTransaction = Object.freeze({
      ...txn,
      status: 'REFUND_PENDING',
      updatedAt: NOW,
    });
    this.transactions.set(transactionId, updated);
    this.storeIdempotency(`cancel:${idempotencyKey}`, transactionId);
    return ok(
      this.projectTransaction({
        ...updated,
        status: 'REFUND_PENDING',
      }),
    );
  }

  history(actor: AccessActor, filters: AccessHistoryFilters = {}) {
    const auth = authorizeAccessView(actor, actor.customerId);
    if (!auth.ok) return err(auth.error);
    let rows: AccessHistoryItemView[] = this.activityRows(actor).map((row) => projectActivityAsHistory(row));
    for (const txn of this.transactionsFor(actor)) {
      rows.push(
        Object.freeze({
          historyId: txn.transactionId,
          kind: txn.status === 'CANCELLED' || txn.status === 'REFUNDED' ? 'CANCELLATION' : 'BOOKING',
          category: txn.category,
          summary: txn.summary,
          status: txn.status,
          occurredAt: txn.updatedAt,
          referenceId: txn.bookingId,
        }),
      );
    }
    rows.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    if (filters.category) rows = rows.filter((row) => row.category === filters.category);
    if (filters.status) rows = rows.filter((row) => row.status === filters.status);
    const page = paginate(rows, filters.cursor, filters.pageSize ?? 20);
    return ok(
      Object.freeze({
        schema: 'sunrey.consumer.access.history.v1',
        ...ACCESS_POSTURE,
        items: page.items,
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
      }),
    );
  }

  allocationExplanation(actor: AccessActor): Result<AccessAllocationExplanation, AccessFailure> {
    const auth = authorizeAccessView(actor, actor.customerId);
    if (!auth.ok) return err(auth.error);
    const entitlements = capabilityEnabled(actor) ? this.entitlementRows(actor) : [];
    return ok(
      Object.freeze({
        schema: 'sunrey.consumer.access.allocation-explanation.v1',
        summary:
          'Your monthly Access allocation is based on your eligible SunRey and MoonRey participation and available Access capacity.',
        allocationPeriod: ALLOCATION_PERIOD,
        categoryAllocations: entitlements.map((row) =>
          Object.freeze({
            category: row.category,
            displayName: ACCESS_CATEGORY_LABELS[row.category],
            units: row.remainingUses ?? 0,
            unit: categoryUnit(row.category),
            expiresAt: row.validUntil,
          }),
        ),
        simulationOnly: true,
      }),
    );
  }

  private projectTransaction(txn: StoredTransaction): AccessTransactionView {
    const quote = this.checkoutQuotes.get(txn.checkoutQuoteId);
    return Object.freeze({
      schema: 'sunrey.consumer.access.transaction.v1',
      transactionId: txn.transactionId,
      status: txn.status,
      consumerStatusMessage: consumerStatusMessage(txn.status),
      category: txn.category,
      summary: txn.summary,
      checkoutQuoteId: txn.checkoutQuoteId,
      bookingId: txn.bookingId,
      paymentMethodId: txn.paymentMethodId,
      refund:
        txn.status === 'REFUND_PENDING' || txn.status === 'REFUNDED'
          ? Object.freeze({
              refundStatus: txn.status === 'REFUNDED' ? 'COMPLETED' : 'PENDING',
              originalAmountMinorUnits: quote?.breakdown.totalProviderAmountMinorUnits ?? '0',
              providerRefundAmountMinorUnits: quote?.breakdown.userContributionMinorUnits ?? null,
              accessPoolRefundMinorUnits: quote?.breakdown.accessCoverageAmountMinorUnits ?? null,
              userRefundMinorUnits: quote?.breakdown.userContributionMinorUnits ?? null,
              penaltyMinorUnits: null,
              expectedTiming: null,
              entitlementRestorationStatus: txn.status === 'REFUNDED' ? 'RESTORED' : 'PENDING',
            })
          : null,
      updatedAt: txn.updatedAt,
      simulationOnly: true,
    });
  }

  private entitlementRows(actor: AccessActor) {
    const outcome = this.product.entitlements(actor);
    return outcome.ok ? outcome.value.items : [];
  }

  private reservationRows(actor: AccessActor) {
    const outcome = this.product.reservations(actor);
    return outcome.ok ? outcome.value.items : [];
  }

  private activityRows(actor: AccessActor) {
    const outcome = this.product.activity(actor);
    return outcome.ok ? outcome.value.items : [];
  }

  private transactionsFor(actor: AccessActor): readonly StoredTransaction[] {
    return [...this.transactions.values()].filter((row) => row.customerId === actor.customerId);
  }

  private opportunityCategory(opportunityId: string): AccessCategory | null {
    return this.opportunities.get(opportunityId)?.category ?? null;
  }

  private idempotencyIndex = new Map<string, string>();

  private storeIdempotency(key: string, value: string): void {
    this.idempotencyIndex.set(key, value);
  }

  private findCheckoutQuoteByIdempotency(key: string): StoredCheckoutQuote | undefined {
    const id = this.idempotencyIndex.get(key);
    return id ? this.checkoutQuotes.get(id) : undefined;
  }

  private findTransactionByIdempotency(key: string): StoredTransaction | undefined {
    const id = this.idempotencyIndex.get(key);
    return id ? this.transactions.get(id) : undefined;
  }
}

export function createAccessConsumerBffSurface(product: HumanAccessEconomyProduct): AccessConsumerBffSurface {
  return new AccessConsumerBffSurface(product);
}
