import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { EconomicAssetRegistry } from '../../economic-asset-registry/src/index.ts';
import { contributionFingerprint } from './productive/fingerprint.ts';
import {
  capacityOutputEventFingerprint,
  crossCategoryEventFingerprint,
  governedContributionFingerprint,
} from './productive/policy-governance/fingerprint.ts';
import {
  HISTORICAL_FINGERPRINT_DOMAINS,
  ProductiveEventIdentityRegistry,
  assessEventLinkage,
  attachClaimToEvent,
  attributionGraphCannotMint,
  authoritativeLineageCreatesStrongLink,
  buildBatchLineage,
  candidateEventClassesFor,
  classifyEventClass,
  classifyObservationRelation,
  containsRawIndustrialData,
  createProductiveEconomicEvent,
  economicEventFingerprintV3,
  eventIdentityCannotAuthorizeIssuance,
  eventOmitsMoonReyQuantity,
  eventProjectionCannotMint,
  fingerprintV1RemainsHistorical,
  fingerprintV2RemainsHistorical,
  historicalFingerprintDomains,
  identityRef,
  mapEconomicEventAsset,
  outputBatchIsIndependentProduction,
  possibleMatchCannotMerge,
  projectEconomicEvent,
  rebuildProductiveAttributionGraph,
  relationDoesNotImplyDuplicate,
  supersedeEvent,
  defaultProjectionInstant,
  claimRefFor,
  objectRefFor,
} from './productive/policy-governance/attribution/index.ts';
import type { EventIdentityEvidence } from './productive/policy-governance/attribution/types.ts';

const PERIOD = Object.freeze({
  validFromUnixSeconds: 1_799_000_000n,
  validUntilUnixSeconds: 1_800_000_000n,
  epoch: 12,
});

function baseEvidence(overrides: Partial<EventIdentityEvidence> = {}): EventIdentityEvidence {
  return {
    transformationRef: identityRef('transform', 'line-7:B1'),
    alternateViewGroupRef: identityRef('view', 'mfg-B1'),
    physicalObjectRefs: [identityRef('object', 'factory.7')],
    sourceObjectRefs: [identityRef('object', 'factory.7')],
    inputLotRefs: [identityRef('lot', 'A')],
    outputLotRefs: [identityRef('lot', 'B1')],
    serialAssetRefs: [],
    measurementPeriod: PERIOD,
    deliveryPeriod: { fromUnixSeconds: PERIOD.validFromUnixSeconds, untilUnixSeconds: PERIOD.validUntilUnixSeconds },
    geographyId: 'geo.factory.7',
    jurisdiction: 'US-SIM',
    oracleFactRefs: [identityRef('fact', 'factory')],
    sourceProvenanceRefs: [identityRef('prov', 'mes')],
    upstreamEventRefs: [],
    downstreamEventRefs: [],
    canonicalMeasurementRefs: [identityRef('measure', 'B1:100')],
    controllerRefs: [identityRef('ctl', 'factory')],
    participantRefs: [identityRef('part', 'line-7')],
    sourceSystemRefs: [identityRef('sys', 'factory-mes')],
    lineageRoot: identityRef('root', 'A'),
    economicTransformationRef: identityRef('transform', 'line-7:B1'),
    ...overrides,
  };
}

function v1Input() {
  return {
    objectId: 'obj.factory.7',
    measurementPeriodEpoch: 12,
    validFromUnixSeconds: PERIOD.validFromUnixSeconds,
    validUntilUnixSeconds: PERIOD.validUntilUnixSeconds,
    claimType: 'OUTPUT' as const,
    category: 'MANUFACTURING' as const,
    normalizedQuantity: 100n,
    baseUnitId: 'UNIT',
    oracleFactIds: ['b', 'a'],
    upstreamContributionIds: ['u2', 'u1'],
  };
}

