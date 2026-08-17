import { QUALITY_FORMULA_VERSION, type OracleSourceQualityProfile, type QualityClass } from './types.ts';

export type QualityInputs = {
  readonly sourceId: string;
  readonly freshnessBps: number;
  readonly availabilityBps: number;
  readonly historicalConflictRateBps: number;
  readonly schemaValidityBps: number;
  readonly sourceIndependenceBps: number;
  readonly attestationLevelBps: number;
  readonly qualityClass: QualityClass;
};

function clampBps(value: number): number {
  if (!Number.isInteger(value)) {
    return 0;
  }
  return Math.min(10_000, Math.max(0, value));
}

/**
 * Versioned engineering-governed quality formula.
 * oracle.quality.profile.v1 — integer basis points only.
 */
export function scoreQuality(inputs: QualityInputs): OracleSourceQualityProfile {
  const freshness = clampBps(inputs.freshnessBps);
  const availability = clampBps(inputs.availabilityBps);
  const conflictPenalty = clampBps(inputs.historicalConflictRateBps);
  const schema = clampBps(inputs.schemaValidityBps);
  const independence = clampBps(inputs.sourceIndependenceBps);
  const attestation = clampBps(inputs.attestationLevelBps);
  const weighted =
    freshness * 25 +
    availability * 20 +
    schema * 20 +
    independence * 15 +
    attestation * 10 +
    (10_000 - conflictPenalty) * 10;
  const scoreBps = Math.floor(weighted / 100);
  return Object.freeze({
    schemaVersion: 1,
    formulaVersion: QUALITY_FORMULA_VERSION,
    sourceId: inputs.sourceId,
    freshnessBps: freshness,
    availabilityBps: availability,
    historicalConflictRateBps: conflictPenalty,
    schemaValidityBps: schema,
    sourceIndependenceBps: independence,
    attestationLevelBps: attestation,
    scoreBps,
    qualityClass: inputs.qualityClass,
    engineeringGoverned: true,
  });
}
