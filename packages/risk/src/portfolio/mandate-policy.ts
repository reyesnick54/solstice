import { ratioCmp, type Ratio } from '../arithmetic.ts';
import type { RiskPolicyVersion } from '../ids.ts';
import { asRiskPolicyVersion } from '../ids.ts';
import type { MandateRiskPolicy } from './types.ts';
import type { UtcInstant } from '@solstice/domain';

export const DEFAULT_M20_POLICY_VERSION = asRiskPolicyVersion('helios-m20-portfolio-risk-v1');

export function buildMandateRiskPolicy(input: Omit<MandateRiskPolicy, 'engineeringOnly' | 'cannotLoosenMandate'>): MandateRiskPolicy {
  return Object.freeze({
    ...input,
    engineeringOnly: true,
    cannotLoosenMandate: true,
  });
}

function optionalRatioTightened(current: Ratio | undefined, candidate: Ratio | undefined): boolean {
  if (current === undefined || candidate === undefined) {
    return false;
  }
  return ratioCmp(candidate, current) > 0;
}

function optionalMinorTightened(current: bigint | undefined, candidate: bigint | undefined): boolean {
  if (current === undefined || candidate === undefined) {
    return false;
  }
  return candidate < current;
}

export function policyUpdatePermitted(current: MandateRiskPolicy, candidate: MandateRiskPolicy): {
  readonly permitted: boolean;
  readonly reasons: readonly string[];
} {
  const reasons: string[] = [];
  if (candidate.mandateId !== current.mandateId || candidate.portfolioId !== current.portfolioId) {
    reasons.push('mandate or portfolio identity mismatch');
  }
  if (optionalRatioTightened(current.maximumPositionExposure, candidate.maximumPositionExposure)) {
    reasons.push('maximumPositionExposure would loosen');
  }
  if (optionalRatioTightened(current.maximumStrategyExposure, candidate.maximumStrategyExposure)) {
    reasons.push('maximumStrategyExposure would loosen');
  }
  if (optionalRatioTightened(current.maximumAssetClassExposure, candidate.maximumAssetClassExposure)) {
    reasons.push('maximumAssetClassExposure would loosen');
  }
  if (optionalRatioTightened(current.maximumCorrelatedClusterExposure, candidate.maximumCorrelatedClusterExposure)) {
    reasons.push('maximumCorrelatedClusterExposure would loosen');
  }
  if (optionalRatioTightened(current.maximumPortfolioDrawdown, candidate.maximumPortfolioDrawdown)) {
    reasons.push('maximumPortfolioDrawdown would loosen');
  }
  if (optionalMinorTightened(current.dailyRealizedLossLimitMinor, candidate.dailyRealizedLossLimitMinor)) {
    reasons.push('dailyRealizedLossLimitMinor would loosen');
  }
  if (optionalMinorTightened(current.minimumLiquidityMinor, candidate.minimumLiquidityMinor)) {
    reasons.push('minimumLiquidityMinor would loosen');
  }
  return Object.freeze({
    permitted: reasons.length === 0,
    reasons: Object.freeze(reasons),
  });
}

export function nextPolicyVersion(current: RiskPolicyVersion): RiskPolicyVersion {
  const match = String(current).match(/v(\d+)$/);
  if (!match) {
    return asRiskPolicyVersion(`${String(current)}-rev2`);
  }
  const next = (BigInt(match[1]!) + 1n).toString();
  return asRiskPolicyVersion(String(current).replace(/v\d+$/, `v${next}`));
}

export function fixtureMultiAssetProfiles(): readonly import('./types.ts').InstrumentRiskProfile[] {
  return Object.freeze([
    Object.freeze({
      instrumentId: 'EQUITY:SPY:us:etf:USD',
      assetClass: 'ETF',
      venue: 'NYSE_ARCA',
      strategyId: 'strat_index_mr',
      correlationClusterIds: Object.freeze(['US_EQUITY', 'RISK_ON']),
      sourceRef: 'fixture:profile:spy',
    }),
    Object.freeze({
      instrumentId: 'EQUITY:QQQ:us:etf:USD',
      assetClass: 'ETF',
      venue: 'NASDAQ',
      strategyId: 'strat_index_mr',
      correlationClusterIds: Object.freeze(['US_EQUITY', 'TECH_GROWTH', 'RISK_ON']),
      sourceRef: 'fixture:profile:qqq',
    }),
    Object.freeze({
      instrumentId: 'EQUITY:NVDA:us:equity:USD',
      assetClass: 'EQUITY',
      venue: 'NASDAQ',
      strategyId: 'strat_momentum',
      correlationClusterIds: Object.freeze(['TECH_GROWTH', 'RISK_ON']),
      sourceRef: 'fixture:profile:nvda',
    }),
    Object.freeze({
      instrumentId: 'CRYPTO:BTC:bitcoin:native:USD',
      assetClass: 'CRYPTO',
      venue: 'COINBASE',
      strategyId: 'strat_crypto_momentum',
      correlationClusterIds: Object.freeze(['CRYPTO', 'RISK_ON']),
      sourceRef: 'fixture:profile:btc',
    }),
  ]);
}

export type PolicyBuilderInput = {
  readonly policyId: string;
  readonly mandateId: string;
  readonly customerId: string;
  readonly portfolioId: string;
  readonly version?: RiskPolicyVersion;
  readonly effectiveFrom: UtcInstant;
  readonly limits?: Partial<
    Pick<
      MandateRiskPolicy,
      | 'maximumPositionExposure'
      | 'maximumStrategyExposure'
      | 'maximumAssetClassExposure'
      | 'maximumCorrelatedClusterExposure'
      | 'maximumCryptoExposure'
      | 'maximumCommodityExposure'
      | 'maximumVenueConcentration'
      | 'maximumGrossExposure'
      | 'maximumNetExposure'
      | 'dailyRealizedLossLimitMinor'
      | 'dailyTotalLossThresholdMinor'
      | 'dailyTotalLossIncludesUnrealized'
      | 'maximumPortfolioDrawdown'
      | 'maximumStrategyDrawdown'
      | 'maximumConsecutiveLosses'
      | 'minimumLiquidityMinor'
      | 'staleDataBlocksNewEntries'
      | 'providerHealthBlocksNewEntries'
      | 'cautionPortfolioDrawdown'
      | 'reducedRiskPortfolioDrawdown'
      | 'newEntriesBlockedPortfolioDrawdown'
      | 'exitOnlyPortfolioDrawdown'
      | 'emergencyClosePortfolioDrawdown'
      | 'emergencyClosePermitted'
    >
  >;
};

export function buildPolicyFromLimits(input: PolicyBuilderInput): MandateRiskPolicy {
  return buildMandateRiskPolicy({
    policyId: input.policyId,
    mandateId: input.mandateId,
    customerId: input.customerId,
    portfolioId: input.portfolioId,
    version: input.version ?? DEFAULT_M20_POLICY_VERSION,
    effectiveFrom: input.effectiveFrom,
    ...input.limits,
  });
}
