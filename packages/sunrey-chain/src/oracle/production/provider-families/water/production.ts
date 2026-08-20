import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import {
  createProductiveEconomicEvent,
  identityRef,
} from '../../../../productive/policy-governance/attribution/index.ts';
import type {
  EventIdentityEvidence,
  ProductiveEconomicEvent,
} from '../../../../productive/policy-governance/attribution/types.ts';
import type {
  NormalizedWaterObservation,
  WaterIdentityRefs,
  WaterRefusal,
  WaterSourceRecord,
} from './types.ts';

export function identityRefsOf(record: WaterSourceRecord): WaterIdentityRefs {
  return Object.freeze({
    plantSiteRef: identityRef('plant', record.identity.plantSiteId),
    meterRef: identityRef('meter', record.meterRef),
    campaignRef: record.identity.campaignId ? identityRef('campaign', record.identity.campaignId) : null,
    batchRef: record.identity.batchId ? identityRef('batch', record.identity.batchId) : null,
  });
}

export function waterProductionEvidenceOf(
  observation: NormalizedWaterObservation,
  measurementStartUnix: bigint,
  measurementEndUnix: bigint,
): EventIdentityEvidence {
  const refs = observation.identityRefs;
  return Object.freeze({
    transformationRef: refs.campaignRef,
    alternateViewGroupRef: refs.batchRef ?? refs.campaignRef,
    physicalObjectRefs: Object.freeze([refs.plantSiteRef, refs.meterRef]),
    sourceObjectRefs: Object.freeze([refs.plantSiteRef]),
    inputLotRefs: Object.freeze([]),
    outputLotRefs: Object.freeze(refs.batchRef ? [refs.batchRef] : []),
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
    geographyId: `${observation.geography.jurisdiction}:${observation.geography.watershed}:${observation.geography.basin}`,
    jurisdiction: observation.geography.jurisdiction,
    oracleFactRefs: Object.freeze([identityRef('obs', observation.observationId)]),
    sourceProvenanceRefs: Object.freeze([identityRef('src', observation.sourceClass)]),
    upstreamEventRefs: Object.freeze([]),
    downstreamEventRefs: Object.freeze([]),
    canonicalMeasurementRefs: Object.freeze([
      identityRef('vol', `${observation.canonicalQuantity.mantissa.toString()}:${observation.canonicalUnit}`),
    ]),
    controllerRefs: Object.freeze([identityRef('ctl', observation.controllerId)]),
    participantRefs: Object.freeze([identityRef('op', observation.operatorPartyId)]),
    sourceSystemRefs: Object.freeze([identityRef('sys', observation.sourceClass)]),
    lineageRoot: refs.batchRef ?? refs.campaignRef ?? refs.plantSiteRef,
    economicTransformationRef: refs.campaignRef,
  });
}

export function clusterWaterProductionObservations(
  observations: readonly NormalizedWaterObservation[],
  measurementStartUnix: bigint,
  measurementEndUnix: bigint,
): Result<readonly ProductiveEconomicEvent[], WaterRefusal> {
  const production = observations.filter((row) => row.createsWaterProductionEvent);
  return ok(
    Object.freeze(
      production.map((observation) =>
        createProductiveEconomicEvent({
          eventClass: 'WATER_PRODUCTION_EVENT',
          evidence: waterProductionEvidenceOf(observation, measurementStartUnix, measurementEndUnix),
          claimRefs: Object.freeze([identityRef('obs', observation.observationId)]),
        }),
      ),
    ),
  );
}

export function refuseEquatedSemantics(
  left: NormalizedWaterObservation,
  right: NormalizedWaterObservation,
): Result<true, WaterRefusal> {
  if (left.measurementSemantics !== right.measurementSemantics) {
    return err({
      code: 'SEMANTICS_CANNOT_BE_EQUATED',
      detail: `cannot silently equate ${left.measurementSemantics} with ${right.measurementSemantics}`,
    });
  }
  return ok(true);
}
