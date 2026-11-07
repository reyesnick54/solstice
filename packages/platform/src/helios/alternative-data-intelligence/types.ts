import type { UtcInstant } from '@solstice/domain';

import type { AafCertifiedAltFeatureId, AlternativeDataSkepticAttackVector } from './taxonomy.ts';

export type AafQualificationLabel = 'CERTIFIED' | 'BLOCKED' | 'DEGRADED' | 'RESEARCH_ONLY';

export type SignalFamilyState = {
  readonly familyId: string;
  readonly modality: string;
  readonly stateLabel: string;
  readonly uncertaintyBps: number;
  readonly coverageFractionBps: number;
  readonly knowableAt: UtcInstant;
  readonly blocked: boolean;
  readonly blockReason: string | null;
};

export type IncrementalInformationAssessment = {
  readonly inSampleLiftBps: number;
  readonly holdoutLiftBps: number;
  readonly incrementalOnHoldout: boolean;
  readonly rejectedForOverfit: boolean;
};

export type SourceContribution = {
  readonly providerId: string;
  readonly modality: string;
  readonly weightBps: number;
  readonly reliabilityBps: number;
  readonly licensed: boolean;
};

export type ContradictingSignal = {
  readonly signalId: string;
  readonly familyId: string;
  readonly summary: string;
  readonly severity: 'LOW' | 'MEDIUM' | 'HIGH';
};

export type SkepticFinding = {
  readonly vector: AlternativeDataSkepticAttackVector;
  readonly passed: boolean;
  readonly detail: string;
};

export type AltStrategyGenomeFeatureRow = {
  readonly featureId: AafCertifiedAltFeatureId;
  readonly stateLabel: string;
  readonly uncertaintyBps: number;
  readonly knowableAt: UtcInstant;
  readonly aafCertified: boolean;
  readonly rawProviderRecordExposed: false;
};

export type AlternativeDataResearchState = {
  readonly schema: 'sunrey.helios.alternative-data-research-state.v1';
  readonly entityId: string;
  readonly decisionTime: UtcInstant;
  readonly signalFamilyStates: readonly SignalFamilyState[];
  readonly incrementalInformation: IncrementalInformationAssessment;
  readonly signalUncertainty: number;
  readonly coverage: number;
  readonly providerReliability: number;
  readonly entityResolutionQuality: number;
  readonly AAFQualification: AafQualificationLabel;
  readonly evidenceRefs: readonly string[];
  readonly sourceContributions: readonly SourceContribution[];
  readonly contradictingSignals: readonly ContradictingSignal[];
  readonly confidence: number;
  readonly skepticFindings: readonly SkepticFinding[];
  readonly researchEvidenceOnly: true;
  readonly grantsExecutionAuthority: false;
};

export type AltResearchBuildInput = {
  readonly entityId: string;
  readonly decisionTime: UtcInstant;
  readonly entityResolutionQuality: number;
  readonly signalFamilies: readonly SignalFamilyState[];
  readonly sources: readonly SourceContribution[];
  readonly contradictions: readonly ContradictingSignal[];
  readonly skepticFindings: readonly SkepticFinding[];
  readonly incremental: IncrementalInformationAssessment;
  readonly evidenceRefs: readonly string[];
};
