/**
 * HELIOS Multi-Asset M27 qualification gate.
 */

export const HELIOS_MULTI_ASSET_M27_GROW_INTELLIGENCE_QUALIFIED =
  'HELIOS_MULTI_ASSET_M27_GROW_INTELLIGENCE_QUALIFIED' as const;

export const HELIOS_MULTI_ASSET_M27_GROW_INTELLIGENCE_BLOCKED =
  'HELIOS_MULTI_ASSET_M27_GROW_INTELLIGENCE_BLOCKED' as const;

export type GrowIntelligenceQualificationChecks = {
  readonly morningBrief: boolean;
  readonly eveningRecap: boolean;
  readonly profitableDay: boolean;
  readonly losingDay: boolean;
  readonly noTradeDay: boolean;
  readonly depositsExcluded: boolean;
  readonly withdrawals: boolean;
  readonly unsettledTrade: boolean;
  readonly riskBlock: boolean;
  readonly providerOutage: boolean;
  readonly paperModeLabeling: boolean;
  readonly missingAiSummarizerFallback: boolean;
  readonly deterministicFallbackReport: boolean;
  readonly timezoneRespected: boolean;
  readonly disabledNotification: boolean;
  readonly duplicateDeliveryPrevention: boolean;
  readonly restart: boolean;
  readonly customerIsolation: boolean;
  readonly structuredBeforeNarrative: boolean;
  readonly noExecutionAuthority: boolean;
  readonly noCounterfactualProfitClaims: boolean;
};

export type GrowIntelligenceQualificationResult = {
  readonly marker:
    | typeof HELIOS_MULTI_ASSET_M27_GROW_INTELLIGENCE_QUALIFIED
    | typeof HELIOS_MULTI_ASSET_M27_GROW_INTELLIGENCE_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateGrowIntelligenceQualification(
  checks: GrowIntelligenceQualificationChecks,
): GrowIntelligenceQualificationResult {
  const entries = Object.entries(checks) as Array<[keyof GrowIntelligenceQualificationChecks, boolean]>;
  const blockers = entries.filter(([, passed]) => !passed).map(([key]) => key);
  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified
      ? HELIOS_MULTI_ASSET_M27_GROW_INTELLIGENCE_QUALIFIED
      : HELIOS_MULTI_ASSET_M27_GROW_INTELLIGENCE_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}
