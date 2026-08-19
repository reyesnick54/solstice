/**
 * Public oracle payloads must not carry raw GPS, customer addresses,
 * or handwritten signature images. Prefer commitments and region refs.
 */

import { createHash } from 'node:crypto';

import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import type { LogisticsRefusal, LogisticsSourceObservation, PublicLogisticsEvidence } from './types.ts';

const PUBLIC_FORBIDDEN_KEYS = Object.freeze([
  'latitude',
  'longitude',
  'lat',
  'lng',
  'gps',
  'gpsTrace',
  'rawGps',
  'coordinates',
  'telemetryTrace',
  'streetAddress',
  'customerAddress',
  'rawCustomerAddress',
  'signatureImage',
  'handwrittenSignature',
]);

export function commitmentOf(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function routeCommitmentOf(input: {
  readonly originRegionRef: string | null;
  readonly destinationRegionRef: string | null;
  readonly distanceMeters?: bigint;
  readonly shipmentRef?: string | null;
}): string {
  return commitmentOf(
    `route:${input.originRegionRef ?? ''}:${input.destinationRegionRef ?? ''}:${input.distanceMeters?.toString() ?? ''}:${input.shipmentRef ?? ''}`,
  );
}

function extrasLeakForbidden(extras: Readonly<Record<string, unknown>> | undefined): string | null {
  if (!extras) {
    return null;
  }
  for (const key of Object.keys(extras)) {
    const normalized = key.replace(/[^A-Za-z]/g, '').toLowerCase();
    if (PUBLIC_FORBIDDEN_KEYS.some((forbidden) => normalized.includes(forbidden.replace(/[^A-Za-z]/g, '').toLowerCase()))) {
      return key;
    }
  }
  return null;
}

export function refusePublicPrivacyLeaks(
  observation: LogisticsSourceObservation,
): Result<true, LogisticsRefusal> {
  if (observation.rawCustomerAddress) {
    return err({
      code: 'CUSTOMER_ADDRESS_PUBLIC_FORBIDDEN',
      detail: 'raw customer addresses are not public oracle payloads',
      reviewRequired: false,
    });
  }
  if (observation.signatureImage && observation.requireSignatureImage !== true) {
    return err({
      code: 'SIGNATURE_IMAGE_FORBIDDEN',
      detail: 'raw handwritten signature images are not stored unless source policy explicitly requires them',
      reviewRequired: false,
    });
  }
  const leaked = extrasLeakForbidden(observation.extras);
  if (leaked) {
    return err({
      code: 'RAW_GPS_PUBLIC_FORBIDDEN',
      detail: `public extras must not include ${leaked}`,
      reviewRequired: false,
    });
  }
  if (observation.restrictedTelematics && observation.extras && 'restrictedTelematics' in observation.extras) {
    return err({
      code: 'RAW_GPS_PUBLIC_FORBIDDEN',
      detail: 'restricted telematics must stay off-chain',
      reviewRequired: false,
    });
  }
  return ok(true);
}

export function publicEvidenceFrom(input: {
  readonly observation: LogisticsSourceObservation;
  readonly claimType: PublicLogisticsEvidence['claimType'];
  readonly productiveCategory: PublicLogisticsEvidence['productiveCategory'];
  readonly realizationState: PublicLogisticsEvidence['realizationState'];
  readonly unit: string | null;
  readonly mantissa: string | null;
  readonly derivationReceiptId: string | null;
  readonly proofOfDeliveryRef: string | null;
  readonly storageQualifier: PublicLogisticsEvidence['storageQualifier'];
  readonly temperatureEvidenceCommitment: string | null;
}): PublicLogisticsEvidence {
  const identity = input.observation.identity;
  return Object.freeze({
    observationId: input.observation.observationId,
    sourceFamily: input.observation.sourceFamily,
    factType: input.observation.factType,
    claimType: input.claimType,
    productiveCategory: input.productiveCategory,
    realizationState: input.realizationState,
    unit: input.unit,
    mantissa: input.mantissa,
    derivationReceiptId: input.derivationReceiptId,
    identity: Object.freeze({ ...identity }),
    routeCommitment: routeCommitmentOf({
      originRegionRef: identity.originRegionRef,
      destinationRegionRef: identity.destinationRegionRef,
      shipmentRef: identity.shipmentRef,
    }),
    originRegionRef: identity.originRegionRef,
    destinationRegionRef: identity.destinationRegionRef,
    proofOfDeliveryRef: input.proofOfDeliveryRef,
    storageQualifier: input.storageQualifier,
    temperatureEvidenceCommitment: input.temperatureEvidenceCommitment,
    containsRawGps: false,
    containsCustomerAddress: false,
    containsSignatureImage: false,
  });
}

export function publicEvidenceContainsRawGps(evidence: PublicLogisticsEvidence): false {
  return evidence.containsRawGps;
}
