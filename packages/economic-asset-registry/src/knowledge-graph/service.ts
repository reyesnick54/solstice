import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import { AliasRegistry } from './alias-registry.ts';
import { buildClaimLinkageBundle, linkDuplicateEvents, type ClaimLinkageInput } from './claim-linkage.ts';
import { runEntityResolutionPipeline } from './entity-resolution/pipeline.ts';
import { applyAiSuggestion, createAiMatchSuggestion } from './entity-resolution/probabilistic.ts';
import type { DeterministicResolutionInput } from './entity-resolution/deterministic.ts';
import { canonicalEntityIdFor, knowledgeEdgeIdFor, knowledgeNodeIdFor } from './ids.ts';
import type { KnowledgeNodeId } from './ids.ts';
import { AUTHORIZATION_GATED_RELATIONS } from './ontology.ts';
import { assertHumanNodePrivacy } from './privacy.ts';
import {
  buildProductiveAssetNode,
  buildProductiveEventNode,
  buildProductiveRelationshipEdge,
  PRODUCTIVE_SCENARIO_FIXTURES,
} from './productive-relationships.ts';
import { AdjacencyTableGraphRepository, type GraphRepositoryPort } from './repository/adjacency.ts';
import { AGE_EVALUATION } from './repository/age-evaluation.ts';
import type {
  ClaimLinkage,
  EconomicClaimRef,
  EntityResolutionRecord,
  ExternalIdentifier,
  KnowledgeEdge,
  KnowledgeGraphFailure,
  KnowledgeGraphSnapshot,
  KnowledgeNode,
  MatchSuggestion,
} from './types.ts';

function failure(code: KnowledgeGraphFailure['code'], message: string): KnowledgeGraphFailure {
  return Object.freeze({ code, message });
}

export type EconomicKnowledgeGraphServiceOptions = {
  readonly repository?: GraphRepositoryPort;
  readonly aliasRegistry?: AliasRegistry;
  readonly nowUtc?: UtcInstant;
};

export class EconomicKnowledgeGraphService {
  readonly #repo: GraphRepositoryPort;
  readonly #aliases: AliasRegistry;
  readonly #defaultNow: UtcInstant | undefined;

  constructor(options?: EconomicKnowledgeGraphServiceOptions) {
    this.#repo = options?.repository ?? new AdjacencyTableGraphRepository();
    this.#aliases = options?.aliasRegistry ?? new AliasRegistry();
    this.#defaultNow = options?.nowUtc;
  }

  get storageBackend(): string {
    return AGE_EVALUATION.activeBackend;
  }

  registerNode(input: {
    nodeClass: KnowledgeNode['nodeClass'];
    domain: KnowledgeNode['domain'];
    label: string;
    externalRef: string | null;
    payload?: Readonly<Record<string, string>>;
    canonicalEntityId?: string | null;
    createdAt?: UtcInstant;
  }): Result<KnowledgeNode, KnowledgeGraphFailure> {
    const payload = input.payload ?? Object.freeze({});
    const violations = assertHumanNodePrivacy(input.nodeClass, input.domain, input.externalRef, payload);
    if (violations.length > 0) {
      return err(failure('PRIVACY_VIOLATION', violations.map((v) => v.message).join('; ')));
    }
    const createdAt = input.createdAt ?? this.#defaultNow ?? ('1970-01-01T00:00:00.000Z' as UtcInstant);
    const material = `${input.nodeClass}:${input.domain}:${input.label}:${input.externalRef ?? ''}`;
    const node: KnowledgeNode = Object.freeze({
      nodeId: knowledgeNodeIdFor(material),
      nodeClass: input.nodeClass,
      domain: input.domain,
      canonicalEntityId: input.canonicalEntityId ? canonicalEntityIdFor(input.canonicalEntityId) : null,
      label: input.label,
      externalRef: input.externalRef,
      payload: Object.freeze({ ...payload }),
      createdAt,
      authoritative: false,
      mutatesFinancialState: false,
    });
    if (this.#repo.getNode(node.nodeId)) {
      return err(failure('DUPLICATE_NODE', `node already exists: ${node.nodeId}`));
    }
    this.#repo.upsertNode(node);
    return ok(node);
  }

