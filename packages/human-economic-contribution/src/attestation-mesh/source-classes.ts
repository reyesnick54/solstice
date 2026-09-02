/**
 * Human Contribution Attestation source classes.
 *
 * Not all source classes carry equal evidentiary weight. Self-attestation and
 * peer attestation are explicitly weaker than institutional or signed receipts.
 */

export const ATTESTATION_SOURCE_CLASSES = [
  'PRIMARY_INSTITUTION',
  'EMPLOYER',
  'EDUCATIONAL_INSTITUTION',
  'RESEARCH_PUBLISHER',
  'RESEARCH_REGISTRY',
  'CREDENTIAL_ISSUER',
  'GOVERNMENT',
  'SIGNED_COMPUTATION_RECEIPT',
  'SIGNED_WORK_RECEIPT',
  'PEER_ATTESTATION',
  'USER_SELF_ATTESTATION',
  'AUTHORIZED_DATA_PROVIDER',
  'OTHER_GOVERNANCE_APPROVED',
] as const;

export type AttestationSourceClass = (typeof ATTESTATION_SOURCE_CLASSES)[number];

export type AttestationEvidentiaryWeight = 'AUTHORITATIVE' | 'STRONG' | 'MODERATE' | 'WEAK' | 'NON_VERIFYING';

export const ATTESTATION_SOURCE_CLASS_WEIGHTS: Readonly<Record<AttestationSourceClass, AttestationEvidentiaryWeight>> =
  Object.freeze({
    PRIMARY_INSTITUTION: 'AUTHORITATIVE',
    EMPLOYER: 'STRONG',
    EDUCATIONAL_INSTITUTION: 'STRONG',
    RESEARCH_PUBLISHER: 'AUTHORITATIVE',
    RESEARCH_REGISTRY: 'AUTHORITATIVE',
    CREDENTIAL_ISSUER: 'STRONG',
    GOVERNMENT: 'AUTHORITATIVE',
    SIGNED_COMPUTATION_RECEIPT: 'STRONG',
    SIGNED_WORK_RECEIPT: 'STRONG',
    PEER_ATTESTATION: 'MODERATE',
    USER_SELF_ATTESTATION: 'WEAK',
    AUTHORIZED_DATA_PROVIDER: 'STRONG',
    OTHER_GOVERNANCE_APPROVED: 'MODERATE',
  });

export const SELF_ATTESTATION_SOURCE_CLASS: AttestationSourceClass = 'USER_SELF_ATTESTATION';

export function isAttestationSourceClass(value: string): value is AttestationSourceClass {
  return (ATTESTATION_SOURCE_CLASSES as readonly string[]).includes(value);
}

export function attestationSourceClassWeight(sourceClass: AttestationSourceClass): AttestationEvidentiaryWeight {
  return ATTESTATION_SOURCE_CLASS_WEIGHTS[sourceClass];
}

export function isAuthoritativeAttestationSource(sourceClass: AttestationSourceClass): boolean {
  return ATTESTATION_SOURCE_CLASS_WEIGHTS[sourceClass] === 'AUTHORITATIVE';
}

export function isStrongAttestationSource(sourceClass: AttestationSourceClass): boolean {
  const weight = ATTESTATION_SOURCE_CLASS_WEIGHTS[sourceClass];
  return weight === 'AUTHORITATIVE' || weight === 'STRONG';
}

export function isSelfAttestationSource(sourceClass: AttestationSourceClass): boolean {
  return sourceClass === SELF_ATTESTATION_SOURCE_CLASS;
}

export function countsTowardIndependentEvidence(sourceClass: AttestationSourceClass): boolean {
  return ATTESTATION_SOURCE_CLASS_WEIGHTS[sourceClass] !== 'WEAK' && sourceClass !== 'PEER_ATTESTATION';
}

export function selfAttestationMaySupportClaimInput(sourceClass: AttestationSourceClass): boolean {
  return sourceClass === SELF_ATTESTATION_SOURCE_CLASS;
}

export function selfAttestationCannotSoleVerify(sourceClass: AttestationSourceClass): boolean {
  return sourceClass === SELF_ATTESTATION_SOURCE_CLASS;
}
