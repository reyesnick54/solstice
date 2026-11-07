/**
 * HELIOS ALT02 — alternative-data rights manifest and policy types.
 */

import type { UtcInstant } from '@solstice/domain';

import type {
  ALTERNATIVE_DATA_RIGHTS_SCHEMA_VERSION,
  AlternativeDataLicenseClass,
  PermittedPurpose,
  ProhibitedAcquisitionPractice,
  ProhibitedIndividualSensitiveSignal,
  ProviderRevocationStateKind,
} from './taxonomy.ts';

export type SourceTermsSnapshot = {
  readonly termsUrl: string | null;
  readonly termsVersionLabel: string;
  readonly capturedAtUtc: UtcInstant;
  readonly contentSha256: string;
  readonly grantsExecutionAuthority: false;
};

export type RetentionPolicy = {
  /** Contractual maximum retention for ingested observations (days); null when not bounded in manifest. */
  readonly maxRetentionDays: number | null;
  /** When entitlement expires, historical rows may be read until this instant (UTC). */
  readonly historicalUseAllowedUntilUtc: UtcInstant | null;
  readonly deleteAfterEntitlementExpiry: boolean;
  readonly grantsExecutionAuthority: false;
};

export type DerivedFeatureRights = {
  /** Explicit subset of source permitted purposes — must not be inferred. */
  readonly permittedPurposes: readonly PermittedPurpose[];
  readonly derivedFeatureStorageAllowed: boolean;
  readonly grantsExecutionAuthority: false;
};

export type AlternativeDataEntitlementPolicy = {
  readonly policyId: string;
  readonly effectiveFromUtc: UtcInstant;
  readonly effectiveUntilUtc: UtcInstant | null;
  /** Must be explicit; empty means blocked for every purpose. */
  readonly permittedPurposes: readonly PermittedPurpose[];
  readonly grantsExecutionAuthority: false;
};

export type ProviderRevocationState = {
  readonly state: ProviderRevocationStateKind;
  readonly evaluatedAtUtc: UtcInstant;
  readonly entitlementExpiresAtUtc: UtcInstant | null;
  readonly revokedAtUtc: UtcInstant | null;
  readonly grantsExecutionAuthority: false;
};

export type AlternativeDataRightsManifest = {
  readonly schemaVersion: typeof ALTERNATIVE_DATA_RIGHTS_SCHEMA_VERSION;
  readonly manifestId: string;
  readonly providerId: string;
  readonly sourceId: string;
  readonly licenseClass: AlternativeDataLicenseClass;
  readonly terms: SourceTermsSnapshot;
  readonly entitlementPolicy: AlternativeDataEntitlementPolicy;
  readonly retention: RetentionPolicy;
  readonly derivedFeatureRights: DerivedFeatureRights;
  /**
   * Each prohibited practice must be explicitly disclaimed (false = HELIOS does not use this path).
   */
  readonly prohibitedAcquisitionAttestation: Readonly<Record<ProhibitedAcquisitionPractice, false>>;
  /**
   * HELIOS investment research consumes firm/asset/aggregate observations only.
   */
  readonly aggregateObservationScopeOnly: true;
  readonly prohibitedIndividualSignals: Readonly<Record<ProhibitedIndividualSensitiveSignal, false>>;
  readonly sealedAtUtc: UtcInstant;
  readonly grantsExecutionAuthority: false;
};
