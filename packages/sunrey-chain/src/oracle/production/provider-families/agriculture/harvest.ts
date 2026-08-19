import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import { convertExact } from '../../../../units/convert.ts';
import { exactQuantity, integerMantissaOf } from '../../../../units/quantity.ts';
import type { ExactQuantity, NormalizationReceipt } from '../../../../units/types.ts';
import {
  assessEventLinkage,
  createProductiveEconomicEvent,
  identityRef,
} from '../../../../productive/policy-governance/attribution/index.ts';
import type {
  EventIdentityEvidence,
  ProductiveEconomicEvent,
} from '../../../../productive/policy-governance/attribution/types.ts';
import type {
  AgricultureIdentityRefs,
  AgricultureRefusal,
  AgricultureRegisterSnapshot,
  AgricultureSourceRecord,
  NormalizedAgricultureObservation,
} from './types.ts';

const GRAMS_PER_KG = 1_000n;
const GRAMS_PER_TONNE = 1_000_000n;

export function identityRefsOf(record: AgricultureSourceRecord): AgricultureIdentityRefs {
  return Object.freeze({
    farmSiteRef: identityRef('farm', record.identity.farmSiteId),
    fieldPlotRef: record.identity.fieldPlotId ? identityRef('field', record.identity.fieldPlotId) : null,
    cropCycleRef: record.identity.cropCycleId ? identityRef('cycle', record.identity.cropCycleId) : null,
    harvestCampaignRef: record.identity.harvestCampaignId
      ? identityRef('campaign', record.identity.harvestCampaignId)
      : null,
    harvestBatchRef: record.identity.harvestBatchId ? identityRef('batch', record.identity.harvestBatchId) : null,
    lotRef: record.identity.lotId ? identityRef('lot', record.identity.lotId) : null,
    siloBatchRef: record.identity.siloBatchId ? identityRef('silo', record.identity.siloBatchId) : null,
    packhouseBatchRef: record.identity.packhouseBatchId
      ? identityRef('packhouse', record.identity.packhouseBatchId)
      : null,
  });
}

export function harvestEvidenceOf(
  observation: NormalizedAgricultureObservation,
  measurementStartUnix: bigint,
  measurementEndUnix: bigint,
): EventIdentityEvidence {
  const refs = observation.identityRefs;
  const lotRefs = [refs.harvestBatchRef, refs.lotRef, refs.siloBatchRef, refs.packhouseBatchRef].filter(
    (value): value is string => value !== null,
  );
  const alternate = refs.harvestCampaignRef ?? refs.harvestBatchRef ?? refs.lotRef ?? refs.cropCycleRef;
  return Object.freeze({
    transformationRef: refs.cropCycleRef,
    alternateViewGroupRef: alternate,
    physicalObjectRefs: Object.freeze(
      [refs.farmSiteRef, refs.fieldPlotRef].filter((value): value is string => value !== null),
    ),
    sourceObjectRefs: Object.freeze([refs.farmSiteRef]),
    inputLotRefs: Object.freeze([]),
    outputLotRefs: Object.freeze(lotRefs),
    serialAssetRefs: Object.freeze([]),
    measurementPeriod: Object.freeze({
      validFromUnixSeconds: measurementStartUnix,
      validUntilUnixSeconds: measurementEndUnix,
      epoch: 1,
    }),
    deliveryPeriod: Object.freeze({
      fromUnixSeconds: measurementStartUnix,
      untilUnixSeconds: measurementEndUnix,
    }),
    geographyId: `${observation.geography.jurisdiction}:${observation.geography.farmRegion}:${observation.geography.agriculturalDistrict}`,
    jurisdiction: observation.geography.jurisdiction,
    oracleFactRefs: Object.freeze([identityRef('obs', observation.observationId)]),
    sourceProvenanceRefs: Object.freeze([identityRef('src', observation.sourceClass)]),
    upstreamEventRefs: Object.freeze([]),
    downstreamEventRefs: Object.freeze([]),
    canonicalMeasurementRefs: Object.freeze([
      identityRef('mass', `${observation.canonicalQuantity.mantissa.toString()}:${observation.canonicalUnit}`),
    ]),
    controllerRefs: Object.freeze([identityRef('ctl', observation.controllerId)]),
    participantRefs: Object.freeze([identityRef('op', observation.operatorPartyId)]),
    sourceSystemRefs: Object.freeze([identityRef('sys', observation.sourceClass)]),
    lineageRoot: refs.harvestBatchRef ?? refs.lotRef ?? refs.cropCycleRef ?? refs.farmSiteRef,
    economicTransformationRef: refs.cropCycleRef,
  });
}

