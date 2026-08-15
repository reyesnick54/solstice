import type { UtcInstant } from '../../../domain/src/time.ts';
import { err, ok, type Result } from '../../../domain/src/result.ts';
import { assertNoSensitiveCardData } from '../pci-boundary.ts';
import type { AcceptanceDeviceId, MerchantId, ProviderDeviceReference } from './ids.ts';

export const ACCEPTANCE_DEVICE_STATUSES = ['PENDING', 'ACTIVE', 'SUSPENDED', 'BLOCKED', 'REMOVED'] as const;
export type AcceptanceDeviceStatus = (typeof ACCEPTANCE_DEVICE_STATUSES)[number];

const ALLOWED: Readonly<Record<AcceptanceDeviceStatus, readonly AcceptanceDeviceStatus[]>> = {
  PENDING: ['ACTIVE', 'BLOCKED', 'REMOVED'],
  ACTIVE: ['SUSPENDED', 'BLOCKED', 'REMOVED'],
  SUSPENDED: ['ACTIVE', 'BLOCKED', 'REMOVED'],
  BLOCKED: ['REMOVED'],
  REMOVED: [],
};

export type AcceptanceDevice = {
  readonly deviceId: AcceptanceDeviceId;
  readonly merchantId: MerchantId;
  readonly providerDeviceReference: ProviderDeviceReference;
  readonly identityDeviceId: string | null;
  readonly status: AcceptanceDeviceStatus;
  readonly attestationReference: string;
  readonly registeredAt: UtcInstant;
  readonly lastSeenAt: UtcInstant;
};

export type IllegalAcceptanceDeviceTransition = {
  readonly code: 'ILLEGAL_ACCEPTANCE_DEVICE_TRANSITION';
  readonly from: AcceptanceDeviceStatus;
  readonly to: AcceptanceDeviceStatus;
};

export function canTransitionAcceptanceDevice(from: AcceptanceDeviceStatus, to: AcceptanceDeviceStatus): boolean {
  return ALLOWED[from].includes(to);
}

export function freezeAcceptanceDevice(device: AcceptanceDevice): AcceptanceDevice {
  assertNoSensitiveCardData(device, 'acceptanceDevice');
  return Object.freeze({ ...device });
}

export function transitionAcceptanceDevice(
  device: AcceptanceDevice,
  to: AcceptanceDeviceStatus,
  now: UtcInstant,
): Result<AcceptanceDevice, IllegalAcceptanceDeviceTransition> {
  if (!canTransitionAcceptanceDevice(device.status, to)) {
    return err({ code: 'ILLEGAL_ACCEPTANCE_DEVICE_TRANSITION', from: device.status, to });
  }
  return ok(freezeAcceptanceDevice({ ...device, status: to, lastSeenAt: now }));
}

export function deviceCanTransact(device: AcceptanceDevice): boolean {
  return device.status === 'ACTIVE';
}
