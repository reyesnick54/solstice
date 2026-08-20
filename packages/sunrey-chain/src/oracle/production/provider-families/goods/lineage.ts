/**
 * Goods event identity and cross-family attribution boundaries.
 *
 * Manufacturing output that is later registered as a finished-goods
 * batch is normally the same underlying production event or a derived
 * view. Harvested produce that becomes a goods batch is likewise not a
 * second production event. Merchant GOODS_DELIVERY and carrier
 * DELIVERY_COMPLETION may share a physical delivery without both taking
 * full credit. Independently measured transport can remain distinct.
 *
 * Uses Chunks 120–122. Does not mint MoonRey.
 */

import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import {
  assessEventLinkage,
  createProductiveEconomicEvent,
  identityRef,
} from '../../../../productive/policy-governance/attribution/index.ts';
import { classifyEventClass } from '../../../../productive/policy-governance/attribution/classification.ts';
import { evaluateAttribution, developmentAttributionPolicy } from '../../../../productive/policy-governance/attribution/index.ts';
import { subject, relationship } from '../../../../productive/policy-governance/attribution/fixtures.ts';
import type { EventIdentityEvidence } from '../../../../productive/policy-governance/attribution/types.ts';
import type { ProductiveEconomicEvent } from '../../../../productive/policy-governance/attribution/types.ts';
import type { AttributionEvaluation } from '../../../../productive/policy-governance/attribution/types.ts';
import {
  MANUFACTURING_PLUS_GOODS_DOUBLE_COUNT,
  type GoodsRefusal,
  type GoodsSourceObservation,
} from './types.ts';

export function goodsIdentityRef(kind: string, value: string): string {
  return identityRef(kind, value);
}

export function evidenceFromGoods(observation: GoodsSourceObservation): EventIdentityEvidence {
  const batch = observation.identity.batchRef ?? observation.identity.lotRef ?? observation.identity.serialRef;
  const transformSeed =
    observation.identity.manufacturingEventRef ??
    observation.identity.agricultureEventRef ??
    batch ??
    observation.observationId;
  const start = observation.sourceTimestampUnix;
  const objectRef =
    observation.identity.skuRef ??
    observation.identity.productRef ??
    identityRef('object', observation.observationId);
  return {
    transformationRef: identityRef('transform', transformSeed),
    alternateViewGroupRef: identityRef('view', transformSeed),
    physicalObjectRefs: [objectRef],
    sourceObjectRefs: [objectRef],
    inputLotRefs: observation.identity.harvestLotRef
      ? [observation.identity.harvestLotRef]
      : observation.identity.lotRef
        ? [observation.identity.lotRef]
        : [],
    outputLotRefs: batch ? [batch] : [],
    serialAssetRefs: observation.identity.serialRef ? [observation.identity.serialRef] : [],
    measurementPeriod: {
      validFromUnixSeconds: start,
      validUntilUnixSeconds: start + 1n,
      epoch: 1,
    },
    deliveryPeriod: { fromUnixSeconds: start, untilUnixSeconds: start + 1n },
    geographyId: observation.identity.warehouseRef ?? 'geo.sandbox.goods',
    jurisdiction: 'SIM',
    oracleFactRefs: [identityRef('fact', observation.observationId)],
    sourceProvenanceRefs: [identityRef('prov', observation.sourceId)],
    upstreamEventRefs: [
      observation.identity.manufacturingEventRef,
      observation.identity.agricultureEventRef,
      observation.identity.logisticsDeliveryEventRef,
    ].filter((row): row is string => row !== null),
    downstreamEventRefs: [],
    canonicalMeasurementRefs: [identityRef('measure', `${transformSeed}:${observation.numericValue}:${observation.unit}`)],
    controllerRefs: [identityRef('ctl', observation.controllerId)],
    participantRefs: observation.identity.merchantRef ? [observation.identity.merchantRef] : [],
    sourceSystemRefs: [identityRef('sys', observation.sourceId)],
    lineageRoot: batch,
    economicTransformationRef: identityRef('transform', transformSeed),
  };
}

