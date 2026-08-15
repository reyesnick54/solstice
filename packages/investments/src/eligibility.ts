import type { Account } from '../../domain/src/account.ts';
import type { Customer } from '../../domain/src/customer.ts';
import type { LegalEntity } from '../../domain/src/legal-entity.ts';
import type { Product } from '../../domain/src/product.ts';
import { ENVIRONMENT, LIVE_TRADING_ENABLED } from '../../config/src/flags.ts';
import type { EligibilityStatus, RdtLegalStatus } from './types.ts';
import { LIVE_INVESTMENT_EXECUTION } from './types.ts';

export type InvestmentEligibilityInput = {
  readonly customer: Customer | undefined;
  readonly identityVerified: boolean;
  readonly identityUsable: boolean;
  readonly jurisdiction: string | undefined;
  readonly legalEntity: LegalEntity | undefined;
  readonly product: Product | undefined;
  readonly brokerageCash: Account | undefined;
  readonly securities: Account | undefined;
  readonly investmentCapabilityEnabled: boolean;
  readonly rdtStatus: RdtLegalStatus;
};

export type InvestmentEligibility = {
  readonly status: EligibilityStatus;
  readonly reasons: readonly string[];
  readonly rdtStatus: RdtLegalStatus;
  readonly simulationOnly: true;
};

const SUPPORTED_SIMULATION_JURISDICTIONS = new Set(['GB', 'US']);

export function evaluateInvestmentEligibility(input: InvestmentEligibilityInput): InvestmentEligibility {
  const reasons: string[] = [];
  if (ENVIRONMENT !== 'simulation' || LIVE_INVESTMENT_EXECUTION !== false || LIVE_TRADING_ENABLED !== false) {
    return freezeEligibility('NOT_SUPPORTED', ['live investment execution is forbidden'], 'SIMULATION_ONLY');
  }
  if (!input.identityUsable || !input.identityVerified) {
    reasons.push('unverified or unusable identity');
  }
  if (!input.customer || input.customer.status !== 'ACTIVE') {
    reasons.push('customer is not ACTIVE');
  }
  if (!input.jurisdiction) {
    reasons.push('jurisdiction is missing');
  } else if (!SUPPORTED_SIMULATION_JURISDICTIONS.has(input.jurisdiction)) {
    return freezeEligibility(
      'NOT_SUPPORTED',
      [`jurisdiction ${input.jurisdiction} is not supported for simulation investments`],
      'RESEARCH_REQUIRED',
    );
  }
  if (!input.legalEntity || input.legalEntity.status !== 'ACTIVE') {
    reasons.push('legal entity is missing or inactive');
  }
  if (!input.product || input.product.status !== 'ACTIVE') {
    reasons.push('investment product is missing or retired');
  }
  if (!input.investmentCapabilityEnabled) {
    return freezeEligibility('NOT_SUPPORTED', ['investment capability is disabled'], 'SIMULATION_ONLY');
  }
  if (input.brokerageCash && input.brokerageCash.status === 'FROZEN') {
    reasons.push('brokerage cash account is frozen');
  }
  if (input.securities && input.securities.status === 'FROZEN') {
    reasons.push('securities account is frozen');
  }
  if (input.brokerageCash && input.brokerageCash.status === 'CLOSED') {
    reasons.push('brokerage cash account is closed');
  }
  if (input.rdtStatus === 'COUNSEL_REVIEW_REQUIRED') {
    return freezeEligibility('REVIEW', [...reasons, 'RDT requires counsel review'], input.rdtStatus);
  }
  if (reasons.length > 0) {
    return freezeEligibility('NOT_SUPPORTED', reasons, input.rdtStatus);
  }
  return freezeEligibility(
    'ELIGIBLE_SIMULATION',
    ['simulation paper investing only; no investor-suitability determination'],
    input.rdtStatus,
  );
}

function freezeEligibility(
  status: EligibilityStatus,
  reasons: readonly string[],
  rdtStatus: RdtLegalStatus,
): InvestmentEligibility {
  return Object.freeze({
    status,
    reasons: Object.freeze([...reasons]),
    rdtStatus,
    simulationOnly: true,
  });
}
