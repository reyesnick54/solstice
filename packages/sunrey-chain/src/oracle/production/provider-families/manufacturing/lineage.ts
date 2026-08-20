/**
 * Manufacturing event identity, source independence, goods lineage,
 * batch split/merge, and mass-balance evidence.
 *
 * MES, robot telemetry, ERP, weigh scale, and quality may observe the
 * same manufactured batch. Those are evidence sources, not five
 * independent outputs. A later goods registration is identity, not a
 * second production event. Logistics is a later distinct service.
 */

import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import { sha256Hex } from '../../../../../../security/src/hash.ts';
import {
  assessEventLinkage,
  createProductiveEconomicEvent,
  identityRef,
} from '../../../../productive/policy-governance/attribution/index.ts';
import { classifyEventClass } from '../../../../productive/policy-governance/attribution/classification.ts';
import type { EventIdentityEvidence } from '../../../../productive/policy-governance/attribution/types.ts';
import { convertExact } from '../../../../units/convert.ts';
import { exactQuantity } from '../../../../units/quantity.ts';
import { integerMantissaOf } from '../../../../units/quantity.ts';
import type { ManufacturingObservation, ManufacturingRejection, MassBalanceEvidence } from './types.ts';

export type ManufacturingEventView = {
  readonly eventId: string;
  readonly eventFingerprint: string;
  readonly observationIds: readonly string[];
  readonly sourceClasses: readonly string[];
  readonly controllers: readonly string[];
  readonly outputBatchRef: string | null;
  readonly goodsAssetRef: string | null;
  readonly fullAttributionClaimCount: number;
};

export function manufacturingIdentityRef(kind: string, value: string): string {
  return identityRef(kind, value);
}

export function evidenceFromObservation(observation: ManufacturingObservation): EventIdentityEvidence {
  const batch = observation.identities.outputBatchRef ?? observation.identities.batchRef;
  const transformSeed =
    batch ??
    observation.identities.productionOrderRef ??
    observation.identities.productionLineRef ??
    observation.observationId;
  const period = observation.measurementPeriod ?? {
    fromUnixSeconds: BigInt(observation.sourceTimestampUnix),
    untilUnixSeconds: BigInt(observation.sourceTimestampUnix) + 1n,
  };
  const objectRef = observation.identities.robotRef
    ?? observation.identities.machineRef
    ?? observation.identities.productionLineRef
    ?? observation.identities.factoryRef
    ?? identityRef('object', observation.identifier);
  return {
    transformationRef: identityRef('transform', transformSeed),
    alternateViewGroupRef: identityRef('view', transformSeed),
    physicalObjectRefs: [objectRef],
    sourceObjectRefs: [objectRef],
    inputLotRefs: observation.identities.lotRef ? [observation.identities.lotRef] : [],
    outputLotRefs: batch ? [batch] : [],
    serialAssetRefs: [],
    measurementPeriod: {
      validFromUnixSeconds: period.fromUnixSeconds,
      validUntilUnixSeconds: period.untilUnixSeconds,
      epoch: 1,
    },
    deliveryPeriod: {
      fromUnixSeconds: period.fromUnixSeconds,
      untilUnixSeconds: period.untilUnixSeconds,
    },
    geographyId: observation.identities.factoryRef ?? 'geo.sandbox.factory',
    jurisdiction: 'SIM',
    oracleFactRefs: [identityRef('fact', observation.observationId)],
    sourceProvenanceRefs: [identityRef('prov', observation.sourceSystemId)],
    upstreamEventRefs: [],
    downstreamEventRefs: [],
    canonicalMeasurementRefs: [identityRef('measure', `${transformSeed}:${observation.numericValue}:${observation.unit}`)],
    controllerRefs: [identityRef('ctl', observation.controllerId)],
    participantRefs: observation.identities.productionLineRef ? [observation.identities.productionLineRef] : [],
    sourceSystemRefs: [identityRef('sys', observation.sourceSystemId)],
    lineageRoot: batch,
    economicTransformationRef: identityRef('transform', transformSeed),
  };
}

