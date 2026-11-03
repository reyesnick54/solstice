import {
  HELIOS_NATIVE_CROSS_MARKET_INTELLIGENCE_BLOCKED,
  HELIOS_NATIVE_CROSS_MARKET_INTELLIGENCE_QUALIFIED,
} from './taxonomy.ts';

export type Native14CrossMarketQualificationChecks = {
  readonly evidenceGraphBuilt: boolean;
  readonly dislocationDetection: boolean;
  readonly probabilityStateEvaluated: boolean;
  readonly confirmationAndContradiction: boolean;
  readonly macroResearchTriggerScenario: boolean;
  readonly cryptoResearchTriggerScenario: boolean;
  readonly opportunityCandidatesEvidenceBacked: boolean;
  readonly m16RankingBridge: boolean;
  readonly correlationDoesNotAuthorizeTrade: boolean;
  readonly noExecutionAuthority: boolean;
};

export type Native14CrossMarketQualificationResult = {
  readonly marker:
    | typeof HELIOS_NATIVE_CROSS_MARKET_INTELLIGENCE_QUALIFIED
    | typeof HELIOS_NATIVE_CROSS_MARKET_INTELLIGENCE_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateNative14CrossMarketQualification(
  checks: Native14CrossMarketQualificationChecks,
): Native14CrossMarketQualificationResult {
  const blockers: string[] = [];
  for (const [key, passed] of Object.entries(checks) as [keyof Native14CrossMarketQualificationChecks, boolean][]) {
    if (!passed) blockers.push(String(key));
  }
  if (blockers.length > 0) {
    return Object.freeze({
      marker: HELIOS_NATIVE_CROSS_MARKET_INTELLIGENCE_BLOCKED,
      qualified: false,
      blockers: Object.freeze(blockers),
    });
  }
  return Object.freeze({
    marker: HELIOS_NATIVE_CROSS_MARKET_INTELLIGENCE_QUALIFIED,
    qualified: true,
    blockers: Object.freeze([]),
  });
}
