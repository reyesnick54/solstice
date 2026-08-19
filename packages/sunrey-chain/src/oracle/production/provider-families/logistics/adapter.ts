/**
 * Logistics / storage ingest adapter. Fixture and in-process only.
 * Consensus is never called. Facts never mint MoonRey.
 */

import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import { oracleFactCreationNeverMintsMoonRey } from '../../eligibility.ts';
import { createProductiveEconomicEvent } from '../../../../productive/policy-governance/attribution/event.ts';
import { identityRef } from '../../../../productive/policy-governance/attribution/identity.ts';
import type {
  EventIdentityEvidence,
  ProductiveEconomicEvent,
  ProductiveEconomicEventClass,
} from '../../../../productive/policy-governance/attribution/types.ts';
import { evaluateDeliveryCompletion } from './delivery.ts';
import { reviewRestrictedMovement, type MovementReview } from './geography.ts';
import { deriveTonneKm, evaluateMultiLeg } from './legs.ts';
import { profileFor } from './profiles.ts';
import { publicEvidenceFrom, refusePublicPrivacyLeaks } from './privacy.ts';
import { detectSchemaDrift, refuseFloatNumericValue } from './schemas.ts';
import { canonicalLogisticsRefs, shipmentLineageParent } from './shipments.ts';
import { measureStorage } from './storage.ts';
import {
  GOODS_PRODUCTION_RECOUNTED_AS_LOGISTICS,
  LOGISTICS_FACT_AUTO_MINTS,
  PRODUCTION_ACTIVE,
  RAW_GPS_PUBLIC,
  REAL_CARRIER_CONTACTED,
  STORAGE_FACT_AUTO_MINTS,
  WAREHOUSE_CAPACITY_EQUALS_STORAGE_SERVICE,
  isLogisticsFactType,
  isLogisticsSourceFamily,
  type LogisticsRefusal,
  type LogisticsSourceObservation,
  type MassDistanceDerivationReceipt,
  type PublicLogisticsEvidence,
  type RealizationState,
} from './types.ts';

export type LogisticsFabricDecision = {
  readonly accepted: boolean;
  readonly reviewRequired: boolean;
  readonly refusal: LogisticsRefusal | null;
  readonly publicEvidence: PublicLogisticsEvidence | null;
  readonly events: readonly ProductiveEconomicEvent[];
  readonly freightReceipts: readonly MassDistanceDerivationReceipt[];
  readonly movement: MovementReview;
  readonly goodsProductionRecountedAsLogistics: false;
  readonly warehouseCapacityEqualsStorageService: false;
  readonly rawGpsPublic: false;
  readonly realCarrierContacted: false;
  readonly productionActive: false;
  readonly logisticsFactAutoMints: false;
  readonly storageFactAutoMints: false;
  readonly networkCalls: 0;
};

function emptyMovement(): MovementReview {
  return Object.freeze({
    flags: Object.freeze([]),
    reviewRequired: false,
    securityGradeAntiSpoofing: false,
  });
}

function refuse(code: LogisticsRefusal['code'], detail: string, reviewRequired = false): LogisticsFabricDecision {
  return Object.freeze({
    accepted: false,
    reviewRequired,
    refusal: Object.freeze({ code, detail, reviewRequired }),
    publicEvidence: null,
    events: Object.freeze([]),
    freightReceipts: Object.freeze([]),
    movement: emptyMovement(),
    goodsProductionRecountedAsLogistics: GOODS_PRODUCTION_RECOUNTED_AS_LOGISTICS,
    warehouseCapacityEqualsStorageService: WAREHOUSE_CAPACITY_EQUALS_STORAGE_SERVICE,
    rawGpsPublic: RAW_GPS_PUBLIC,
    realCarrierContacted: REAL_CARRIER_CONTACTED,
    productionActive: PRODUCTION_ACTIVE,
    logisticsFactAutoMints: LOGISTICS_FACT_AUTO_MINTS,
    storageFactAutoMints: STORAGE_FACT_AUTO_MINTS,
    networkCalls: 0,
  });
}