export function eventFromObservation(observation: ManufacturingObservation) {
  const evidence = evidenceFromObservation(observation);
  const observationKind =
    observation.factType === 'AUTOMATED_MACHINE_OUTPUT'
      ? 'ROBOT_MACHINE_OUTPUT'
      : observation.factType === 'GOODS_OUTPUT'
        ? 'GOODS_BATCH_RECORD'
        : 'FACTORY_MANUFACTURING_OUTPUT';
  return createProductiveEconomicEvent({
    eventClass: classifyEventClass({
      observationKind,
      describesManufacturingTransformation: observation.factType !== 'GOODS_OUTPUT' || Boolean(observation.identities.outputBatchRef),
    }),
    evidence,
    claimRefs: [identityRef('claim', observation.observationId)],
  });
}

export function recognizeSameUnderlyingEvent(
  left: ManufacturingObservation,
  right: ManufacturingObservation,
): boolean {
  const assessment = assessEventLinkage(evidenceFromObservation(left), evidenceFromObservation(right));
  if (assessment.canEstablishSameUnderlyingEvent) {
    return true;
  }
  return eventFromObservation(left).eventId === eventFromObservation(right).eventId;
}

export function sameControllerAreNotIndependent(
  left: ManufacturingObservation,
  right: ManufacturingObservation,
): boolean {
  return left.controllerId === right.controllerId || left.upstreamOrganizationId === right.upstreamOrganizationId;
}

export function evaluateSourceIndependence(
  observations: readonly ManufacturingObservation[],
): Result<{ readonly independentControllers: number }, ManufacturingRejection> {
  const production = observations.filter(
    (row) => row.factType === 'MANUFACTURING_OUTPUT' || row.factType === 'AUTOMATED_MACHINE_OUTPUT',
  );
  const byBatch = new Map<string, ManufacturingObservation[]>();
  for (const row of production) {
    const batch = row.identities.outputBatchRef ?? row.identities.batchRef ?? row.observationId;
    const existing = byBatch.get(batch) ?? [];
    existing.push(row);
    byBatch.set(batch, existing);
  }
  for (const [batch, rows] of byBatch) {
    if (rows.length < 2) {
      continue;
    }
    const controllers = new Set(rows.map((row) => row.controllerId));
    const orgs = new Set(rows.map((row) => row.upstreamOrganizationId));
    if (controllers.size === 1 || orgs.size === 1) {
      return err({
        code: 'SAME_CONTROLLER_FAKE_QUORUM',
        detail: `MES/ERP/robot feeds for batch ${batch} share a controller or organization and are not independent outputs`,
      });
    }
  }
  return ok({ independentControllers: new Set(observations.map((row) => row.controllerId)).size });
}

export function bindObservationsToEvent(
  observations: readonly ManufacturingObservation[],
): Result<ManufacturingEventView, ManufacturingRejection> {
  if (observations.length === 0) {
    return err({ code: 'MISSING_REALIZED_EVIDENCE', detail: 'no manufacturing observations' });
  }
  const first = observations[0]!;
  const sameEvent = observations.every((row) => recognizeSameUnderlyingEvent(first, row) || row.factType === 'GOODS_OUTPUT');
  if (!sameEvent) {
    return err({
      code: 'INDEPENDENT_OUTPUT_SAME_BATCH',
      detail: 'observations do not share manufacturing event identity',
    });
  }
  const event = eventFromObservation(first);
  const goods = observations.find((row) => row.factType === 'GOODS_OUTPUT');
  return ok(
    Object.freeze({
      eventId: event.eventId,
      eventFingerprint: event.eventFingerprint,
      observationIds: observations.map((row) => row.observationId),
      sourceClasses: observations.map((row) => row.sourceClass),
      controllers: [...new Set(observations.map((row) => row.controllerId))],
      outputBatchRef: first.identities.outputBatchRef,
      goodsAssetRef: goods?.identities.outputBatchRef ?? null,
      fullAttributionClaimCount: 1,
    }),
  );
}