export function eventFromGoods(observation: GoodsSourceObservation): ProductiveEconomicEvent {
  const evidence = evidenceFromGoods(observation);
  const observationKind = observation.factType === 'GOODS_DELIVERY' ? 'LOGISTICS_DELIVERY' : 'GOODS_BATCH_RECORD';
  return createProductiveEconomicEvent({
    eventClass: classifyEventClass({
      observationKind,
      describesManufacturingTransformation: Boolean(observation.identity.manufacturingEventRef),
      category: 'GOODS',
    }),
    evidence,
    claimRefs: [identityRef('claim', observation.observationId)],
    parentEventRefs: evidence.upstreamEventRefs,
  });
}

export function recognizeSameUnderlyingEvent(left: EventIdentityEvidence, right: EventIdentityEvidence): boolean {
  return assessEventLinkage(left, right).canEstablishSameUnderlyingEvent;
}

export function manufacturingGoodsAreSameEvent(
  manufacturingEvidence: EventIdentityEvidence,
  goods: GoodsSourceObservation,
): boolean {
  return recognizeSameUnderlyingEvent(manufacturingEvidence, evidenceFromGoods(goods));
}

export function agricultureGoodsAreSameEvent(
  agricultureEvidence: EventIdentityEvidence,
  goods: GoodsSourceObservation,
): boolean {
  return recognizeSameUnderlyingEvent(agricultureEvidence, evidenceFromGoods(goods));
}

export function evaluateManufacturingGoodsAttribution(
  manufacturingEventId: string,
  goods: GoodsSourceObservation,
): Result<AttributionEvaluation, GoodsRefusal> {
  if (goods.identity.manufacturingEventRef === null || goods.identity.batchRef === null) {
    return err({
      code: 'MISSING_REALIZED_EVIDENCE',
      detail: 'manufacturing→goods attribution requires a shared batch and manufacturing event ref',
    });
  }
  const evaluation = evaluateAttribution({
    policy: developmentAttributionPolicy(),
    height: 100,
    subjects: [
      subject({
        claimId: 'claim.mfg.output',
        economicEventId: manufacturingEventId,
        category: 'MANUFACTURING',
        controllerId: goods.controllerId,
        quantity: BigInt(observationQuantity(goods)),
        unitId: goods.unit === 'UNIT' ? 'UNIT' : 'units_produced',
        batchIdentity: goods.identity.batchRef,
      }),
      subject({
        claimId: 'claim.goods.output',
        economicEventId: manufacturingEventId,
        category: 'GOODS',
        controllerId: goods.controllerId,
        quantity: BigInt(observationQuantity(goods)),
        unitId: goods.unit === 'UNIT' ? 'UNIT' : 'units_produced',
        batchIdentity: goods.identity.batchRef,
        lineageEventIds: [manufacturingEventId],
      }),
    ],
    relationships: [relationship(manufacturingEventId, manufacturingEventId, 'GOODS_IDENTITY')],
  });
  const fullCredits = evaluation.decisions.filter((row) => row.decision === 'FULL_ATTRIBUTION').length;
  if (fullCredits > 1) {
    return err({
      code: 'MANUFACTURING_GOODS_DOUBLE_COUNT',
      detail: 'manufacturing output and finished-goods registration cannot both take full productive credit',
    });
  }
  return ok(evaluation);
}

export function evaluateAgricultureGoodsAttribution(
  agricultureEventId: string,
  goods: GoodsSourceObservation,
): Result<AttributionEvaluation, GoodsRefusal> {
  const evaluation = evaluateAttribution({
    policy: developmentAttributionPolicy(),
    height: 100,
    subjects: [
      subject({
        claimId: 'claim.ag.harvest',
        economicEventId: agricultureEventId,
        category: 'FOOD_AGRICULTURE',
        controllerId: goods.controllerId,
        quantity: BigInt(observationQuantity(goods)),
        unitId: goods.unit === 'kg' || goods.unit === 'tonne' ? goods.unit : 'kg',
        batchIdentity: goods.identity.harvestLotRef ?? goods.identity.batchRef ?? undefined,
      }),
      subject({
        claimId: 'claim.goods.batch',
        economicEventId: agricultureEventId,
        category: 'GOODS',
        controllerId: goods.controllerId,
        quantity: BigInt(observationQuantity(goods)),
        unitId: goods.unit === 'UNIT' ? 'UNIT' : 'units_produced',
        batchIdentity: goods.identity.batchRef ?? undefined,
        lineageEventIds: [agricultureEventId],
      }),
    ],
    relationships: [relationship(agricultureEventId, agricultureEventId, 'SAME_UNDERLYING_EVENT')],
  });
  const fullCredits = evaluation.decisions.filter((row) => row.decision === 'FULL_ATTRIBUTION').length;
  if (fullCredits > 1) {
    return err({
      code: 'AGRICULTURE_GOODS_DOUBLE_COUNT',
      detail: 'harvested produce and the goods batch cannot both take full productive credit',
    });
  }
  return ok(evaluation);
}

