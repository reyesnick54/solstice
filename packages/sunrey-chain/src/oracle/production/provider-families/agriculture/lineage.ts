import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import { createProductiveEconomicEvent, identityRef } from '../../../../productive/policy-governance/attribution/index.ts';
import type { ProductiveEconomicEvent } from '../../../../productive/policy-governance/attribution/types.ts';
import type { AgricultureLineageLink, AgricultureRefusal, NormalizedAgricultureObservation } from './types.ts';

/**
 * 1,000 kg wheat harvested → milling → 750 kg flour is lineage, not
 * 1,750 kg of the same productive quantity.
 */
export function refuseHarvestPlusProcessedSum(
  harvest: NormalizedAgricultureObservation,
  processed: NormalizedAgricultureObservation,
): Result<true, AgricultureRefusal> {
  if (harvest.createsHarvestEvent && processed.measurementSemantics === 'PROCESSED_FOOD') {
    return err({
      code: 'PROCESSED_FOOD_CANNOT_BE_SUMMED_WITH_HARVEST',
      detail: 'raw agricultural output and processed food remain distinct lineage stages',
    });
  }
  if (harvest.measurementSemantics !== processed.measurementSemantics) {
    return err({
      code: 'MEASUREMENT_SEMANTICS_MISMATCH',
      detail: `cannot silently substitute ${harvest.measurementSemantics} for ${processed.measurementSemantics}`,
    });
  }
  return ok(true);
}

export function linkHarvestToProcessing(input: {
  readonly harvest: NormalizedAgricultureObservation;
  readonly processed: NormalizedAgricultureObservation;
}): Result<AgricultureLineageLink, AgricultureRefusal> {
  const summed = refuseHarvestPlusProcessedSum(input.harvest, input.processed);
  if (summed.ok) {
    return err({
      code: 'PROCESSED_FOOD_CANNOT_BE_SUMMED_WITH_HARVEST',
      detail: 'processing must remain a distinct manufacturing transformation',
    });
  }
  if (summed.error.code !== 'PROCESSED_FOOD_CANNOT_BE_SUMMED_WITH_HARVEST') {
    return summed;
  }
  return ok(
    Object.freeze({
      fromObservationId: input.harvest.observationId,
      toObservationId: input.processed.observationId,
      relation: 'TRANSFORMS',
      impliesDuplicateValue: false,
    }),
  );
}

/**
 * Packaged finished food may later appear as GOODS_OUTPUT. Harvest,
 * processing, and goods registration are not three full credits.
 */
export function linkHarvestToGoods(input: {
  readonly harvest: NormalizedAgricultureObservation;
  readonly goodsObservationId: string;
}): Result<AgricultureLineageLink, AgricultureRefusal> {
  if (!input.harvest.createsHarvestEvent) {
    return err({
      code: 'GOODS_REGISTRATION_IS_NOT_NEW_HARVEST',
      detail: 'goods lineage requires an underlying harvest observation',
    });
  }
  return ok(
    Object.freeze({
      fromObservationId: input.harvest.observationId,
      toObservationId: input.goodsObservationId,
      relation: 'OUTPUT_OF',
      impliesDuplicateValue: false,
    }),
  );
}

export function linkHarvestToInventory(input: {
  readonly harvest: NormalizedAgricultureObservation;
  readonly inventory: NormalizedAgricultureObservation;
}): Result<AgricultureLineageLink, AgricultureRefusal> {
  if (!input.harvest.createsHarvestEvent) {
    return err({ code: 'WRONG_FACT_TYPE', detail: 'inventory lineage requires an underlying harvest observation' });
  }
  if (!input.inventory.createsInventoryEvidence) {
    return err({ code: 'INVENTORY_IS_NOT_PRODUCTION', detail: 'inventory lineage requires inventory evidence' });
  }
  return ok(
    Object.freeze({
      fromObservationId: input.harvest.observationId,
      toObservationId: input.inventory.observationId,
      relation: 'STORES',
      impliesDuplicateValue: false,
    }),
  );
}

export function linkIrrigationToHarvest(input: {
  readonly irrigationObservationId: string;
  readonly harvest: NormalizedAgricultureObservation;
}): Result<AgricultureLineageLink, AgricultureRefusal> {
  if (!input.harvest.createsHarvestEvent) {
    return err({
      code: 'IRRIGATION_OWNERSHIP_DUPLICATE',
      detail: 'irrigation is an input to harvest and cannot invent a harvest event',
    });
  }
  return ok(
    Object.freeze({
      fromObservationId: input.irrigationObservationId,
      toObservationId: input.harvest.observationId,
      relation: 'INPUT_TO',
      impliesDuplicateValue: false,
    }),
  );
}

