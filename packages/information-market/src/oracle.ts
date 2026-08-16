import { addMs } from '../../config/src/clock.ts';
import { err, ok, type Result } from '../../domain/src/result.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import type { KeyProvider } from '../../security/src/provider.ts';
import { newAttestationId, subjectRefFor } from './ids.ts';
import { ORACLE_ISSUER, type OracleClaimType } from './taxonomy.ts';
import type { EligibilityFact, InformationMarketFailure, OracleAttestation } from './types.ts';

function attestationPayload(row: Omit<OracleAttestation, 'signatureHex' | 'keyId' | 'keyVersion'>): string {
  return JSON.stringify({
    attestationId: row.attestationId,
    subjectRef: row.subjectRef,
    claimType: row.claimType,
    claimResult: row.claimResult,
    sourceRefs: row.sourceRefs,
    purposeRef: row.purposeRef,
    issuedAt: row.issuedAt,
    expiresAt: row.expiresAt,
    issuer: row.issuer,
  });
}

export function issueOracleAttestation(input: {
  readonly keys: KeyProvider;
  readonly fact: EligibilityFact;
  readonly claimType: OracleClaimType;
  readonly purposeRef: string;
  readonly now: UtcInstant;
  readonly consentRef?: string;
}): Result<OracleAttestation, InformationMarketFailure> {
  const result = claimFromFact(input.fact, input.claimType);
  if (result === undefined) {
    return err({ code: 'CLAIM_UNAVAILABLE', message: 'fact does not support the requested claim' });
  }
  const unsigned = {
    attestationId: newAttestationId(),
    subjectRef: subjectRefFor(input.fact.subjectId),
    claimType: input.claimType,
    claimResult: result,
    sourceRefs: Object.freeze([
      input.fact.pegRef ?? 'peg:none',
      ...(input.fact.vaultMetadataCategories ?? []).map((category) => `pdv-meta:${category}`),
    ]),
    purposeRef: input.purposeRef,
    consentRef: input.consentRef,
    issuedAt: input.now,
    expiresAt: addMs(input.now, 24 * 60 * 60 * 1000),
    issuer: ORACLE_ISSUER,
    verificationState: 'SIGNED_SIMULATION' as const,
    sourceRecordRevealed: false as const,
  };
  const signed = input.keys.sign('DATA_USE_PERMIT_SIGNING', attestationPayload(unsigned));
  if (!signed.ok) {
    return err({ code: 'ATTESTATION_SIGN_FAILED', message: signed.error.message });
  }
  return ok(
    Object.freeze({
      ...unsigned,
      signatureHex: signed.value.hex,
      keyId: signed.value.keyId,
      keyVersion: signed.value.keyVersion,
    }),
  );
}

export function verifyOracleAttestation(input: {
  readonly keys: KeyProvider;
  readonly attestation: OracleAttestation;
  readonly now: UtcInstant;
}): Result<OracleAttestation, InformationMarketFailure> {
  if (input.now >= input.attestation.expiresAt) {
    return err({ code: 'ATTESTATION_EXPIRED', message: 'attestation expired' });
  }
  const { signatureHex, keyId, keyVersion, ...rest } = input.attestation;
  const verified = input.keys.verify('DATA_USE_PERMIT_SIGNING', attestationPayload(rest), signatureHex, keyVersion);
  if (!verified.ok) {
    return err({ code: 'ATTESTATION_TAMPERED', message: 'attestation signature invalid' });
  }
  return ok(input.attestation);
}

function claimFromFact(fact: EligibilityFact, claimType: OracleClaimType): string | boolean | undefined {
  switch (claimType) {
    case 'AGE_BAND':
      return fact.ageBand;
    case 'RESEARCH_INCLUSION':
      return fact.researchInclusion;
    case 'INCOME_THRESHOLD':
      return fact.incomeAboveThreshold;
    case 'SAVINGS_BEHAVIOR_MAINTAINED':
      return fact.savingsBehaviorMaintained;
    case 'VERIFIED_CREDENTIAL':
      return fact.verifiedCredential;
    case 'COHORT_MEMBERSHIP':
      return fact.cohortId;
    default:
      return undefined;
  }
}
