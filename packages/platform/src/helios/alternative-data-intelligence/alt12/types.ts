/**
 * HELIOS ALT12 — missing-aware multimodal fusion types.
 */

import type { UtcInstant } from '@solstice/domain';
import { ALT_MISSING_REASONS } from '../taxonomy.ts';
import type {
  AltAdvancedFusionModel,
  AltBaselineFusionModel,
  AltFusionModelKind,
  AltMissingReason,
  AltModalityId,
  HELIOS_ALT12_MULTIMODAL_FUSION_AUTHORITY,
  HELIOS_ALT12_MULTIMODAL_FUSION_SCHEMA,
} from '../taxonomy.ts';

export type ModalityAvailability = 'PRESENT' | 'MISSING' | 'BLOCKED';

export type ModalityReliability = {
  readonly modality: AltModalityId;
  readonly trustScore: number;
  readonly coverageScore: number;
  readonly latencyScore: number;
  readonly calibrationScore: number;
  readonly effectiveTrust: number;
  readonly degradationNotes: readonly string[];
};

export type ModalityState = {
  readonly modality: AltModalityId;
  readonly availability: ModalityAvailability;
  readonly missingReason: AltMissingReason | null;
  readonly featureValue: number | null;
  readonly featureUncertainty: number | null;
  readonly evaluatedAt: UtcInstant | null;
  readonly providerId: string | null;
  readonly reliability: ModalityReliability;
};

export type FusionRouteDecision = {
  readonly routeId: string;
  readonly activeModalities: readonly AltModalityId[];
  readonly blockedModalities: readonly AltModalityId[];
  readonly modalityRouteWeights: Readonly<Record<AltModalityId, number>>;
  readonly modelRouteWeights: Readonly<Record<AltFusionModelKind, number>>;
  readonly routingNotes: readonly string[];
};

/** @deprecated Use FusionRouteDecision — retained as FusionRoute per work-package spec. */
export type FusionRoute = FusionRouteDecision;

export type ModelFusionOutput = {
  readonly modelKind: AltFusionModelKind;
  readonly pointEstimate: number;
  readonly uncertainty: number;
  readonly activeModalityCount: number;
  readonly researchOnly: true;
};

export type SourceContribution = {
  readonly modality: AltModalityId;
  readonly diagnosticMethod: 'weighted_share' | 'leave_one_out';
  readonly fusedSignalDelta: number;
  readonly weightShare: number;
  readonly nonCausalDisclaimer: 'NOT_A_CAUSAL_ATTRIBUTION';
};

export type FusionUncertainty = {
  readonly aleatoric: number;
  readonly epistemic: number;
  readonly missingnessInflation: number;
  readonly reliabilityInflation: number;
  readonly total: number;
  readonly intervalLower: number;
  readonly intervalUpper: number;
  readonly calibrated: true;
};

export type SourceDropoutScenario = {
  readonly scenarioId: string;
  readonly removedModalities: readonly AltModalityId[];
};

export type SourceDropoutResult = {
  readonly scenarioId: string;
  readonly removedModalities: readonly AltModalityId[];
  readonly fusedSignal: number;
  readonly uncertaintyTotal: number;
  readonly gracefulDegradation: boolean;
  readonly catastrophic: boolean;
};

export type AlternativeDataFusionState = {
  readonly schema: typeof HELIOS_ALT12_MULTIMODAL_FUSION_SCHEMA;
  readonly authority: typeof HELIOS_ALT12_MULTIMODAL_FUSION_AUTHORITY;
  readonly fusionId: string;
  readonly entityId: string;
  readonly asOf: UtcInstant;
  readonly researchOnly: true;
  readonly notAFact: true;
  readonly grantsExecutionAuthority: false;
  readonly modalities: readonly ModalityState[];
  readonly route: FusionRouteDecision;
  readonly baselineOutputs: Readonly<
    Record<AltBaselineFusionModel, ModelFusionOutput>
  >;
  readonly advancedOutputs: Readonly<
    Record<AltAdvancedFusionModel, ModelFusionOutput>
  >;
  readonly fusedSignal: number;
  readonly uncertainty: FusionUncertainty;
  readonly sourceContributions: readonly SourceContribution[];
  readonly dropoutResults: readonly SourceDropoutResult[];
};

export type AltModalityInput = {
  readonly modality: AltModalityId;
  readonly featureValue: number | null;
  readonly featureUncertainty: number | null;
  readonly evaluatedAt: UtcInstant | null;
  readonly providerId: string | null;
  readonly missingReason: AltMissingReason | null;
  readonly reliability: Omit<ModalityReliability, 'modality' | 'effectiveTrust' | 'degradationNotes'>;
};

export type Alt12FusionRequest = {
  readonly fusionId: string;
  readonly entityId: string;
  readonly asOf: UtcInstant;
  readonly modalityInputs: readonly AltModalityInput[];
  readonly routingContext?: Alt12RoutingContext;
  readonly runDropoutValidation?: boolean;
};

export type Alt12RoutingContext = {
  readonly satelliteCloudObscured?: boolean;
  readonly digitalDemandReliabilityDegraded?: boolean;
  readonly workforceGeographicCoverageLost?: boolean;
};

export function isAltMissingReason(value: string): value is AltMissingReason {
  return (ALT_MISSING_REASONS as readonly string[]).includes(value);
}
