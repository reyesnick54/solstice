/**
 * HELIOS MD05 qualification gate.
 */

import {
  HELIOS_MD05_REDUNDANT_MARKET_TRUTH_BLOCKED,
  HELIOS_MD05_REDUNDANT_MARKET_TRUTH_QUALIFIED,
} from './taxonomy.ts';

export type Md05QualificationChecks = {
  readonly abDedupeEarliestArrival: boolean;
  readonly noDoubleCount: boolean;
  readonly sourceAttributionRetained: boolean;
  readonly incompatibleNotAveraged: boolean;
  readonly unanimousConsensus: boolean;
  readonly readOnlyFailover: boolean;
  readonly executionAuthoritySeparate: boolean;
  readonly providerTrustDimensions: boolean;
  readonly divergenceSurfaced: boolean;
};

export type Md05QualificationResult = {
  readonly marker:
    | typeof HELIOS_MD05_REDUNDANT_MARKET_TRUTH_QUALIFIED
    | typeof HELIOS_MD05_REDUNDANT_MARKET_TRUTH_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateMd05Qualification(checks: Md05QualificationChecks): Md05QualificationResult {
  const blockers: string[] = [];
  const entries: Array<[keyof Md05QualificationChecks, string]> = [
    ['abDedupeEarliestArrival', 'A/B dedupe must keep earliest valid arrival'],
    ['noDoubleCount', 'duplicate native sequence/message must not double-count'],
    ['sourceAttributionRetained', 'normalized observation must retain contributing sources'],
    ['incompatibleNotAveraged', 'incompatible observations must not be averaged'],
    ['unanimousConsensus', 'economically equivalent observations must reach consensus'],
    ['readOnlyFailover', 'failover must remain read-only market data'],
    ['executionAuthoritySeparate', 'failover must not implicate execution authority'],
    ['providerTrustDimensions', 'provider trust must track MD05 quality dimensions'],
    ['divergenceSurfaced', 'feed divergence must be surfaced for incompatible fields'],
  ];
  for (const [key, message] of entries) {
    if (!checks[key]) {
      blockers.push(message);
    }
  }
  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified
      ? HELIOS_MD05_REDUNDANT_MARKET_TRUTH_QUALIFIED
      : HELIOS_MD05_REDUNDANT_MARKET_TRUTH_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}
