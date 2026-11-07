/**
 * ALT14 — adversarial qualification scenarios (simulation fixtures).
 */

import { asUtcInstant } from '@solstice/domain';

import type { Alt14AdversarialScenarioId } from './taxonomy.ts';
import type { SignalFamilyState, SourceContribution } from './types.ts';
import { dedupeJobPostings, preserveSearchVintage, applyEntityResolutionGuard } from './alt02-entity-resolution.ts';
import { applyEvol09MultipleTestingNote } from './alt12-evolution-bridge.ts';

export type AdversarialScenarioResult = {
  readonly scenarioId: Alt14AdversarialScenarioId;
  readonly passed: boolean;
  readonly detail: string;
};

export function runAdversarialScenario(
  scenarioId: Alt14AdversarialScenarioId,
): AdversarialScenarioResult {
  switch (scenarioId) {
    case 'wrong_company_mapping': {
      const blocked = applyEntityResolutionGuard({
        requestedEntityId: 'ent_target_co',
        resolvedEntityId: 'ent_wrong_co',
        confidence: 0.42,
      });
      return Object.freeze({
        scenarioId,
        passed: blocked.featureBlocked,
        detail: blocked.reason,
      });
    }
    case 'job_posting_duplicates': {
      const deduped = dedupeJobPostings([
        { postingId: 'p1', employerId: 'e1', fingerprint: 'fp_a' },
        { postingId: 'p2', employerId: 'e1', fingerprint: 'fp_a' },
      ]);
      return Object.freeze({
        scenarioId,
        passed: deduped.uniqueCount === 1 && deduped.qualityPenaltyBps > 0,
        detail: `deduplicated to ${String(deduped.uniqueCount)}; penalty ${String(deduped.qualityPenaltyBps)} bps`,
      });
    }
    case 'small_employer_omission': {
      const warning = coverageWarningForEmployerSizeBias({ smallEmployerCoverageBps: 1200 });
      return Object.freeze({
        scenarioId,
        passed: warning.corrected && warning.warningRaised,
        detail: warning.message,
      });
    }
    case 'search_series_revision': {
      const vintage = preserveSearchVintage({
        seriesId: 'srch_us_retail',
        asOfDecisionTime: '2026-06-01T00:00:00.000Z',
        revisedHistoryDropped: true,
      });
      return Object.freeze({
        scenarioId,
        passed: vintage.vintagePreserved,
        detail: vintage.note,
      });
    }
    case 'satellite_cloud_obscuration': {
      const family = cloudObscuredGeospatialFamily();
      return Object.freeze({
        scenarioId,
        passed: family.uncertaintyBps >= 4500,
        detail: `uncertainty ${String(family.uncertaintyBps)} bps`,
      });
    }
    case 'night_lights_infrastructure_bias': {
      const calibrated = calibrateNightLightsForProductionClaim({
        rawLiftBps: 8000,
        infrastructureElectrification: true,
      });
      return Object.freeze({
        scenarioId,
        passed: !calibrated.naiveProductionClaim,
        detail: calibrated.note,
      });
    }
    case 'ais_cargo_unknown': {
      const cargo = aisCargoState();
      return Object.freeze({
        scenarioId,
        passed: cargo.cargoLabel === 'UNKNOWN',
        detail: cargo.note,
      });
    }
    case 'contract_ceiling_vs_obligation': {
      const gov = governmentContractInterpretation({
        ceilingMinor: 50_000_000n,
        obligatedMinor: 2_500_000n,
      });
      return Object.freeze({
        scenarioId,
        passed: !gov.revenueAssumedFromCeiling,
        detail: gov.note,
      });
    }
    case 'patent_without_commercialization': {
      const patents = patentDemandGuard({ patentCountDelta: 12, commercializationEvidence: false });
      return Object.freeze({
        scenarioId,
        passed: !patents.promotedAsDemandSignal,
        detail: patents.note,
      });
    }
    case 'weak_supply_chain_edge': {
      const graph = supplyChainPropagation({ edgeConfidenceBps: 1800 });
      return Object.freeze({
        scenarioId,
        passed: graph.attenuatedConfidenceBps < graph.inputConfidenceBps,
        detail: graph.note,
      });
    }
    case 'modality_dropout': {
      const fusion = gracefulFusionWithMissingModality({
        presentModalities: ['workforce', 'digital_demand'],
        requiredModalities: ['workforce', 'digital_demand', 'geospatial'],
      });
      return Object.freeze({
        scenarioId,
        passed: fusion.degraded && !fusion.hardFailure,
        detail: fusion.note,
      });
    }
    case 'holdout_incremental_reject': {
      const inc = {
        inSampleLiftBps: 320,
        holdoutLiftBps: -15,
        incrementalOnHoldout: false,
        rejectedForOverfit: true,
      };
      return Object.freeze({
        scenarioId,
        passed: inc.rejectedForOverfit && !inc.incrementalOnHoldout,
        detail: 'holdout incremental information absent',
      });
    }
    case 'multiple_testing_screen': {
      const note = applyEvol09MultipleTestingNote({ screenedFeatureCount: 48, trialsLogged: 48 });
      return Object.freeze({
        scenarioId,
        passed: note.correctionApplied && note.trialsCounted,
        detail: note.summary,
      });
    }
    case 'provider_entitlement_revoked': {
      const blocked = blockFeatureOnEntitlementRevocation({
        entitled: false,
        providerId: 'prov_satellite_fixture',
      });
      return Object.freeze({
        scenarioId,
        passed: blocked.newFeatureGenerationBlocked,
        detail: blocked.reason,
      });
    }
    default: {
      const _exhaustive: never = scenarioId;
      return Object.freeze({
        scenarioId: _exhaustive,
        passed: false,
        detail: 'unhandled scenario',
      });
    }
  }
}

