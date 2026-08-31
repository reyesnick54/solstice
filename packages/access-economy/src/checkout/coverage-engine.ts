/**
 * ACCESS Wave 3 Prompt 34 — Access Coverage Engine.
 *
 * Deterministic checkout and coverage calculation. Read-only with respect to
 * funding ledgers, entitlement ledgers, payments, and token movement.
 */

import { randomUUID } from 'node:crypto';

import { asUtcInstant, type UtcInstant } from '../../../domain/src/time.ts';
import { TOKEN_CONVERSION_CONTRIBUTION } from '../funding-solvency/taxonomy.ts';
import type { ProviderFxQuote, ProviderFxQuotePort } from '../providers/fx-port.ts';
import { UnavailableProviderFxQuotePort } from '../providers/fx-port.ts';
import {
  AccessCheckoutCoveragePolicyRegistry,
  applyCoverageCaps,
} from './coverage-policy.ts';
import {
  classifyProviderQuoteCosts,
  sumEligibleCost,
  sumExcludedCost,
} from './cost-classification.ts';
import { AccessCheckoutQuoteStore } from './quote-store.ts';
import type {
  AccessCheckoutQuote,
  AccessCheckoutQuoteFailureCode,
  AccessCheckoutQuoteRequest,
  AccessCheckoutQuoteResult,
  AccessProviderFirmQuote,
  CheckoutQuoteExplanationLine,
  CheckoutReservationPlan,
  ProviderQuoteClassification,
} from './types.ts';

const DEFAULT_CHECKOUT_EXPIRY_MINUTES = 15;

export type AccessCoverageEngineDeps = {
  readonly solvencyService: AccessSolvencyService;
  readonly policyRegistry?: AccessCheckoutCoveragePolicyRegistry;
  readonly quoteStore?: AccessCheckoutQuoteStore;
  readonly fxReferencePort?: ProviderFxQuotePort;
};

export class AccessCoverageEngine {
  private readonly solvencyService: AccessSolvencyService;
  private readonly policyRegistry: AccessCheckoutCoveragePolicyRegistry;
  private readonly quoteStore: AccessCheckoutQuoteStore;
  private readonly fxReferencePort: ProviderFxQuotePort;

  constructor(deps: AccessCoverageEngineDeps) {
    this.solvencyService = deps.solvencyService;
    this.policyRegistry = deps.policyRegistry ?? new AccessCheckoutCoveragePolicyRegistry();
    this.quoteStore = deps.quoteStore ?? new AccessCheckoutQuoteStore();
    this.fxReferencePort = deps.fxReferencePort ?? new UnavailableProviderFxQuotePort();
  }

