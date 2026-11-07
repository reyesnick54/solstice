import type { UtcInstant } from '../imports.ts';
import type { EvidenceReference } from '../research-mesh/types.ts';

export const ALTERNATIVE_DATA_ALT14_SCHEMA = 'sunrey.helios.alt14.alternative-data-research.v1' as const;

export const ALTERNATIVE_DATA_ALT14_ROLES = Object.freeze([
  'WORKFORCE_INTELLIGENCE',
  'DIGITAL_DEMAND',
  'PRODUCT_DEMAND',
  'LOGISTICS',
  'GEOSPATIAL',
  'INNOVATION',
  'PROCUREMENT',
  'SUPPLY_CHAIN',
  'ALTERNATIVE_DATA_SKEPTIC',
  'ALTERNATIVE_DATA_SYNTHESIS',
] as const);

export type AlternativeDataAlt14Role = (typeof ALTERNATIVE_DATA_ALT14_ROLES)[number];

export const ALTERNATIVE_DATA_ALT14_PHASES = Object.freeze([
  'LABOR_AND_DIGITAL',
  'PRODUCT_AND_PRICING',
  'PHYSICAL_AND_LOGISTICS',
  'INNOVATION_AND_SUPPLY',
  'ADVERSARIAL_REVIEW',
  'SYNTHESIS',
] as const);

export type AlternativeDataAlt14Phase = (typeof ALTERNATIVE_DATA_ALT14_PHASES)[number];

export const SKEPTIC_ALT14_CHECKLIST = Object.freeze([
  'entity mismatch',
  'selection bias',
  'coverage bias',
  'provider revision',
  'staleness',
  'licensing',
  'duplicate observations',
  'proxy instability',
  'regime shift',
  'missing modalities',
  'spurious correlation',
] as const);

export type Alt14SpecialistExtraction = {
  readonly familyId: string;
  readonly modality: string;
  readonly stateLabel: string;
  readonly uncertaintyBps: number;
  readonly coverageFractionBps: number;
  readonly notes: readonly string[];
};

export type AlternativeDataAlt14Artifact = {
  readonly artifactId: string;
  readonly role: AlternativeDataAlt14Role;
  readonly workOrderId: string;
  readonly subjectId: string;
  readonly informationTime: UtcInstant;
  readonly thesis: string;
  readonly evidence: readonly EvidenceReference[];
  readonly extraction: Alt14SpecialistExtraction | null;
  readonly skepticChecklist?: readonly string[];
  readonly simulationOnly: true;
};

export type AlternativeDataAlt14Request = {
  readonly workOrderId: string;
  readonly subjectId: string;
  readonly entityId: string;
  readonly objective: string;
  readonly contextRef?: string;
  readonly evidenceBundle?: readonly EvidenceReference[];
  readonly roles?: readonly AlternativeDataAlt14Role[];
};

export type AlternativeDataResearchThesis = {
  readonly thesisId: string;
  readonly workOrderId: string;
  readonly subjectId: string;
  readonly entityId: string;
  readonly informationTime: UtcInstant;
  readonly summary: string;
  readonly researchEvidenceOnly: true;
  readonly specialistCount: number;
};

export type AlternativeDataAlt14MeshRun = {
  readonly schema: typeof ALTERNATIVE_DATA_ALT14_SCHEMA;
  readonly runId: string;
  readonly workOrderId: string;
  readonly subjectId: string;
  readonly entityId: string;
  readonly informationTime: UtcInstant;
  readonly artifacts: readonly AlternativeDataAlt14Artifact[];
  readonly thesis: AlternativeDataResearchThesis;
  readonly simulationOnly: true;
};

export type AlternativeDataAlt14MeshFailure = {
  readonly code: 'VALIDATION_FAILED' | 'LANGUAGE_GUARD_VIOLATION' | 'DATA_UNAVAILABLE';
  readonly message: string;
};
