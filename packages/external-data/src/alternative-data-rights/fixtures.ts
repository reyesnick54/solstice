/**
 * HELIOS ALT02 simulation fixtures — explicit rights manifests for alternative-data sources.
 */

import { asUtcInstant } from '@solstice/domain';
import {
  type AlternativeDataRightsManifest,
  type ProviderRevocationState,
  PROHIBITED_ACQUISITION_PRACTICES,
  PROHIBITED_INDIVIDUAL_SENSITIVE_SIGNALS,
  ALTERNATIVE_DATA_RIGHTS_SCHEMA_VERSION,
} from '@solstice/provider-sdk';

const PROHIBITED_ACQUISITION_ATTESTATION = Object.freeze(
  Object.fromEntries(PROHIBITED_ACQUISITION_PRACTICES.map((key) => [key, false as const])) as Record<
    (typeof PROHIBITED_ACQUISITION_PRACTICES)[number],
    false
  >,
);

const PROHIBITED_INDIVIDUAL_ATTESTATION = Object.freeze(
  Object.fromEntries(PROHIBITED_INDIVIDUAL_SENSITIVE_SIGNALS.map((key) => [key, false as const])) as Record<
    (typeof PROHIBITED_INDIVIDUAL_SENSITIVE_SIGNALS)[number],
    false
  >,
);

const SEALED = asUtcInstant('2026-06-01T00:00:00.000Z');

function baseManifest(input: {
  readonly manifestId: string;
  readonly providerId: string;
  readonly sourceId: string;
  readonly licenseClass: AlternativeDataRightsManifest['licenseClass'];
  readonly permittedPurposes: AlternativeDataRightsManifest['entitlementPolicy']['permittedPurposes'];
  readonly derivedPurposes: AlternativeDataRightsManifest['derivedFeatureRights']['permittedPurposes'];
  readonly historicalUseAllowedUntilUtc: AlternativeDataRightsManifest['retention']['historicalUseAllowedUntilUtc'];
}): AlternativeDataRightsManifest {
  return Object.freeze({
    schemaVersion: ALTERNATIVE_DATA_RIGHTS_SCHEMA_VERSION,
    manifestId: input.manifestId,
    providerId: input.providerId,
    sourceId: input.sourceId,
    licenseClass: input.licenseClass,
    terms: Object.freeze({
      termsUrl: 'https://example.test/terms/alt-data',
      termsVersionLabel: '2026-06-simulation',
      capturedAtUtc: SEALED,
      contentSha256: 'a'.repeat(64),
      grantsExecutionAuthority: false,
    }),
    entitlementPolicy: Object.freeze({
      policyId: `${input.manifestId}:policy`,
      effectiveFromUtc: asUtcInstant('2026-01-01T00:00:00.000Z'),
      effectiveUntilUtc: null,
      permittedPurposes: input.permittedPurposes,
      grantsExecutionAuthority: false,
    }),
    retention: Object.freeze({
      maxRetentionDays: 365,
      historicalUseAllowedUntilUtc: input.historicalUseAllowedUntilUtc,
      deleteAfterEntitlementExpiry: false,
      grantsExecutionAuthority: false,
    }),
    derivedFeatureRights: Object.freeze({
      permittedPurposes: input.derivedPurposes,
      derivedFeatureStorageAllowed: true,
      grantsExecutionAuthority: false,
    }),
    prohibitedAcquisitionAttestation: PROHIBITED_ACQUISITION_ATTESTATION,
    aggregateObservationScopeOnly: true,
    prohibitedIndividualSignals: PROHIBITED_INDIVIDUAL_ATTESTATION,
    sealedAtUtc: SEALED,
    grantsExecutionAuthority: false,
  });
}

export const ARBEITNOW_ALT02_MANIFEST = baseManifest({
  manifestId: 'alt02:arbeitnow:jobs',
  providerId: 'arbeitnow',
  sourceId: 'arbeitnow:public-jobs',
  licenseClass: 'PUBLIC_OPEN',
  permittedPurposes: Object.freeze(['RESEARCH', 'BACKTEST', 'PAPER']),
  derivedPurposes: Object.freeze(['RESEARCH', 'BACKTEST']),
  historicalUseAllowedUntilUtc: asUtcInstant('2028-01-01T00:00:00.000Z'),
});

export const ARBEITNOW_ALT02_REVOCATION_ACTIVE: ProviderRevocationState = Object.freeze({
  state: 'ENTITLEMENT_ACTIVE',
  evaluatedAtUtc: SEALED,
  entitlementExpiresAtUtc: asUtcInstant('2027-06-01T00:00:00.000Z'),
  revokedAtUtc: null,
  grantsExecutionAuthority: false,
});

export const ARBEITNOW_ALT02_REVOCATION_EXPIRED: ProviderRevocationState = Object.freeze({
  state: 'ENTITLEMENT_EXPIRED',
  evaluatedAtUtc: asUtcInstant('2027-07-01T00:00:00.000Z'),
  entitlementExpiresAtUtc: asUtcInstant('2027-06-01T00:00:00.000Z'),
  revokedAtUtc: null,
  grantsExecutionAuthority: false,
});

export const UNKNOWN_LICENSE_ALT02_MANIFEST = baseManifest({
  manifestId: 'alt02:quandl-nasdaq-data-link:unknown',
  providerId: 'quandl-nasdaq-data-link',
  sourceId: 'nasdaq:alt-bundle',
  licenseClass: 'UNKNOWN',
  permittedPurposes: Object.freeze(['RESEARCH']),
  derivedPurposes: Object.freeze(['RESEARCH']),
  historicalUseAllowedUntilUtc: null,
});

export const ALT02_FIXTURE_SOURCE_IDS = Object.freeze(['arbeitnow:public-jobs', 'nasdaq:alt-bundle'] as const);
