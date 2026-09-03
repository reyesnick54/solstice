import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  EconomicClaimRegistry,
  deriveCanonicalEntityId,
  deriveCanonicalEventId,
  deriveClaimFingerprint,
  deriveObservationFingerprint,
  isObservationReplay,
  resolveEntityAlias,
} from './index.ts';
import {
  HIN_ALIAS,
  ORCID_ALIAS,
  PUBMED_ALIAS,
  RESEARCH_PAPER_COMMITMENT,
  UNIVERSITY_ALIAS,
  createHumanAliasResolver,
  employmentPayloadDigest,
  researchPayloadDigest,
  computationReceiptDigest,
  attestationDigest,
  HUMAN_FIXTURE_NOW,
} from './fixtures/human.ts';
import {
  COMPUTE_CLUSTER_ENTITY,
  ENERGY_EVENT_QUANTITY,
  ENERGY_UNIT,
  FACTORY_ENTITY,
  POWER_PLANT_ENTITY,
  PRODUCTIVE_FIXTURE_END,
  PRODUCTIVE_FIXTURE_NOW,
  computeTelemetryDigest,
  energyPayloadDigest,
  factoryProductionDigest,
  logisticsDigest,
  workloadReceiptDigest,
} from './fixtures/productive.ts';
import { asMonetizationContextId } from './monetization-lock.ts';
import {
  claimCannotAuthorizeIssuance,
  evidenceCannotAuthorizeIssuance,
  humanAndProductiveClaimsAreDistinguishable,
  observationCannotAuthorizeIssuance,
  verifiedFactCannotAuthorizeIssuance,
} from './authority.ts';
import {
  buildHumanEconomicClaim,
  buildProductiveEconomicClaim,
  buildVerifiedFactFromEvidence,
  fromEconomyDataObservation,
  fromOracleVerifiedFact,
} from './adapters.ts';
import { ECONOMIC_OBSERVATION_SCHEMA_VERSION } from './constants.ts';
import {
  fixtureHumanProofPipeline,
  fixtureProductiveProofPipeline,
  malformedClaim,
} from './fixtures.ts';
import { duplicateClaimFingerprint } from './ids.ts';
import { InMemoryEconomicProofPersistence } from './persistence.ts';
import {
  chainCommitmentRepresentation,
  claimCommitment,
  encodeCanonicalEconomicClaim,
  encodeEconomicEvidence,
  encodeEconomicObservation,
  encodeVerifiedEconomicFact,
  evidenceCommitment,
  observationCommitment,
  verifiedFactCommitment,
} from './serialization.ts';
import type { EconomicObservation } from './types.ts';
import {
  assertSupportedSchemaVersion,
  validateCanonicalEconomicClaim,
  validateEconomicEvidence,
  validateEconomicObservation,
  validateVerifiedEconomicFact,
} from './validation.ts';

describe('Wave 3 economic proof — core invariants', () => {
  it('distinguishes observation replay from multi-source corroboration', () => {
    const payload = energyPayloadDigest('meter-a');
    const fp1 = deriveObservationFingerprint({
      providerId: 'grid-meter',
      sourceClass: 'METER',
      providerRecordId: 'rec-1',
      payloadDigest: payload,
      observedAtUtc: PRODUCTIVE_FIXTURE_NOW,
    });
    const fp2 = deriveObservationFingerprint({
      providerId: 'grid-operator',
      sourceClass: 'GRID_OPERATOR',
      providerRecordId: 'rec-2',
      payloadDigest: payload,
      observedAtUtc: PRODUCTIVE_FIXTURE_NOW,
    });
    const fpReplay = deriveObservationFingerprint({
      providerId: 'grid-meter',
      sourceClass: 'METER',
      providerRecordId: 'rec-1',
      payloadDigest: payload,
      observedAtUtc: PRODUCTIVE_FIXTURE_NOW,
    });

    assert.notEqual(fp1, fp2);
    assert.equal(isObservationReplay(fp1, fpReplay), true);
  });

  it('rejects duplicate claim fingerprint registration', () => {
    const registry = new EconomicClaimRegistry();
    const entityMaterial = {
      economy: 'PRODUCTIVE' as const,
      entityKind: 'POWER_PLANT' as const,
      entityCommitment: POWER_PLANT_ENTITY,
    };
    const eventMaterial = {
      economicAction: 'ENERGY_GENERATED',
      quantity: ENERGY_EVENT_QUANTITY,
      unit: ENERGY_UNIT,
      validFromUtc: PRODUCTIVE_FIXTURE_NOW,
      validUntilUtc: PRODUCTIVE_FIXTURE_END,
      locationCommitment: 'geo:us-tx-wave3',
    };

    const obs = registry.registerObservation({
      observationId: 'obs-meter-1',
      economy: 'PRODUCTIVE',
      providerId: 'grid-meter',
      sourceClass: 'METER',
      providerRecordId: 'meter-rec-1',
      payloadDigest: energyPayloadDigest('meter'),
      observedAtUtc: PRODUCTIVE_FIXTURE_NOW,
      entityMaterial,
      eventMaterial,
    });
    assert.equal(obs.ok, true);

    const claim1 = registry.registerClaim({
      claimId: 'claim-energy-1',
      economy: 'PRODUCTIVE',
      entityMaterial,
      eventMaterial,
      economicAction: 'ENERGY_GENERATED',
      validFromUtc: PRODUCTIVE_FIXTURE_NOW,
      validUntilUtc: PRODUCTIVE_FIXTURE_END,
      categoryCommitment: 'ENERGY',
      observationIds: ['obs-meter-1'],
      lineageEdges: [],
      methodologyVersion: 'wave3-energy-v1',
    });
    assert.equal(claim1.ok, true);

    const claim2 = registry.registerClaim({
      claimId: 'claim-energy-dup',
      economy: 'PRODUCTIVE',
      entityMaterial,
      eventMaterial,
      economicAction: 'ENERGY_GENERATED',
      validFromUtc: PRODUCTIVE_FIXTURE_NOW,
      validUntilUtc: PRODUCTIVE_FIXTURE_END,
      categoryCommitment: 'ENERGY',
      observationIds: ['obs-meter-1'],
      lineageEdges: [],
      methodologyVersion: 'wave3-energy-v1',
    });
    assert.equal(claim2.ok, false);
    if (!claim2.ok) {
      assert.equal(claim2.error.code, 'CLAIM_ALREADY_EXISTS');
    }
  });
});

