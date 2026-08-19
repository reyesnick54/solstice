import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import {
  assessEventLinkage,
  createProductiveEconomicEvent,
  identityRef,
} from '../../../../productive/policy-governance/attribution/index.ts';
import type {
  EventIdentityEvidence,
  ProductiveEconomicEvent,
} from '../../../../productive/policy-governance/attribution/types.ts';
import type { NormalizedResourceObservation, ResourceIdentityRefs, ResourceRefusal, ResourceSourceRecord } from './types.ts';

export function identityRefsOf(record: ResourceSourceRecord): ResourceIdentityRefs {
  const mine = identityRef('mine', record.identity.mineSiteId);
  return Object.freeze({
    mineSiteRef: mine,
    pitShaftZoneRef: record.identity.pitShaftZoneId
      ? identityRef('zone', record.identity.pitShaftZoneId)
      : null,
    extractionCampaignRef: record.identity.extractionCampaignId
      ? identityRef('campaign', record.identity.extractionCampaignId)
      : null,
    shiftRef: record.identity.shiftId ? identityRef('shift', record.identity.shiftId) : null,
    haulBatchRef: record.identity.haulBatchId ? identityRef('haul', record.identity.haulBatchId) : null,
    weighbridgeTicketRef: record.identity.weighbridgeTicketId
      ? identityRef('ticket', record.identity.weighbridgeTicketId)
      : null,
    rawMaterialLotRef: record.identity.rawMaterialLotId
      ? identityRef('lot', record.identity.rawMaterialLotId)
      : null,
    stockpileRef: record.identity.stockpileId ? identityRef('stockpile', record.identity.stockpileId) : null,
  });
}

export function extractionEvidenceOf(
  observation: NormalizedResourceObservation,
  measurementStartUnix: bigint,
  measurementEndUnix: bigint,
): EventIdentityEvidence {
  const refs = observation.identityRefs;
  const lotRefs = [refs.rawMaterialLotRef, refs.haulBatchRef, refs.weighbridgeTicketRef].filter(
    (value): value is string => value !== null,
  );
  const alternate =
    refs.haulBatchRef ?? refs.weighbridgeTicketRef ?? refs.rawMaterialLotRef ?? refs.extractionCampaignRef;
  return Object.freeze({
    transformationRef: refs.extractionCampaignRef,
    alternateViewGroupRef: alternate,
    physicalObjectRefs: Object.freeze([refs.mineSiteRef, refs.pitShaftZoneRef].filter((value): value is string => value !== null)),
    sourceObjectRefs: Object.freeze([refs.mineSiteRef]),
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
    geographyId: `${observation.geography.jurisdiction}:${observation.geography.mineRegion}:${observation.geography.resourceZone}`,
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
    lineageRoot: refs.rawMaterialLotRef ?? refs.haulBatchRef ?? refs.mineSiteRef,
    economicTransformationRef: refs.extractionCampaignRef,
  });
}

/**
 * Truck + scale + ERP observations of the same haul/lot/ticket are one
 * extraction event, not five independent OUTPUT quantities.
 */
export function clusterExtractionObservations(
  observations: readonly NormalizedResourceObservation[],
  measurementStartUnix: bigint,
  measurementEndUnix: bigint,
): Result<readonly ProductiveEconomicEvent[], ResourceRefusal> {
  const extraction = observations.filter((row) => row.createsExtractionEvent);
  if (extraction.length === 0) {
    return ok(Object.freeze([]));
  }
  const clusters: NormalizedResourceObservation[][] = [];
  for (const observation of extraction) {
    const evidence = extractionEvidenceOf(observation, measurementStartUnix, measurementEndUnix);
    let attached = false;
    for (const cluster of clusters) {
      const representative = cluster[0]!;
      const linkage = assessEventLinkage(
        extractionEvidenceOf(representative, measurementStartUnix, measurementEndUnix),
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
      eventClass: 'RESOURCE_EXTRACTION_EVENT',
      evidence: extractionEvidenceOf(head, measurementStartUnix, measurementEndUnix),
      claimRefs: cluster.map((row) => identityRef('obs', row.observationId)),
    });
  });
  return ok(Object.freeze(events));
}

export function refuseDuplicateExtractionMass(
  events: readonly ProductiveEconomicEvent[],
  claimedIndependentOutputs: number,
): Result<true, ResourceRefusal> {
  if (claimedIndependentOutputs > events.length) {
    return err({
      code: 'DUPLICATE_EXTRACTION_MASS',
      detail: `claimed ${claimedIndependentOutputs} independent extraction outputs for ${events.length} underlying event(s)`,
    });
  }
  return ok(true);
}
