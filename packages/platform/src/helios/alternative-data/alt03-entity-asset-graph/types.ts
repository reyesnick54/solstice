import type { UtcInstant } from '@solstice/domain';

import type { EconomicKnowledgeCanonicalEntityId } from '../../feature-fabric/entity-resolution/ekg-bridge.ts';
import type { TemporalEntityKind } from '../../feature-fabric/entity-resolution/types.ts';
import type {
  AltAssetEntityKind,
  AltMatchCascadeStage,
  AltObservationMatchState,
  AltObservationSurface,
} from './taxonomy.ts';

export type AltDeterministicIdentifier = {
  readonly system: string;
  readonly id: string;
};

export type AltCrosswalkEntry = {
  readonly providerId: string;
  readonly externalKey: string;
  readonly targetNodeId: string;
  readonly effectiveFrom: UtcInstant;
  readonly effectiveTo: UtcInstant | null;
  readonly knowableAt: UtcInstant;
  readonly sourceRefs: readonly string[];
  readonly confidence: number;
};

export type AltCrosswalkRegistry = {
  readonly lookup: (
    providerId: string,
    externalKey: string,
    asOf: UtcInstant,
    knowableAtCutoff: UtcInstant,
  ) => AltCrosswalkEntry | undefined;
};

export type AltObservationResolutionInput = {
  readonly observationRef: string;
  readonly providerId: string;
  readonly surface: AltObservationSurface;
  readonly rawLabel: string;
  readonly asOf: UtcInstant;
  readonly knowableAtCutoff: UtcInstant;
  readonly deterministicIdentifiers: readonly AltDeterministicIdentifier[];
  readonly normalizedTokens: readonly string[];
  readonly sourceRefs: readonly string[];
};

export type AltMatchCascadeStepEvidence = {
  readonly stage: AltMatchCascadeStage;
  readonly attempted: boolean;
  readonly outcome: AltObservationMatchState | 'SKIPPED' | 'NO_HIT';
  readonly detail: string | null;
  readonly candidateNodeIds: readonly string[];
};

export type AltLlmMatchProposal = {
  readonly proposalId: string;
  readonly observationRef: string;
  readonly proposedNodeId: string;
  readonly rationale: string;
  readonly modelRef: string;
  readonly proposedAt: UtcInstant;
  /** LLM proposals are never silently certified. */
  readonly certified: false;
  readonly reviewerRef: null;
};

export type CertifiedAltMatchProposal = AltLlmMatchProposal & {
  readonly certified: true;
  readonly reviewerRef: string;
  readonly certifiedAt: UtcInstant;
};

export type AltObservationMatchRecord = {
  readonly observationRef: string;
  readonly matchState: AltObservationMatchState;
  readonly resolvedNodeId: string | null;
  readonly resolvedKind: TemporalEntityKind | null;
  readonly investmentIssuerEntityId: EconomicKnowledgeCanonicalEntityId | null;
  readonly cascade: readonly AltMatchCascadeStepEvidence[];
  readonly sourceRefs: readonly string[];
  readonly confidence: number | null;
  readonly llmProposal: AltLlmMatchProposal | CertifiedAltMatchProposal | null;
  readonly grantsExecutionAuthority: false;
};

export type AltAppendAssetRelationInput = {
  readonly relationshipType: import('./taxonomy.ts').AltAssetRelationshipType;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly effectiveFrom: UtcInstant;
  readonly effectiveTo: UtcInstant | null;
  readonly knowableAt: UtcInstant;
  readonly observedAt: UtcInstant;
  readonly sourceRefs: readonly string[];
  readonly confidence: number;
  readonly jurisdiction: string | null;
};

/** Preferred target entity kind per observation surface (blocks naive parent collapse). */
export function preferredTargetKindForSurface(surface: AltObservationSurface): AltAssetEntityKind | null {
  switch (surface) {
    case 'BRAND_MENTION':
    case 'PRODUCT_MENTION':
      return 'BRAND';
    case 'FACILITY_ACTIVITY':
      return 'FACILITY';
    case 'FACTORY_OUTPUT':
      return 'FACTORY';
    case 'WAREHOUSE_THROUGHPUT':
      return 'WAREHOUSE';
    case 'PORT_CALL':
      return 'PORT';
    case 'VESSEL_CARGO':
      return 'VESSEL';
    case 'MINE_PRODUCTION':
      return 'MINE';
    case 'POWER_GENERATION':
      return 'POWER_PLANT';
    case 'DATACENTER_UTILIZATION':
      return 'DATACENTER';
    case 'PATENT_FILING':
      return 'PATENT_ASSIGNEE';
    case 'GOVERNMENT_CONTRACT':
      return 'GOVERNMENT_CONTRACTOR';
    case 'JOB_POSTING':
    case 'WEBSITE_SIGNAL':
      return null;
    default: {
      const _exhaustive: never = surface;
      return _exhaustive;
    }
  }
}
