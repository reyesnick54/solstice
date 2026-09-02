import type { UtcInstant } from '../../../domain/src/time.ts';
import type {
  CanonicalEntityId,
  EntityResolutionId,
  KnowledgeAliasId,
  KnowledgeEdgeId,
  KnowledgeNodeId,
  MatchSuggestionId,
} from './ids.ts';
import type { KnowledgeGraphDomain, KnowledgeNodeClass, KnowledgeRelationKind } from './ontology.ts';

export const ENTITY_RESOLUTION_OUTCOMES = [
  'EXACT_MATCH',
  'PROBABLE_MATCH',
  'POSSIBLE_MATCH',
  'NO_MATCH',
  'CONFLICT',
] as const;
export type EntityResolutionOutcome = (typeof ENTITY_RESOLUTION_OUTCOMES)[number];

export const RESOLUTION_METHODS = ['DETERMINISTIC', 'PROBABILISTIC', 'AI_ASSISTED'] as const;
export type ResolutionMethod = (typeof RESOLUTION_METHODS)[number];

export type ExternalIdentifier = {
  readonly system: string;
  readonly id: string;
  readonly authorityClass: 'AUTHORITATIVE' | 'PROVIDER' | 'DERIVED' | 'INFERRED';
};

export type KnowledgeNode = {
  readonly nodeId: KnowledgeNodeId;
  readonly nodeClass: KnowledgeNodeClass;
  readonly domain: KnowledgeGraphDomain;
  readonly canonicalEntityId: CanonicalEntityId | null;
  readonly label: string;
  readonly externalRef: string | null;
  readonly payload: Readonly<Record<string, string>>;
  readonly createdAt: UtcInstant;
  readonly authoritative: false;
  readonly mutatesFinancialState: false;
};

export type KnowledgeEdge = {
  readonly edgeId: KnowledgeEdgeId;
  readonly kind: KnowledgeRelationKind;
  readonly fromNodeId: KnowledgeNodeId;
  readonly toNodeId: KnowledgeNodeId;
  readonly domain: KnowledgeGraphDomain;
  readonly authorized: boolean;
  readonly createdAt: UtcInstant;
  readonly provenanceRef: string;
};

export type EntityAlias = {
  readonly aliasId: KnowledgeAliasId;
  readonly canonicalEntityId: CanonicalEntityId;
  readonly externalIdentifier: ExternalIdentifier;
  readonly preservedOriginalId: string;
  readonly createdAt: UtcInstant;
  readonly mergeStatus: 'ALIAS_ONLY' | 'EXACT_MATCH' | 'GOVERNED_MERGE';
};

export type EntityResolutionRecord = {
  readonly resolutionId: EntityResolutionId;
  readonly inputIdentifiers: readonly ExternalIdentifier[];
  readonly outcome: EntityResolutionOutcome;
  readonly method: ResolutionMethod;
  readonly canonicalEntityId: CanonicalEntityId | null;
  readonly candidateEntityIds: readonly CanonicalEntityId[];
  readonly confidence: number | null;
  readonly createdAt: UtcInstant;
  readonly autoMerged: false;
};

export type MatchSuggestion = {
  readonly suggestionId: MatchSuggestionId;
  readonly leftIdentifier: ExternalIdentifier;
  readonly rightIdentifier: ExternalIdentifier;
  readonly suggestedOutcome: EntityResolutionOutcome;
  readonly method: 'AI_ASSISTED';
  readonly confidence: number;
  readonly highImpact: boolean;
  readonly requiresGovernedReview: boolean;
  readonly createdAt: UtcInstant;
  readonly autoApplied: false;
};

export type EconomicClaimRef = {
  readonly claimId: string;
  readonly claimClass: 'PRODUCTIVE' | 'HUMAN_CONTRIBUTION' | 'CANONICAL';
  readonly fingerprint: string | null;
};

export type ClaimLinkage = {
  readonly claimRef: EconomicClaimRef;
  readonly claimNodeId: KnowledgeNodeId;
  readonly canonicalEventNodeId: KnowledgeNodeId;
  readonly observationNodeIds: readonly KnowledgeNodeId[];
  readonly evidenceNodeIds: readonly KnowledgeNodeId[];
  readonly providerNodeIds: readonly KnowledgeNodeId[];
};

export type KnowledgeGraphSnapshot = {
  readonly nodes: readonly KnowledgeNode[];
  readonly edges: readonly KnowledgeEdge[];
  readonly aliases: readonly EntityAlias[];
  readonly resolutions: readonly EntityResolutionRecord[];
  readonly suggestions: readonly MatchSuggestion[];
  readonly claimLinkages: readonly ClaimLinkage[];
  readonly snapshotHash: string;
};

export type KnowledgeGraphFailure = {
  readonly code:
    | 'PRIVACY_VIOLATION'
    | 'DUPLICATE_NODE'
    | 'DUPLICATE_EDGE'
    | 'UNAUTHORIZED_RELATION'
    | 'AMBIGUOUS_MERGE'
    | 'HIGH_IMPACT_AUTO_MERGE'
    | 'NOT_FOUND'
    | 'INVALID_INPUT';
  readonly message: string;
};