describe('Wave 3 human economy duplicate scenarios', () => {
  it('resolves same research contribution from PubMed, university, ORCID, and HIN to one entity', () => {
    const resolver = createHumanAliasResolver();
    const entityMaterial = {
      economy: 'HUMAN' as const,
      entityKind: 'RESEARCH_CONTRIBUTION' as const,
      entityCommitment: RESEARCH_PAPER_COMMITMENT,
    };

    const orcidEntity = resolveEntityAlias(resolver, ORCID_ALIAS, entityMaterial);
    const pubmedEntity = resolveEntityAlias(resolver, PUBMED_ALIAS, entityMaterial);
    const universityEntity = resolveEntityAlias(resolver, UNIVERSITY_ALIAS, entityMaterial);
    const hinEntity = resolveEntityAlias(resolver, HIN_ALIAS, entityMaterial);

    assert.equal(orcidEntity, pubmedEntity);
    assert.equal(pubmedEntity, universityEntity);
    assert.equal(universityEntity, hinEntity);
  });

  it('clusters four source observations into one claim without four monetizable claims', () => {
    const registry = new EconomicClaimRegistry({ aliasResolver: createHumanAliasResolver() });
    const entityMaterial = {
      economy: 'HUMAN' as const,
      entityKind: 'PSEUDONYMOUS_PERSON' as const,
      entityCommitment: RESEARCH_PAPER_COMMITMENT,
    };
    const eventMaterial = {
      economicAction: 'RESEARCH_CONTRIBUTION',
      quantity: 1n,
      unit: 'contribution',
      validFromUtc: HUMAN_FIXTURE_NOW,
      validUntilUtc: null,
      domainIdentifierCommitment: RESEARCH_PAPER_COMMITMENT,
    };

    const sources = [
      { id: 'obs-pubmed', providerId: 'pubmed', sourceClass: 'PUBMED', recordId: 'pmid:wave3-1' },
      { id: 'obs-university', providerId: 'stanford-repo', sourceClass: 'UNIVERSITY', recordId: 'uni:rec-1' },
      { id: 'obs-orcid', providerId: 'orcid', sourceClass: 'ORCID', recordId: 'orcid:rec-1' },
      { id: 'obs-hin', providerId: 'hin', sourceClass: 'HIN', recordId: 'hin:rec-1' },
    ] as const;

    for (const source of sources) {
      const result = registry.registerObservation({
        observationId: source.id,
        economy: 'HUMAN',
        providerId: source.providerId,
        sourceClass: source.sourceClass,
        providerRecordId: source.recordId,
        payloadDigest: researchPayloadDigest(source.sourceClass),
        observedAtUtc: HUMAN_FIXTURE_NOW,
        entityMaterial,
        eventMaterial,
      });
      assert.equal(result.ok, true);
    }

    const firstObs = registry.getObservation('obs-pubmed');
    assert.ok(firstObs);
    const cluster = registry.getClusterForEvent(firstObs.canonicalEventId);
    assert.ok(cluster);
    assert.equal(cluster.observationIds.length, 4);
    assert.equal(cluster.sourceClasses.length, 4);
    assert.equal(cluster.resolutionStatus, 'CORROBORATING');

    const claim = registry.registerClaim({
      claimId: 'claim-research-1',
      economy: 'HUMAN',
      entityMaterial,
      eventMaterial,
      economicAction: 'RESEARCH_CONTRIBUTION',
      validFromUtc: HUMAN_FIXTURE_NOW,
      validUntilUtc: null,
      jurisdictionCommitment: 'US',
      observationIds: sources.map((s) => s.id),
      lineageEdges: [],
      methodologyVersion: 'wave3-human-research-v1',
    });
    assert.equal(claim.ok, true);

    const duplicateClaim = registry.registerClaim({
      claimId: 'claim-research-dup',
      economy: 'HUMAN',
      entityMaterial,
      eventMaterial,
      economicAction: 'RESEARCH_CONTRIBUTION',
      validFromUtc: HUMAN_FIXTURE_NOW,
      validUntilUtc: null,
      jurisdictionCommitment: 'US',
      observationIds: ['obs-pubmed'],
      lineageEdges: [],
      methodologyVersion: 'wave3-human-research-v1',
    });
    assert.equal(duplicateClaim.ok, false);
    if (!duplicateClaim.ok) {
      assert.equal(duplicateClaim.error.code, 'CLAIM_ALREADY_EXISTS');
    }
  });

  it('rejects replayed employment activity and computation receipt observations', () => {
    const registry = new EconomicClaimRegistry();
    const entityMaterial = {
      economy: 'HUMAN' as const,
      entityKind: 'PSEUDONYMOUS_PERSON' as const,
      entityCommitment: 'person-commitment-wave3',
    };
    const eventMaterial = {
      economicAction: 'EMPLOYMENT_ACTIVITY',
      quantity: 8n,
      unit: 'hour',
      validFromUtc: HUMAN_FIXTURE_NOW,
      validUntilUtc: null,
    };

    const first = registry.registerObservation({
      observationId: 'obs-employ-1',
      economy: 'HUMAN',
      providerId: 'employer-portal',
      sourceClass: 'EMPLOYER',
      providerRecordId: 'timesheet:2026-09-01',
      payloadDigest: employmentPayloadDigest(1),
      observedAtUtc: HUMAN_FIXTURE_NOW,
      entityMaterial,
      eventMaterial,
    });
    assert.equal(first.ok, true);

    const replay = registry.registerObservation({
      observationId: 'obs-employ-replay',
      economy: 'HUMAN',
      providerId: 'employer-portal',
      sourceClass: 'EMPLOYER',
      providerRecordId: 'timesheet:2026-09-01',
      payloadDigest: employmentPayloadDigest(1),
      observedAtUtc: HUMAN_FIXTURE_NOW,
      entityMaterial,
      eventMaterial,
    });
    assert.equal(replay.ok, false);
    if (!replay.ok) {
      assert.equal(replay.error.code, 'OBSERVATION_REPLAY');
    }

    const receiptDigest = computationReceiptDigest('gpu-job-wave3');
    const receipt = registry.registerObservation({
      observationId: 'obs-compute-1',
      economy: 'HUMAN',
      providerId: 'compute-receipt',
      sourceClass: 'COMPUTE_RECEIPT',
      providerRecordId: 'receipt:gpu-job-wave3',
      payloadDigest: receiptDigest,
      observedAtUtc: HUMAN_FIXTURE_NOW,
      entityMaterial: {
        ...entityMaterial,
        entityKind: 'COMPUTE_CLUSTER',
      },
      eventMaterial: {
        economicAction: 'COMPUTE_CONTRIBUTION',
        quantity: 3600n,
        unit: 'gpu_second',
        validFromUtc: HUMAN_FIXTURE_NOW,
        validUntilUtc: null,
      },
    });
    assert.equal(receipt.ok, true);

    const receiptReplay = registry.registerObservation({
      observationId: 'obs-compute-replay',
      economy: 'HUMAN',
      providerId: 'compute-receipt',
      sourceClass: 'COMPUTE_RECEIPT',
      providerRecordId: 'receipt:gpu-job-wave3',
      payloadDigest: receiptDigest,
      observedAtUtc: HUMAN_FIXTURE_NOW,
      entityMaterial: {
        ...entityMaterial,
        entityKind: 'COMPUTE_CLUSTER',
      },
      eventMaterial: {
        economicAction: 'COMPUTE_CONTRIBUTION',
        quantity: 3600n,
        unit: 'gpu_second',
        validFromUtc: HUMAN_FIXTURE_NOW,
        validUntilUtc: null,
      },
    });
    assert.equal(receiptReplay.ok, false);

    const attestation = registry.registerObservation({
      observationId: 'obs-attest-1',
      economy: 'HUMAN',
      providerId: 'attestor',
      sourceClass: 'ATTESTATION',
      providerRecordId: 'attest:1',
      payloadDigest: attestationDigest('attest:1'),
      observedAtUtc: HUMAN_FIXTURE_NOW,
      entityMaterial,
      eventMaterial,
    });
    assert.equal(attestation.ok, true);

    const attestationReplay = registry.registerObservation({
      observationId: 'obs-attest-replay',
      economy: 'HUMAN',
      providerId: 'attestor',
      sourceClass: 'ATTESTATION',
      providerRecordId: 'attest:1',
      payloadDigest: attestationDigest('attest:1'),
      observedAtUtc: HUMAN_FIXTURE_NOW,
      entityMaterial,
      eventMaterial,
    });
    assert.equal(attestationReplay.ok, false);
  });
});

