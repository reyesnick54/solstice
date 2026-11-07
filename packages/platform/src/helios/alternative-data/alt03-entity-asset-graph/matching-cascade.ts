import type { UtcInstant } from '@solstice/domain';

import type { TemporalEntityGraphStore } from '../../feature-fabric/entity-resolution/graph-store.ts';
import { heliosIssuerCanonicalEntityId } from '../../feature-fabric/entity-resolution/ekg-bridge.ts';
import { mappingActive } from '../../feature-fabric/entity-resolution/temporal.ts';
import type { TemporalEntityNode } from '../../feature-fabric/entity-resolution/types.ts';
import { normalizeAltLabel, normalizeIdentifierToken } from './normalize.ts';
import type {
  AltCrosswalkRegistry,
  AltLlmMatchProposal,
  AltMatchCascadeStepEvidence,
  AltObservationMatchRecord,
  AltObservationResolutionInput,
} from './types.ts';
import { preferredTargetKindForSurface } from './types.ts';
import type { AltObservationMatchState } from './taxonomy.ts';

export type AltMatchingCascadeOptions = {
  readonly graph: TemporalEntityGraphStore;
  readonly crosswalk?: AltCrosswalkRegistry;
  readonly llmProposals?: readonly AltLlmMatchProposal[];
};

const DETERMINISTIC_PAYLOAD_KEYS: Readonly<Record<string, string>> = Object.freeze({
  cik: 'cik',
  lei: 'lei',
  isin: 'isin',
  imo: 'imo',
  mmsi: 'mmsi',
  uspto_assignee: 'usptoAssigneeId',
  sam_uei: 'samUei',
  duns: 'duns',
  facility_epa: 'epaFacilityId',
});

function step(
  stage: AltMatchCascadeStepEvidence['stage'],
  attempted: boolean,
  outcome: AltMatchCascadeStepEvidence['outcome'],
  candidateNodeIds: readonly string[],
  detail: string | null,
): AltMatchCascadeStepEvidence {
  return Object.freeze({ stage, attempted, outcome, detail, candidateNodeIds, });
}

function isExpired(node: TemporalEntityNode, asOf: UtcInstant): boolean {
  const delisted = node.payload.delistedAsOf;
  if (!delisted) return false;
  return Date.parse(asOf) >= Date.parse(delisted);
}

function kindMatchesPreferred(node: TemporalEntityNode, preferred: string | null): boolean {
  if (!preferred) return true;
  return node.kind === preferred;
}

function collectDeterministicHits(
  store: TemporalEntityGraphStore,
  identifiers: AltObservationResolutionInput['deterministicIdentifiers'],
): TemporalEntityNode[] {
  const hits: TemporalEntityNode[] = [];
  for (const ident of identifiers) {
    const payloadKey = DETERMINISTIC_PAYLOAD_KEYS[ident.system.toLowerCase()];
    if (!payloadKey) continue;
    for (const node of store.listNodes()) {
      if (node.payload[payloadKey] === ident.id || node.payload[ident.system] === ident.id) {
        hits.push(node);
      }
    }
  }
  return hits;
}

function collectCrosswalkHit(
  store: TemporalEntityGraphStore,
  crosswalk: AltCrosswalkRegistry | undefined,
  input: AltObservationResolutionInput,
): TemporalEntityNode | undefined {
  if (!crosswalk) return undefined;
  const keys = [
    ...input.deterministicIdentifiers.map((d) => normalizeIdentifierToken(d.system, d.id)),
    ...input.normalizedTokens.map((token) => token.trim().toLowerCase()),
    normalizeAltLabel(input.rawLabel),
  ];
  for (const key of keys) {
    const hit = crosswalk.lookup(input.providerId, key, input.asOf, input.knowableAtCutoff);
    if (hit) {
      return store.getNode(hit.targetNodeId);
    }
  }
  return undefined;
}

function collectExactNormalizedHits(
  store: TemporalEntityGraphStore,
  tokens: readonly string[],
): TemporalEntityNode[] {
  const normalized = new Set(tokens.map(normalizeAltLabel));
  const hits: TemporalEntityNode[] = [];
  for (const node of store.listNodes()) {
    const nodeToken = node.payload.normalizedId ?? normalizeAltLabel(node.displayName);
    if (normalized.has(nodeToken)) {
      hits.push(node);
    }
  }
  return hits;
}

function scoreProbabilistic(
  node: TemporalEntityNode,
  input: AltObservationResolutionInput,
): number {
  const label = normalizeAltLabel(input.rawLabel);
  const nodeLabel = node.payload.normalizedId ?? normalizeAltLabel(node.displayName);
  if (label === nodeLabel) return 0.92;
  if (nodeLabel.includes(label) || label.includes(nodeLabel)) return 0.78;
  return 0.4;
}

