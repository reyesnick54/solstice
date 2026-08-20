import { newCorrelationId, newSecurityToken } from '../../random.ts';
import type {
  CredentialFailureCode,
  CredentialOperation,
  CredentialProviderDomain,
  CredentialUseAudit,
  CredentialWorkload,
} from './types.ts';
import { redactCredentialLog } from './redaction.ts';

export function recordCredentialUse(input: {
  readonly providerId: string;
  readonly domain: CredentialProviderDomain;
  readonly credentialId: string;
  readonly credentialVersion: number;
  readonly workloadIdentity: CredentialWorkload;
  readonly operation: CredentialOperation;
  readonly timestamp: string;
  readonly success: boolean;
  readonly reasonCode: CredentialFailureCode | 'OK';
  readonly correlationId?: string;
  readonly secretValue?: string;
}): CredentialUseAudit {
  const audit = Object.freeze({
    auditId: newSecurityToken(),
    providerId: input.providerId,
    domain: input.domain,
    credentialId: input.credentialId,
    credentialVersion: input.credentialVersion,
    workloadIdentity: input.workloadIdentity,
    operation: input.operation,
    timestamp: input.timestamp,
    success: input.success,
    reasonCode: input.reasonCode,
    correlationId: input.correlationId ?? newCorrelationId(),
  });
  const serialized = JSON.stringify(redactCredentialLog(audit));
  if (input.secretValue && serialized.includes(input.secretValue)) {
    throw new Error('credential audit must not contain secret material');
  }
  return audit;
}

export function auditContainsSecret(audit: CredentialUseAudit, secret: string): boolean {
  return JSON.stringify(audit).includes(secret);
}
