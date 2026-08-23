/**
 * Webhook hardening: signature, timestamp, replay, environment,
 * provider mapping, raw-body hash, idempotency. Callbacks cannot
 * bypass canonical domain state machines.
 */

import { sha256Hex } from '../hash.ts';
import { ProviderWebhookGuard, type ProviderWebhookEnvelope } from '../regulated/webhook.ts';
import { securityErr, securityOk, type SecurityResult } from '../errors.ts';
import type { SecretValue } from '../redaction.ts';

export const WEBHOOK_DOMAIN_BYPASS_FORBIDDEN = true as const;

export function hashRawBody(rawBody: string | Buffer): string {
  return sha256Hex(rawBody);
}

export function validateInboundWebhook(input: {
  readonly guard: ProviderWebhookGuard;
  readonly envelope: ProviderWebhookEnvelope;
  readonly rawBody: string | Buffer;
  readonly nowMs: number;
  readonly domainStateMachineInvoked: boolean;
}): SecurityResult<{ readonly duplicate: boolean; readonly domainBypassed: false }> {
  if (hashRawBody(input.rawBody) !== input.envelope.payloadHash) {
    return securityErr('SIGNATURE_INVALID', 'raw-body hash does not match payloadHash');
  }
  const result = input.guard.validate(input.envelope, input.nowMs);
  if (!result.ok) {
    const code =
      result.code === 'ENVIRONMENT_MISMATCH'
        ? 'ENVIRONMENT_MISMATCH'
        : result.code === 'INVALID_SIGNATURE'
          ? 'SIGNATURE_INVALID'
          : result.code === 'STALE_TIMESTAMP' || result.code === 'REPLAYED'
            ? 'AUTHENTICATION_FAILED'
            : 'POLICY_REJECTED';
    return securityErr(code, `webhook ${result.code}`);
  }
  if (!input.domainStateMachineInvoked || !WEBHOOK_DOMAIN_BYPASS_FORBIDDEN) {
    return securityErr('POLICY_REJECTED', 'provider callback cannot bypass the canonical domain state machine');
  }
  return securityOk({ duplicate: result.duplicate, domainBypassed: false });
}

export function registerEnvironmentBoundProvider(
  guard: ProviderWebhookGuard,
  providerId: string,
  secret: SecretValue,
  environment: string,
): void {
  guard.registerProvider(providerId, secret, environment);
}
