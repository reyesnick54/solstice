/**
 * Admission gate for collection envelopes.
 *
 * A coded refusal is returned if any required control fails.
 * Certification expiry, suspension, and schema/unit/taxonomy drift
 * cannot remain indefinitely admissible.
 */

import { err, ok, type Result } from '../../../../../domain/src/result.ts';
import { sha256Hex } from '../../../../../security/src/hash.ts';
import { lookupUnit } from '../../../units/convert.ts';
import { measureCanonical } from '../../../units/measurement.ts';
import { exactQuantity } from '../../../units/quantity.ts';
import { validateSourceFactClaimMapping } from '../../source-taxonomy/validator.ts';
import { resolveSourceCategory } from '../../../productive/source-taxonomy/types.ts';
import { CANONICAL_NORMALIZATION_VERSION } from '../types.ts';
import type { CertificationStatus } from '../certification/types.ts';
import { routeCollection } from './routing.ts';
import {
  FABRIC_CONNECTOR_RUNTIME_VERSION,
  FABRIC_NORMALIZATION_VERSION,
  fabricRejection,
  type AdmissionMode,
  type CollectionCandidate,
  type EconomicDataCollectionEnvelope,
  type FabricRejection,
} from './types.ts';

const MODE_MIN_STATUS: Readonly<Record<AdmissionMode, readonly CertificationStatus[]>> = Object.freeze({
  FIXTURE_ONLY: Object.freeze([
    'NOT_EVALUATED',
    'ENGINEERING_SANDBOX',
    'CONFORMANCE_PASSED',
    'TESTNET_ADMISSIBLE',
    'PRODUCTION_CANDIDATE',
  ]),
  ENGINEERING_SANDBOX: Object.freeze(['ENGINEERING_SANDBOX', 'CONFORMANCE_PASSED', 'TESTNET_ADMISSIBLE', 'PRODUCTION_CANDIDATE']),
  TESTNET_ADMISSIBLE: Object.freeze(['TESTNET_ADMISSIBLE', 'PRODUCTION_CANDIDATE']),
  PRODUCTION_CANDIDATE: Object.freeze(['PRODUCTION_CANDIDATE']),
});

const FORBIDDEN_PAYLOAD_KEYS = Object.freeze([
  'password',
  'secret',
  'apiKey',
  'api_key',
  'authorization',
  'oauthToken',
  'oauth_token',
  'accessToken',
  'refreshToken',
  'privateKey',
  'private_key',
  'prompt',
  'prompts',
  'recipe',
  'recipes',
  'gpsTrail',
  'gps_trail',
  'waypoints',
  'packet',
  'packets',
  'customerName',
  'ssn',
  'email',
  'phone',
  'farmRaw',
  'plcCommand',
  'setpoint',
]);

const FORBIDDEN_URL_PREFIXES = Object.freeze(['http://', 'https://']);

function envelopeIdOf(input: CollectionCandidate): string {
  return sha256Hex(
    `edf.envelope.v1:${input.providerId}:${input.sourceId}:${input.sourceObservationId}:${input.contentCommitment}`,
  );
}

function scanForbidden(value: unknown, depth = 0): string | null {
  if (value === null || value === undefined || depth > 6) {
    return null;
  }
  if (typeof value === 'string') {
    const lowered = value.toLowerCase();
    if (FORBIDDEN_URL_PREFIXES.some((prefix) => lowered.startsWith(prefix))) {
      return value;
    }
    return null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = scanForbidden(item, depth + 1);
      if (hit) {
        return hit;
      }
    }
    return null;
  }
  if (typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      if (FORBIDDEN_PAYLOAD_KEYS.includes(key)) {
        return key;
      }
      const hit = scanForbidden(nested, depth + 1);
      if (hit) {
        return hit;
      }
    }
  }
  return null;
}

function statusAllowed(mode: AdmissionMode, status: CertificationStatus | 'NOT_EVALUATED'): boolean {
  if (status === 'NOT_EVALUATED') {
    return mode === 'FIXTURE_ONLY';
  }
  return (MODE_MIN_STATUS[mode] as readonly string[]).includes(status);
}