  calculateCheckoutQuote(request: AccessCheckoutQuoteRequest): AccessCheckoutQuoteResult {
    const prior = this.quoteStore.getByIdempotencyKey(request.idempotencyKey);
    if (prior) {
      return Object.freeze({ ok: true, quote: prior, idempotent: true });
    }

    const quoteFailure = this.validateProviderQuote(request.providerQuote, request.now);
    if (quoteFailure) {
      const failedQuote = this.buildFailedQuote(request, quoteFailure.code, quoteFailure.message);
      return Object.freeze({
        ok: false,
        code: quoteFailure.code,
        message: quoteFailure.message,
        quote: failedQuote,
      });
    }

    const policy = this.policyRegistry.resolve(request.category, request.now);
    if (!policy) {
      const failedQuote = this.buildFailedQuote(request, 'POLICY_NOT_FOUND', 'no checkout coverage policy registered');
      return Object.freeze({
        ok: false,
        code: 'POLICY_NOT_FOUND',
        message: 'no checkout coverage policy registered',
        quote: failedQuote,
      });
    }

    if (request.entitlement.remainingUnits < request.requestedUnits) {
      const failedQuote = this.buildFailedQuote(
        request,
        'ENTITLEMENT_INSUFFICIENT',
        'remaining entitlement units are insufficient for requested units',
        policy,
      );
      return Object.freeze({
        ok: false,
        code: 'ENTITLEMENT_INSUFFICIENT',
        message: 'remaining entitlement units are insufficient for requested units',
        quote: failedQuote,
      });
    }

    const pool = this.solvencyService.getPoolRegistry().getPool(request.fundingPoolId);
    if (!pool) {
      const failedQuote = this.buildFailedQuote(request, 'ACCESS_FUNDING_UNAVAILABLE', 'funding pool not found', policy);
      return Object.freeze({
        ok: false,
        code: 'ACCESS_FUNDING_UNAVAILABLE',
        message: 'funding pool not found',
        quote: failedQuote,
      });
    }

    if (
      pool.categoryPolicy === 'STRICT_CATEGORY' &&
      pool.category !== null &&
      pool.category !== request.category
    ) {
      const failedQuote = this.buildFailedQuote(
        request,
        'CATEGORY_FUNDING_RESTRICTED',
        'funding pool category does not match checkout category',
        policy,
      );
      return Object.freeze({
        ok: false,
        code: 'CATEGORY_FUNDING_RESTRICTED',
        message: 'funding pool category does not match checkout category',
        quote: failedQuote,
      });
    }

    if (!this.providerFundingPermitted(request.fundingPoolId, request.providerQuote.providerId, request.now)) {
      const failedQuote = this.buildFailedQuote(
        request,
        'PROVIDER_FUNDING_RESTRICTED',
        'provider is restricted for this funding pool',
        policy,
      );
      return Object.freeze({
        ok: false,
        code: 'PROVIDER_FUNDING_RESTRICTED',
        message: 'provider is restricted for this funding pool',
        quote: failedQuote,
      });
    }

    const classified = classifyProviderQuoteCosts(request.providerQuote, policy);
    const eligibleCost = sumEligibleCost(classified);
    const excludedAmount = sumExcludedCost(classified);

    const policyCappedEligible = applyCoverageCaps(eligibleCost, policy, {
      programCoverageRemainingMinorUnits: request.programCoverageRemainingMinorUnits,
      transactionCoverageCapMinorUnits: request.transactionCoverageCapMinorUnits,
    });

    const fundingCurrency = request.fundingCurrency;
    const quoteCurrency = request.providerQuote.currency;
    let fundingAvailable = this.solvencyService.getAvailableFunding(
      request.fundingPoolId,
      fundingCurrency,
      request.now,
    );
    let referenceFxEstimate: bigint | null = null;
    let fxQuoteKind: 'REFERENCE_FX' | 'EXECUTION_FX' | null = null;

    if (quoteCurrency !== fundingCurrency) {
      const fxQuote = this.fxReferencePort.getQuote({
        quoteId: `fx_ref_${request.providerQuote.quoteId}`,
        baseCurrency: quoteCurrency,
        quoteCurrency: fundingCurrency,
        sourceAmountMinorUnits: policyCappedEligible,
        corridorId: `${quoteCurrency}_${fundingCurrency}`,
        at: request.now,
      });
      if (!fxQuote) {
        const failedQuote = this.buildFailedQuote(
          request,
          'CURRENCY_MISMATCH_NO_FX',
          'provider quote currency differs from funding pool and no reference FX is available',
          policy,
          classified,
        );
        return Object.freeze({
          ok: false,
          code: 'CURRENCY_MISMATCH_NO_FX',
          message: 'provider quote currency differs from funding pool and no reference FX is available',
          quote: failedQuote,
        });
      }
      referenceFxEstimate = fxQuote.destinationAmountMinorUnits;
      fxQuoteKind = 'REFERENCE_FX';
    }

    const remainingProgramCoverage = request.programCoverageRemainingMinorUnits ?? policyCappedEligible;
    if (policyCappedEligible > 0n && fundingAvailable <= 0n) {
      const failedQuote = this.buildQuote(request, policy, classified, {
        accessCoverageAmount: 0n,
        fundingAvailable,
        referenceFxEstimate,
        fxQuoteKind,
        status: 'NON_SETTLEABLE',
        failureCode: 'ACCESS_FUNDING_UNAVAILABLE',
        failureMessage: 'funding pool has no available coverage',
      });
      const saved = this.quoteStore.save(failedQuote, request.idempotencyKey);
      return Object.freeze({
        ok: false,
        code: 'ACCESS_FUNDING_UNAVAILABLE',
        message: 'funding pool has no available coverage',
        quote: saved,
      });
    }

    let accessCoverage = min(
      policyCappedEligible,
      remainingProgramCoverage,
      fundingAvailable,
    );

    if (accessCoverage < 0n) {
      accessCoverage = 0n;
    }

    const otherAuthorized = request.otherAuthorizedProgramCoverageMinorUnits ?? 0n;
    const userContribution = max(
      0n,
      request.providerQuote.totalProviderAmount - accessCoverage - otherAuthorized,
    );

    const status = accessCoverage > 0n || userContribution === request.providerQuote.totalProviderAmount
      ? 'SETTLEABLE'
      : 'NON_SETTLEABLE';

    const quote = this.buildQuote(request, policy, classified, {
      accessCoverageAmount: accessCoverage,
      fundingAvailable,
      referenceFxEstimate,
      fxQuoteKind,
      status,
      failureCode: null,
      failureMessage: null,
      userContribution,
      otherAuthorized,
      excludedAmount,
      eligibleCost,
    });

    if (request.previousCheckoutQuoteId) {
      this.quoteStore.supersede(request.previousCheckoutQuoteId, quote);
    }

    const saved = this.quoteStore.save(quote, request.idempotencyKey);
    return Object.freeze({ ok: true, quote: saved, idempotent: false });
  }

