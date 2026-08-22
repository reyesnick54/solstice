import { Money } from '../../../../money/src/money.ts';
import { DETECTOR_TO_CATEGORY } from './taxonomy.ts';
import { riskRank } from './products.ts';
import type {
  DetectorFinding,
  OpportunityDiscoveryContext,
  OpportunityEligibility,
  ProductCapability,
} from './types.ts';
import type { CompiledEconomicMandate } from '../../mandate/types.ts';
import { constraintAmount } from '../feasibility.ts';

const SUPPORTED_JURISDICTIONS = new Set(['US', 'GB']);

export function evaluateOpportunityEligibility(input: {
  readonly finding: DetectorFinding;
  readonly context: OpportunityDiscoveryContext;
  readonly mandate?: CompiledEconomicMandate;
}): OpportunityEligibility {
  const reasons: string[] = [];
  const failed: string[] = [];
  const category = DETECTOR_TO_CATEGORY[input.finding.detector];
  const product = input.context.products.find((item) => item.productId === input.finding.productId);

  checkJurisdiction(input.context, failed, reasons);
  checkKyc(input.context, product, failed, reasons);
  checkRestriction(input.context, failed, reasons);
  checkProduct(product, category, input.context.jurisdiction, failed, reasons);
  checkProvider(product, failed, reasons);
  checkRisk(input.finding, input.context, failed, reasons);
  checkMinimum(input.finding, product, failed, reasons);
  checkLiquidity(input.finding, input.mandate, failed, reasons);
  checkAccounts(input.context, failed, reasons);
  checkPolicy(input.finding, input.context, failed, reasons);
  checkMandate(input.finding, input.mandate, failed, reasons);

  return Object.freeze({
    eligible: failed.length === 0,
    immediatelyExecutable: false,
    reasons: Object.freeze(reasons.length > 0 ? reasons : ['eligible_for_review_not_execution']),
    failedChecks: Object.freeze(failed),
    ...(product ? { productId: product.productId, providerId: product.providerId } : {}),
  });
}

function checkJurisdiction(
  context: OpportunityDiscoveryContext,
  failed: string[],
  reasons: string[],
): void {
  if (!SUPPORTED_JURISDICTIONS.has(context.jurisdiction)) {
    failed.push('jurisdiction');
    reasons.push(`jurisdiction ${context.jurisdiction} is not supported`);
  }
}

function checkKyc(
  context: OpportunityDiscoveryContext,
  product: ProductCapability | undefined,
  failed: string[],
  reasons: string[],
): void {
  if (product?.requiresKyc && context.kycState !== 'VERIFIED') {
    failed.push('kyc');
    reasons.push(`KYC state ${context.kycState} cannot action this product`);
  }
}

function checkRestriction(
  context: OpportunityDiscoveryContext,
  failed: string[],
  reasons: string[],
): void {
  if (context.customerRestricted || context.kycState === 'RESTRICTED') {
    failed.push('compliance');
    reasons.push('customer or identity is restricted');
  }
}

function checkProduct(
  product: ProductCapability | undefined,
  category: string,
  jurisdiction: string,
  failed: string[],
  reasons: string[],
): void {
  if (!product) {
    failed.push('product');
    reasons.push(`no supported product for ${category}`);
    return;
  }
  if (!product.available) {
    failed.push('product');
    reasons.push(`product ${product.productId} is unavailable`);
  }
  if (!product.jurisdictions.includes(jurisdiction)) {
    failed.push('jurisdiction');
    reasons.push(`product ${product.productId} is not offered in ${jurisdiction}`);
  }
}

function checkProvider(
  product: ProductCapability | undefined,
  failed: string[],
  reasons: string[],
): void {
  if (product && !product.providerAvailable) {
    failed.push('provider');
    reasons.push(`provider ${product.providerId} is unavailable`);
  }
}

