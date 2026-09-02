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
      ...claim1.ok ? {
        claimId: 'claim-energy-dup',
        economy: 'PRODUCTIVE' as const,
        entityMaterial,
        eventMaterial,
        economicAction: 'ENERGY_GENERATED',
        validFromUtc: PRODUCTIVE_FIXTURE_NOW,
        validUntilUtc: PRODUCTIVE_FIXTURE_END,
        categoryCommitment: 'ENERGY',
        observationIds: ['obs-meter-1'],
        lineageEdges: [],
        methodologyVersion: 'wave3-energy-v1',
      } : {},
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