  recalculateForProviderQuoteChange(input: {
    readonly previousCheckoutQuoteId: string;
    readonly request: AccessCheckoutQuoteRequest;
  }): AccessCheckoutQuoteResult {
    const prior = this.quoteStore.getByCheckoutQuoteId(input.previousCheckoutQuoteId);
    if (!prior) {
      return Object.freeze({
        ok: false,
        code: 'QUOTE_NOT_FIRM',
        message: 'previous checkout quote not found',
        quote: null,
      });
    }
    return this.calculateCheckoutQuote({
      ...input.request,
      previousCheckoutQuoteId: input.previousCheckoutQuoteId,
      idempotencyKey: `${input.request.idempotencyKey}:reprice:${input.request.providerQuote.quoteId}`,
    });
  }

  getQuoteStore(): AccessCheckoutQuoteStore {
    return this.quoteStore;
  }

  private validateProviderQuote(
    quote: AccessProviderFirmQuote,
    now: UtcInstant,
  ): { readonly code: AccessCheckoutQuoteFailureCode; readonly message: string } | null {
    if (quote.expiresAt <= now) {
      return Object.freeze({ code: 'QUOTE_EXPIRED', message: 'provider quote has expired' });
    }
    const classification = normalizeQuoteClassification(quote.classification, quote.expiresAt, now);
    if (classification === 'REFERENCE') {
      return Object.freeze({ code: 'QUOTE_REFERENCE', message: 'reference quotes cannot be used for settlement-bound checkout' });
    }
    if (classification === 'INDICATIVE') {
      return Object.freeze({ code: 'QUOTE_INDICATIVE', message: 'indicative quotes cannot be used for settlement-bound checkout' });
    }
    if (classification !== 'FIRM') {
      return Object.freeze({ code: 'QUOTE_NOT_FIRM', message: 'only firm quotes are accepted for settlement-bound checkout' });
    }
    return null;
  }

  private providerFundingPermitted(fundingPoolId: string, providerId: string, now: string): boolean {
    const sources = this.solvencyService.getPoolRegistry().activeSourcesForPool(fundingPoolId, now);
    const restricted = sources.filter((source) => source.restrictions.providerId);
    if (restricted.length === 0) {
      return true;
    }
    return restricted.some((source) => source.restrictions.providerId === providerId);
  }

  private buildFailedQuote(
    request: AccessCheckoutQuoteRequest,
    code: AccessCheckoutQuoteFailureCode,
    message: string,
    policy?: import('./coverage-policy.ts').AccessCheckoutCoveragePolicy,
    classified?: readonly import('./types.ts').ClassifiedCostComponent[],
  ): AccessCheckoutQuote {
    const components = classified ?? (policy ? classifyProviderQuoteCosts(request.providerQuote, policy) : []);
    return this.buildQuote(request, policy ?? null, components, {
      accessCoverageAmount: 0n,
      fundingAvailable: 0n,
      referenceFxEstimate: null,
      fxQuoteKind: null,
      status: 'NON_SETTLEABLE',
      failureCode: code,
      failureMessage: message,
      userContribution: request.providerQuote.totalProviderAmount,
      otherAuthorized: 0n,
      excludedAmount: sumExcludedCost(components),
      eligibleCost: sumEligibleCost(components),
    });
  }

