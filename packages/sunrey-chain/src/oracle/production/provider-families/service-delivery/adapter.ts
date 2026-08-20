/**
 * Service-delivery ingest adapter. Fixture and in-process only.
 * Consensus is never called. Facts never mint MoonRey.
 */

import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import { oracleFactCreationNeverMintsMoonRey } from '../../eligibility.ts';
import { createProductiveEconomicEvent, identityRef } from '../../../../productive/policy-governance/attribution/index.ts';
import type { EventIdentityEvidence, ProductiveEconomicEvent } from '../../../../productive/policy-governance/attribution/types.ts';
import { evaluateServiceCompletion } from './completion.ts';
import { evaluateServiceOutcome } from './outcomes.ts';
import { publicEvidenceFrom, refuseServicePrivacyLeaks } from './privacy.ts';
import { detectSchemaDrift, parseIntegerMantissa } from './schemas.ts';
import { evaluateServiceQuantity } from './time.ts';
import {
  PRODUCTION_ACTIVE,
  REAL_PROVIDER_CONTACTED,
  SERVICE_FACT_AUTO_MINTS,
  isForbiddenServiceFactType,
  isServiceFactType,
  isServiceSourceClass,
  type PublicServiceEvidence,
  type ServiceRefusal,
  type ServiceSourceObservation,
} from './types.ts';

export type AcceptedServiceObservation = {
  readonly observation: ServiceSourceObservation;
  readonly publicEvidence: PublicServiceEvidence;
  readonly event: ProductiveEconomicEvent;
  readonly mintsMoonRey: false;
  readonly realProviderContacted: false;
  readonly productionActive: false;
  readonly invoiceEqualsCompletion: false;
  readonly humanWorthScoring: false;
  readonly networkCalls: 0;
};

function evidenceFor(observation: ServiceSourceObservation): EventIdentityEvidence {
  const seed =
    observation.identity.workOrderRef ??
    observation.identity.jobRef ??
    observation.identity.serviceDefinitionRef ??
    observation.observationId;
  const start = observation.sourceTimestampUnix;
  const end = start + (observation.durationSeconds ?? 1n);
  return {
    transformationRef: identityRef('transform', seed),
    alternateViewGroupRef: identityRef('view', seed),
    physicalObjectRefs: observation.identity.facilityRef ? [observation.identity.facilityRef] : [],
    sourceObjectRefs: [identityRef('source', observation.sourceId)],
    inputLotRefs: [],
    outputLotRefs: [],
    serialAssetRefs: [],
    measurementPeriod: {
      validFromUnixSeconds: start,
      validUntilUnixSeconds: end,
      epoch: 1,
    },
    deliveryPeriod: { fromUnixSeconds: start, untilUnixSeconds: end },
    geographyId: observation.identity.facilityRef ?? 'geo.sandbox.service',
    jurisdiction: 'SIM',
    oracleFactRefs: [identityRef('fact', observation.observationId)],
    sourceProvenanceRefs: [identityRef('prov', observation.sourceClass)],
    upstreamEventRefs: observation.identity.bookingRef ? [identityRef('booking', observation.identity.bookingRef)] : [],
    downstreamEventRefs: [],
    canonicalMeasurementRefs: [identityRef('measure', `${seed}:${observation.numericValue}:${observation.unit}`)],
    controllerRefs: [identityRef('ctl', observation.controllerId)],
    participantRefs: [
      observation.identity.humanContributionRef,
      observation.identity.automationContributionRef,
    ].filter((row): row is string => row !== null),
    sourceSystemRefs: [identityRef('sys', observation.sourceId)],
    lineageRoot: seed,
    economicTransformationRef: identityRef('transform', seed),
  };
}

export class ServicesDataFabric {
  readonly fabricVersion = 'sunrey.services-data-fabric.v1';
  readonly productionActive = PRODUCTION_ACTIVE;
  readonly autoMints = SERVICE_FACT_AUTO_MINTS;
  readonly realProviderContacted = REAL_PROVIDER_CONTACTED;

  ingest(observation: ServiceSourceObservation): Result<AcceptedServiceObservation, ServiceRefusal> {
    if (observation.networkCallAttempted === true) {
      return err({ code: 'NETWORK_FORBIDDEN', detail: 'services fabric does not contact real providers' });
    }
    if (!isServiceSourceClass(observation.sourceClass)) {
      return err({ code: 'UNKNOWN_SOURCE_CLASS', detail: `unsupported source class ${observation.sourceClass}` });
    }
    if (isForbiddenServiceFactType(observation.factType)) {
      return err({
        code: 'FORBIDDEN_FACT_TYPE',
        detail: `${observation.factType} is not a productive-output fact`,
      });
    }
    if (!isServiceFactType(observation.factType)) {
      return err({ code: 'UNKNOWN_FACT_TYPE', detail: `do not invent synonym fact types; ${observation.factType}` });
    }
    if (
      observation.sharedControlGroup !== null &&
      observation.relatedSourceIds.some((id) => id !== observation.sourceId)
    ) {
      return err({
        code: 'SAME_CONTROLLER_FAKE_QUORUM',
        detail: 'different APIs of the same service operator are not independent controllers',
      });
    }
    const privacy = refuseServicePrivacyLeaks(observation);
    if (!privacy.ok) {
      return privacy;
    }
    const quantity = parseIntegerMantissa(observation.numericValue, 'numericValue');
    if (!quantity.ok) {
      return quantity;
    }
    const schema = detectSchemaDrift(observation);
    if (!schema.ok) {
      return schema;
    }
    const completion = evaluateServiceCompletion(observation);
    if (!completion.ok) {
      return completion;
    }
    const measured = evaluateServiceQuantity(observation);
    if (!measured.ok) {
      return measured;
    }
    const outcome = evaluateServiceOutcome(observation);
    if (!outcome.ok) {
      return outcome;
    }
    const event = createProductiveEconomicEvent({
      eventClass: 'SERVICE_DELIVERY_EVENT',
      evidence: evidenceFor(observation),
      claimRefs: [identityRef('claim', observation.observationId)],
      contributionRefs: [
        observation.identity.humanContributionRef,
        observation.identity.automationContributionRef,
      ]
        .filter((row): row is string => row !== null)
        .map((row) => identityRef('contribution', row)),
    });
    return ok(
      Object.freeze({
        observation,
        publicEvidence: publicEvidenceFrom(observation),
        event,
        mintsMoonRey: false as const,
        realProviderContacted: REAL_PROVIDER_CONTACTED,
        productionActive: PRODUCTION_ACTIVE,
        invoiceEqualsCompletion: false as const,
        humanWorthScoring: false as const,
        networkCalls: 0 as const,
      }),
    );
  }

  serviceFactCannotAutoMint(): true {
    if (!oracleFactCreationNeverMintsMoonRey() || this.autoMints !== false) {
      throw new Error('SERVICE_FACT_AUTO_MINTS');
    }
    return true;
  }
}

export function ingestServiceObservation(
  observation: ServiceSourceObservation,
): Result<AcceptedServiceObservation, ServiceRefusal> {
  return new ServicesDataFabric().ingest(observation);
}

export function serviceObservationNeverMints(_accepted?: AcceptedServiceObservation): true {
  if (!oracleFactCreationNeverMintsMoonRey()) {
    throw new Error('SERVICE_FACT_AUTO_MINTS');
  }
  return true;
}
