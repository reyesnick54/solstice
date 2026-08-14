import type { UtcInstant } from '../../../packages/domain/src/time.ts';
import type { EvidenceVault } from '../../../packages/evidence/src/vault.ts';
import type { DomainEventLog } from '../../../packages/events/src/events.ts';
import type {
  SecurityAuditPayload,
  SecurityEventSink,
  SecurityEvidenceSink,
} from '../../../packages/security/src/audit.ts';

export function securityEventSink(
  events: DomainEventLog,
  now: () => UtcInstant,
): SecurityEventSink {
  return {
    emit(payload: SecurityAuditPayload): void {
      if (payload.kind === 'security.config.changed') {
        return;
      }
      const eventType =
        payload.kind === 'security.key.created'
          ? 'KeyCreated'
          : payload.kind === 'security.key.rotated'
            ? 'KeyRotated'
            : payload.kind === 'security.key.retired'
              ? 'KeyRetired'
              : 'KeyRevoked';
      events.append({
        eventType,
        schemaVersion: 1,
        occurredAt: now(),
        payload: {
          keyId: payload.keyId,
          purpose: payload.purpose,
          version: payload.version,
          previousVersion: payload.previousVersion,
          status: payload.status,
          provider: payload.provider,
          providerRef: payload.providerRef,
        },
      });
    },
  };
}

export function securityEvidenceSink(evidence: EvidenceVault): SecurityEvidenceSink {
  return {
    seal(kind: string, payload: SecurityAuditPayload) {
      const record = evidence.seal(kind, {
        keyId: payload.keyId,
        purpose: payload.purpose,
        version: payload.version,
        previousVersion: payload.previousVersion,
        status: payload.status,
        provider: payload.provider,
        providerRef: payload.providerRef,
      });
      return { evidenceId: record.evidenceId };
    },
  };
}
