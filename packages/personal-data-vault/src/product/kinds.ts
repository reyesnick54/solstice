/**
 * Record kinds. AI inference is never a verified personal fact.
 */

export const DATA_KINDS = [
  'RAW_DATA',
  'NORMALIZED_DATA',
  'DERIVED_DATA',
  'AI_INFERENCE',
  'USER_DECLARATION',
  'VERIFIED_FACT',
] as const;
export type DataKind = (typeof DATA_KINDS)[number];

export const VERIFICATION_STATES = [
  'UNVERIFIED',
  'USER_DECLARED',
  'PROVIDER_SOURCED',
  'DERIVED',
  'AI_INFERRED',
  'REVIEW_PENDING',
  'DISPUTED',
  'VERIFIED',
] as const;
export type VerificationState = (typeof VERIFICATION_STATES)[number];

export function isDataKind(value: string): value is DataKind {
  return (DATA_KINDS as readonly string[]).includes(value);
}

export function kindFromProvenance(
  provenanceKind: string,
  derivationState: string,
): DataKind {
  if (derivationState === 'DERIVED' || provenanceKind === 'DERIVED') {
    return 'DERIVED_DATA';
  }
  if (provenanceKind === 'USER_DECLARED') {
    return 'USER_DECLARATION';
  }
  if (provenanceKind === 'USER_UPLOADED' || provenanceKind === 'IMPORTED_ARCHIVE') {
    return 'RAW_DATA';
  }
  if (provenanceKind === 'SOLSTICE_GENERATED') {
    return 'NORMALIZED_DATA';
  }
  if (provenanceKind === 'EXTERNAL_CONNECTOR') {
    return 'NORMALIZED_DATA';
  }
  return 'RAW_DATA';
}

export function verificationFromKind(kind: DataKind, provenanceKind: string): VerificationState {
  if (kind === 'AI_INFERENCE') {
    return 'AI_INFERRED';
  }
  if (kind === 'VERIFIED_FACT') {
    return 'VERIFIED';
  }
  if (kind === 'USER_DECLARATION' || provenanceKind === 'USER_DECLARED') {
    return 'USER_DECLARED';
  }
  if (kind === 'DERIVED_DATA') {
    return 'DERIVED';
  }
  if (provenanceKind === 'EXTERNAL_CONNECTOR') {
    return 'PROVIDER_SOURCED';
  }
  return 'UNVERIFIED';
}

export function assertNotVerifiedInference(kind: DataKind, verification: VerificationState): void {
  if (kind === 'AI_INFERENCE' && verification === 'VERIFIED') {
    throw new Error('AI inference cannot be marked as a verified personal fact');
  }
}