  registerEdge(input: {
    kind: KnowledgeEdge['kind'];
    fromNodeId: KnowledgeNodeId;
    toNodeId: KnowledgeNodeId;
    domain: KnowledgeEdge['domain'];
    authorized?: boolean;
    provenanceRef: string;
    createdAt?: UtcInstant;
  }): Result<KnowledgeEdge, KnowledgeGraphFailure> {
    if (AUTHORIZATION_GATED_RELATIONS.has(input.kind) && !input.authorized) {
      return err(failure('UNAUTHORIZED_RELATION', `${input.kind} requires explicit authorization`));
    }
    const createdAt = input.createdAt ?? this.#defaultNow ?? ('1970-01-01T00:00:00.000Z' as UtcInstant);
    const edge: KnowledgeEdge = Object.freeze({
      edgeId: knowledgeEdgeIdFor(`${input.kind}:${input.fromNodeId}:${input.toNodeId}`),
      kind: input.kind,
      fromNodeId: input.fromNodeId,
      toNodeId: input.toNodeId,
      domain: input.domain,
      authorized: input.authorized ?? !AUTHORIZATION_GATED_RELATIONS.has(input.kind),
      createdAt,
      provenanceRef: input.provenanceRef,
    });
    this.#repo.upsertEdge(edge);
    return ok(edge);
  }

