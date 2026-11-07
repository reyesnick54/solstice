/**
 * ALT09 — fuse specialist outputs into AlternativeDataResearchState.
 */

import type { AlternativeDataResearchState, AltResearchBuildInput } from './types.ts';
import { skepticGateBlocksAafCertification } from './alt08-skeptic.ts';

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function buildAlternativeDataResearchState(
  input: AltResearchBuildInput,
): AlternativeDataResearchState {
  const activeFamilies = input.signalFamilies.filter((row) => !row.blocked);
  const coverage =
    activeFamilies.length === 0
      ? 0
      : clamp01(
          activeFamilies.reduce((sum, row) => sum + row.coverageFractionBps, 0) /
            (activeFamilies.length * 10_000),
        );
  const signalUncertainty =
    activeFamilies.length === 0
      ? 1
      : clamp01(
          activeFamilies.reduce((sum, row) => sum + row.uncertaintyBps, 0) /
            (activeFamilies.length * 10_000),
        );
  const providerReliability =
    input.sources.length === 0
      ? 0
      : clamp01(
          input.sources.reduce((sum, row) => sum + row.reliabilityBps, 0) /
            (input.sources.length * 10_000),
        );
  const skepticBlocks = skepticGateBlocksAafCertification(input.skepticFindings);
  const holdoutReject = input.incremental.rejectedForOverfit || !input.incremental.incrementalOnHoldout;
  const entityBad = input.entityResolutionQuality < 0.85;
  const unlicensed = input.sources.some((row) => !row.licensed);

  let AAFQualification: AlternativeDataResearchState['AAFQualification'] = 'CERTIFIED';
  if (entityBad || skepticBlocks || unlicensed || holdoutReject) {
    AAFQualification = 'BLOCKED';
  } else if (coverage < 0.5 || signalUncertainty > 0.65) {
    AAFQualification = 'DEGRADED';
  } else if (activeFamilies.length < input.signalFamilies.length) {
    AAFQualification = 'RESEARCH_ONLY';
  }

  const confidence = clamp01(
    (1 - signalUncertainty) * coverage * input.entityResolutionQuality * providerReliability,
  );

  return Object.freeze({
    schema: 'sunrey.helios.alternative-data-research-state.v1',
    entityId: input.entityId,
    decisionTime: input.decisionTime,
    signalFamilyStates: Object.freeze([...input.signalFamilies]),
    incrementalInformation: input.incremental,
    signalUncertainty,
    coverage,
    providerReliability,
    entityResolutionQuality: clamp01(input.entityResolutionQuality),
    AAFQualification,
    evidenceRefs: Object.freeze([...input.evidenceRefs]),
    sourceContributions: Object.freeze([...input.sources]),
    contradictingSignals: Object.freeze([...input.contradictions]),
    confidence,
    skepticFindings: Object.freeze([...input.skepticFindings]),
    researchEvidenceOnly: true,
    grantsExecutionAuthority: false,
  });
}
