/**
 * HIN private vs public reference data boundary.
 *
 * HINPrivateData: user-owned, permission-controlled, sensitive.
 * HINReferenceData: public/external knowledge, non-user-specific.
 *
 * External provider adapters write ONLY to the reference layer.
 */

export const HIN_DATA_LAYERS = Object.freeze({
  PRIVATE: 'HIN_PRIVATE_DATA',
  REFERENCE: 'HIN_REFERENCE_DATA',
} as const);

export type HinDataLayer = (typeof HIN_DATA_LAYERS)[keyof typeof HIN_DATA_LAYERS];

export type HinPrivateDataMarker = {
  readonly layer: typeof HIN_DATA_LAYERS.PRIVATE;
  readonly subjectBound: true;
  readonly permissionControlled: true;
  readonly sensitive: true;
};

export type HinReferenceDataMarker = {
  readonly layer: typeof HIN_DATA_LAYERS.REFERENCE;
  readonly publicKnowledge: true;
  readonly nonUserSpecific: true;
  readonly referenceOnly: true;
};

export function markAsHinReferenceData(): HinReferenceDataMarker {
  return Object.freeze({
    layer: HIN_DATA_LAYERS.REFERENCE,
    publicKnowledge: true,
    nonUserSpecific: true,
    referenceOnly: true,
  });
}

export function markAsHinPrivateData(): HinPrivateDataMarker {
  return Object.freeze({
    layer: HIN_DATA_LAYERS.PRIVATE,
    subjectBound: true,
    permissionControlled: true,
    sensitive: true,
  });
}

/** Blocks attaching public genetics reference to a user DNA profile without consent. */
export function mayAttachGeneticsToUserProfile(input: {
  readonly hasUserGeneticData: boolean;
  readonly userAuthorized: boolean;
  readonly vaultPolicyPermits: boolean;
}): { readonly allowed: false; readonly reason: string } | { readonly allowed: true } {
  if (!input.hasUserGeneticData) {
    return { allowed: false, reason: 'no user-specific genetic data exists' };
  }
  if (!input.userAuthorized) {
    return { allowed: false, reason: 'user has not explicitly authorized genetics processing' };
  }
  if (!input.vaultPolicyPermits) {
    return { allowed: false, reason: 'vault/HIN policy does not permit genetics attachment' };
  }
  return { allowed: true };
}

/** Public health reference must never create a diagnosis. */
export function assertNotDiagnosis(_referenceData: unknown): { readonly isDiagnosis: false } {
  return { isDiagnosis: false };
}

/** Vault permission check placeholder — does not broaden permissions. */
export function checkVaultPermissionForCombine(input: {
  readonly vaultConsentGranted: boolean;
  readonly operation: 'COMBINE_REFERENCE_WITH_PRIVATE';
}): boolean {
  return input.vaultConsentGranted && input.operation === 'COMBINE_REFERENCE_WITH_PRIVATE';
}
