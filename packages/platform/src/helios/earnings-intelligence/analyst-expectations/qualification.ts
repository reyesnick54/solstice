/**
 * EARN04 qualification gate.
 */

import {
  HELIOS_EARN04_ANALYST_EXPECTATIONS_BLOCKED,
  HELIOS_EARN04_ANALYST_EXPECTATIONS_QUALIFIED,
} from './taxonomy.ts';

export type Earn04AnalystExpectationsQualificationChecks = {
  readonly pointInTimeForecasts: boolean;
  readonly consensusStatistics: boolean;
  readonly revisionIntelligence: boolean;
  readonly analystResponsiveness: boolean;
  readonly volatilityOfDisagreement: boolean;
  readonly historicalAnalystReliability: boolean;
  readonly noFutureOutcomeLeakage: boolean;
  readonly dynamicConsensusFilter: boolean;
  readonly streetExpectationDistribution: boolean;
  readonly fixtureSimulationOnly: boolean;
  readonly noExecutionAuthority: boolean;
};

export type Earn04AnalystExpectationsQualificationResult = {
  readonly marker:
    | typeof HELIOS_EARN04_ANALYST_EXPECTATIONS_QUALIFIED
    | typeof HELIOS_EARN04_ANALYST_EXPECTATIONS_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateEarn04AnalystExpectationsQualification(
  checks: Earn04AnalystExpectationsQualificationChecks,
): Earn04AnalystExpectationsQualificationResult {
  const blockers: string[] = [];
  for (const [key, passed] of Object.entries(checks) as [
    keyof Earn04AnalystExpectationsQualificationChecks,
    boolean,
  ][]) {
    if (!passed) blockers.push(String(key));
  }
  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified
      ? HELIOS_EARN04_ANALYST_EXPECTATIONS_QUALIFIED
      : HELIOS_EARN04_ANALYST_EXPECTATIONS_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}