describe('Chunk 120 productive economic event identity', () => {
  it('1. same object / same event share eventId and v3 fingerprint', () => {
    const evidence = baseEvidence();
    const first = createProductiveEconomicEvent({
      eventClass: 'MANUFACTURING_TRANSFORMATION_EVENT',
      evidence,
      claimRefs: [claimRefFor('mfg-1')],
    });
    const second = createProductiveEconomicEvent({
      eventClass: 'MANUFACTURING_TRANSFORMATION_EVENT',
      evidence,
      claimRefs: [claimRefFor('mfg-2')],
    });
    assert.equal(first.eventId, second.eventId);
    assert.equal(first.eventFingerprint, second.eventFingerprint);
    assert.equal(first.eventFingerprint, economicEventFingerprintV3(evidence));
  });

  it('2. different object representations of the same event hash together', () => {
    const factory = baseEvidence({
      physicalObjectRefs: [identityRef('object', 'factory.7')],
      sourceObjectRefs: [identityRef('object', 'factory.7')],
      controllerRefs: [identityRef('ctl', 'factory')],
      sourceSystemRefs: [identityRef('sys', 'mes')],
    });
    const robot = baseEvidence({
      physicalObjectRefs: [identityRef('object', 'robot.R1')],
      sourceObjectRefs: [identityRef('object', 'robot.R1')],
      controllerRefs: [identityRef('ctl', 'robot')],
      sourceSystemRefs: [identityRef('sys', 'telemetry')],
      oracleFactRefs: [identityRef('fact', 'robot')],
    });
    assert.equal(economicEventFingerprintV3(factory), economicEventFingerprintV3(robot));
    assert.equal(
      createProductiveEconomicEvent({ eventClass: 'MANUFACTURING_TRANSFORMATION_EVENT', evidence: factory }).eventId,
      createProductiveEconomicEvent({ eventClass: 'MACHINE_OPERATION_EVENT', evidence: robot }).eventId,
    );
  });

  it('3. factory + robot share one manufacturing event', () => {
    const store = new ProductiveEventIdentityRegistry();
    const factoryEvidence = baseEvidence({ physicalObjectRefs: [objectRefFor('factory.7')] });
    const robotEvidence = baseEvidence({
      physicalObjectRefs: [objectRefFor('robot.R1')],
      sourceObjectRefs: [objectRefFor('robot.R1')],
    });
    const factory = store.register(
      {
        eventClass: classifyEventClass({ observationKind: 'FACTORY_MANUFACTURING_OUTPUT' }),
        evidence: factoryEvidence,
        claimRefs: [claimRefFor('factory-mfg')],
      },
      factoryEvidence,
    );
    const robot = store.register(
      {
        eventClass: classifyEventClass({ observationKind: 'ROBOT_MACHINE_OUTPUT' }),
        evidence: robotEvidence,
        claimRefs: [claimRefFor('robot-out')],
      },
      robotEvidence,
    );
    assert.equal(factory.eventId, robot.eventId);
    assert.equal(factory.eventClass, 'MANUFACTURING_TRANSFORMATION_EVENT');
    assert.equal(robot.eventClass, 'MANUFACTURING_TRANSFORMATION_EVENT');
    const shared = store.getByClaim(claimRefFor('factory-mfg'));
    assert.equal(shared?.eventId, store.getByClaim(claimRefFor('robot-out'))?.eventId);
  });

  it('4. manufacturing output + goods batch linkage shares event when describing the transformation', () => {
    const evidence = baseEvidence();
    const manufacturing = createProductiveEconomicEvent({
      eventClass: classifyEventClass({ observationKind: 'FACTORY_MANUFACTURING_OUTPUT' }),
      evidence,
      claimRefs: [claimRefFor('mfg')],
    });
    const goods = attachClaimToEvent(manufacturing, claimRefFor('goods-B1'));
    assert.equal(goods.eventId, manufacturing.eventId);
    assert.equal(goods.claimRefs.length, 2);
    assert.equal(
      classifyEventClass({ observationKind: 'GOODS_BATCH_RECORD', describesManufacturingTransformation: true }),
      'MANUFACTURING_TRANSFORMATION_EVENT',
    );
  });

  it('5. logistics event is linked to goods but distinct', () => {
    const mfg = createProductiveEconomicEvent({
      eventClass: 'MANUFACTURING_TRANSFORMATION_EVENT',
      evidence: baseEvidence(),
    });
    const freightEvidence = baseEvidence({
      transformationRef: identityRef('transform', 'freight:B1'),
      alternateViewGroupRef: identityRef('view', 'freight'),
      economicTransformationRef: identityRef('transform', 'freight:B1'),
    });
    const freight = createProductiveEconomicEvent({
      eventClass: classifyEventClass({ observationKind: 'LOGISTICS_DELIVERY' }),
      evidence: freightEvidence,
    });
    assert.notEqual(mfg.eventId, freight.eventId);
    const relation = classifyObservationRelation({
      fromKind: 'LOGISTICS_DELIVERY',
      toKind: 'GOODS_BATCH_RECORD',
      sameUnderlyingEvent: false,
    });
    assert.equal(relation.relation, 'TRANSPORTS');
    assert.equal(relation.impliesDuplicateValue, false);
    assert.equal(relationDoesNotImplyDuplicate('DELIVERS'), true);
  });

  it('6. storage event is distinct from stored goods', () => {
    const goods = createProductiveEconomicEvent({
      eventClass: 'GOODS_CREATION_EVENT',
      evidence: baseEvidence({
        transformationRef: identityRef('transform', 'goods:B1'),
        alternateViewGroupRef: identityRef('view', 'goods'),
        economicTransformationRef: identityRef('transform', 'goods:B1'),
      }),
    });
    const storage = createProductiveEconomicEvent({
      eventClass: classifyEventClass({ observationKind: 'STORAGE_HOLDING' }),
      evidence: baseEvidence({
        transformationRef: identityRef('transform', 'store:B1'),
        alternateViewGroupRef: identityRef('view', 'store'),
        economicTransformationRef: identityRef('transform', 'store:B1'),
      }),
    });
    assert.notEqual(goods.eventId, storage.eventId);
    const relation = classifyObservationRelation({
      fromKind: 'STORAGE_HOLDING',
      toKind: 'GOODS_BATCH_RECORD',
      sameUnderlyingEvent: false,
    });
    assert.equal(relation.relation, 'STORES');
    assert.equal(relation.impliesDuplicateValue, false);
  });

  it('7. compute usage and AI inference are linked correctly without silent merge', () => {
    const compute = createProductiveEconomicEvent({
      eventClass: classifyEventClass({ observationKind: 'COMPUTE_USAGE' }),
      evidence: baseEvidence({
        transformationRef: identityRef('transform', 'gpu-job-9'),
        alternateViewGroupRef: identityRef('view', 'compute'),
        economicTransformationRef: identityRef('transform', 'gpu-job-9'),
        outputLotRefs: [],
      }),
    });
    const inference = createProductiveEconomicEvent({
      eventClass: classifyEventClass({ observationKind: 'AI_INFERENCE' }),
      evidence: baseEvidence({
        transformationRef: identityRef('transform', 'infer-9'),
        alternateViewGroupRef: identityRef('view', 'ai'),
        economicTransformationRef: identityRef('transform', 'infer-9'),
        outputLotRefs: [],
      }),
    });
    assert.notEqual(compute.eventId, inference.eventId);
    const relation = classifyObservationRelation({
      fromKind: 'COMPUTE_USAGE',
      toKind: 'AI_INFERENCE',
      sameUnderlyingEvent: false,
    });
    assert.equal(relation.relation, 'ENABLES');
    assert.ok(candidateEventClassesFor('AI_COMPUTE').includes('AI_COMPUTE_EVENT'));
    assert.ok(candidateEventClassesFor('COMPUTE').includes('COMPUTE_EXECUTION_EVENT'));
  });

  it('8. unrelated similar events do not merge', () => {
    const left = baseEvidence({
      transformationRef: identityRef('transform', 'line-7:B1'),
      outputLotRefs: [identityRef('lot', 'B1')],
      geographyId: 'geo.factory.7',
    });
    const right = baseEvidence({
      transformationRef: identityRef('transform', 'line-8:B9'),
      alternateViewGroupRef: identityRef('view', 'other'),
      economicTransformationRef: identityRef('transform', 'line-8:B9'),
      outputLotRefs: [identityRef('lot', 'B9')],
      geographyId: 'geo.factory.8',
    });
    const assessment = assessEventLinkage(left, right);
    assert.equal(assessment.canEstablishSameUnderlyingEvent, false);
    assert.notEqual(economicEventFingerprintV3(left), economicEventFingerprintV3(right));
  });

  it('9. weak similarity generates possible match only', () => {
    const left = baseEvidence({
      transformationRef: null,
      alternateViewGroupRef: null,
      economicTransformationRef: null,
      outputLotRefs: [],
      inputLotRefs: [],
      serialAssetRefs: [],
      canonicalMeasurementRefs: [],
      physicalObjectRefs: [identityRef('object', 'a')],
    });
    const right = baseEvidence({
      transformationRef: null,
      alternateViewGroupRef: null,
      economicTransformationRef: null,
      outputLotRefs: [],
      inputLotRefs: [],
      serialAssetRefs: [],
      canonicalMeasurementRefs: [],
      physicalObjectRefs: [identityRef('object', 'b')],
    });
    const assessment = assessEventLinkage(left, right);
    assert.equal(assessment.confidence, 'POSSIBLE_MATCH');
    assert.equal(assessment.canEstablishSameUnderlyingEvent, false);
    assert.equal(assessment.reviewRequired, true);
    assert.equal(possibleMatchCannotMerge(assessment.confidence), true);
    const store = new ProductiveEventIdentityRegistry();
    const first = store.register({ eventClass: 'SERVICE_DELIVERY_EVENT', evidence: left }, left);
    const second = store.register({ eventClass: 'SERVICE_DELIVERY_EVENT', evidence: right }, right);
    const link = store.link(first.eventId, second.eventId);
    assert.equal(link.merged, false);
    assert.equal(link.reviewRequired, true);
  });

  it('10. authoritative batch lineage creates a strong link', () => {
    const lineage = buildBatchLineage({
      rawMaterialBatchRef: identityRef('lot', 'A'),
      energyEventRef: identityRef('energy', 'B'),
      manufacturingEventId: 'evt_mfg',
      outputBatchRef: identityRef('lot', 'B1'),
      logisticsEventId: 'evt_log',
      authoritative: true,
    });
    assert.equal(authoritativeLineageCreatesStrongLink(lineage), true);
    assert.equal(outputBatchIsIndependentProduction(lineage), false);
    assert.ok(lineage.edges.some((edge) => edge.relation === 'PRODUCES' && edge.confidence === 'AUTHORITATIVE_LINK'));
    assert.ok(lineage.edges.some((edge) => edge.relation === 'TRANSPORTS'));
  });

  it('11. corrected event supersedes the old event', () => {
    const prior = createProductiveEconomicEvent({
      eventClass: 'MANUFACTURING_TRANSFORMATION_EVENT',
      evidence: baseEvidence(),
      status: 'VERIFIED',
    });
    const result = supersedeEvent(prior, {
      eventClass: 'MANUFACTURING_TRANSFORMATION_EVENT',
      evidence: baseEvidence({
        canonicalMeasurementRefs: [identityRef('measure', 'B1:99')],
      }),
    });
    assert.equal(result.prior.status, 'SUPERSEDED');
    assert.equal(result.relation.relation, 'SUPERSEDES');
    assert.equal(result.next.eventVersion, prior.eventVersion + 1);
    assert.ok(result.next.parentEventRefs.includes(prior.eventId));
  });

  it('12. event graph rebuild is deterministic', () => {
    const event = createProductiveEconomicEvent({
      eventClass: 'MANUFACTURING_TRANSFORMATION_EVENT',
      evidence: baseEvidence(),
      claimRefs: [claimRefFor('mfg'), claimRefFor('robot')],
    });
    const first = rebuildProductiveAttributionGraph({ events: [event] });
    const second = rebuildProductiveAttributionGraph({ events: [event] });
    assert.equal(first.projectionHash, second.projectionHash);
    assert.equal(first.isLedger, false);
    assert.equal(first.isMonetaryAuthority, false);
  });

  it('13. fingerprint v1 remains historical', () => {
    const left = fingerprintV1RemainsHistorical(v1Input());
    const right = contributionFingerprint({ ...v1Input(), oracleFactIds: ['a', 'b'] });
    assert.equal(left, right);
    assert.equal(historicalFingerprintDomains().v1Contribution, 'SUNREY_PRODUCTIVE_V1');
    assert.equal(HISTORICAL_FINGERPRINT_DOMAINS.v1Contribution, 'SUNREY_PRODUCTIVE_V1');
    assert.notEqual(left, economicEventFingerprintV3(baseEvidence()));
  });

  it('14. fingerprint v2 remains historical', () => {
    const v2 = fingerprintV2RemainsHistorical({
      governed: {
        ...v1Input(),
        actorId: 'actor',
        deliveryFromUnixSeconds: PERIOD.validFromUnixSeconds,
        deliveryUntilUnixSeconds: PERIOD.validUntilUnixSeconds,
        claimLineage: ['u2', 'u1'],
      },
      crossCategory: {
        objectId: 'obj.factory.7',
        measurementPeriodEpoch: 12,
        validFromUnixSeconds: PERIOD.validFromUnixSeconds,
        validUntilUnixSeconds: PERIOD.validUntilUnixSeconds,
        deliveryFromUnixSeconds: PERIOD.validFromUnixSeconds,
        deliveryUntilUnixSeconds: PERIOD.validUntilUnixSeconds,
        actorId: 'actor',
        oracleFactIds: ['b', 'a'],
        claimLineage: [],
      },
      capacity: {
        objectId: 'obj.factory.7',
        category: 'MANUFACTURING',
        measurementPeriodEpoch: 12,
        validFromUnixSeconds: PERIOD.validFromUnixSeconds,
        validUntilUnixSeconds: PERIOD.validUntilUnixSeconds,
      },
    });
    assert.equal(
      v2.governed,
      governedContributionFingerprint({
        ...v1Input(),
        actorId: 'actor',
        deliveryFromUnixSeconds: PERIOD.validFromUnixSeconds,
        deliveryUntilUnixSeconds: PERIOD.validUntilUnixSeconds,
        claimLineage: ['u1', 'u2'],
      }),
    );
    assert.equal(
      v2.crossCategory,
      crossCategoryEventFingerprint({
        objectId: 'obj.factory.7',
        measurementPeriodEpoch: 12,
        validFromUnixSeconds: PERIOD.validFromUnixSeconds,
        validUntilUnixSeconds: PERIOD.validUntilUnixSeconds,
        deliveryFromUnixSeconds: PERIOD.validFromUnixSeconds,
        deliveryUntilUnixSeconds: PERIOD.validUntilUnixSeconds,
        actorId: 'actor',
        oracleFactIds: ['a', 'b'],
        claimLineage: [],
      }),
    );
    assert.equal(
      v2.capacity,
      capacityOutputEventFingerprint({
        objectId: 'obj.factory.7',
        category: 'MANUFACTURING',
        measurementPeriodEpoch: 12,
        validFromUnixSeconds: PERIOD.validFromUnixSeconds,
        validUntilUnixSeconds: PERIOD.validUntilUnixSeconds,
      }),
    );
    assert.equal(historicalFingerprintDomains().v2CrossCategory, 'SUNREY_MOONREY_EVENT_V1');
    assert.notEqual(v2.crossCategory, economicEventFingerprintV3(baseEvidence()));
  });

  it('15. fingerprint v3 is deterministic across categories and controllers', () => {
    const left = economicEventFingerprintV3(
      baseEvidence({
        controllerRefs: [identityRef('ctl', 'a')],
        sourceSystemRefs: [identityRef('sys', 'one')],
      }),
    );
    const right = economicEventFingerprintV3(
      baseEvidence({
        controllerRefs: [identityRef('ctl', 'b')],
        sourceSystemRefs: [identityRef('sys', 'two')],
        physicalObjectRefs: [identityRef('object', 'robot.R1')],
      }),
    );
    assert.equal(left, right);
    assert.equal(left.length, 64);
    assert.equal(historicalFingerprintDomains().v3EconomicEvent, 'SUNREY_MOONREY_EVENT_V3');
  });

  it('16. graph cannot mint', () => {
    const event = createProductiveEconomicEvent({
      eventClass: 'MANUFACTURING_TRANSFORMATION_EVENT',
      evidence: baseEvidence(),
    });
    const graph = rebuildProductiveAttributionGraph({ events: [event] });
    assert.equal(attributionGraphCannotMint(graph), false);
    assert.equal(graph.canMint, false);
    assert.equal(graph.isLedger, false);
    assert.equal(graph.isMonetaryAuthority, false);
  });

  it('17. event identity cannot authorize issuance', () => {
    const event = createProductiveEconomicEvent({
      eventClass: 'MANUFACTURING_TRANSFORMATION_EVENT',
      evidence: baseEvidence(),
    });
    assert.equal(eventIdentityCannotAuthorizeIssuance(event), false);
    assert.equal(event.authorizesMoonReyIssuance, false);
    assert.equal(eventOmitsMoonReyQuantity(event), true);
    const registry = new EconomicAssetRegistry();
    const projected = projectEconomicEvent(registry, event, defaultProjectionInstant());
    assert.equal(projected.ok, true);
    if (projected.ok) {
      assert.equal(eventProjectionCannotMint(registry, projected.value), false);
      assert.equal(registry.authorizeMint(projected.value).moonReyQuantity, null);
    }
  });

  it('18. no raw industrial data in the graph or identity evidence', () => {
    const evidence = baseEvidence();
    assert.equal(containsRawIndustrialData(evidence), false);
    const event = createProductiveEconomicEvent({
      eventClass: 'MANUFACTURING_TRANSFORMATION_EVENT',
      evidence,
    });
    const graph = rebuildProductiveAttributionGraph({ events: [event] });
    assert.equal(graph.containsRawIndustrialData, false);
    assert.equal(containsRawIndustrialData(graph), false);
    assert.throws(() => identityRef('payload', 'SCADA telemetry payload dump'), /RAW_INDUSTRIAL_DATA/);
    const mapped = mapEconomicEventAsset(event, defaultProjectionInstant());
    assert.equal(mapped.ok, true);
  });

  it('does not assume one ProductiveCategory equals one event class', () => {
    assert.ok(candidateEventClassesFor('MANUFACTURING').length > 1);
    assert.ok(candidateEventClassesFor('AUTOMATED_MACHINE_OUTPUT').includes('MANUFACTURING_TRANSFORMATION_EVENT'));
    assert.ok(candidateEventClassesFor('GOODS').includes('MANUFACTURING_TRANSFORMATION_EVENT'));
  });
});
