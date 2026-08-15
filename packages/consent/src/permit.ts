import { addMs, isExpired } from '../../config/src/clock.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import { newSecurityToken } from '../../security/src/random.ts';
import type { KeyProvider } from '../../security/src/provider.ts';
import type { ConsentOperation } from './taxonomy.ts';
import { PERMIT_MAX_TTL_MS, PERMIT_TTL_MS } from './taxonomy.ts';
import { newDataUsePermitId } from './ids.ts';
import type { ConsentRecord, DataUsePermit } from './types.ts';
import type { ConsentFailure } from './types.ts';
import { err, ok, type Result } from '../../domain/src/result.ts';

const ISSUER = 'packages/consent';

export function permitPayload(permit: Omit<DataUsePermit, 'signatureHex' | 'keyId' | 'keyVersion'>): string {
  return JSON.stringify({
    permitId: permit.permitId,
    subjectId: permit.subjectId,
    consentId: permit.consentId,
    consentVersion: permit.consentVersion,
    purposeId: permit.purposeId,
    purposeVersion: permit.purposeVersion,
    recipientId: permit.recipientId,
    permittedAssetIds: permit.permittedAssetIds,
    permittedCategories: permit.permittedCategories,
    allowedOperation: permit.allowedOperation,
    issuedAt: permit.issuedAt,
    expiresAt: permit.expiresAt,
    nonce: permit.nonce,
    issuer: permit.issuer,
  });
}

export function issueDataUsePermit(input: {
  readonly keys: KeyProvider;
  readonly consent: ConsentRecord;
  readonly operation: ConsentOperation;
  readonly now: UtcInstant;
  readonly ttlMs?: number;
}): Result<DataUsePermit, ConsentFailure> {
  const ttl = input.ttlMs ?? PERMIT_TTL_MS;
  if (ttl <= 0 || ttl > PERMIT_MAX_TTL_MS) {
    return err({ code: 'PERMIT_INVALID', message: 'permit TTL must be short-lived' });
  }
  const unsigned = {
    permitId: newDataUsePermitId(),
    subjectId: input.consent.subjectId,
    consentId: input.consent.consentId,
    consentVersion: input.consent.version,
    purposeId: input.consent.purposeId,
    purposeVersion: input.consent.purposeVersion,
    recipientId: input.consent.recipientId,
    permittedAssetIds: input.consent.permittedAssetIds,
    permittedCategories: input.consent.permittedCategories,
    allowedOperation: input.operation,
    issuedAt: input.now,
    expiresAt: addMs(input.now, ttl),
    nonce: newSecurityToken(),
    issuer: ISSUER,
  };
  const signed = input.keys.sign('DATA_USE_PERMIT_SIGNING', permitPayload(unsigned));
  if (!signed.ok) {
    return err({ code: 'PERMIT_INVALID', message: signed.error.message });
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

export function verifyDataUsePermit(input: {
  readonly keys: KeyProvider;
  readonly permit: DataUsePermit;
  readonly now: UtcInstant;
  readonly expectedRecipientId: string;
  readonly expectedPurposeId: string;
  readonly expectedSubjectId: string;
}): Result<DataUsePermit, ConsentFailure> {
  if (input.permit.issuer !== ISSUER) {
    return err({ code: 'PERMIT_INVALID', message: 'unknown permit issuer' });
  }
  if (input.permit.subjectId !== input.expectedSubjectId) {
    return err({ code: 'SUBJECT_MISMATCH', message: 'permit is bound to a different subject' });
  }
  if (input.permit.recipientId !== input.expectedRecipientId) {
    return err({ code: 'PERMIT_RECIPIENT_MISMATCH', message: 'permit cannot be used by this recipient' });
  }
  if (input.permit.purposeId !== input.expectedPurposeId) {
    return err({ code: 'PERMIT_PURPOSE_MISMATCH', message: 'permit cannot be reused for another purpose' });
  }
  if (isExpired(input.permit.expiresAt, input.now)) {
    return err({ code: 'PERMIT_EXPIRED', message: 'data-use permit has expired' });
  }
  const { signatureHex, keyId: _keyId, keyVersion, ...unsigned } = input.permit;
  const verified = input.keys.verify('DATA_USE_PERMIT_SIGNING', permitPayload(unsigned), signatureHex, keyVersion);
  if (!verified.ok) {
    return err({ code: 'PERMIT_INVALID', message: 'permit signature is invalid' });
  }
  return ok(input.permit);
}
