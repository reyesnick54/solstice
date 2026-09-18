/**
 * HELIOS H27 product contract qualification gate.
 */

export const HELIOS_GROW_PRODUCT_CONTRACT_QUALIFIED = 'HELIOS_GROW_PRODUCT_CONTRACT_QUALIFIED' as const;
export const HELIOS_GROW_PRODUCT_CONTRACT_BLOCKED = 'HELIOS_GROW_PRODUCT_CONTRACT_BLOCKED' as const;

export type GrowProductContractQualificationResult = {
  readonly marker:
    | typeof HELIOS_GROW_PRODUCT_CONTRACT_QUALIFIED
    | typeof HELIOS_GROW_PRODUCT_CONTRACT_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export type GrowProductContractQualificationChecks = {
  readonly pauseBlocksNewDeployment: boolean;
  readonly pausePreservesInflight: boolean;
  readonly settlementContinuesWhilePaused: boolean;
  readonly resumeRevalidatesAuthority: boolean;
  readonly closePositionSupported: boolean;
  readonly partialCloseSupported: boolean;
  readonly withdrawalAvailableCash: boolean;
  readonly withdrawReservedRejected: boolean;
  readonly withdrawalReinvestmentRaceSafe: boolean;
  readonly mandateReductionSupported: boolean;
  readonly staleDataDegradation: boolean;
  readonly aiProviderDegradation: boolean;
  readonly executionProviderDegradation: boolean;
  readonly reconciliationMismatchBlocksReuse: boolean;
  readonly valuationStaleDisclosed: boolean;
  readonly restartPreservesControls: boolean;
  readonly customerIsolationHolds: boolean;
  readonly openapiControlsDocumented: boolean;
  readonly productionSafetyChecksPass: boolean;
};

export function evaluateGrowProductContractQualification(
  checks: GrowProductContractQualificationChecks,
): GrowProductContractQualificationResult {
  const blockers: string[] = [];
  const entries: Array<[keyof GrowProductContractQualificationChecks, string]> = [
    ['pauseBlocksNewDeployment', 'pause does not block new deployment'],
    ['pausePreservesInflight', 'pause erases in-flight operations'],
    ['settlementContinuesWhilePaused', 'settlement interrupted while paused'],
    ['resumeRevalidatesAuthority', 'resume skips authority revalidation'],
    ['closePositionSupported', 'close position unsupported'],
    ['partialCloseSupported', 'partial close unsupported'],
    ['withdrawalAvailableCash', 'withdrawal of available cash unsupported'],
    ['withdrawReservedRejected', 'reserved cash withdrawal not rejected'],
    ['withdrawalReinvestmentRaceSafe', 'withdrawal/reinvestment race unsafe'],
    ['mandateReductionSupported', 'mandate reduction unsupported'],
    ['staleDataDegradation', 'stale data degradation missing'],
    ['aiProviderDegradation', 'AI provider degradation missing'],
    ['executionProviderDegradation', 'execution provider degradation missing'],
    ['reconciliationMismatchBlocksReuse', 'reconciliation mismatch does not block reuse'],
    ['valuationStaleDisclosed', 'valuation stale not disclosed'],
    ['restartPreservesControls', 'restart loses control state'],
    ['customerIsolationHolds', 'customer isolation failure'],
    ['openapiControlsDocumented', 'OpenAPI controls incomplete'],
    ['productionSafetyChecksPass', 'production safety checks failed'],
  ];
  for (const [key, message] of entries) {
    if (!checks[key]) blockers.push(message);
  }
  if (blockers.length > 0) {
    return Object.freeze({
      marker: HELIOS_GROW_PRODUCT_CONTRACT_BLOCKED,
      qualified: false,
      blockers: Object.freeze(blockers),
    });
  }
  return Object.freeze({
    marker: HELIOS_GROW_PRODUCT_CONTRACT_QUALIFIED,
    qualified: true,
    blockers: Object.freeze([]),
  });
}