describe('Wave 3 productive economy duplicate scenarios', () => {
  it('does not sum 500 MWh four ways into 2000 MWh', () => {
    const registry = new EconomicClaimRegistry();
    const entityMaterial = {
      economy: 'PRODUCTIVE' as const,
      entityKind: 'POWER_PLANT' as const,
      entityCommitment: POWER_PLANT_ENTITY,
    };
    const eventMaterial = {
      economicAction: 'ENERGY_GENERATED',
      quantity: ENERGY_EVENT_QUANTITY,
      unit: ENERGY_UNIT,
      validFromUtc: PRODUCTIVE_FIXTURE_NOW,
      validUntilUtc: PRODUCTIVE_FIXTURE_END,
      locationCommitment: 'geo:us-tx-wave3',
    };

    const providers = [
      { id: 'obs-meter', providerId: 'grid-meter', sourceClass: 'METER', recordId: 'm-1' },
      { id: 'obs-grid', providerId: 'grid-operator', sourceClass: 'GRID_OPERATOR', recordId: 'g-1' },
      { id: 'obs-gov', providerId: 'gov-dataset', sourceClass: 'GOVERNMENT_DATASET', recordId: 'gov-1' },
      { id: 'obs-weather', providerId: 'weather-estimate', sourceClass: 'WEATHER_DERIVED', recordId: 'w-1' },
    ] as const;

    for (const provider of providers) {
      const result = registry.registerObservation({
        observationId: provider.id,
        economy: 'PRODUCTIVE',
        providerId: provider.providerId,
        sourceClass: provider.sourceClass,
        providerRecordId: provider.recordId,
        payloadDigest: energyPayloadDigest(provider.sourceClass),
        observedAtUtc: PRODUCTIVE_FIXTURE_NOW,
        entityMaterial,
        eventMaterial,
      });
      assert.equal(result.ok, true);
    }

    const firstObs = registry.getObservation('obs-meter');
    assert.ok(firstObs);

    const claim = registry.registerClaim({
      claimId: 'claim-energy-main',
      economy: 'PRODUCTIVE',
      entityMaterial,
      eventMaterial,
      economicAction: 'ENERGY_GENERATED',
      validFromUtc: PRODUCTIVE_FIXTURE_NOW,
      validUntilUtc: PRODUCTIVE_FIXTURE_END,
      categoryCommitment: 'ENERGY',
      observationIds: providers.map((p) => p.id),
      lineageEdges: [],
      methodologyVersion: 'wave3-energy-v1',
    });
    assert.equal(claim.ok, true);

    const monetizedQuantity = registry.totalClusterQuantity(firstObs.canonicalEventId);
    assert.equal(monetizedQuantity, ENERGY_EVENT_QUANTITY);
    assert.notEqual(monetizedQuantity, ENERGY_EVENT_QUANTITY * 4n);
  });

  it('clusters factory ERP, logistics, and energy observations into one production claim', () => {
    const registry = new EconomicClaimRegistry();
    const entityMaterial = {
      economy: 'PRODUCTIVE' as const,
      entityKind: 'FACTORY' as const,
      entityCommitment: FACTORY_ENTITY,
    };
    const quantity = 1000n;
    const eventMaterial = {
      economicAction: 'GOODS_PRODUCED',
      quantity,
      unit: 'unit',
      validFromUtc: PRODUCTIVE_FIXTURE_NOW,
      validUntilUtc: PRODUCTIVE_FIXTURE_END,
    };

    const observations = [
      {
        id: 'obs-erp',
        providerId: 'factory-erp',
        sourceClass: 'ERP',
        recordId: 'erp-batch-1',
        digest: factoryProductionDigest('erp', quantity),
      },
      {
        id: 'obs-logistics',
        providerId: 'logistics',
        sourceClass: 'LOGISTICS',
        recordId: 'ship-1',
        digest: logisticsDigest('logistics', quantity),
      },
      {
        id: 'obs-energy',
        providerId: 'energy-meter',
        sourceClass: 'ENERGY_METER',
        recordId: 'energy-1',
        digest: energyPayloadDigest('factory-energy', 50_000n),
      },
    ] as const;

    for (const observation of observations) {
      const result = registry.registerObservation({
        observationId: observation.id,
        economy: 'PRODUCTIVE',
        providerId: observation.providerId,
        sourceClass: observation.sourceClass,
        providerRecordId: observation.recordId,
        payloadDigest: observation.digest,
        observedAtUtc: PRODUCTIVE_FIXTURE_NOW,
        entityMaterial,
        eventMaterial,
      });
      assert.equal(result.ok, true);
    }

    const claim = registry.registerClaim({
      claimId: 'claim-factory-1',
      economy: 'PRODUCTIVE',
      entityMaterial,
      eventMaterial,
      economicAction: 'GOODS_PRODUCED',
      validFromUtc: PRODUCTIVE_FIXTURE_NOW,
      validUntilUtc: PRODUCTIVE_FIXTURE_END,
      categoryCommitment: 'MANUFACTURING',
      observationIds: observations.map((o) => o.id),
      lineageEdges: [],
      methodologyVersion: 'wave3-factory-v1',
    });
    assert.equal(claim.ok, true);
    if (claim.ok) {
      assert.equal(claim.value.observationIds.length, 3);
      assert.equal(claim.value.sourceClasses.includes('ERP'), true);
    }
  });

  it('clusters datacenter telemetry and workload receipt for compute contribution', () => {
    const registry = new EconomicClaimRegistry();
    const entityMaterial = {
      economy: 'PRODUCTIVE' as const,
      entityKind: 'COMPUTE_CLUSTER' as const,
      entityCommitment: COMPUTE_CLUSTER_ENTITY,
    };
    const gpuSeconds = 7200n;
    const eventMaterial = {
      economicAction: 'COMPUTE_WORKLOAD',
      quantity: gpuSeconds,
      unit: 'gpu_second',
      validFromUtc: PRODUCTIVE_FIXTURE_NOW,
      validUntilUtc: PRODUCTIVE_FIXTURE_END,
    };

    for (const observation of [
      {
        id: 'obs-telemetry',
        providerId: 'datacenter-telemetry',
        sourceClass: 'DATACENTER_TELEMETRY',
        recordId: 'tel-1',
        digest: computeTelemetryDigest('telemetry', gpuSeconds),
      },
      {
        id: 'obs-receipt',
        providerId: 'workload-scheduler',
        sourceClass: 'WORKLOAD_RECEIPT',
        recordId: 'job-42',
        digest: workloadReceiptDigest('job-42'),
      },
    ]) {
      const result = registry.registerObservation({
        observationId: observation.id,
        economy: 'PRODUCTIVE',
        providerId: observation.providerId,
        sourceClass: observation.sourceClass,
        providerRecordId: observation.recordId,
        payloadDigest: observation.digest,
        observedAtUtc: PRODUCTIVE_FIXTURE_NOW,
        entityMaterial,
        eventMaterial,
      });
      assert.equal(result.ok, true);
    }

    const claim = registry.registerClaim({
      claimId: 'claim-compute-1',
      economy: 'PRODUCTIVE',
      entityMaterial,
      eventMaterial,
      economicAction: 'COMPUTE_WORKLOAD',
      validFromUtc: PRODUCTIVE_FIXTURE_NOW,
      validUntilUtc: PRODUCTIVE_FIXTURE_END,
      categoryCommitment: 'COMPUTE',
      observationIds: ['obs-telemetry', 'obs-receipt'],
      lineageEdges: [],
      methodologyVersion: 'wave3-compute-v1',
    });
    assert.equal(claim.ok, true);
  });
});