export function evaluateLogisticsGoodsDeliveryAttribution(
  carrierDeliveryEventId: string,
  goods: GoodsSourceObservation,
  independentlyMeasuredTransport: boolean,
): Result<AttributionEvaluation, GoodsRefusal> {
  const goodsEvent = eventFromGoods(goods);
  const sharedEventId = independentlyMeasuredTransport ? goodsEvent.eventId : carrierDeliveryEventId;
  const kind = independentlyMeasuredTransport ? 'DISTINCT_REALIZED_SERVICE' : 'SAME_UNDERLYING_EVENT';
  const evaluation = evaluateAttribution({
    policy: developmentAttributionPolicy(),
    height: 100,
    subjects: [
      subject({
        claimId: 'claim.logistics.delivery',
        economicEventId: independentlyMeasuredTransport ? carrierDeliveryEventId : sharedEventId,
        category: 'LOGISTICS_TRANSPORTATION',
        claimType: 'DELIVERY',
        eventClass: 'DELIVERY',
        controllerId: independentlyMeasuredTransport ? 'controller.carrier' : goods.controllerId,
        quantity: 1n,
        unitId: 'units_produced',
      }),
      subject({
        claimId: 'claim.goods.delivery',
        economicEventId: independentlyMeasuredTransport ? goodsEvent.eventId : sharedEventId,
        category: 'GOODS',
        claimType: 'DELIVERY',
        eventClass: 'DELIVERY',
        controllerId: goods.controllerId,
        quantity: BigInt(observationQuantity(goods)),
        unitId: 'units_produced',
        lineageEventIds: independentlyMeasuredTransport ? [carrierDeliveryEventId] : [],
      }),
    ],
    relationships: [
      relationship(
        independentlyMeasuredTransport ? carrierDeliveryEventId : sharedEventId,
        independentlyMeasuredTransport ? goodsEvent.eventId : sharedEventId,
        kind,
      ),
    ],
  });
  if (!independentlyMeasuredTransport) {
    const fullCredits = evaluation.decisions.filter((row) => row.decision === 'FULL_ATTRIBUTION').length;
    if (fullCredits > 1) {
      return err({
        code: 'CARRIER_GOODS_DELIVERY_DOUBLE_COUNT',
        detail: 'merchant goods delivery and carrier completion of the same physical delivery cannot both take full credit',
      });
    }
  }
  return ok(evaluation);
}

export function evaluateSourceIndependence(
  observations: readonly GoodsSourceObservation[],
): Result<{ readonly independentControllers: number }, GoodsRefusal> {
  const controllers = new Set(observations.map((row) => row.controllerId));
  const fakeQuorum = observations.some(
    (row) =>
      row.sharedControlGroup !== null &&
      row.relatedSourceIds.some((id) => id !== row.sourceId),
  );
  if (fakeQuorum) {
    return err({
      code: 'SAME_CONTROLLER_FAKE_QUORUM',
      detail: 'ERP, OMS, WMS, and POS owned by the same retailer are not independent controllers',
    });
  }
  return ok({ independentControllers: controllers.size });
}

export function manufacturingPlusGoodsDoubleCount(): false {
  return MANUFACTURING_PLUS_GOODS_DOUBLE_COUNT;
}

function observationQuantity(observation: GoodsSourceObservation): string {
  return /^[0-9]+$/.test(observation.numericValue) ? observation.numericValue : '0';
}
