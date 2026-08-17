import { err, ok, type Result } from '../../../../domain/src/result.ts';
import type { SecretProvider, SecretReference } from '../../../../security/src/secrets.ts';
import type { SecretValue } from '../../../../security/src/redaction.ts';
import type { OracleWorkloadIdentity, ProductionOracleRejection } from './types.ts';

export function createCollectorIdentity(input: {
  readonly collectorId: string;
  readonly assignedSourceIds: readonly string[];
  readonly credentialRefs: Readonly<Record<string, SecretReference>>;
  readonly expiresAtUnix: bigint;
}): Result<OracleWorkloadIdentity, ProductionOracleRejection> {
  for (const sourceId of input.assignedSourceIds) {
    if (!input.credentialRefs[sourceId]) {
      return err({
        code: 'CREDENTIAL_NOT_ASSIGNED',
        detail: `collector ${input.collectorId} is missing a SecretReference for ${sourceId}`,
      });
    }
  }
  for (const sourceId of Object.keys(input.credentialRefs)) {
    if (!input.assignedSourceIds.includes(sourceId)) {
      return err({
        code: 'CREDENTIAL_ISOLATION_VIOLATION',
        detail: `collector ${input.collectorId} received a credential for unassigned source ${sourceId}`,
      });
    }
  }
  return ok(
    Object.freeze({
      schemaVersion: 1,
      collectorId: input.collectorId,
      assignedSourceIds: [...input.assignedSourceIds],
      credentialRefs: Object.freeze({ ...input.credentialRefs }),
      expiresAtUnix: input.expiresAtUnix,
      status: 'ACTIVE',
    }),
  );
}

export function resolveAssignedCredential(
  identity: OracleWorkloadIdentity,
  sourceId: string,
  secrets: SecretProvider,
  nowUnix: bigint,
): Result<SecretValue, ProductionOracleRejection> {
  if (identity.status === 'REVOKED') {
    return err({ code: 'CREDENTIAL_ISOLATION_VIOLATION', detail: 'collector identity is revoked' });
  }
  if (nowUnix >= identity.expiresAtUnix) {
    return err({ code: 'CREDENTIAL_ISOLATION_VIOLATION', detail: 'collector identity expired' });
  }
  if (!identity.assignedSourceIds.includes(sourceId)) {
    return err({
      code: 'CREDENTIAL_ISOLATION_VIOLATION',
      detail: `collector ${identity.collectorId} is not assigned source ${sourceId}`,
    });
  }
  const reference = identity.credentialRefs[sourceId];
  if (!reference) {
    return err({ code: 'CREDENTIAL_NOT_ASSIGNED', detail: sourceId });
  }
  const resolved = secrets.resolve(reference);
  if (!resolved.ok) {
    return err({ code: 'CREDENTIAL_NOT_ASSIGNED', detail: resolved.error.message });
  }
  return ok(resolved.value);
}

export function feedDefinitionMustNotStoreCredentialValue(feedJson: string): Result<true, ProductionOracleRejection> {
  if (/(api[_-]?key|client_secret|password|private_key)["']?\s*[:=]\s*["'][^"']+["']/i.test(feedJson)) {
    return err({
      code: 'CREDENTIAL_ISOLATION_VIOLATION',
      detail: 'feed definition must store SecretReference only',
    });
  }
  return ok(true);
}