export function admitCollection(
  input: CollectionCandidate,
  mode: AdmissionMode,
  nowUnix: bigint,
): Result<EconomicDataCollectionEnvelope, FabricRejection> {
  if (mode === ('PRODUCTION_LIVE' as string)) {
    return err(fabricRejection('PRODUCTION_LIVE_FORBIDDEN', 'PRODUCTION_LIVE admission is not authorized'));
  }
  if (input.credentialsPresent === true) {
    return err(fabricRejection('CREDENTIAL_MATERIAL_PRESENT', 'collection envelope must not carry credentials'));
  }
  if (input.rawPayloadPresent === true || input.payload !== undefined) {
    const leak = scanForbidden(input.payload);
    if (input.rawPayloadPresent === true) {
      return err(fabricRejection('RAW_PAYLOAD_PRESENT', 'raw provider payload must not be stored on the envelope'));
    }
    if (leak && FORBIDDEN_PAYLOAD_KEYS.includes(leak)) {
      return err(fabricRejection('PRIVACY_FIREWALL_VIOLATION', `forbidden payload field ${leak}`));
    }
  }
  if (input.externalUrl) {
    return err(fabricRejection('ARBITRARY_URL_FORBIDDEN', 'arbitrary external URLs are refused'));
  }
  const leak = scanForbidden(input);
  if (leak && FORBIDDEN_PAYLOAD_KEYS.includes(leak)) {
    return err(fabricRejection('PRIVACY_FIREWALL_VIOLATION', `forbidden field ${leak}`));
  }
  if (input.sourceRegistered === false) {
    return err(fabricRejection('SOURCE_NOT_REGISTERED', `source ${input.sourceId} is not registered`));
  }
  if (input.endpointApproved === false) {
    return err(fabricRejection('ENDPOINT_PROFILE_NOT_APPROVED', `endpoint ${input.endpointProfileId ?? 'unknown'} is not approved`));
  }
  if (input.connectorResultValid === false) {
    return err(fabricRejection('CONNECTOR_RESULT_INVALID', 'connector result is not valid'));
  }
  if (input.schemaValid === false) {
    return err(fabricRejection('SCHEMA_VALIDATION_FAILED', `schema ${input.schemaId} failed validation`));
  }
  if (input.providerSuspended === true) {
    return err(fabricRejection('PROVIDER_SUSPENDED', `provider ${input.providerId} is suspended`));
  }
  if (input.sourceSuspended === true) {
    return err(fabricRejection('SOURCE_SUSPENDED', `source ${input.sourceId} is suspended`));
  }
  if (!input.provenanceRef || !input.contentCommitment) {
    return err(fabricRejection('PROVENANCE_INCOMPLETE', 'provenanceRef and contentCommitment are required'));
  }
  const maxAge = input.freshnessMaxAgeSeconds ?? 3_600;
  if (nowUnix - input.sourceTimestamp > BigInt(maxAge)) {
    return err(fabricRejection('FRESHNESS_POLICY_FAILED', 'source observation is stale'));
  }
  const routed = routeCollection(input);
  if (!routed.ok) {
    return routed;
  }
  const certificationStatus = input.certificationStatus ?? 'NOT_EVALUATED';
  if (certificationStatus === 'SUSPENDED' || certificationStatus === 'REVOKED') {
    return err(fabricRejection('PROVIDER_SUSPENDED', `certification status ${certificationStatus}`));
  }
  if (input.certificationExpired === true || certificationStatus === 'REVALIDATION_REQUIRED') {
    return err(
      fabricRejection(
        input.certificationExpired === true ? 'CERTIFICATION_EXPIRED' : 'CERTIFICATION_REVALIDATION_REQUIRED',
        input.certificationExpired === true
          ? 'certification expired and is no longer admissible'
          : 'source requires revalidation after schema, unit, endpoint, auth, or controller change',
      ),
    );
  }
  if (mode !== 'FIXTURE_ONLY' && !input.certificationId) {
    return err(fabricRejection('CERTIFICATION_MISSING', `${mode} requires a current certification record`));
  }
  if (!statusAllowed(mode, certificationStatus)) {
    if (certificationStatus === 'NOT_EVALUATED' || certificationStatus === 'CONFORMANCE_FAILED') {
      return err(
        fabricRejection(
          mode === 'FIXTURE_ONLY' ? 'CERTIFICATION_STATUS_INSUFFICIENT' : 'CERTIFICATION_EXPIRED',
          `certification ${certificationStatus} is not admissible for ${mode}`,
        ),
      );
    }
    return err(
      fabricRejection('CERTIFICATION_STATUS_INSUFFICIENT', `certification ${certificationStatus} is not admissible for ${mode}`),
    );
  }
  if (routed.value.family.familyId === 'REFERENCE_DATA') {
    if (input.claimedProductiveCategory) {
      return err(fabricRejection('REFERENCE_PRICE_CANNOT_CREATE_CLAIM', 'REFERENCE_PRICE remains reference-only'));
    }
  }
  const taxonomy = validateSourceFactClaimMapping({
    sourceCategory: input.sourceCategory,
    factType: input.factType,
    sourceUnit: input.sourceQuantity.unit,
    productiveCategory: routed.value.productiveCategory ?? undefined,
    claimType: routed.value.family.familyId === 'REFERENCE_DATA' ? undefined : undefined,
    mappingId: input.mappingId ?? undefined,
    mappingVersion: input.mappingVersion ?? undefined,
  });
  if (!taxonomy.ok && input.factType !== 'REFERENCE_PRICE') {
    const hardFail =
      routed.value.family.implementationState === 'ADAPTER_IMPLEMENTED' || mode !== 'FIXTURE_ONLY';
    if (hardFail) {
      return err(fabricRejection('TAXONOMY_INCOMPATIBLE', `${taxonomy.error.code}: ${taxonomy.error.detail}`));
    }
  }
  if (input.factType === 'REFERENCE_PRICE' && taxonomy.ok && taxonomy.value.mapping.canCreateProductiveClaim) {
    return err(fabricRejection('REFERENCE_PRICE_CANNOT_CREATE_CLAIM', 'REFERENCE_PRICE cannot create a productive claim'));
  }
  if (lookupUnit(input.sourceQuantity.unit) === undefined) {
    return err(fabricRejection('UNIT_EXTENSION_REQUIRED', `unit ${input.sourceQuantity.unit} has no canonical path`));
  }
  let canonicalMeasurement = null;
  let canonicalMeasurementRef: string | null = null;
  if (routed.value.productiveCategory) {
    const quantity = exactQuantity({
      mantissa: input.sourceQuantity.mantissa,
      unitId: input.sourceQuantity.unit,
      scale: 0,
    });
    if (!quantity.ok) {
      return err(fabricRejection('UNIT_NORMALIZATION_FAILED', quantity.error.detail));
    }
    const measured = measureCanonical({
      sourceQuantity: quantity.value,
      factType: input.factType,
      productiveCategory: routed.value.productiveCategory,
    });
    if (!measured.ok) {
      if (measured.error.code === 'CANONICAL_UNIT_REQUIRED') {
        return err(fabricRejection('UNIT_EXTENSION_REQUIRED', measured.error.detail));
      }
      if (routed.value.family.implementationState === 'ADAPTER_IMPLEMENTED') {
        return err(fabricRejection('UNIT_NORMALIZATION_FAILED', `${measured.error.code}: ${measured.error.detail}`));
      }
    } else {
      canonicalMeasurement = measured.value;
      canonicalMeasurementRef = measured.value.normalizationReceiptId;
    }
  }
  const resolved = resolveSourceCategory(input.sourceCategory);
  const mapping = taxonomy.ok ? taxonomy.value.mapping : null;
  const envelope: EconomicDataCollectionEnvelope = Object.freeze({
    envelopeId: envelopeIdOf(input),
    familyId: routed.value.family.familyId,
    providerId: input.providerId,
    sourceId: input.sourceId,
    feedId: input.feedId,
    sourceCategory: input.sourceCategory,
    canonicalSourceCategory: resolved.canonical,
    factType: input.factType,
    schemaId: input.schemaId,
    schemaVersion: input.schemaVersion,
    sourceObservationId: input.sourceObservationId,
    subjectRef: input.subjectRef,
    sourceQuantity: Object.freeze({ ...input.sourceQuantity }),
    canonicalMeasurementRef,
    canonicalMeasurement,
    measurementStart: input.measurementStart,
    measurementEnd: input.measurementEnd,
    sourceTimestamp: input.sourceTimestamp,
    collectionTimestamp: input.collectionTimestamp,
    geography: Object.freeze({ ...input.geography }),
    provenanceRef: input.provenanceRef,
    contentCommitment: input.contentCommitment,
    certificationId: input.certificationId ?? null,
    certificationStatus,
    connectorRuntimeVersion: FABRIC_CONNECTOR_RUNTIME_VERSION,
    normalizationVersion: FABRIC_NORMALIZATION_VERSION,
    mappingId: mapping?.mappingId ?? input.mappingId ?? null,
    mappingVersion: mapping?.mappingVersion ?? input.mappingVersion ?? null,
    privacyClassification: routed.value.family.privacyClass,
    payloadStored: false,
    credentialsPresent: false,
    productiveCategory: routed.value.family.familyId === 'REFERENCE_DATA' ? null : routed.value.productiveCategory,
    canCreateProductiveClaim: routed.value.family.familyId === 'REFERENCE_DATA' ? false : mapping?.referenceDataOnly !== true && routed.value.productiveCategory !== null,
    canMint: false,
    productionActivated: false,
  });
  if (envelope.payloadStored || envelope.credentialsPresent) {
    return err(fabricRejection('PRIVACY_FIREWALL_VIOLATION', 'envelope privacy invariants failed'));
  }
  void CANONICAL_NORMALIZATION_VERSION;
  return ok(envelope);
}

export function envelopeOmitsRawPayload(envelope: EconomicDataCollectionEnvelope): boolean {
  return envelope.payloadStored === false && envelope.credentialsPresent === false;
}