describe('Wave 3 monetization lock and challenge state', () => {
  it('enforces one-time consumption with commitment registry', () => {
    const registry = new EconomicClaimRegistry();
    const entityMaterial = {
      economy: 'HUMAN' as const,
      entityKind: 'PSEUDONYMOUS_PERSON' as const,
      entityCommitment: 'person-wave3',
    };
    const eventMaterial = {
      economicAction: 'RESEARCH_CONTRIBUTION',
      quantity: 1n,
      unit: 'contribution',
      validFromUtc: HUMAN_FIXTURE_NOW,
      validUntilUtc: null,
    };

    registry.registerObservation({
      observationId: 'obs-1',
      economy: 'HUMAN',
      providerId: 'hin',
      sourceClass: 'HIN',
      providerRecordId: 'r-1',
      payloadDigest: researchPayloadDigest('hin'),
      observedAtUtc: HUMAN_FIXTURE_NOW,
      entityMaterial,
      eventMaterial,
    });

    registry.registerClaim({
      claimId: 'claim-1',
      economy: 'HUMAN',
      entityMaterial,
      eventMaterial,
      economicAction: 'RESEARCH_CONTRIBUTION',
      validFromUtc: HUMAN_FIXTURE_NOW,
      validUntilUtc: null,
      observationIds: ['obs-1'],
      lineageEdges: [],
      methodologyVersion: 'wave3-v1',
    });

    const contextId = asMonetizationContextId('sunrey:human:settlement:wave3');
    assert.equal(registry.authorizeMonetization('claim-1', contextId).ok, true);

    const consumed = registry.consumeMonetization({
      claimId: 'claim-1',
      contextId,
      replayKey: 'SUNREY:HUMAN_CONTRIBUTION:fp-1',
    });
    assert.equal(consumed.ok, true);
    if (consumed.ok) {
      assert.equal(consumed.value.monetizationLock.status, 'CONSUMED');
      assert.ok(consumed.value.monetizationLock.consumptionCommitment);
    }

    const replayConsume = registry.consumeMonetization({
      claimId: 'claim-1',
      contextId,
      replayKey: 'SUNREY:HUMAN_CONTRIBUTION:fp-1',
    });
    assert.equal(replayConsume.ok, false);
  });

  it('blocks monetization progression under material dispute unless policy permits', () => {
    const registry = new EconomicClaimRegistry();
    const entityMaterial = {
      economy: 'PRODUCTIVE' as const,
      entityKind: 'POWER_PLANT' as const,
      entityCommitment: POWER_PLANT_ENTITY,
    };
    const eventMaterial = {
      economicAction: 'ENERGY_GENERATED',
      quantity: ENERGY_EVENT_QUANTITY,
      unit: ENERGY_UNIT,
      validFromUtc: PRODUCTIVE_FIXTURE_NOW,
      validUntilUtc: PRODUCTIVE_FIXTURE_END,
    };

    registry.registerObservation({
      observationId: 'obs-energy',
      economy: 'PRODUCTIVE',
      providerId: 'meter',
      sourceClass: 'METER',
      providerRecordId: 'm-1',
      payloadDigest: energyPayloadDigest('meter'),
      observedAtUtc: PRODUCTIVE_FIXTURE_NOW,
      entityMaterial,
      eventMaterial,
    });

    registry.registerClaim({
      claimId: 'claim-energy',
      economy: 'PRODUCTIVE',
      entityMaterial,
      eventMaterial,
      economicAction: 'ENERGY_GENERATED',
      validFromUtc: PRODUCTIVE_FIXTURE_NOW,
      validUntilUtc: PRODUCTIVE_FIXTURE_END,
      observationIds: ['obs-energy'],
      lineageEdges: [],
      methodologyVersion: 'wave3-v1',
    });

    const challenged = registry.openChallenge('claim-energy', 'meter calibration dispute', true);
    assert.equal(challenged.ok, true);
    if (challenged.ok) {
      assert.equal(challenged.value.challengeState.status, 'MATERIAL_DISPUTE');
    }

    const contextId = asMonetizationContextId('moonrey:productive:settlement:wave3');
    const authorize = registry.authorizeMonetization('claim-energy', contextId);
    assert.equal(authorize.ok, false);
    if (!authorize.ok) {
      assert.equal(authorize.error.code, 'MONETIZATION_BLOCKED');
    }
  });
});

