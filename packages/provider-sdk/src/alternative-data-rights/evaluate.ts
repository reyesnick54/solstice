/**
 * HELIOS ALT02 — entitlement and provenance firewall evaluation.
 */

import type { UtcInstant } from '@solstice/domain';

import { licenseClassBlocksByDefault, type AlternativeDataGateOutcome, type PermittedPurpose } from './taxonomy.ts';
import type { AlternativeDataRightsManifest, ProviderRevocationState } from './types.ts';
import { validateAlternativeDataRightsManifest } from './validate.ts';

export type AlternativeDataAccessMode = 'new_ingestion' | 'historical_read' | 'derived_feature';

export type AlternativeDataGateDecision = {
  readonly allowed: boolean;
  readonly outcome: AlternativeDataGateOutcome;
  readonly requestedPurpose: PermittedPurpose;
  readonly providerId: string;
  readonly sourceId: string;
  readonly message: string;
  readonly grantsExecutionAuthority: false;
};

function purposePermitted(manifest: AlternativeDataRightsManifest, purpose: PermittedPurpose): boolean {
  return manifest.entitlementPolicy.permittedPurposes.includes(purpose);
}

function derivedPurposePermitted(manifest: AlternativeDataRightsManifest, purpose: PermittedPurpose): boolean {
  return manifest.derivedFeatureRights.permittedPurposes.includes(purpose);
}

function historicalUseAllowed(
  manifest: AlternativeDataRightsManifest,
  revocation: ProviderRevocationState,
  atUtc: UtcInstant,
): boolean {
  if (revocation.state === 'ENTITLEMENT_ACTIVE') {
    return true;
  }
  const until = manifest.retention.historicalUseAllowedUntilUtc;
  if (until === null) {
    return false;
  }
  return atUtc <= until;
}

export function evaluateAlternativeDataGate(input: {
  readonly manifest: AlternativeDataRightsManifest;
  readonly revocation: ProviderRevocationState;
  readonly requestedPurpose: PermittedPurpose;
  readonly accessMode: AlternativeDataAccessMode;
  readonly atUtc: UtcInstant;
}): AlternativeDataGateDecision {
  const { manifest, revocation, requestedPurpose, accessMode, atUtc } = input;
  const base = {
    requestedPurpose,
    providerId: manifest.providerId,
    sourceId: manifest.sourceId,
    grantsExecutionAuthority: false as const,
  };

  const validation = validateAlternativeDataRightsManifest(manifest);
  if (!validation.valid || licenseClassBlocksByDefault(manifest.licenseClass)) {
    return Object.freeze({
      ...base,
      allowed: false,
      outcome: 'LICENSE_UNKNOWN',
      message: `source ${manifest.sourceId} blocked: license or manifest invalid (${validation.codes.join(', ')})`,
    });
  }

  if (revocation.state === 'ENTITLEMENT_REVOKED') {
    return Object.freeze({
      ...base,
      allowed: false,
      outcome: 'ENTITLEMENT_REVOKED',
      message: `provider ${manifest.providerId} entitlement revoked`,
    });
  }

  const expired =
    revocation.state === 'ENTITLEMENT_EXPIRED' ||
    (revocation.entitlementExpiresAtUtc !== null && atUtc > revocation.entitlementExpiresAtUtc);

  if (expired && accessMode === 'new_ingestion') {
    return Object.freeze({
      ...base,
      allowed: false,
      outcome: 'ENTITLEMENT_EXPIRED',
      message: `new ingestion stopped for ${manifest.providerId}: entitlement expired`,
    });
  }

  if (expired && accessMode === 'historical_read') {
    if (historicalUseAllowed(manifest, revocation, atUtc)) {
      if (!purposePermitted(manifest, requestedPurpose)) {
        return Object.freeze({
          ...base,
          allowed: false,
          outcome: 'PURPOSE_NOT_PERMITTED',
          message: `purpose ${requestedPurpose} not in explicit manifest list`,
        });
      }
      return Object.freeze({
        ...base,
        allowed: true,
        outcome: 'ENTITLEMENT_EXPIRED',
        message: `historical read permitted under retention policy until contractual cutoff`,
      });
    }
    return Object.freeze({
      ...base,
      allowed: false,
      outcome: 'ENTITLEMENT_EXPIRED',
      message: `historical use beyond contractual retention for ${manifest.providerId}`,
    });
  }

  if (accessMode === 'derived_feature') {
    if (!manifest.derivedFeatureRights.derivedFeatureStorageAllowed) {
      return Object.freeze({
        ...base,
        allowed: false,
        outcome: 'PURPOSE_NOT_PERMITTED',
        message: 'derived feature storage not permitted by manifest',
      });
    }
    if (!derivedPurposePermitted(manifest, requestedPurpose)) {
      return Object.freeze({
        ...base,
        allowed: false,
        outcome: 'PURPOSE_NOT_PERMITTED',
        message: `derived purpose ${requestedPurpose} not explicitly permitted`,
      });
    }
  } else if (!purposePermitted(manifest, requestedPurpose)) {
    return Object.freeze({
      ...base,
      allowed: false,
      outcome: 'PURPOSE_NOT_PERMITTED',
      message: `purpose ${requestedPurpose} not in explicit manifest list`,
    });
  }

  if (revocation.state !== 'ENTITLEMENT_ACTIVE' && !expired) {
    return Object.freeze({
      ...base,
      allowed: false,
      outcome: 'ENTITLEMENT_REVOKED',
      message: `provider ${manifest.providerId} not entitlement-active`,
    });
  }

  return Object.freeze({
    ...base,
    allowed: true,
    outcome: 'ENTITLEMENT_ACTIVE',
    message: 'entitlement active for requested purpose',
  });
}

export function evaluateAlternativeDataFeatureGate(input: {
  readonly manifest: AlternativeDataRightsManifest;
  readonly revocation: ProviderRevocationState;
  readonly requestedPurpose: PermittedPurpose;
  readonly atUtc: UtcInstant;
}): AlternativeDataGateDecision {
  return evaluateAlternativeDataGate({
    ...input,
    accessMode: 'derived_feature',
  });
}