  private buildQuote(
    request: AccessCheckoutQuoteRequest,
    policy: import('./coverage-policy.ts').AccessCheckoutCoveragePolicy | null,
    classified: readonly import('./types.ts').ClassifiedCostComponent[],
    amounts: {
      readonly accessCoverageAmount: bigint;
      readonly fundingAvailable: bigint;
      readonly referenceFxEstimate: bigint | null;
      readonly fxQuoteKind: 'REFERENCE_FX' | 'EXECUTION_FX' | null;
      readonly status: AccessCheckoutQuote['status'];
      readonly failureCode: AccessCheckoutQuoteFailureCode | null;
      readonly failureMessage: string | null;
      readonly userContribution?: bigint;
      readonly otherAuthorized?: bigint;
      readonly excludedAmount?: bigint;
      readonly eligibleCost?: bigint;
    },
  ): AccessCheckoutQuote {
    const providerQuote = request.providerQuote;
    const eligibleCost = amounts.eligibleCost ?? sumEligibleCost(classified);
    const excludedAmount = amounts.excludedAmount ?? sumExcludedCost(classified);
    const otherAuthorized = amounts.otherAuthorized ?? 0n;
    const userContribution =
      amounts.userContribution ??
      max(0n, providerQuote.totalProviderAmount - amounts.accessCoverageAmount - otherAuthorized);
    const unitsToReserve = request.requestedUnits;
    const fundingToReserve = amounts.accessCoverageAmount;
    const expiresAt = this.resolveExpiry(request);
    const explanation = buildExplanation({
      currency: providerQuote.currency,
      totalProviderAmount: providerQuote.totalProviderAmount,
      accessCoverageAmount: amounts.accessCoverageAmount,
      userContribution,
      securityDeposit: providerQuote.securityDeposit,
      unit: request.entitlement.unit,
      unitsToReserve,
    });
    const reservationPlan: CheckoutReservationPlan = Object.freeze({
      entitlementUnitsToReserve: unitsToReserve,
      entitlementUnit: request.entitlement.unit,
      fundingToReserve,
      fundingCurrency: request.fundingCurrency,
      userPaymentRequired: userContribution,
      providerAmountRequired: providerQuote.totalProviderAmount,
      securityDepositUserSecured: providerQuote.securityDeposit,
    });

    return Object.freeze({
      checkoutQuoteId: request.checkoutQuoteId ?? `acq_${randomUUID()}`,
      accessTransactionId: request.accessTransactionId,
      userId: request.userId,
      providerId: providerQuote.providerId,
      providerQuoteId: providerQuote.quoteId,
      category: request.category,
      productId: request.productId ?? null,
      requestedUnits: request.requestedUnits,
      unit: request.entitlement.unit,
      currency: providerQuote.currency,
      pricing: Object.freeze({
        baseAmount: providerQuote.baseAmount,
        taxes: providerQuote.taxes,
        mandatoryFees: providerQuote.mandatoryFees,
        optionalFees: providerQuote.optionalFees,
        securityDeposit: providerQuote.securityDeposit,
        contingentLiability: providerQuote.contingentLiability,
        totalProviderAmount: providerQuote.totalProviderAmount,
        totalExposure: providerQuote.totalExposure,
      }),
      coverage: Object.freeze({
        accessEligibleAmount: eligibleCost,
        accessCoverageAmount: amounts.accessCoverageAmount,
        userFiatContribution: userContribution,
        excludedAmount,
        otherAuthorizedProgramCoverage: otherAuthorized,
        tokenConversionContribution: TOKEN_CONVERSION_CONTRIBUTION,
      }),
      classifiedComponents: classified,
      entitlement: Object.freeze({
        entitlementId: request.entitlement.entitlementId,
        availableUnits: request.entitlement.remainingUnits,
        unitsRequested: request.requestedUnits,
        unitsToReserve,
      }),
      funding: Object.freeze({
        fundingPoolId: request.fundingPoolId,
        fundingAvailable: amounts.fundingAvailable,
        fundingToReserve,
        currency: request.fundingCurrency,
        fxQuoteKind: amounts.fxQuoteKind,
        referenceFxEstimateMinorUnits: amounts.referenceFxEstimate,
      }),
      reservationPlan,
      explanation,
      expiresAt,
      status: amounts.status,
      policyId: policy?.policyId ?? 'UNKNOWN',
      policyVersion: policy?.version ?? 'unknown',
      evidenceReference: request.evidenceReference,
      previousCheckoutQuoteId: request.previousCheckoutQuoteId ?? null,
      replacementProviderQuoteId: providerQuote.previousQuoteId,
      failureCode: amounts.failureCode,
      failureMessage: amounts.failureMessage,
      createdAt: request.now,
    });
  }

  private resolveExpiry(request: AccessCheckoutQuoteRequest): UtcInstant {
    const minutes = request.sunreyCheckoutExpiryMinutes ?? DEFAULT_CHECKOUT_EXPIRY_MINUTES;
    const checkoutExpiry = addMinutes(request.now, minutes);
    return request.providerQuote.expiresAt < checkoutExpiry
      ? request.providerQuote.expiresAt
      : checkoutExpiry;
  }
}

export function createAccessCoverageEngine(deps: AccessCoverageEngineDeps): AccessCoverageEngine {
  return new AccessCoverageEngine(deps);
}