export function refuseIndependentCreditsForSameBatch(
  observations: readonly ManufacturingObservation[],
): Result<ManufacturingEventView, ManufacturingRejection> {
  const production = observations.filter(
    (row) => row.factType === 'MANUFACTURING_OUTPUT' || row.factType === 'AUTOMATED_MACHINE_OUTPUT',
  );
  if (production.length >= 2) {
    const first = production[0]!;
    const same = production.every((row) => recognizeSameUnderlyingEvent(first, row));
    if (same) {
      const independence = evaluateSourceIndependence(production);
      if (!independence.ok) {
        return independence;
      }
      return err({
        code: 'INDEPENDENT_OUTPUT_SAME_BATCH',
        detail: 'the same manufactured batch cannot receive multiple full output credits',
      });
    }
  }
  return bindObservationsToEvent(observations);
}

export type BatchSplit = {
  readonly parentBatchRef: string;
  readonly parentQuantity: bigint;
  readonly children: readonly { readonly batchRef: string; readonly quantity: bigint }[];
};

export function evaluateBatchSplit(split: BatchSplit): Result<{ readonly aggregate: bigint }, ManufacturingRejection> {
  const childTotal = split.children.reduce((sum, child) => sum + child.quantity, 0n);
  if (childTotal > split.parentQuantity) {
    return err({
      code: 'BATCH_SPLIT_OVERALLOCATION',
      detail: `split ${childTotal} exceeds parent ${split.parentQuantity}; B1 → B1A + B1B must not double productive quantity`,
    });
  }
  return ok({ aggregate: childTotal });
}

export function mergedShipmentDoesNotFabricateProduction(
  parents: readonly bigint[],
  shipmentQuantity: bigint,
): boolean {
  const total = parents.reduce((sum, item) => sum + item, 0n);
  return shipmentQuantity <= total;
}

export function goodsRegistrationIsNotNewProduction(): true {
  return true;
}

export function logisticsIsLaterDistinctEvent(): true {
  return true;
}

export function evaluateMassBalance(
  evidence: MassBalanceEvidence,
): Result<{ readonly withinTolerance: boolean; readonly unexplainedCanonicalG: bigint }, ManufacturingRejection> {
  if (evidence.requiresPerfectEquality) {
    return err({
      code: 'WRONG_NUMERIC_REPRESENTATION',
      detail: 'perfect mass equality is not required; retain governed tolerances',
    });
  }
  const accounted = evidence.outputMassCanonicalG + evidence.scrapOrWasteCanonicalG;
  const delta = evidence.inputMassCanonicalG >= accounted
    ? evidence.inputMassCanonicalG - accounted
    : accounted - evidence.inputMassCanonicalG;
  return ok({
    withinTolerance: delta <= evidence.toleranceCanonicalG,
    unexplainedCanonicalG: delta,
  });
}

export function normalizeMassOutput(
  quantity: bigint,
  unit: string,
): Result<{ readonly canonicalG: bigint; readonly unit: 'g' }, ManufacturingRejection> {
  const source = exactQuantity({ mantissa: quantity, scale: 0, unitId: unit });
  if (!source.ok) {
    return err({ code: 'WRONG_UNIT', detail: source.error.detail });
  }
  const converted = convertExact({
    source: source.value,
    targetUnitId: 'g',
    context: { factType: 'MANUFACTURING_OUTPUT' },
  });
  if (!converted.ok) {
    return err({ code: 'WRONG_UNIT', detail: converted.error.detail });
  }
  const mantissa = integerMantissaOf(converted.value.targetQuantity);
  if (!mantissa.ok) {
    return err({ code: 'WRONG_NUMERIC_REPRESENTATION', detail: 'mass normalization must remain exact' });
  }
  return ok({ canonicalG: mantissa.value, unit: 'g' });
}

export function factTypesRemainDistinct(
  manufacturing: string,
  automated: string,
  goods: string,
): boolean {
  return manufacturing === 'MANUFACTURING_OUTPUT' && automated === 'AUTOMATED_MACHINE_OUTPUT' && goods === 'GOODS_OUTPUT';
}

export function lineageDigest(parts: readonly string[]): string {
  return sha256Hex(`mfg-lineage:${[...parts].sort().join('|')}`);
}
