export const HELIOS_AAFV2_05_BIAS_SENTINEL_QUALIFIED =
  'HELIOS_AAFV2_05_BIAS_SENTINEL_QUALIFIED' as const;

export const HELIOS_AAFV2_05_BIAS_SENTINEL_BLOCKED =
  'HELIOS_AAFV2_05_BIAS_SENTINEL_BLOCKED' as const;

export type Aafv205QualificationChecks = {
  readonly deterministicDiagnostics: boolean;
  readonly megaCapAltDataDetected: boolean;
  readonly survivorshipDetected: boolean;
  readonly sectorBiasDetected: boolean;
  readonly providerBiasDetected: boolean;
  readonly liquidityBiasDetected: boolean;
  readonly delistingBiasDetected: boolean;
  readonly cleanControlPasses: boolean;
  readonly severeBlocksPromotion: boolean;
  readonly warningRequiresReview: boolean;
  readonly noCausalClaimsFromCorrelation: boolean;
  readonly evidenceVaultIntegration: boolean;
  readonly coverageTensorBridge: boolean;
  readonly compilerManifestBridge: boolean;
  readonly noExecutionAuthority: boolean;
};

export type Aafv205QualificationResult = {
  readonly marker:
    | typeof HELIOS_AAFV2_05_BIAS_SENTINEL_QUALIFIED
    | typeof HELIOS_AAFV2_05_BIAS_SENTINEL_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateAafv205Qualification(
  checks: Aafv205QualificationChecks,
): Aafv205QualificationResult {
  const blockers: string[] = [];
  for (const [key, passed] of Object.entries(checks) as [keyof Aafv205QualificationChecks, boolean][]) {
    if (!passed) {
      blockers.push(String(key));
    }
  }
  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified
      ? HELIOS_AAFV2_05_BIAS_SENTINEL_QUALIFIED
      : HELIOS_AAFV2_05_BIAS_SENTINEL_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}
