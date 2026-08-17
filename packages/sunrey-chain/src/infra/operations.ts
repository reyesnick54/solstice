/**
 * Credential rotation and safe operational audit events.
 * Secret values never appear in logs.
 */

import { INFRA_AUDIT_EVENT_TYPES, infraErr, infraOk, type InfraAuditEventType, type InfraEnvironment, type InfraResult, type SecretClass } from './types.ts';
import { digestJson } from './hash.ts';
import type { ClassifiedSecretStore } from './secrets.ts';

export const ROTATION_TARGETS = [
  'SERVICE_CREDENTIAL',
  'DATABASE_CREDENTIAL',
  'TLS_CERTIFICATE',
  'EXTERNAL_PROVIDER_CREDENTIAL',
  'KMS_KEY_VERSION',
] as const;
export type RotationTarget = (typeof ROTATION_TARGETS)[number];

export type RotationRecord = {
  readonly rotationId: string;
  readonly target: RotationTarget;
  readonly secretClass: SecretClass | null;
  readonly environment: InfraEnvironment;
  readonly generation: number;
  readonly validatorKeyRotationDelegated: true;
};

export type InfraAuditEvent = {
  readonly eventId: string;
  readonly eventType: InfraAuditEventType;
  readonly environment: InfraEnvironment;
  readonly actor: string;
  readonly resource: string;
  readonly outcome: 'OK' | 'DENIED';
  readonly secretValuePresent: false;
  readonly detail: string;
};

const SECRET_LIKE = /(secret|password|token|private[_-]?key|seed|credential)/i;

export function assertNoSecretValue(text: string): InfraResult<true> {
  if (SECRET_LIKE.test(text) && /(reveal|plaintext|value=|secret=)/i.test(text)) {
    return infraErr('SECRET_IN_LOG', 'secret value must not appear in audit logs');
  }
  return infraOk(true);
}

export class InfraAuditLog {
  readonly #events: InfraAuditEvent[] = [];

  record(input: Omit<InfraAuditEvent, 'eventId' | 'secretValuePresent'>): InfraResult<InfraAuditEvent> {
    if (!(INFRA_AUDIT_EVENT_TYPES as readonly string[]).includes(input.eventType)) {
      return infraErr('UNKNOWN_AUDIT_EVENT', `unknown audit event ${input.eventType}`);
    }
    const safe = assertNoSecretValue(`${input.detail} ${input.resource} ${input.actor}`);
    if (!safe.ok) {
      return safe;
    }
    const event: InfraAuditEvent = Object.freeze({
      ...input,
      eventId: `aud_${this.#events.length + 1}`,
      secretValuePresent: false,
    });
    this.#events.push(event);
    return infraOk(event);
  }

  list(): readonly InfraAuditEvent[] {
    return Object.freeze([...this.#events]);
  }

  digest(): string {
    return digestJson(this.list());
  }
}

export function rotateServiceCredential(
  store: ClassifiedSecretStore,
  secretId: string,
  environment: InfraEnvironment,
  nextValue: string,
  audit: InfraAuditLog,
): InfraResult<RotationRecord> {
  const rotated = store.rotate(secretId, nextValue, environment);
  if (!rotated.ok) {
    audit.record({
      eventType: 'CREDENTIAL_ROTATION',
      environment,
      actor: 'infra-control-plane',
      resource: secretId,
      outcome: 'DENIED',
      detail: rotated.error.code,
    });
    return rotated;
  }
  audit.record({
    eventType: 'CREDENTIAL_ROTATION',
    environment,
    actor: 'infra-control-plane',
    resource: secretId,
    outcome: 'OK',
    detail: `generation ${rotated.value.rotationGeneration}`,
  });
  return infraOk(
    Object.freeze({
      rotationId: `rot_${secretId}_${rotated.value.rotationGeneration}`,
      target: 'SERVICE_CREDENTIAL',
      secretClass: rotated.value.secretClass,
      environment,
      generation: rotated.value.rotationGeneration,
      validatorKeyRotationDelegated: true,
    }),
  );
}