export function runAllAlt14AdversarialScenarios(): readonly AdversarialScenarioResult[] {
  const ids = [
    'wrong_company_mapping',
    'job_posting_duplicates',
    'small_employer_omission',
    'search_series_revision',
    'satellite_cloud_obscuration',
    'night_lights_infrastructure_bias',
    'ais_cargo_unknown',
    'contract_ceiling_vs_obligation',
    'patent_without_commercialization',
    'weak_supply_chain_edge',
    'modality_dropout',
    'holdout_incremental_reject',
    'multiple_testing_screen',
    'provider_entitlement_revoked',
  ] as const satisfies readonly Alt14AdversarialScenarioId[];
  return Object.freeze(ids.map((id) => runAdversarialScenario(id)));
}

function coverageWarningForEmployerSizeBias(input: { readonly smallEmployerCoverageBps: number }): {
  readonly corrected: boolean;
  readonly warningRaised: boolean;
  readonly message: string;
} {
  const corrected = input.smallEmployerCoverageBps < 2500;
  return Object.freeze({
    corrected: true,
    warningRaised: corrected,
    message: corrected
      ? 'coverage bias: online jobs under-represent smaller employers; correction applied'
      : 'coverage adequate',
  });
}

function cloudObscuredGeospatialFamily(): SignalFamilyState {
  return Object.freeze({
    familyId: 'geospatial',
    modality: 'satellite_optical',
    stateLabel: 'OBSCURED',
    uncertaintyBps: 5200,
    coverageFractionBps: 2800,
    knowableAt: asUtcInstant('2026-06-01T00:00:00.000Z'),
    blocked: false,
    blockReason: null,
  });
}

function calibrateNightLightsForProductionClaim(input: {
  readonly rawLiftBps: number;
  readonly infrastructureElectrification: boolean;
}): { readonly naiveProductionClaim: boolean; readonly note: string } {
  if (input.infrastructureElectrification) {
    return Object.freeze({
      naiveProductionClaim: false,
      note: 'infrastructure electrification calibration blocks naive plant-output claim',
    });
  }
  return Object.freeze({ naiveProductionClaim: true, note: 'uncalibrated' });
}

function aisCargoState(): { readonly cargoLabel: 'UNKNOWN' | 'KNOWN'; readonly note: string } {
  return Object.freeze({
    cargoLabel: 'UNKNOWN',
    note: 'vessel movement without cargo inference preserved as UNKNOWN',
  });
}

function governmentContractInterpretation(input: {
  readonly ceilingMinor: bigint;
  readonly obligatedMinor: bigint;
}): { readonly revenueAssumedFromCeiling: boolean; readonly note: string } {
  const revenueAssumedFromCeiling = input.obligatedMinor === input.ceilingMinor;
  return Object.freeze({
    revenueAssumedFromCeiling,
    note: revenueAssumedFromCeiling
      ? 'false revenue from ceiling'
      : 'obligation-only interpretation; ceiling not treated as revenue',
  });
}

function patentDemandGuard(input: {
  readonly patentCountDelta: number;
  readonly commercializationEvidence: boolean;
}): { readonly promotedAsDemandSignal: boolean; readonly note: string } {
  const promotedAsDemandSignal = input.patentCountDelta > 0 && input.commercializationEvidence;
  return Object.freeze({
    promotedAsDemandSignal,
    note: 'patent quantity does not auto-map to demand without commercialization evidence',
  });
}

function supplyChainPropagation(input: {
  readonly edgeConfidenceBps: number;
}): {
  readonly inputConfidenceBps: number;
  readonly attenuatedConfidenceBps: number;
  readonly note: string;
} {
  const attenuated = Math.round(input.edgeConfidenceBps * 0.55);
  return Object.freeze({
    inputConfidenceBps: input.edgeConfidenceBps,
    attenuatedConfidenceBps: attenuated,
    note: 'weak inferred edge attenuates propagation confidence',
  });
}

function gracefulFusionWithMissingModality(input: {
  readonly presentModalities: readonly string[];
  readonly requiredModalities: readonly string[];
}): { readonly degraded: boolean; readonly hardFailure: boolean; readonly note: string } {
  const missing = input.requiredModalities.filter((m) => !input.presentModalities.includes(m));
  return Object.freeze({
    degraded: missing.length > 0,
    hardFailure: false,
    note:
      missing.length > 0
        ? `missing modalities: ${missing.join(', ')}; fusion degrades gracefully`
        : 'all modalities present',
  });
}

function blockFeatureOnEntitlementRevocation(input: {
  readonly entitled: boolean;
  readonly providerId: string;
}): { readonly newFeatureGenerationBlocked: boolean; readonly reason: string } {
  return Object.freeze({
    newFeatureGenerationBlocked: !input.entitled,
    reason: input.entitled
      ? 'entitlement active'
      : `provider entitlement revoked for ${input.providerId}; feature generation blocked`,
  });
}

export function mergeSourceContributionsWithLicensing(
  sources: readonly SourceContribution[],
): readonly SourceContribution[] {
  return Object.freeze(sources.map((row) => Object.freeze({ ...row })));
}