export function processingTransformationEvent(processedObservationId: string): ProductiveEconomicEvent {
  const evidenceStart = 1_700_000_000n;
  return createProductiveEconomicEvent({
    eventClass: 'MANUFACTURING_TRANSFORMATION_EVENT',
    evidence: {
      transformationRef: identityRef('mill', processedObservationId),
      alternateViewGroupRef: identityRef('mill-view', processedObservationId),
      physicalObjectRefs: Object.freeze([identityRef('plant', 'mill-plant')]),
      sourceObjectRefs: Object.freeze([identityRef('plant', 'mill-plant')]),
      inputLotRefs: Object.freeze([identityRef('wheat', processedObservationId)]),
      outputLotRefs: Object.freeze([identityRef('flour', processedObservationId)]),
      serialAssetRefs: Object.freeze([]),
      measurementPeriod: Object.freeze({
        validFromUnixSeconds: evidenceStart,
        validUntilUnixSeconds: evidenceStart + 3_600n,
        epoch: 1,
      }),
      deliveryPeriod: Object.freeze({
        fromUnixSeconds: evidenceStart,
        untilUnixSeconds: evidenceStart + 3_600n,
      }),
      geographyId: 'SIM:prairie:district-north',
      jurisdiction: 'SIM',
      oracleFactRefs: Object.freeze([identityRef('obs', processedObservationId)]),
      sourceProvenanceRefs: Object.freeze([identityRef('src', 'PACKHOUSE_SYSTEM')]),
      upstreamEventRefs: Object.freeze([]),
      downstreamEventRefs: Object.freeze([]),
      canonicalMeasurementRefs: Object.freeze([]),
      controllerRefs: Object.freeze([identityRef('ctl', 'mill-controller')]),
      participantRefs: Object.freeze([]),
      sourceSystemRefs: Object.freeze([identityRef('sys', 'PACKHOUSE_SYSTEM')]),
      lineageRoot: identityRef('wheat', processedObservationId),
      economicTransformationRef: identityRef('mill', processedObservationId),
    },
  });
}

export function goodsCreationEvent(goodsObservationId: string): ProductiveEconomicEvent {
  const evidenceStart = 1_700_000_000n;
  return createProductiveEconomicEvent({
    eventClass: 'GOODS_CREATION_EVENT',
    evidence: {
      transformationRef: identityRef('goods', goodsObservationId),
      alternateViewGroupRef: identityRef('goods-view', goodsObservationId),
      physicalObjectRefs: Object.freeze([identityRef('sku', goodsObservationId)]),
      sourceObjectRefs: Object.freeze([identityRef('sku', goodsObservationId)]),
      inputLotRefs: Object.freeze([identityRef('flour', goodsObservationId)]),
      outputLotRefs: Object.freeze([identityRef('goods', goodsObservationId)]),
      serialAssetRefs: Object.freeze([]),
      measurementPeriod: Object.freeze({
        validFromUnixSeconds: evidenceStart,
        validUntilUnixSeconds: evidenceStart + 3_600n,
        epoch: 1,
      }),
      deliveryPeriod: Object.freeze({
        fromUnixSeconds: evidenceStart,
        untilUnixSeconds: evidenceStart + 3_600n,
      }),
      geographyId: 'SIM:prairie:district-north',
      jurisdiction: 'SIM',
      oracleFactRefs: Object.freeze([identityRef('obs', goodsObservationId)]),
      sourceProvenanceRefs: Object.freeze([identityRef('src', 'GOODS_OUTPUT')]),
      upstreamEventRefs: Object.freeze([]),
      downstreamEventRefs: Object.freeze([]),
      canonicalMeasurementRefs: Object.freeze([]),
      controllerRefs: Object.freeze([identityRef('ctl', 'pack-controller')]),
      participantRefs: Object.freeze([]),
      sourceSystemRefs: Object.freeze([identityRef('sys', 'GOODS_OUTPUT')]),
      lineageRoot: identityRef('wheat', goodsObservationId),
      economicTransformationRef: identityRef('goods', goodsObservationId),
    },
  });
}