function findCertifiedLlmHit(
  proposals: readonly AltLlmMatchProposal[] | undefined,
  observationRef: string,
  store: TemporalEntityGraphStore,
): TemporalEntityNode | undefined {
  if (!proposals) return undefined;
  const certified = proposals.find(
    (p) => p.observationRef === observationRef && p.certified === true,
  ) as (AltLlmMatchProposal & { certified: true }) | undefined;
  if (!certified) return undefined;
  return store.getNode(certified.proposedNodeId);
}

function findLlmCandidate(
  proposals: readonly AltLlmMatchProposal[] | undefined,
  observationRef: string,
): AltLlmMatchProposal | null {
  if (!proposals) return null;
  const open = proposals.find((p) => p.observationRef === observationRef && p.certified === false);
  return open ?? null;
}

function resolveInvestmentIssuer(
  store: TemporalEntityGraphStore,
  node: TemporalEntityNode,
  asOf: UtcInstant,
  knowableAtCutoff: UtcInstant,
): string | null {
  if (node.economicKnowledgeEntityId) {
    return node.economicKnowledgeEntityId;
  }
  const edges = store.listEdges().filter((e) => mappingActive(e, asOf, knowableAtCutoff));
  for (const edge of edges) {
    if (edge.toNodeId !== node.nodeId) continue;
    if (
      edge.relationshipType === 'BRAND_OF' ||
      edge.relationshipType === 'OPERATES' ||
      edge.relationshipType === 'SUBSIDIARY_OF' ||
      edge.relationshipType === 'OWNED_BY'
    ) {
      const parent = store.getNode(edge.fromNodeId);
      if (parent?.economicKnowledgeEntityId) {
        return parent.economicKnowledgeEntityId;
      }
      if (parent?.kind === 'PUBLIC_COMPANY' || parent?.kind === 'ISSUER' || parent?.kind === 'LEGAL_ENTITY') {
        return parent.economicKnowledgeEntityId ?? heliosIssuerCanonicalEntityId(normalizeAltLabel(parent.displayName));
      }
    }
  }
  if (node.kind === 'PUBLIC_COMPANY' || node.kind === 'PRIVATE_COMPANY') {
    return heliosIssuerCanonicalEntityId(normalizeAltLabel(node.displayName));
  }
  return null;
}

function finalizeRecord(
  input: AltObservationResolutionInput,
  matchState: AltObservationMatchState,
  node: TemporalEntityNode | null,
  cascade: AltMatchCascadeStepEvidence[],
  confidence: number | null,
  llmProposal: AltLlmMatchProposal | null,
  store: TemporalEntityGraphStore,
): AltObservationMatchRecord {
  const preferred = preferredTargetKindForSurface(input.surface);
  if (node && preferred && node.kind !== preferred) {
    const preferredKind = preferred as TemporalEntityNode['kind'];
    if (node.kind === 'PUBLIC_COMPANY' || node.kind === 'LEGAL_ENTITY' || node.kind === 'ISSUER') {
      return Object.freeze({
        observationRef: input.observationRef,
        matchState: 'AMBIGUOUS',
        resolvedNodeId: node.nodeId,
        resolvedKind: node.kind,
        investmentIssuerEntityId: null,
        cascade: Object.freeze(cascade),
        sourceRefs: Object.freeze([...input.sourceRefs]),
        confidence,
        llmProposal,
        grantsExecutionAuthority: false,
      });
    }
    if (node.kind !== preferredKind) {
      return Object.freeze({
        observationRef: input.observationRef,
        matchState: 'AMBIGUOUS',
        resolvedNodeId: node.nodeId,
        resolvedKind: node.kind,
        investmentIssuerEntityId: null,
        cascade: Object.freeze([
          ...cascade,
          step(
            'EXACT_NORMALIZED_IDENTIFIER',
            true,
            'AMBIGUOUS',
            [node.nodeId],
            `surface ${input.surface} requires kind ${preferredKind}, got ${node.kind}`,
          ),
        ]),
        sourceRefs: Object.freeze([...input.sourceRefs]),
        confidence,
        llmProposal,
        grantsExecutionAuthority: false,
      });
    }
  }

  return Object.freeze({
    observationRef: input.observationRef,
    matchState,
    resolvedNodeId: node?.nodeId ?? null,
    resolvedKind: node?.kind ?? null,
    investmentIssuerEntityId: node
      ? (resolveInvestmentIssuer(store, node, input.asOf, input.knowableAtCutoff) as AltObservationMatchRecord['investmentIssuerEntityId'])
      : null,
    cascade: Object.freeze(cascade),
    sourceRefs: Object.freeze([...input.sourceRefs]),
    confidence,
    llmProposal,
    grantsExecutionAuthority: false,
  });
}