export function buildFirmProviderQuote(input: {
  readonly quoteId: string;
  readonly providerId: AccessProviderFirmQuote['providerId'];
  readonly catalogItemId: string;
  readonly canonicalUnit: AccessProviderFirmQuote['canonicalUnit'];
  readonly classification?: ProviderQuoteClassification;
  readonly quantity: bigint;
  readonly currency?: string;
  readonly baseAmount: bigint;
  readonly taxes?: bigint;
  readonly mandatoryFees?: bigint;
  readonly optionalFees?: bigint;
  readonly securityDeposit?: bigint;
  readonly contingentLiability?: bigint;
  readonly expiresAt: UtcInstant;
  readonly previousQuoteId?: string | null;
  readonly simulationOnly?: boolean;
  readonly costLines?: readonly import('./types.ts').ProviderQuoteCostLine[];
}): AccessProviderFirmQuote {
  const taxes = input.taxes ?? 0n;
  const mandatoryFees = input.mandatoryFees ?? 0n;
  const optionalFees = input.optionalFees ?? 0n;
  const securityDeposit = input.securityDeposit ?? 0n;
  const contingentLiability = input.contingentLiability ?? 0n;
  const totalProviderAmount = input.baseAmount + taxes + mandatoryFees + optionalFees;
  const totalExposure = totalProviderAmount + securityDeposit + contingentLiability;
  return Object.freeze({
    quoteId: input.quoteId,
    providerId: input.providerId,
    catalogItemId: input.catalogItemId,
    canonicalUnit: input.canonicalUnit,
    classification: input.classification ?? 'FIRM',
    quantity: input.quantity,
    currency: input.currency ?? 'USD',
    baseAmount: input.baseAmount,
    taxes,
    mandatoryFees,
    optionalFees,
    securityDeposit,
    contingentLiability,
    totalProviderAmount,
    totalExposure,
    costLines: input.costLines ?? [],
    expiresAt: input.expiresAt,
    previousQuoteId: input.previousQuoteId ?? null,
    simulationOnly: input.simulationOnly ?? true,
  });
}

function buildExplanation(input: {
  readonly currency: string;
  readonly totalProviderAmount: bigint;
  readonly accessCoverageAmount: bigint;
  readonly userContribution: bigint;
  readonly securityDeposit: bigint;
  readonly unit: string;
  readonly unitsToReserve: bigint;
}): readonly CheckoutQuoteExplanationLine[] {
  const lines: CheckoutQuoteExplanationLine[] = [
    Object.freeze({
      code: 'PROVIDER_PRICE',
      label: 'Provider Price',
      amountMinorUnits: input.totalProviderAmount,
      currency: input.currency,
    }),
    Object.freeze({
      code: 'ACCESS_COVERS',
      label: 'Access covers',
      amountMinorUnits: input.accessCoverageAmount,
      currency: input.currency,
    }),
    Object.freeze({
      code: 'USER_PAYS',
      label: 'You pay',
      amountMinorUnits: input.userContribution,
      currency: input.currency,
    }),
  ];
  if (input.securityDeposit > 0n) {
    lines.push(
      Object.freeze({
        code: 'REFUNDABLE_DEPOSIT',
        label: 'Refundable deposit',
        amountMinorUnits: input.securityDeposit,
        currency: input.currency,
      }),
    );
  }
  if (input.unitsToReserve > 0n) {
    lines.push(
      Object.freeze({
        code: 'ACCESS_UNITS_USED',
        label: `Access used: ${input.unitsToReserve.toString()} ${input.unit}`,
        amountMinorUnits: input.unitsToReserve,
        currency: input.unit,
      }),
    );
  }
  return Object.freeze(lines);
}

function normalizeQuoteClassification(
  classification: ProviderQuoteClassification,
  expiresAt: UtcInstant,
  now: UtcInstant,
): ProviderQuoteClassification {
  if (expiresAt <= now) {
    return 'EXPIRED';
  }
  return classification;
}

function min(...values: readonly (bigint | null | undefined)[]): bigint {
  const present = values.filter((value): value is bigint => value !== null && value !== undefined);
  if (present.length === 0) {
    return 0n;
  }
  return present.reduce((smallest, value) => (value < smallest ? value : smallest));
}

function max(left: bigint, right: bigint): bigint {
  return left > right ? left : right;
}

function addMinutes(instant: UtcInstant, minutes: number): UtcInstant {
  const date = new Date(instant);
  date.setUTCMinutes(date.getUTCMinutes() + minutes);
  return asUtcInstant(date.toISOString());
}

export type { ProviderFxQuote };