function succeed(input: {
  readonly reviewRequired: boolean;
  readonly publicEvidence: PublicLogisticsEvidence;
  readonly events: readonly ProductiveEconomicEvent[];
  readonly freightReceipts: readonly MassDistanceDerivationReceipt[];
  readonly movement: MovementReview;
}): LogisticsFabricDecision {
  return Object.freeze({
    accepted: true,
    reviewRequired: input.reviewRequired,
    refusal: null,
    publicEvidence: input.publicEvidence,
    events: Object.freeze([...input.events]),
    freightReceipts: Object.freeze([...input.freightReceipts]),
    movement: input.movement,
    goodsProductionRecountedAsLogistics: GOODS_PRODUCTION_RECOUNTED_AS_LOGISTICS,
    warehouseCapacityEqualsStorageService: WAREHOUSE_CAPACITY_EQUALS_STORAGE_SERVICE,
    rawGpsPublic: RAW_GPS_PUBLIC,
    realCarrierContacted: REAL_CARRIER_CONTACTED,
    productionActive: PRODUCTION_ACTIVE,
    logisticsFactAutoMints: LOGISTICS_FACT_AUTO_MINTS,
    storageFactAutoMints: STORAGE_FACT_AUTO_MINTS,
    networkCalls: 0,
  });
}

function evidenceFor(
  observation: LogisticsSourceObservation,
  eventClass: ProductiveEconomicEventClass,
): EventIdentityEvidence {
  const refs = canonicalLogisticsRefs(observation.identity);
  const start = observation.measurementStartUnix ?? observation.sourceTimestampUnix;
  const end = observation.measurementEndUnix ?? observation.sourceTimestampUnix + 1n;
  return {
    transformationRef: refs.shipment,
    alternateViewGroupRef: refs.deliveryGroup,
    physicalObjectRefs: [refs.vehicle, refs.container].filter((row): row is string => row !== null),
    sourceObjectRefs: [identityRef('source', observation.sourceId)],
    inputLotRefs: refs.goodsBatch ? [refs.goodsBatch] : [],
    outputLotRefs: [],
    serialAssetRefs: [],
    measurementPeriod: {
      validFromUnixSeconds: start,
      validUntilUnixSeconds: end,
      epoch: 1,
    },
    deliveryPeriod: { fromUnixSeconds: start, untilUnixSeconds: end },
    geographyId: refs.origin ?? 'geo.region.restricted',
    jurisdiction: 'SIM',
    oracleFactRefs: [identityRef('obs', observation.observationId)],
    sourceProvenanceRefs: [identityRef('prov', observation.sourceFamily)],
    upstreamEventRefs: refs.manufacturingEvent ? [refs.manufacturingEvent] : [],
    downstreamEventRefs: [],
    canonicalMeasurementRefs: refs.shipment ? [refs.shipment] : [],
    controllerRefs: [identityRef('ctl', observation.controllerId)],
    participantRefs: refs.carrier ? [refs.carrier] : [],
    sourceSystemRefs: [identityRef('sys', observation.sourceId)],
    lineageRoot: shipmentLineageParent(observation.identity),
    economicTransformationRef: eventClass === 'MANUFACTURING_TRANSFORMATION_EVENT' ? refs.manufacturingEvent : refs.shipment,
  };
}

