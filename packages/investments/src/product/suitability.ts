import type { Customer } from '../../../domain/src/customer.ts';
import { ENVIRONMENT, LIVE_TRADING_ENABLED } from '../../../config/src/flags.ts';
import { LIVE_INVESTMENT_EXECUTION } from '../types.ts';
import type { InstrumentProduct } from './instrument-catalog.ts';
import type {
  ExperienceLevel,
  InvestorClassification,
  SuitabilityStatus,
} from './types.ts';
import { LIVE_INVESTMENT_PROVIDER_CONNECTED, LIVE_SECURITIES_BROKERAGE } from './types.ts';

export type SuitabilityInput = {
  readonly customer: Customer | undefined;
  readonly identityVerified: boolean;
  readonly identityUsable: boolean;
  readonly jurisdiction: string | undefined;
  readonly investorClassification: InvestorClassification;
  readonly experience: ExperienceLevel;
  readonly riskTolerance: 'LOW' | 'MODERATE' | 'HIGH' | 'UNKNOWN';
  readonly liquidityNeed: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  readonly providerAvailable: boolean;
  readonly productRestriction: readonly string[];
  readonly instrument: InstrumentProduct;
};

export type SuitabilityDecision = {
  readonly status: SuitabilityStatus;
  readonly reasons: readonly string[];
  readonly instrumentId: string;
  readonly simulationOnly: true;
  readonly liveBrokerage: false;
  readonly counselConfirmed: false;
};

const SUPPORTED = new Set(['GB', 'US']);

export function evaluateProductSuitability(input: SuitabilityInput): SuitabilityDecision {
  const reasons: string[] = [];
  if (
    ENVIRONMENT !== 'simulation' ||
    LIVE_INVESTMENT_EXECUTION !== false ||
    LIVE_TRADING_ENABLED !== false ||
    LIVE_SECURITIES_BROKERAGE !== false ||
    LIVE_INVESTMENT_PROVIDER_CONNECTED !== false
  ) {
    return decision('NOT_SUPPORTED', input.instrument.instrumentId, ['live securities brokerage is forbidden']);
  }
  if (!input.identityUsable || !input.identityVerified) {
    reasons.push('KYC is not verified');
  }
  if (!input.customer || input.customer.status !== 'ACTIVE') {
    reasons.push('customer is not ACTIVE');
  }
  if (!input.jurisdiction) {
    reasons.push('jurisdiction is missing');
  } else if (!SUPPORTED.has(input.jurisdiction)) {
    return decision('RESEARCH_REQUIRED', input.instrument.instrumentId, [
      `jurisdiction ${input.jurisdiction} is RESEARCH_REQUIRED for investment products`,
    ]);
  } else if (!input.instrument.jurisdictionEligibility.includes(input.jurisdiction)) {
    return decision('NOT_SUPPORTED', input.instrument.instrumentId, [
      `instrument is not eligible in ${input.jurisdiction}`,
    ]);
  }
  if (input.instrument.status === 'RESEARCH_REQUIRED') {
    return decision('RESEARCH_REQUIRED', input.instrument.instrumentId, ['instrument remains research required']);
  }
  if (input.instrument.status !== 'AVAILABLE_SIMULATION') {
    return decision('NOT_SUPPORTED', input.instrument.instrumentId, [`instrument status is ${input.instrument.status}`]);
  }
  if (input.instrument.assetClass === 'DIGITAL_ASSET' && input.instrument.digitalAssetAllowed !== true) {
    return decision('NOT_SUPPORTED', input.instrument.instrumentId, ['digital assets are not allowed on this path']);
  }
  if (!input.providerAvailable) {
    return decision('NOT_SUPPORTED', input.instrument.instrumentId, ['investment provider is unavailable']);
  }
  if (input.productRestriction.includes(input.instrument.assetClass)) {
    return decision('NOT_SUPPORTED', input.instrument.instrumentId, [
      `product restriction forbids ${input.instrument.assetClass}`,
    ]);
  }
  if (input.instrument.riskCategory === 'HIGH' && input.riskTolerance === 'LOW') {
    return decision('REVIEW', input.instrument.instrumentId, [
      ...reasons,
      'high-risk product exceeds stated risk tolerance',
    ]);
  }
  if (input.instrument.riskCategory === 'HIGH' && (input.experience === 'NONE' || input.experience === 'LIMITED')) {
    return decision('REVIEW', input.instrument.instrumentId, [
      ...reasons,
      'experience is insufficient for a high-risk product',
    ]);
  }
  if (input.instrument.liquidity === 'LOW' && input.liquidityNeed === 'HIGH') {
    return decision('REVIEW', input.instrument.instrumentId, [
      ...reasons,
      'low-liquidity product conflicts with a high liquidity need',
    ]);
  }
  if (input.investorClassification === 'UNSPECIFIED' && input.instrument.riskCategory === 'HIGH') {
    reasons.push('investor classification is unspecified for a high-risk product');
  }
  if (reasons.length > 0) {
    return decision('NOT_SUPPORTED', input.instrument.instrumentId, reasons);
  }
  return decision('ELIGIBLE_SIMULATION', input.instrument.instrumentId, [
    'simulation paper investing only; not a live suitability determination or licensed advice',
  ]);
}

function decision(status: SuitabilityStatus, instrumentId: string, reasons: readonly string[]): SuitabilityDecision {
  return Object.freeze({
    status,
    reasons: Object.freeze([...reasons]),
    instrumentId,
    simulationOnly: true,
    liveBrokerage: false,
    counselConfirmed: false,
  });
}
