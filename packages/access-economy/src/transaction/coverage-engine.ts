/**
 * ACCESS Wave 3 / Prompt 34+ — AccessTransactionCoverageEngine.
 *
 * Combines entitlement capacity, funding pool solvency, and coverage policy
 * to produce deterministic checkout quotes. Users cannot override splits.
 */

import type { AccessSolvencyService } from '../funding-solvency/solvency-service.ts';
import { accessEvidenceRefFor } from '../domain/ids.ts';
import type { AccessCategoryId, AccessUnit } from '../domain/taxonomy.ts';
import { providerRefFor } from '../ids.ts';
import { resolveCoveragePolicy } from '../providers/coverage-policy.ts';
import type { ProviderQuote } from '../providers/types.ts';
import { TOKEN_CONVERSION_CONTRIBUTION } from '../funding-solvency/taxonomy.ts';
import type { AccessCheckoutQuote } from './types.ts';
import type { AccessDomainQuoteId, AccessDomainTransactionId } from '../domain/ids.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';

export type CoverageEngineInput = {
  readonly transactionId: AccessDomainTransactionId;
  readonly quoteId: AccessDomainQuoteId;
  readonly userId: string;
  readonly category: AccessCategoryId;
  readonly unit: AccessUnit;
  readonly entitlementClass: string;
  readonly entitlementRemainingUnits: bigint;
  readonly fundingPoolId: string;
  readonly providerQuote: ProviderQuote;
  readonly taxesMinorUnits: bigint;
  readonly mandatoryFeesMinorUnits: bigint;
  readonly securityDepositMinorUnits: bigint;
  readonly now: UtcInstant;
};

export type CoverageEngineResult =
  | { readonly ok: true; readonly checkoutQuote: AccessCheckoutQuote }
  | { readonly ok: false; readonly code: string; readonly message: string };

export class AccessTransactionCoverageEngine {
  private readonly solvency: AccessSolvencyService;

  constructor(solvency: AccessSolvencyService) {
    this.solvency = solvency;
  }

  evaluate(input: CoverageEngineInput): CoverageEngineResult {
    const policy = resolveCoveragePolicy(input.entitlementClass);
    if (!policy) {
      return { ok: false, code: 'POLICY_NOT_FOUND', message: `no coverage policy for ${input.entitlementClass}` };
    }

    const providerPrice = input.providerQuote.providerPriceMinorUnits;
    const totalProvider =
      providerPrice + input.taxesMinorUnits + input.mandatoryFeesMinorUnits;

    if (input.entitlementRemainingUnits < input.providerQuote.quantity) {
      return {
        ok: false,
        code: 'INSUFFICIENT_ENTITLEMENT',
        message: 'entitlement units insufficient for requested quantity',
      };
    }

    const policyDecision = policy.evaluate({
      entitlementClass: input.entitlementClass,
      category: input.category,
      canonicalUnit: input.providerQuote.canonicalUnit,
      quantity: input.providerQuote.quantity,
      geographicZone: null,
      serviceLevel: 'STANDARD',
      providerPriceMinorUnits: totalProvider,
      jurisdiction: 'US',
      benefitSource: 'ACCESS_POOL',
    });

    const availableFunding = this.solvency.getAvailableFunding(
      input.fundingPoolId,
      input.providerQuote.currency,
      input.now,
    );

    const policyCoverage = policyDecision.appliedCoverageMinorUnits;
    const fundingBoundedCoverage =
      policyCoverage < availableFunding ? policyCoverage : availableFunding;
    const accessContribution = fundingBoundedCoverage < totalProvider ? fundingBoundedCoverage : totalProvider;
    const userContribution = totalProvider - accessContribution;

    const checkoutQuote: AccessCheckoutQuote = Object.freeze({
      quoteId: input.quoteId,
      transactionId: input.transactionId,
      providerId: providerRefFor(input.providerQuote.providerId),
      providerProductId: input.providerQuote.catalogItemId,
      category: input.category,
      requestedUnits: input.providerQuote.quantity,
      unit: input.unit,
      providerPriceMinorUnits: providerPrice,
      taxesMinorUnits: input.taxesMinorUnits,
      mandatoryFeesMinorUnits: input.mandatoryFeesMinorUnits,
      securityDepositMinorUnits: input.securityDepositMinorUnits,
      totalProviderAmountMinorUnits: totalProvider,
      accessPoolContributionMinorUnits: accessContribution,
      userContributionMinorUnits: userContribution,
      tokenConversionContributionMinorUnits: TOKEN_CONVERSION_CONTRIBUTION,
      entitlementUnitsReserved: policyDecision.entitlementUnitsConsumed,
      currency: input.providerQuote.currency,
      expiresAt: input.providerQuote.expiresAt,
      providerQuoteReference: input.providerQuote.quoteId,
      coveragePolicyId: policy.policyId,
      coveragePolicyVersion: policy.version,
      evidenceReference: accessEvidenceRefFor(`coverage:${input.transactionId}:${input.quoteId}`),
    });

    return { ok: true, checkoutQuote };
  }
}
