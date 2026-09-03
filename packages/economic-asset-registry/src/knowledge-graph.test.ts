import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../../domain/src/time.ts';
import {
  AGE_EVALUATION,
  AdjacencyTableGraphRepository,
  EconomicKnowledgeGraphService,
  applyAiSuggestion,
  buildProductiveAssetNode,
  createAiMatchSuggestion,
  derivedSourcesBehindDataset,
  eventsForProductiveAsset,
  evidenceForPseudonymousContribution,
  isHighImpactIdentifier,
  observationsOfEvent,
  providersSupportingClaim,
  resolveDeterministic,
  AliasRegistry,
  canonicalEntityIdFor,
} from './knowledge-graph/index.ts';

const NOW = asUtcInstant('2026-09-02T10:00:00.000Z');

describe('Economic Knowledge Graph', () => {
  it('exact identity match via deterministic resolution', () => {
    const aliases = new AliasRegistry();
    const record = resolveDeterministic(
      {
        identifiers: [{ system: 'provider', id: 'res-a', authorityClass: 'PROVIDER' }],
        facilityId: null,
        geographicRef: null,
        publicationId: null,
        organizationId: null,
        pseudonymousRef: null,
        createdAt: NOW,
      },
      aliases,
    );
    assert.equal(record.outcome, 'EXACT_MATCH');
    assert.ok(record.canonicalEntityId);
    assert.equal(record.autoMerged, false);
  });

  it('probable match stays suggestion-only for high-impact identities', () => {
    const left = { system: 'productive_asset', id: 'plant-north', authorityClass: 'AUTHORITATIVE' as const };
    const right = { system: 'productive_asset', id: 'plant_north', authorityClass: 'PROVIDER' as const };
    assert.equal(isHighImpactIdentifier(left), true);
    const suggestion = createAiMatchSuggestion({
      left,
      right,
      aiConfidence: 0.8,
      createdAt: NOW,
    });
    assert.equal(suggestion.requiresGovernedReview, true);
    const applied = applyAiSuggestion(suggestion);
    assert.equal(applied.applied, false);
  });

  it('ambiguous identity yields possible match without auto merge', () => {
    const suggestion = createAiMatchSuggestion({
      left: { system: 'provider', id: 'alpha', authorityClass: 'PROVIDER' },
      right: { system: 'provider', id: 'alph', authorityClass: 'PROVIDER' },
      aiConfidence: 0.5,
      createdAt: NOW,
    });
    assert.equal(suggestion.suggestedOutcome, 'POSSIBLE_MATCH');
    assert.equal(applyAiSuggestion(suggestion).applied, false);
  });

  it('conflicting identity resolution when aliases disagree', () => {
    const aliases = new AliasRegistry();
    const canonicalA = canonicalEntityIdFor('entity-a');
    const canonicalB = canonicalEntityIdFor('entity-b');
    aliases.registerAlias({
      canonicalEntityId: canonicalA,
      externalIdentifier: { system: 'provider', id: 'x', authorityClass: 'PROVIDER' },
      preservedOriginalId: 'x',
      createdAt: NOW,
    });
    aliases.registerAlias({
      canonicalEntityId: canonicalB,
      externalIdentifier: { system: 'facility', id: 'y', authorityClass: 'PROVIDER' },
      preservedOriginalId: 'y',
      createdAt: NOW,
    });
    const record = resolveDeterministic(
      {
        identifiers: [
          { system: 'provider', id: 'x', authorityClass: 'PROVIDER' },
          { system: 'facility', id: 'y', authorityClass: 'PROVIDER' },
        ],
        facilityId: null,
        geographicRef: null,
        publicationId: null,
        organizationId: null,
        pseudonymousRef: null,
        createdAt: NOW,
      },
      aliases,
    );
    assert.equal(record.outcome, 'CONFLICT');
  });

  it('alias mapping preserves original provider IDs', () => {
    const service = new EconomicKnowledgeGraphService({ nowUtc: NOW });
    service.registerAlias({
      canonicalEntityId: 'canonical-resource-1',
      externalIdentifier: { system: 'provider', id: 'provider-res-a', authorityClass: 'PROVIDER' },
      preservedOriginalId: 'provider-res-a',
    });
    service.registerAlias({
      canonicalEntityId: 'canonical-resource-1',
      externalIdentifier: { system: 'provider', id: 'provider-res-b', authorityClass: 'PROVIDER' },
      preservedOriginalId: 'provider-res-b',
    });
    const aliases = service.aliasRegistry().aliasesFor(
      service.resolveEntities({
        identifiers: [{ system: 'provider', id: 'provider-res-a', authorityClass: 'PROVIDER' }],
        facilityId: null,
        geographicRef: null,
        publicationId: null,
        organizationId: null,
        pseudonymousRef: null,
        createdAt: NOW,
      }).canonicalEntityId!,
    );
    assert.equal(aliases.length, 2);
    assert.ok(aliases.some((a) => a.preservedOriginalId === 'provider-res-a'));
    assert.ok(aliases.some((a) => a.preservedOriginalId === 'provider-res-b'));
  });

  it('provider lineage via DERIVED_FROM query', () => {
    const service = new EconomicKnowledgeGraphService({ nowUtc: NOW });
    const datasetResult = service.registerNode({
      nodeClass: 'DATASET',
      domain: 'SHARED_REFERENCE',
      label: 'dataset-n',
      externalRef: 'dataset:n',
    });
    assert.ok(datasetResult.ok);
    const dataset = datasetResult.value;
    const parentResult = service.registerNode({
      nodeClass: 'DATASET',
      domain: 'SHARED_REFERENCE',
      label: 'dataset-parent',
      externalRef: 'dataset:parent',
    });
    assert.ok(parentResult.ok);
    const parent = parentResult.value;
    service.registerEdge({
      kind: 'DERIVED_FROM',
      fromNodeId: dataset.nodeId,
      toNodeId: parent.nodeId,
      domain: 'SHARED_REFERENCE',
      provenanceRef: 'lineage',
    });
    const result = derivedSourcesBehindDataset(service.repository(), dataset.nodeId);
    assert.equal(result.nodes.length, 2);
  });

  it('duplicate event linking via SAME_AS', () => {
    const service = new EconomicKnowledgeGraphService({ nowUtc: NOW });
    const primaryResult = service.registerNode({
      nodeClass: 'ECONOMIC_EVENT',
      domain: 'PRODUCTIVE_ECONOMY',
      label: 'event-primary',
      externalRef: 'event:1',
    });
    assert.ok(primaryResult.ok);
    const primary = primaryResult.value;
    const duplicateResult = service.registerNode({
      nodeClass: 'ECONOMIC_EVENT',
      domain: 'PRODUCTIVE_ECONOMY',
      label: 'event-dup',
      externalRef: 'event:1-dup',
    });
    assert.ok(duplicateResult.ok);
    const duplicate = duplicateResult.value;
    service.linkDuplicateEvents(primary.nodeId, duplicate.nodeId, 'dedupe');
    const edges = service.repository().edgesFrom(duplicate.nodeId, 'SAME_AS');
    assert.equal(edges.length, 1);
    assert.equal(edges[0]?.toNodeId, primary.nodeId);
  });

  it('human economy pseudonym protection rejects raw dossier payloads', () => {
    const service = new EconomicKnowledgeGraphService({ nowUtc: NOW });
    const rejected = service.registerNode({
      nodeClass: 'PSEUDONYMOUS_PERSON',
      domain: 'HUMAN_ECONOMY',
      label: 'person',
      externalRef: 'john.doe@email.com',
      payload: { name: 'John Doe', health: 'condition' },
    });
    assert.equal(rejected.ok, false);
    if (!rejected.ok) {
      assert.equal(rejected.error.code, 'PRIVACY_VIOLATION');
    }
  });

  it('human economy prefers pseudonym to verified contribution linkage', () => {
    const service = new EconomicKnowledgeGraphService({ nowUtc: NOW });
    const contribution = service.registerPseudonymousContribution({
      pseudonymRef: 'pseudonym:hisub_abc',
      contributionRef: 'hec_contrib_1',
      contributionClass: 'VERIFIED_SKILL',
    });
    assert.equal(contribution.ok, true);
    if (!contribution.ok) {
      return;
    }
    const evidence = evidenceForPseudonymousContribution(service.repository(), contribution.value.nodeId);
    assert.equal(evidence.nodes.length, 0);
  });

  it('productive economy event relationships for Wave 5', () => {
    const service = new EconomicKnowledgeGraphService({ nowUtc: NOW });
    service.seedProductiveScenarioFixtures(NOW);
    const assets = service.repository().nodes().filter((n) => n.nodeClass === 'FACILITY' || n.nodeClass === 'PRODUCTIVE_ASSET');
    assert.equal(assets.length, 4);
    const asset = assets[0]!;
    const events = eventsForProductiveAsset(service.repository(), asset.nodeId);
    assert.equal(events.nodes.length, 1);
  });

  it('claim linkage connects observations evidence and providers', () => {
    const service = new EconomicKnowledgeGraphService({ nowUtc: NOW });
    const linkage = service.linkClaim({
      claimRef: { claimId: 'claim-1', claimClass: 'PRODUCTIVE', fingerprint: 'fp1' },
      canonicalEventKey: 'energy-event-1',
      observationRefs: ['obs-1', 'obs-2'],
      evidenceRefs: ['ev-1'],
      providerRefs: ['provider-energy'],
      createdAt: NOW,
      provenanceRef: 'wave3-claim',
    });
    const providers = providersSupportingClaim(service.repository(), linkage.claimNodeId);
    assert.ok(providers.nodes.some((n) => n.nodeClass === 'PROVIDER'));
    const observations = observationsOfEvent(service.repository(), linkage.canonicalEventNodeId);
    assert.equal(observations.nodes.length, 2);
  });

  it('graph survives restart via snapshot round-trip', () => {
    const service = new EconomicKnowledgeGraphService({ nowUtc: NOW });
    service.seedProductiveScenarioFixtures(NOW);
    const before = service.snapshot();
    const restored = new EconomicKnowledgeGraphService({ nowUtc: NOW });
    restored.restore(before);
    assert.equal(restored.snapshot().nodes.length, before.nodes.length);
    assert.equal(restored.snapshot().edges.length, before.edges.length);
  });

  it('AGE evaluation defaults to adjacency backend', () => {
    assert.equal(AGE_EVALUATION.activeBackend, 'postgresql-adjacency');
    assert.equal(AGE_EVALUATION.ageAvailableInCi, false);
    const service = new EconomicKnowledgeGraphService();
    assert.equal(service.storageBackend, 'postgresql-adjacency');
  });

  it('repository port supports adjacency queries', () => {
    const repo = new AdjacencyTableGraphRepository();
    const asset = buildProductiveAssetNode({
      assetLabel: 'Test Plant',
      assetClass: 'FACILITY',
      externalRef: 'facility:test',
      createdAt: NOW,
    });
    repo.upsertNode(asset);
    assert.ok(repo.getNode(asset.nodeId));
  });
});
