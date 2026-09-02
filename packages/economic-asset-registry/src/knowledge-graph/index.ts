export {
  ECONOMIC_KNOWLEDGE_GRAPH_ONTOLOGY_ID,
  ECONOMIC_KNOWLEDGE_GRAPH_ONTOLOGY_VERSION,
  KNOWLEDGE_NODE_CLASSES,
  KNOWLEDGE_RELATION_KINDS,
  KNOWLEDGE_GRAPH_DOMAINS,
  PSEUDONYMOUS_NODE_CLASSES,
  AUTHORIZATION_GATED_RELATIONS,
  PRODUCTIVE_EVENT_TEMPLATES,
  HUMAN_EVENT_TEMPLATES,
  isKnowledgeNodeClass,
  isKnowledgeRelationKind,
  type KnowledgeNodeClass,
  type KnowledgeRelationKind,
  type KnowledgeGraphDomain,
} from './ontology.ts';
export {
  KNOWLEDGE_ID_PREFIXES,
  knowledgeNodeIdFor,
  knowledgeEdgeIdFor,
  knowledgeAliasIdFor,
  canonicalEntityIdFor,
  entityResolutionIdFor,
  matchSuggestionIdFor,
  asKnowledgeNodeId,
  asCanonicalEntityId,
  type KnowledgeNodeId,
  type KnowledgeEdgeId,
  type KnowledgeAliasId,
  type CanonicalEntityId,
  type EntityResolutionId,
  type MatchSuggestionId,
} from './ids.ts';
export {
  FORBIDDEN_HUMAN_PAYLOAD_KEYS,
  assertHumanNodePrivacy,
  isPseudonymousReference,
  scanForbiddenHumanPayload,
  type HumanPrivacyViolation,
} from './privacy.ts';
export {
  ENTITY_RESOLUTION_OUTCOMES,
  RESOLUTION_METHODS,
  type EntityResolutionOutcome,
  type ResolutionMethod,
  type ExternalIdentifier,
  type KnowledgeNode,
  type KnowledgeEdge,
  type EntityAlias,
  type EntityResolutionRecord,
  type MatchSuggestion,
  type EconomicClaimRef,
  type ClaimLinkage,
  type KnowledgeGraphSnapshot,
  type KnowledgeGraphFailure,
} from './types.ts';
export { AliasRegistry, aliasRegistryDigest } from './alias-registry.ts';
export {
  resolveDeterministic,
  scoreProbableMatch,
  probabilisticOutcome,
  isHighImpactIdentifier,
  createAiMatchSuggestion,
  canAutoApplySuggestion,
  applyAiSuggestion,
  runEntityResolutionPipeline,
  type DeterministicResolutionInput,
  type AiMatchSuggestionInput,
  type EntityResolutionPipelineResult,
} from './entity-resolution/index.ts';
export {
  buildProductiveAssetNode,
  buildProductiveEventNode,
  buildProductiveRelationshipEdge,
  PRODUCTIVE_SCENARIO_FIXTURES,
  type ProductiveRelationshipInput,
} from './productive-relationships.ts';
export { buildClaimLinkageBundle, linkDuplicateEvents, type ClaimLinkageInput } from './claim-linkage.ts';
export {
  observationsOfEvent,
  providersSupportingClaim,
  eventsForProductiveAsset,
  evidenceForPseudonymousContribution,
  derivedSourcesBehindDataset,
  type GraphQueryResult,
} from './query.ts';
export {
  AdjacencyTableGraphRepository,
  type GraphRepositoryPort,
  type AdjacencyGraphState,
} from './repository/adjacency.ts';
export { AGE_EVALUATION, AgeGraphRepositoryAdapter, evaluateApacheAgeAvailability, type AgeCompatibilityReport } from './repository/age-evaluation.ts';
export { EconomicKnowledgeGraphService, type EconomicKnowledgeGraphServiceOptions } from './service.ts';