/**
 * Combine telemetry + farm system + weigh scale of the same harvest
 * batch/lot/campaign are one agricultural event, not four harvests.
 */
export function clusterHarvestObservations(
  observations: readonly NormalizedAgricultureObservation[],
  measurementStartUnix: bigint,
  measurementEndUnix: bigint,
): Result<readonly ProductiveEconomicEvent[], AgricultureRefusal> {
  const harvest = observations.filter((row) => row.createsHarvestEvent);
  if (harvest.length === 0) {
    return ok(Object.freeze([]));
  }
  const clusters: NormalizedAgricultureObservation[][] = [];
  for (const observation of harvest) {
    const evidence = harvestEvidenceOf(observation, measurementStartUnix, measurementEndUnix);
    let attached = false;
    for (const cluster of clusters) {
      const representative = cluster[0]!;
      const linkage = assessEventLinkage(
        harvestEvidenceOf(representative, measurementStartUnix, measurementEndUnix),
        evidence,
      );
      if (linkage.canEstablishSameUnderlyingEvent) {
        cluster.push(observation);
        attached = true;
        break;
      }
    }
    if (!attached) {
      clusters.push([observation]);
    }
  }
  const events = clusters.map((cluster) => {
    const head = cluster[0]!;
    return createProductiveEconomicEvent({
      eventClass: 'AGRICULTURAL_PRODUCTION_EVENT',
      evidence: harvestEvidenceOf(head, measurementStartUnix, measurementEndUnix),
      claimRefs: cluster.map((row) => identityRef('obs', row.observationId)),
    });
  });
  return ok(Object.freeze(events));
}

export function refuseDuplicateHarvestMass(
  events: readonly ProductiveEconomicEvent[],
  claimedIndependentOutputs: number,
): Result<true, AgricultureRefusal> {
  if (claimedIndependentOutputs > events.length) {
    return err({
      code: 'DUPLICATE_HARVEST_MASS',
      detail: `claimed ${claimedIndependentOutputs} independent harvest outputs for ${events.length} underlying event(s)`,
    });
  }
  return ok(true);
}

export function normalizeHarvestMass(input: {
  readonly mantissa: bigint;
  readonly unit: string;
  readonly factType: 'FOOD_PRODUCTION' | 'AGRICULTURAL_OUTPUT';
  readonly targetUnit?: 'kg' | 'tonne';
}): Result<
  {
    readonly source: ExactQuantity;
    readonly canonical: ExactQuantity;
    readonly unit: 'kg' | 'tonne';
    readonly receipt: NormalizationReceipt;
  },
  AgricultureRefusal
> {
  if (input.unit === 'm2') {
    return err({
      code: 'AREA_IS_NOT_OUTPUT',
      detail: 'field area (m2) is not convertible into harvested mass without an independently observed output',
    });
  }
  if (input.unit === 'L' || input.unit === 'm3' || input.unit === 'units_produced' || input.unit === 'UNIT') {
    return err({
      code: 'UNIT_EXTENSION_REQUIRED',
      detail: `${input.unit} is not a canonical food/agriculture mass unit; do not invent a conversion`,
    });
  }
  if (input.unit !== 'kg' && input.unit !== 'tonne' && input.unit !== 'g') {
    return err({
      code: 'INCOMPATIBLE_UNIT',
      detail: `agricultural harvest facts accept kg/tonne; received ${input.unit}`,
    });
  }
  const target = input.targetUnit ?? (input.unit === 'kg' || input.unit === 'g' ? 'kg' : 'tonne');
  const source = exactQuantity({ mantissa: input.mantissa, unitId: input.unit });
  if (!source.ok) {
    return err({ code: 'INCOMPATIBLE_UNIT', detail: source.error.detail });
  }
  const converted = convertExact({
    source: source.value,
    targetUnitId: target,
    context: { factType: input.factType, productiveCategory: 'FOOD_AGRICULTURE' },
    clock: { nowIso: () => '2026-08-19T00:00:00.000Z' },
  });
  if (!converted.ok) {
    return err({ code: 'INCOMPATIBLE_UNIT', detail: converted.error.detail });
  }
  return ok(
    Object.freeze({
      source: source.value,
      canonical: converted.value.targetQuantity,
      unit: target,
      receipt: converted.value,
    }),
  );
}

