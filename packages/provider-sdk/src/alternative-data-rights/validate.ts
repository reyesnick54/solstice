/**
 * HELIOS ALT02 — manifest validation (fail closed; do not infer rights).
 */

import type { UtcInstant } from '@solstice/domain';

import {
  licenseClassBlocksByDefault,
  PERMITTED_PURPOSES,
  PROHIBITED_ACQUISITION_PRACTICES,
  PROHIBITED_INDIVIDUAL_SENSITIVE_SIGNALS,
} from './taxonomy.ts';
import type { AlternativeDataRightsManifest, DerivedFeatureRights } from './types.ts';

export type AlternativeDataManifestValidationCode =
  | 'MANIFEST_INVALID'
  | 'LICENSE_UNKNOWN'
  | 'PERMITTED_PURPOSES_EMPTY'
  | 'PERMITTED_PURPOSES_INFERRED'
  | 'DERIVED_PURPOSES_NOT_SUBSET'
  | 'DERIVED_RIGHTS_INFERRED'
  | 'PROHIBITED_ACQUISITION_NOT_DISCLAIMED'
  | 'INDIVIDUAL_SENSITIVE_NOT_DISCLAIMED'
  | 'AGGREGATE_SCOPE_REQUIRED';

export type AlternativeDataManifestValidation = {
  readonly valid: boolean;
  readonly codes: readonly AlternativeDataManifestValidationCode[];
  readonly grantsExecutionAuthority: false;
};

function derivedPurposesSubsetOfSource(
  sourcePurposes: readonly string[],
  derived: DerivedFeatureRights,
): boolean {
  if (derived.permittedPurposes.length === 0) {
    return false;
  }
  const allowed = new Set(sourcePurposes);
  return derived.permittedPurposes.every((purpose) => allowed.has(purpose));
}

export function validateAlternativeDataRightsManifest(
  manifest: AlternativeDataRightsManifest,
  options: { readonly purposesExplicitlyDeclared?: boolean } = {},
): AlternativeDataManifestValidation {
  const codes: AlternativeDataManifestValidationCode[] = [];

  if (licenseClassBlocksByDefault(manifest.licenseClass)) {
    codes.push('LICENSE_UNKNOWN');
  }

  if (manifest.entitlementPolicy.permittedPurposes.length === 0) {
    codes.push('PERMITTED_PURPOSES_EMPTY');
  }

  for (const purpose of manifest.entitlementPolicy.permittedPurposes) {
    if (!(PERMITTED_PURPOSES as readonly string[]).includes(purpose)) {
      codes.push('PERMITTED_PURPOSES_INFERRED');
      break;
    }
  }

  if (!manifest.aggregateObservationScopeOnly) {
    codes.push('AGGREGATE_SCOPE_REQUIRED');
  }

  for (const key of PROHIBITED_ACQUISITION_PRACTICES) {
    if (manifest.prohibitedAcquisitionAttestation[key] !== false) {
      codes.push('PROHIBITED_ACQUISITION_NOT_DISCLAIMED');
      break;
    }
  }

  for (const key of PROHIBITED_INDIVIDUAL_SENSITIVE_SIGNALS) {
    if (manifest.prohibitedIndividualSignals[key] !== false) {
      codes.push('INDIVIDUAL_SENSITIVE_NOT_DISCLAIMED');
      break;
    }
  }

  if (!derivedPurposesSubsetOfSource(manifest.entitlementPolicy.permittedPurposes, manifest.derivedFeatureRights)) {
    codes.push('DERIVED_PURPOSES_NOT_SUBSET');
  }

  if (options.purposesExplicitlyDeclared === false) {
    codes.push('PERMITTED_PURPOSES_INFERRED');
  }

  if (!manifest.manifestId || !manifest.providerId || !manifest.sourceId) {
    codes.push('MANIFEST_INVALID');
  }

  return Object.freeze({
    valid: codes.length === 0,
    codes: Object.freeze(codes),
    grantsExecutionAuthority: false,
  });
}

export function assertManifestValidAt(
  manifest: AlternativeDataRightsManifest,
  atUtc: UtcInstant,
): AlternativeDataManifestValidation {
  const base = validateAlternativeDataRightsManifest(manifest);
  if (!base.valid) {
    return base;
  }
  const from = manifest.entitlementPolicy.effectiveFromUtc;
  const until = manifest.entitlementPolicy.effectiveUntilUtc;
  if (atUtc < from) {
    return Object.freeze({
      valid: false,
      codes: Object.freeze(['MANIFEST_INVALID'] as const),
      grantsExecutionAuthority: false,
    });
  }
  if (until !== null && atUtc > until) {
    return Object.freeze({
      valid: false,
      codes: Object.freeze(['MANIFEST_INVALID'] as const),
      grantsExecutionAuthority: false,
    });
  }
  return base;
}