  resolveEntities(
    input: DeterministicResolutionInput,
    probabilisticCandidates?: readonly ExternalIdentifier[],
  ): EntityResolutionRecord {
    const pipeline = runEntityResolutionPipeline(input, this.#aliases, probabilisticCandidates);
    const repo = this.#repo as AdjacencyTableGraphRepository;
    repo.registerResolution(pipeline.deterministic);
    for (const suggestion of pipeline.suggestions) {
      repo.registerSuggestion(suggestion);
    }
    return pipeline.deterministic;
  }

  registerAlias(input: {
    canonicalEntityId: string;
    externalIdentifier: ExternalIdentifier;
    preservedOriginalId: string;
    createdAt?: UtcInstant;
  }): void {
    const createdAt = input.createdAt ?? this.#defaultNow ?? ('1970-01-01T00:00:00.000Z' as UtcInstant);
    const alias = this.#aliases.registerAlias({
      canonicalEntityId: canonicalEntityIdFor(input.canonicalEntityId),
      externalIdentifier: input.externalIdentifier,
      preservedOriginalId: input.preservedOriginalId,
      createdAt,
    });
    const repo = this.#repo as AdjacencyTableGraphRepository;
    repo.registerAlias(alias);
  }

  suggestAiMatch(input: {
    left: ExternalIdentifier;
    right: ExternalIdentifier;
    aiConfidence: number;
    createdAt?: UtcInstant;
  }): MatchSuggestion {
    const createdAt = input.createdAt ?? this.#defaultNow ?? ('1970-01-01T00:00:00.000Z' as UtcInstant);
    const suggestion = createAiMatchSuggestion({
      left: input.left,
      right: input.right,
      aiConfidence: input.aiConfidence,
      createdAt,
    });
    const repo = this.#repo as AdjacencyTableGraphRepository;
    repo.registerSuggestion(suggestion);
    return suggestion;
  }

  tryApplyAiSuggestion(suggestion: MatchSuggestion): Result<never, KnowledgeGraphFailure> {
    const result = applyAiSuggestion(suggestion);
    if (!result.applied) {
      if (suggestion.highImpact) {
        return err(failure('HIGH_IMPACT_AUTO_MERGE', result.reason));
      }
      return err(failure('AMBIGUOUS_MERGE', result.reason));
    }
    return err(failure('INVALID_INPUT', 'auto-apply path is disabled for knowledge graph merges'));
  }

  linkClaim(input: ClaimLinkageInput): ClaimLinkage {
    const bundle = buildClaimLinkageBundle(input);
    this.#repo.upsertNode(bundle.claimNode);
    this.#repo.upsertNode(bundle.eventNode);
    for (const node of bundle.observationNodes) {
      this.#repo.upsertNode(node);
    }
    for (const node of bundle.evidenceNodes) {
      this.#repo.upsertNode(node);
    }
    for (const node of bundle.providerNodes) {
      this.#repo.upsertNode(node);
    }
    for (const edge of bundle.edges) {
      this.#repo.upsertEdge(edge);
    }
    const repo = this.#repo as AdjacencyTableGraphRepository;
    repo.registerClaimLinkage(bundle.linkage);
    return bundle.linkage;
  }

  linkDuplicateEvents(primaryEventNodeId: KnowledgeNodeId, duplicateEventNodeId: KnowledgeNodeId, provenanceRef: string): void {
    const createdAt = this.#defaultNow ?? ('1970-01-01T00:00:00.000Z' as UtcInstant);
    const edge = linkDuplicateEvents(primaryEventNodeId, duplicateEventNodeId, createdAt, provenanceRef);
    this.#repo.upsertEdge(edge);
  }

  seedProductiveScenarioFixtures(createdAt?: UtcInstant): readonly KnowledgeNodeId[] {
    const at = createdAt ?? this.#defaultNow ?? ('1970-01-01T00:00:00.000Z' as UtcInstant);
    const eventNodeIds: KnowledgeNodeId[] = [];
    for (const scenario of PRODUCTIVE_SCENARIO_FIXTURES) {
      const asset = buildProductiveAssetNode({
        assetLabel: scenario.assetLabel,
        assetClass: scenario.assetClass,
        externalRef: `productive:${scenario.eventKind}:${scenario.assetLabel}`,
        createdAt: at,
      });
      const event = buildProductiveEventNode({
        eventLabel: scenario.eventLabel,
        eventKind: scenario.eventKind,
        providerRef: `provider:${scenario.eventKind}`,
        createdAt: at,
      });
      const edge = buildProductiveRelationshipEdge({
        assetNodeId: asset.nodeId,
        eventNodeId: event.nodeId,
        relation: scenario.relation,
        provenanceRef: 'wave4-productive-fixture',
        createdAt: at,
      });
      this.#repo.upsertNode(asset);
      this.#repo.upsertNode(event);
      this.#repo.upsertEdge(edge);
      eventNodeIds.push(event.nodeId);
    }
    return Object.freeze(eventNodeIds);
  }

  registerPseudonymousContribution(input: {
    pseudonymRef: string;
    contributionRef: string;
    contributionClass: string;
    createdAt?: UtcInstant;
  }): Result<KnowledgeNode, KnowledgeGraphFailure> {
    const createdAt = input.createdAt ?? this.#defaultNow ?? ('1970-01-01T00:00:00.000Z' as UtcInstant);
    const person = this.registerNode({
      nodeClass: 'PSEUDONYMOUS_PERSON',
      domain: 'HUMAN_ECONOMY',
      label: input.pseudonymRef,
      externalRef: input.pseudonymRef,
      payload: Object.freeze({ role: 'contributor' }),
      createdAt,
    });
    if (!person.ok) {
      return person;
    }
    const contribution = this.registerNode({
      nodeClass: 'VERIFIED_FACT',
      domain: 'HUMAN_ECONOMY',
      label: input.contributionRef,
      externalRef: input.contributionRef,
      payload: Object.freeze({
        contributionClass: input.contributionClass,
        contributionRef: input.contributionRef,
      }),
      createdAt,
    });
    if (!contribution.ok) {
      return contribution;
    }
    this.registerEdge({
      kind: 'CONTRIBUTED',
      fromNodeId: person.value.nodeId,
      toNodeId: contribution.value.nodeId,
      domain: 'HUMAN_ECONOMY',
      provenanceRef: 'human-contribution-link',
      createdAt,
    });
    return contribution;
  }

  snapshot(): KnowledgeGraphSnapshot {
    const base = this.#repo.snapshot();
    return Object.freeze({
      ...base,
      aliases: Object.freeze([...this.#aliases.snapshot()]),
    });
  }

  restore(snapshot: KnowledgeGraphSnapshot): void {
    this.#repo.restore(snapshot);
    this.#aliases.restore(snapshot.aliases);
  }

  repository(): GraphRepositoryPort {
    return this.#repo;
  }

  aliasRegistry(): AliasRegistry {
    return this.#aliases;
  }
}

export type { EconomicClaimRef, ClaimLinkage, KnowledgeGraphSnapshot };