export function quantityToGrams(quantity: ExactQuantity): Result<bigint, AgricultureRefusal> {
  const grams = convertExact({
    source: quantity,
    targetUnitId: 'g',
    context: { factType: 'AGRICULTURAL_OUTPUT', productiveCategory: 'FOOD_AGRICULTURE' },
    clock: { nowIso: () => '2026-08-19T00:00:00.000Z' },
  });
  if (!grams.ok) {
    return err({ code: 'INCOMPATIBLE_UNIT', detail: grams.error.detail });
  }
  const mantissa = integerMantissaOf(grams.value.targetQuantity);
  if (!mantissa.ok) {
    return err({ code: 'INCOMPATIBLE_UNIT', detail: mantissa.error.detail });
  }
  return ok(mantissa.value);
}

export type HarvestIntervalDerivation =
  | { readonly kind: 'INTERVAL'; readonly mantissa: bigint }
  | { readonly kind: 'CUMULATIVE_DELTA'; readonly mantissa: bigint; readonly prior: AgricultureRegisterSnapshot }
  | { readonly kind: 'CUMULATIVE_REGISTER_ONLY'; readonly mantissa: bigint };

/**
 * Interval harvest is the reported quantity. Cumulative harvest is
 * current − prior only when the same meter/register are ordered in
 * time with no reset or rollover ambiguity. Never negative output.
 */
export function deriveHarvestInterval(
  record: AgricultureSourceRecord,
  currentMantissa: bigint,
): Result<HarvestIntervalDerivation, AgricultureRefusal> {
  if (record.meterSemantics === 'INTERVAL_MASS') {
    return ok(Object.freeze({ kind: 'INTERVAL', mantissa: currentMantissa }));
  }
  const prior = record.prior;
  if (!prior) {
    return ok(Object.freeze({ kind: 'CUMULATIVE_REGISTER_ONLY', mantissa: currentMantissa }));
  }
  if (record.equipmentReplacement || prior.meterRef !== record.meterRef || prior.registerId !== record.registerId) {
    return err({
      code: 'EQUIPMENT_REPLACEMENT',
      detail: 'equipment replacement or register identity change is not treated as harvest',
    });
  }
  const currentTs = BigInt(record.sourceTimestampUnix);
  if (currentTs < prior.sourceTimestampUnix) {
    return err({
      code: 'TIMESTAMP_REVERSAL',
      detail: 'source timestamp moved backwards relative to the previous valid reading',
    });
  }
  if (currentTs === prior.sourceTimestampUnix && currentMantissa === prior.readingMantissa && record.unit === prior.unit) {
    return err({
      code: 'DUPLICATE_READING',
      detail: 'identical cumulative harvest reading is a retransmission, not new output',
    });
  }
  if (currentMantissa === prior.readingMantissa) {
    return err({
      code: 'DUPLICATE_READING',
      detail: 'same cumulative register value is not interval harvest',
    });
  }
  if (currentMantissa < prior.readingMantissa) {
    const extras = record.extras ?? {};
    if (record.documentedMeterReset || extras.meterReset === true || extras.reset === true) {
      return err({
        code: 'METER_RESET',
        detail: 'documented harvest-counter reset is not converted into negative or replacement output',
      });
    }
    if (prior.readingMantissa > 1_000_000n && currentMantissa < prior.readingMantissa / 10n) {
      return err({
        code: 'COUNTER_ROLLOVER',
        detail: 'harvest-counter rollover is ambiguous and is not converted into production',
      });
    }
    return err({
      code: 'COUNTER_RESET_UNDOCUMENTED',
      detail: 'cumulative harvest meter decreased without a documented reset',
    });
  }
  return ok(
    Object.freeze({
      kind: 'CUMULATIVE_DELTA',
      mantissa: currentMantissa - prior.readingMantissa,
      prior,
    }),
  );
}

export function gramsPerKilogram(): bigint {
  return GRAMS_PER_KG;
}

export function gramsPerTonne(): bigint {
  return GRAMS_PER_TONNE;
}
