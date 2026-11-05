/**
 * Probabilistic valuation distributions (research intelligence — not execution authority).
 */

import type { UtcInstant } from '@solstice/domain';
import type { ValuationMethod } from './taxonomy.ts';

export type ValuationDistributionQuantile = {
  readonly quantile: string;
  readonly valueMinor: bigint | null;
  readonly valuePerShareMinor: bigint | null;
};

export type ValuationDistribution = {
  readonly distributionId: string;
  readonly method: ValuationMethod;
  readonly currency: string;
  readonly meanValueMinor: bigint | null;
  readonly medianValueMinor: bigint | null;
  readonly standardDeviationMinor: bigint | null;
  readonly quantiles: readonly ValuationDistributionQuantile[];
  readonly sampleCount: number | null;
  readonly computedAt: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly notAFact: true;
  readonly researchOnly: true;
  readonly grantsExecutionAuthority: false;
};

export type IntrinsicValueDistribution = ValuationDistribution & {
  readonly kind: 'intrinsic_value';
  readonly enterpriseValueMinor: bigint | null;
  readonly equityValueMinor: bigint | null;
  readonly sharesOutstandingMinor: bigint | null;
};

export type MarketImpliedExpectation = {
  readonly expectationId: string;
  readonly method: Extract<ValuationMethod, 'REVERSE_DCF' | 'COMPARABLE_MULTIPLES'>;
  readonly impliedMetric: string;
  readonly impliedValueDecimal: string | null;
  readonly marketPriceMinor: bigint | null;
  readonly asOfKnowableAt: UtcInstant;
  readonly assumptionsUsed: readonly string[];
  readonly notAFact: true;
  readonly researchOnly: true;
  readonly grantsExecutionAuthority: false;
};