function checkRisk(
  finding: DetectorFinding,
  context: OpportunityDiscoveryContext,
  failed: string[],
  reasons: string[],
): void {
  if (riskRank(finding.riskLevel) > riskRank(context.suitabilityMaxRisk)) {
    failed.push('suitability');
    reasons.push(`risk ${finding.riskLevel} exceeds suitability ${context.suitabilityMaxRisk}`);
  }
  if (context.riskProfile === 'CONSERVATIVE' && finding.riskLevel === 'UNCERTAIN_MARKET') {
    failed.push('risk');
    reasons.push('conservative risk profile blocks uncertain-market recommendations');
  }
}

function checkMinimum(
  finding: DetectorFinding,
  product: ProductCapability | undefined,
  failed: string[],
  reasons: string[],
): void {
  if (!product?.minimumAmount || !finding.estimatedImpact) {
    return;
  }
  if (finding.estimatedImpact.currency !== product.minimumAmount.currency) {
    return;
  }
  const amount = Money.fromMinorUnitsString(finding.estimatedImpact.minorUnits, finding.estimatedImpact.currency);
  const minimum = Money.fromMinorUnitsString(product.minimumAmount.minorUnits, product.minimumAmount.currency);
  if (amount.cmp(minimum) < 0) {
    failed.push('minimum_amount');
    reasons.push('amount is below the product minimum');
  }
}

function checkLiquidity(
  finding: DetectorFinding,
  mandate: CompiledEconomicMandate | undefined,
  failed: string[],
  reasons: string[],
): void {
  if (!mandate || finding.liquidityImpact !== 'DECREASES' || !finding.estimatedImpact) {
    return;
  }
  const floor =
    constraintAmount(mandate, 'NEVER_SPEND_BELOW_LIQUIDITY_FLOOR') ??
    constraintAmount(mandate, 'MINIMUM_CASH_RESERVE');
  if (!floor) {
    return;
  }
  reasons.push('liquidity floor remains a hard constraint on any later transfer');
}

function checkAccounts(
  context: OpportunityDiscoveryContext,
  failed: string[],
  reasons: string[],
): void {
  const blocked = context.ledgerPositions?.filter((item) => item.frozen || item.restricted) ?? [];
  if (blocked.length > 0 && context.ledgerPositions?.every((item) => item.frozen || item.restricted)) {
    failed.push('account');
    reasons.push('all known accounts are frozen or restricted');
  }
}

function checkPolicy(
  finding: DetectorFinding,
  context: OpportunityDiscoveryContext,
  failed: string[],
  reasons: string[],
): void {
  if (finding.detector === 'UNINVESTED_INVESTMENT_CASH' || finding.detector === 'PORTFOLIO_DRIFT' || finding.detector === 'PORTFOLIO_CONCENTRATION') {
    const fact = context.policy.queryControlFact({
      capability: 'INVESTMENT_EXECUTION',
      subjectId: 'eligibility',
      jurisdiction: context.jurisdiction,
    });
    if (!fact.permitted) {
      reasons.push('investment product is not immediately executable');
    }
    if (!fact.evaluable) {
      failed.push('compliance');
      reasons.push('investment policy fact is not evaluable');
    }
  }
}

function checkMandate(
  finding: DetectorFinding,
  mandate: CompiledEconomicMandate | undefined,
  failed: string[],
  reasons: string[],
): void {
  if (!mandate) {
    return;
  }
  const prohibited = mandate.hardConstraints.find((item) => item.kind === 'PROHIBITED_PRODUCT_CATEGORIES');
  const category = DETECTOR_TO_CATEGORY[finding.detector];
  if (prohibited?.categories?.includes(category)) {
    failed.push('mandate');
    reasons.push(`mandate prohibits ${category}`);
  }
  if (mandate.hardConstraints.some((item) => item.kind === 'KEEP_ALL_LIQUID') && finding.detector === 'UNINVESTED_INVESTMENT_CASH') {
    failed.push('mandate');
    reasons.push('KEEP_ALL_LIQUID forbids investing surplus');
  }
}