describe('Wave 3 audit surfaces', () => {
  it('documents pre-wave3 duplicate protection weaknesses', async () => {
    const { EXISTING_DUPLICATE_PROTECTIONS, WAVE3_GAPS_ADDRESSED } = await import('./audit.ts');
    assert.ok(EXISTING_DUPLICATE_PROTECTIONS.length >= 10);
    assert.ok(WAVE3_GAPS_ADDRESSED.length >= 6);
    const human = EXISTING_DUPLICATE_PROTECTIONS.filter((entry) => entry.economy === 'HUMAN');
    const productive = EXISTING_DUPLICATE_PROTECTIONS.filter((entry) => entry.economy === 'PRODUCTIVE');
    assert.ok(human.length >= 4);
    assert.ok(productive.length >= 3);
  });
});

describe('Wave 3 economic proof domain', () => {
  it('produces deterministic serialization for observations', () => {
    const { observation } = fixtureHumanProofPipeline();
    const first = encodeEconomicObservation(observation);
    const second = encodeEconomicObservation(observation);
    assert.equal(Buffer.compare(first, second), 0);
    assert.equal(observationCommitment(observation), observationCommitment(observation));
  });

  it('produces deterministic serialization for evidence, facts, and claims', () => {
    const human = fixtureHumanProofPipeline();
    const productive = fixtureProductiveProofPipeline();

    assert.equal(Buffer.compare(encodeEconomicEvidence(human.evidence), encodeEconomicEvidence(human.evidence)), 0);
    assert.equal(
      Buffer.compare(encodeVerifiedEconomicFact(human.fact), encodeVerifiedEconomicFact(human.fact)),
      0,
    );
    assert.equal(
      Buffer.compare(encodeCanonicalEconomicClaim(human.claim), encodeCanonicalEconomicClaim(human.claim)),
      0,
    );
    assert.notEqual(evidenceCommitment(human.evidence), evidenceCommitment(productive.evidence));
    assert.notEqual(claimCommitment(human.claim), claimCommitment(productive.claim));
  });

  it('produces deterministic duplicate claim fingerprints', () => {
    const input = {
      economicDomain: 'HUMAN_ECONOMIC',
      claimType: 'HUMAN_CONTRIBUTION',
      canonicalEntityId: 'entity_1',
      canonicalEventId: 'event_1',
      subjectRef: 'subj_1',
      temporalStartUtc: '2026-01-01T00:00:00.000Z',
      temporalEndUtc: '2026-01-01T01:00:00.000Z',
    };
    assert.equal(duplicateClaimFingerprint(input), duplicateClaimFingerprint(input));
    assert.notEqual(
      duplicateClaimFingerprint(input),
      duplicateClaimFingerprint({ ...input, economicDomain: 'PRODUCTIVE_ECONOMIC' }),
    );
  });

  it('keeps human and productive claims distinguishable', () => {
    const human = fixtureHumanProofPipeline().claim;
    const productive = fixtureProductiveProofPipeline().claim;
    assert.equal(human.economicDomain, 'HUMAN_ECONOMIC');
    assert.equal(productive.economicDomain, 'PRODUCTIVE_ECONOMIC');
    assert.ok(humanAndProductiveClaimsAreDistinguishable(human, productive));
    assert.notEqual(human.duplicateFingerprint, productive.duplicateFingerprint);
  });

  it('observation cannot authorize issuance', () => {
    const { observation } = fixtureHumanProofPipeline();
    assert.equal(observationCannotAuthorizeIssuance(observation), null);
    const bad = {
      ...observation,
      authority: { ...observation.authority, mintsNativeAsset: true as const },
    } as unknown as EconomicObservation;
    assert.notEqual(observationCannotAuthorizeIssuance(bad), null);
  });

  it('evidence cannot authorize issuance', () => {
    const { evidence } = fixtureHumanProofPipeline();
    assert.equal(evidenceCannotAuthorizeIssuance(evidence), null);
  });

  it('verified fact cannot authorize issuance', () => {
    const { fact } = fixtureHumanProofPipeline();
    assert.equal(verifiedFactCannotAuthorizeIssuance(fact), null);
  });

  it('claim cannot authorize issuance', () => {
    const { claim } = fixtureProductiveProofPipeline();
    assert.equal(claimCannotAuthorizeIssuance(claim), null);
  });

  it('rejects malformed claim', () => {
    const result = validateCanonicalEconomicClaim(malformedClaim());
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(
        ['INVALID_TEMPORAL_RANGE', 'MISSING_REQUIRED_ID', 'MALFORMED_CLAIM'].includes(result.code),
        `unexpected rejection code: ${result.code}`,
      );
    }
  });

  it('rejects unsupported schema version', () => {
    const result = assertSupportedSchemaVersion('observation', 'sunrey.economic-proof.observation.v0');
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'UNSUPPORTED_SCHEMA_VERSION');
    }
  });

  it('chain commitment representation does not require raw payload', () => {
    const { claim } = fixtureHumanProofPipeline();
    const commitment = claimCommitment(claim);
    const representation = chainCommitmentRepresentation({
      objectType: 'claim',
      objectId: claim.economicClaimId,
      schemaVersion: claim.schemaVersion,
      commitment,
      economicDomain: claim.economicDomain,
    });
    assert.equal(representation.rawPayloadRequired, false);
    assert.equal(representation.commitment.length, 64);
  });

  it('validates full human proof pipeline', () => {
    const { observation, evidence, fact, claim } = fixtureHumanProofPipeline();
    assert.equal(validateEconomicObservation(observation).ok, true);
    assert.equal(validateEconomicEvidence(evidence).ok, true);
    assert.equal(validateVerifiedEconomicFact(fact).ok, true);
    assert.equal(validateCanonicalEconomicClaim(claim).ok, true);
  });

  it('persists proof records without becoming a monetary authority', () => {
    const store = new InMemoryEconomicProofPersistence();
    const { observation, evidence, fact, claim } = fixtureProductiveProofPipeline();
    store.observations.putObservation(observation);
    store.evidence.putEvidence(evidence);
    store.verifiedFacts.putVerifiedFact(fact);
    store.claims.putClaim(claim);
    store.sealCommitment({
      kind: 'claim',
      objectId: claim.economicClaimId,
      schemaVersion: claim.schemaVersion,
      commitment: claimCommitment(claim),
      sealedAtUtc: '2026-01-01T01:00:00.000Z',
      economicDomain: claim.economicDomain,
    });
    assert.equal(store.claims.getClaim(claim.economicClaimId)?.economicDomain, 'PRODUCTIVE_ECONOMIC');
    assert.equal(store.vaultSeals.length, 1);
  });

  it('adapts economy-data observation without collapsing domains', () => {
    const { observation: productiveObservation } = fixtureProductiveProofPipeline();
    const adapted = fromEconomyDataObservation(
      {
        schema: 'sunrey.productive.economy-data.v1',
        observationId: 'legacy_obs',
        category: 'COMPUTE',
        resourceId: productiveObservation.resourceRef!,
        metric: productiveObservation.metric,
        value: productiveObservation.quantity.value,
        unit: productiveObservation.quantity.unit,
        canonicalUnit: productiveObservation.quantity.unit,
        canonicalValue: productiveObservation.quantity.value,
        timestampUtc: productiveObservation.observedAtUtc,
        source: 'fixture',
        provider: productiveObservation.providerId,
        provenance: {
          sourceId: 'fixture',
          providerId: productiveObservation.providerId,
          sourceClass: 'SANDBOX_FIXTURE',
          method: 'fixture',
          evidenceRef: productiveObservation.provenanceRef.provenanceId,
          collectedAtUtc: productiveObservation.observedAtUtc,
          license: 'SANDBOX_FIXTURE',
          signatureValid: true,
          configuredDoesNotImplyTrusted: true,
        },
        verification: 'SINGLE_SOURCE_VERIFIED',
        confidenceBps: 9_000n,
        freshness: {
          state: 'FRESH',
          ageSeconds: 60n,
          expiresAtUtc: '2026-01-01T02:00:00.000Z',
          usableForTimeSensitiveValuation: true,
        },
        license: 'SANDBOX_FIXTURE',
        integrity: 'INTACT',
        status: 'NORMALIZED',
        simulation: true,
        mintsMoonRey: false,
        setsMarketPrice: false,
        unlabeled: false,
      },
      { observationId: 'adapted_obs', economicDomain: 'PRODUCTIVE_ECONOMIC' },
    );
    assert.equal(adapted.schemaVersion, ECONOMIC_OBSERVATION_SCHEMA_VERSION);
    assert.equal(adapted.economicDomain, 'PRODUCTIVE_ECONOMIC');
    assert.equal(adapted.authority.mintsNativeAsset, false);
  });

  it('adapts oracle verified fact into proof lattice', () => {
    const oracleFact = {
      schemaVersion: 1 as const,
      factId: 'oracle_fact_1',
      feedId: 'feed_gpu',
      subject: 'resource_compute_001',
      aggregatedValue: { schemaVersion: 1 as const, mantissa: 100n, scale: 0, unit: 'gpu_s' as const },
      sourceObservationIds: ['obs_1', 'obs_2'],
      aggregationPolicy: 'MEDIAN' as const,
      observationWindow: { startUnix: 1_735_689_600n, endUnix: 1_735_693_200n },
      validUntilUnix: 1_735_696_800n,
      qualityStatus: 'VERIFIED' as const,
      finalizedHeight: 10,
      conflictReason: null,
    };
    const adapted = fromOracleVerifiedFact(oracleFact, {
      verifiedFactId: 'vef_adapted',
      economicDomain: 'PRODUCTIVE_ECONOMIC',
    });
    assert.equal(adapted.economicDomain, 'PRODUCTIVE_ECONOMIC');
    assert.equal(adapted.authority.mintsNativeAsset, false);
    assert.equal(validateVerifiedEconomicFact(adapted).ok, true);
  });

  it('builds claims with distinct human and productive domains', () => {
    const human = buildHumanEconomicClaim({
      economicClaimId: 'cec_h',
      canonicalEntityId: 'ent_h',
      canonicalEventId: 'evt_h',
      subjectRef: 'subj_h',
      supportingFactIds: ['vef_h'],
      evidenceRefs: ['evd_h'],
      temporalBounds: { startUtc: '2026-01-01T00:00:00.000Z', endUtc: '2026-01-01T01:00:00.000Z' },
    });
    const productive = buildProductiveEconomicClaim({
      economicClaimId: 'cec_p',
      canonicalEntityId: 'ent_p',
      canonicalEventId: 'evt_p',
      subjectRef: 'subj_p',
      resourceRef: 'res_p',
      supportingFactIds: ['vef_p'],
      evidenceRefs: ['evd_p'],
      temporalBounds: { startUtc: '2026-01-01T00:00:00.000Z', endUtc: '2026-01-01T01:00:00.000Z' },
    });
    assert.notEqual(human.economicDomain, productive.economicDomain);
    assert.notEqual(human.claimType, productive.claimType);
  });

  it('verified fact built from evidence cannot mint', () => {
    const { evidence } = fixtureHumanProofPipeline();
    const fact = buildVerifiedFactFromEvidence(evidence, {
      verifiedFactId: 'vef_test',
      metric: 'test_metric',
      quantity: { value: 1n, unit: 'event' },
      temporalBounds: { startUtc: '2026-01-01T00:00:00.000Z', endUtc: '2026-01-01T01:00:00.000Z' },
    });
    assert.equal(fact.authority.mintsNativeAsset, false);
    assert.equal(verifiedFactCannotAuthorizeIssuance(fact), null);
  });
});