export function runAltObservationMatchingCascade(
  options: AltMatchingCascadeOptions,
  input: AltObservationResolutionInput,
): AltObservationMatchRecord {
  const store = options.graph;
  const cascade: AltMatchCascadeStepEvidence[] = [];
  const preferred = preferredTargetKindForSurface(input.surface);

  // 1 — deterministic identifiers
  const deterministicHits = collectDeterministicHits(store, input.deterministicIdentifiers).filter(
    (n) => !isExpired(n, input.asOf) && kindMatchesPreferred(n, preferred),
  );
  cascade.push(
    step(
      'DETERMINISTIC_IDENTIFIER',
      true,
      deterministicHits.length === 1 ? 'EXACT' : deterministicHits.length > 1 ? 'CONFLICTING' : 'NO_HIT',
      deterministicHits.map((n) => n.nodeId),
      deterministicHits.length > 1 ? 'multiple deterministic identifier hits' : null,
    ),
  );
  if (deterministicHits.length === 1) {
    return finalizeRecord(input, 'EXACT', deterministicHits[0]!, cascade, 1, null, store);
  }
  if (deterministicHits.length > 1) {
    return finalizeRecord(input, 'CONFLICTING', null, cascade, null, null, store);
  }

  // 2 — curated crosswalk
  const crosswalkHit = collectCrosswalkHit(store, options.crosswalk, input);
  cascade.push(
    step(
      'CURATED_CROSSWALK',
      Boolean(options.crosswalk),
      crosswalkHit ? 'HIGH_CONFIDENCE' : options.crosswalk ? 'NO_HIT' : 'SKIPPED',
      crosswalkHit ? [crosswalkHit.nodeId] : [],
      null,
    ),
  );
  if (crosswalkHit) {
    return finalizeRecord(input, 'HIGH_CONFIDENCE', crosswalkHit, cascade, 0.9, null, store);
  }

  // 3 — exact normalized identifiers
  const exactHits = collectExactNormalizedHits(store, [
    input.rawLabel,
    ...input.normalizedTokens,
  ]).filter((n) => !isExpired(n, input.asOf) && kindMatchesPreferred(n, preferred));
  cascade.push(
    step(
      'EXACT_NORMALIZED_IDENTIFIER',
      true,
      exactHits.length === 1 ? 'EXACT' : exactHits.length > 1 ? 'AMBIGUOUS' : 'NO_HIT',
      exactHits.map((n) => n.nodeId),
      null,
    ),
  );
  if (exactHits.length === 1) {
    return finalizeRecord(input, 'EXACT', exactHits[0]!, cascade, 0.98, null, store);
  }
  if (exactHits.length > 1) {
    return finalizeRecord(input, 'AMBIGUOUS', null, cascade, null, null, store);
  }

  // 4 — probabilistic match
  const scored = store
    .listNodes()
    .map((node) => ({ node, score: scoreProbabilistic(node, input) }))
    .filter((row) => row.score >= 0.75 && kindMatchesPreferred(row.node, preferred))
    .sort((a, b) => b.score - a.score);
  const top = scored[0];
  const second = scored[1];
  const probabilisticAmbiguous = Boolean(top && second && second.score >= top.score - 0.05);
  cascade.push(
    step(
      'PROBABILISTIC_MATCH',
      true,
      top && !probabilisticAmbiguous ? 'HIGH_CONFIDENCE' : top ? 'AMBIGUOUS' : 'NO_HIT',
      scored.map((s) => s.node.nodeId),
      probabilisticAmbiguous ? 'probabilistic tie band' : null,
    ),
  );
  if (top && !probabilisticAmbiguous) {
    return finalizeRecord(input, 'HIGH_CONFIDENCE', top.node, cascade, top.score, null, store);
  }
  if (probabilisticAmbiguous) {
    return finalizeRecord(input, 'AMBIGUOUS', null, cascade, null, null, store);
  }

  // 5 — LLM-assisted candidate review (propose only; certification required)
  const certified = findCertifiedLlmHit(options.llmProposals, input.observationRef, store);
  const openProposal = findLlmCandidate(options.llmProposals, input.observationRef);
  cascade.push(
    step(
      'LLM_ASSISTED_CANDIDATE',
      Boolean(options.llmProposals?.length),
      certified ? 'HIGH_CONFIDENCE' : openProposal ? 'AMBIGUOUS' : options.llmProposals?.length ? 'UNRESOLVED' : 'SKIPPED',
      certified ? [certified.nodeId] : openProposal ? [openProposal.proposedNodeId] : [],
      openProposal && !certified ? 'LLM proposal awaits human certification' : null,
    ),
  );
  if (certified) {
    return finalizeRecord(input, 'HIGH_CONFIDENCE', certified, cascade, 0.85, openProposal, store);
  }
  if (openProposal) {
    const proposed = store.getNode(openProposal.proposedNodeId);
    return finalizeRecord(input, 'AMBIGUOUS', proposed ?? null, cascade, null, openProposal, store);
  }

  const expiredCandidates = collectExactNormalizedHits(store, [input.rawLabel]).filter((n) =>
    isExpired(n, input.asOf),
  );
  if (expiredCandidates.length > 0) {
    cascade.push(
      step('EXACT_NORMALIZED_IDENTIFIER', true, 'EXPIRED', expiredCandidates.map((n) => n.nodeId), 'mapping expired'),
    );
    return finalizeRecord(input, 'EXPIRED', null, cascade, null, null, store);
  }

  return finalizeRecord(input, 'UNRESOLVED', null, cascade, null, null, store);
}