export class LogisticsStorageDataFabric {
  ingest(observation: LogisticsSourceObservation): Result<LogisticsFabricDecision, LogisticsRefusal> {
    if (observation.networkCallAttempted === true) {
      return ok(refuse('NETWORK_FORBIDDEN', 'logistics fabric does not contact real carriers'));
    }
    if (!isLogisticsSourceFamily(observation.sourceFamily)) {
      return ok(refuse('UNKNOWN_SOURCE_FAMILY', `unsupported source family ${observation.sourceFamily}`));
    }
    if (!isLogisticsFactType(observation.factType)) {
      return ok(refuse('UNKNOWN_FACT_TYPE', `do not invent synonym fact types; ${observation.factType} is not canonical`));
    }
    const float = refuseFloatNumericValue(observation.numericValue, 'numericValue');
    if (!float.ok) {
      return ok(refuse(float.error.code, float.error.detail));
    }
    const privacy = refusePublicPrivacyLeaks(observation);
    if (!privacy.ok) {
      return ok(refuse(privacy.error.code, privacy.error.detail));
    }
    const profile = profileFor(observation.sourceFamily);
    const schema = detectSchemaDrift(observation, observation.factType);
    if (!schema.ok) {
      return ok(refuse(schema.error.code, schema.error.detail));
    }
    if (
      observation.relatedSourceIds.length > 0 &&
      observation.sharedControlGroup !== null &&
      observation.relatedSourceIds.some((id) => id !== observation.sourceId)
    ) {
      return ok(refuse('SAME_CONTROLLER_FAKE_QUORUM', 'different APIs of the same carrier are not independent controllers'));
    }
    if (
      observation.identity.goodsBatchRef &&
      observation.factType === 'LOGISTICS_CAPACITY' &&
      observation.unit === 'units_produced'
    ) {
      return ok(refuse('GOODS_OUTPUT_REPLAYED_AS_LOGISTICS', 'manufactured goods quantity is not logistics output'));
    }

    const movement = reviewRestrictedMovement(observation.restrictedTelematics);

    if (observation.factType === 'STORAGE_CAPACITY') {
      const storage = measureStorage(observation);
      if (!storage.ok) {
        return ok(refuse(storage.error.code, storage.error.detail, storage.error.reviewRequired));
      }
      const event = createProductiveEconomicEvent({
        eventClass: 'STORAGE_SERVICE_EVENT',
        evidence: evidenceFor(observation, 'STORAGE_SERVICE_EVENT'),
        claimRefs: [identityRef('claim', observation.observationId)],
        parentEventRefs: observation.identity.manufacturingEventRef
          ? [identityRef('manufacturing-event', observation.identity.manufacturingEventRef)]
          : [],
      });
      return ok(
        succeed({
          reviewRequired: movement.reviewRequired,
          freightReceipts: [],
          movement,
          events: [event],
          publicEvidence: publicEvidenceFrom({
            observation,
            claimType: storage.value.realizationState === 'CAPACITY' ? 'CAPACITY' : 'USAGE',
            productiveCategory: 'STORAGE',
            realizationState: storage.value.realizationState,
            unit: storage.value.unit,
            mantissa: storage.value.mantissa.toString(),
            derivationReceiptId: storage.value.volumeTimeReceipt?.receiptId ?? null,
            proofOfDeliveryRef: null,
            storageQualifier: storage.value.qualifier,
            temperatureEvidenceCommitment: storage.value.temperatureEvidenceCommitment,
          }),
        }),
      );
    }

    if (observation.factType === 'DELIVERY_COMPLETION' || observation.factType === 'GOODS_DELIVERY') {
      const delivery = evaluateDeliveryCompletion(observation);
      if (!delivery.ok) {
        return ok(refuse(delivery.error.code, delivery.error.detail));
      }
      const event = createProductiveEconomicEvent({
        eventClass: 'LOGISTICS_DELIVERY_EVENT',
        evidence: evidenceFor(observation, 'LOGISTICS_DELIVERY_EVENT'),
        claimRefs: [identityRef('claim', observation.observationId)],
        parentEventRefs: observation.identity.manufacturingEventRef
          ? [identityRef('manufacturing-event', observation.identity.manufacturingEventRef)]
          : [],
      });
      return ok(
        succeed({
          reviewRequired: movement.reviewRequired,
          freightReceipts: [],
          movement,
          events: [event],
          publicEvidence: publicEvidenceFrom({
            observation,
            claimType: 'DELIVERY',
            productiveCategory: 'LOGISTICS_TRANSPORTATION',
            realizationState: 'REALIZED',
            unit: observation.unit ?? 'units_produced',
            mantissa: observation.numericValue ?? '1',
            derivationReceiptId: null,
            proofOfDeliveryRef: delivery.value.proofRef,
            storageQualifier: null,
            temperatureEvidenceCommitment: null,
          }),
        }),
      );
    }

    const realization: RealizationState = observation.realizationState ?? profile.realizationState;
    if (realization === 'CAPACITY' && observation.numericValue && observation.unit === 'tonne_km' && !observation.mass && !observation.distance && !observation.legs) {
      const event = createProductiveEconomicEvent({
        eventClass: 'LOGISTICS_DELIVERY_EVENT',
        evidence: evidenceFor(observation, 'LOGISTICS_DELIVERY_EVENT'),
        claimRefs: [identityRef('claim', `${observation.observationId}:capacity`)],
      });
      return ok(
        succeed({
          reviewRequired: movement.reviewRequired,
          freightReceipts: [],
          movement,
          events: [event],
          publicEvidence: publicEvidenceFrom({
            observation,
            claimType: 'CAPACITY',
            productiveCategory: 'LOGISTICS_TRANSPORTATION',
            realizationState: 'CAPACITY',
            unit: 'tonne_km',
            mantissa: observation.numericValue,
            derivationReceiptId: null,
            proofOfDeliveryRef: null,
            storageQualifier: null,
            temperatureEvidenceCommitment: null,
          }),
        }),
      );
    }

    const legs = evaluateMultiLeg(observation);
    if (!legs.ok) {
      return ok(refuse(legs.error.code, legs.error.detail, legs.error.reviewRequired));
    }
    if (legs.value.receipts.length === 0 && realization !== 'CAPACITY') {
      const derived = deriveTonneKm(observation.mass, observation.distance, undefined);
      if (!derived.ok) {
        return ok(refuse(derived.error.code, derived.error.detail));
      }
    }

    const events = (observation.legs ?? [])
      .filter((leg) => leg.independentlyRealized)
      .map((leg) =>
        createProductiveEconomicEvent({
          eventClass: 'LOGISTICS_DELIVERY_EVENT',
          evidence: {
            ...evidenceFor(observation, 'LOGISTICS_DELIVERY_EVENT'),
            transformationRef: identityRef('leg', leg.legRef),
          },
          claimRefs: [identityRef('claim', `${observation.observationId}:${leg.legRef}`)],
          parentEventRefs: observation.identity.manufacturingEventRef
            ? [identityRef('manufacturing-event', observation.identity.manufacturingEventRef)]
            : [],
        }),
      );

    const singleEvent =
      events.length === 0
        ? [
            createProductiveEconomicEvent({
              eventClass: 'LOGISTICS_DELIVERY_EVENT',
              evidence: evidenceFor(observation, 'LOGISTICS_DELIVERY_EVENT'),
              claimRefs: [identityRef('claim', observation.observationId)],
              parentEventRefs: observation.identity.manufacturingEventRef
                ? [identityRef('manufacturing-event', observation.identity.manufacturingEventRef)]
                : [],
            }),
          ]
        : events;

    const first = legs.value.receipts[0];
    return ok(
      succeed({
        reviewRequired: movement.reviewRequired,
        freightReceipts: legs.value.receipts,
        movement,
        events: singleEvent,
        publicEvidence: publicEvidenceFrom({
          observation,
          claimType: realization === 'CAPACITY' ? 'CAPACITY' : 'USAGE',
          productiveCategory: 'LOGISTICS_TRANSPORTATION',
          realizationState: realization,
          unit: first?.tonneKm.unitId ?? 'tonne_km',
          mantissa: first?.tonneKm.mantissa.toString() ?? observation.numericValue ?? null,
          derivationReceiptId: first?.receiptId ?? null,
          proofOfDeliveryRef: null,
          storageQualifier: null,
          temperatureEvidenceCommitment: null,
        }),
      }),
    );
  }
}

export const defaultLogisticsFabric = new LogisticsStorageDataFabric();

export function ingestLogisticsObservation(
  observation: LogisticsSourceObservation,
): Result<LogisticsFabricDecision, LogisticsRefusal> {
  return defaultLogisticsFabric.ingest(observation);
}

export function logisticsObservationNeverMints(_decision: LogisticsFabricDecision): true {
  return oracleFactCreationNeverMintsMoonRey();
}
