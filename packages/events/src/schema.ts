import type { DurableEventEnvelope } from './envelope.ts';
import { EVENT_TYPE_NAMES, type ImplementedEventTypeName } from './taxonomy.ts';

export type SchemaCompatibility = 'CURRENT' | 'DEPRECATED' | 'UPCAST' | 'UNSUPPORTED';

export type EventSchemaRecord = {
  readonly eventType: string;
  readonly version: number;
  readonly status: 'current' | 'deprecated' | 'unsupported';
  readonly upcastFrom?: number;
};

const REGISTRY: readonly EventSchemaRecord[] = [
  { eventType: 'AccountOpened', version: 1, status: 'current' },
  { eventType: 'DepositPosted', version: 1, status: 'current' },
  { eventType: 'WithdrawalPosted', version: 1, status: 'current' },
  { eventType: 'InternalTransferPosted', version: 1, status: 'current' },
  { eventType: 'CustomerStatusChanged', version: 1, status: 'current' },
  { eventType: 'KernelDecisionRecorded', version: 1, status: 'current' },
  { eventType: 'PolicyPackActivated', version: 1, status: 'current' },
  { eventType: 'PolicyPackRetired', version: 1, status: 'current' },
  { eventType: 'PolicyReviewRequested', version: 1, status: 'current' },
  { eventType: 'PolicyReviewDecided', version: 1, status: 'current' },
  { eventType: 'KeyCreated', version: 1, status: 'current' },
  { eventType: 'KeyRotated', version: 1, status: 'current' },
  { eventType: 'KeyRetired', version: 1, status: 'current' },
  { eventType: 'KeyRevoked', version: 1, status: 'current' },
  { eventType: 'IdentityCreated', version: 1, status: 'current' },
  { eventType: 'IdentityActivated', version: 1, status: 'current' },
  { eventType: 'IdentitySuspended', version: 1, status: 'current' },
  { eventType: 'IdentityKycUpdated', version: 1, status: 'current' },
  { eventType: 'IdentitySessionCreated', version: 1, status: 'current' },
  { eventType: 'IdentitySessionRevoked', version: 1, status: 'current' },
  { eventType: 'IdentityDeviceRegistered', version: 1, status: 'current' },
  { eventType: 'IdentityRecoveryRequested', version: 1, status: 'current' },
  { eventType: 'ComplianceScreeningCompleted', version: 1, status: 'current' },
  { eventType: 'ComplianceScreeningReviewRequired', version: 1, status: 'current' },
  { eventType: 'ComplianceCaseOpened', version: 1, status: 'current' },
  { eventType: 'ComplianceCaseDecided', version: 1, status: 'current' },
  { eventType: 'ComplianceAlertCreated', version: 1, status: 'current' },
  { eventType: 'FraudRiskEvaluated', version: 1, status: 'current' },
];

export class UnsupportedEventVersionError extends Error {
  readonly eventType: string;
  readonly eventVersion: number;
  readonly reasonCode = 'UNSUPPORTED_EVENT_VERSION';

  constructor(eventType: string, eventVersion: number) {
    super(`unsupported event version ${eventType}/${eventVersion}`);
    this.name = 'UnsupportedEventVersionError';
    this.eventType = eventType;
    this.eventVersion = eventVersion;
  }
}

export function listEventSchemas(): readonly EventSchemaRecord[] {
  return REGISTRY;
}

export function resolveEventSchema(eventType: string, version: number): SchemaCompatibility {
  const match = REGISTRY.find((row) => row.eventType === eventType && row.version === version);
  if (match?.status === 'current') {
    return 'CURRENT';
  }
  if (match?.status === 'deprecated') {
    return 'DEPRECATED';
  }
  const upcast = REGISTRY.find(
    (row) => row.eventType === eventType && row.upcastFrom === version && row.status === 'current',
  );
  if (upcast) {
    return 'UPCAST';
  }
  return 'UNSUPPORTED';
}

export function assertSupportedEventVersion(envelope: DurableEventEnvelope): void {
  const compatibility = resolveEventSchema(envelope.eventType, envelope.eventVersion);
  if (compatibility === 'UNSUPPORTED') {
    throw new UnsupportedEventVersionError(envelope.eventType, envelope.eventVersion);
  }
}

/**
 * Compatibility strategy:
 * - new optional field: same version, consumers ignore unknown keys
 * - breaking change: new event version, register it here
 * - deprecated version: keep readable, mark deprecated
 * - upcast: transform an older version into the current shape
 * - unsupported: fail safely, no business effect
 */
export function upcastEnvelope(envelope: DurableEventEnvelope): DurableEventEnvelope {
  const compatibility = resolveEventSchema(envelope.eventType, envelope.eventVersion);
  if (compatibility === 'UNSUPPORTED') {
    throw new UnsupportedEventVersionError(envelope.eventType, envelope.eventVersion);
  }
  return envelope;
}

export function isImplementedEventType(eventType: string): eventType is ImplementedEventTypeName {
  return (EVENT_TYPE_NAMES as readonly string[]).includes(eventType);
}
