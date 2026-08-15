import type { CustomerId } from '../../../domain/src/customer.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { DeviceId } from '../../../identity/src/ids.ts';
import { assertNoSensitiveCardData } from '../pci-boundary.ts';
import type { CardId, NetworkTokenReference } from '../ids.ts';
import type { DevicePaymentTokenId, WalletProviderReference } from './ids.ts';

export const WALLET_PROVIDERS = ['APPLE_WALLET', 'GOOGLE_WALLET'] as const;
export type WalletProvider = (typeof WALLET_PROVIDERS)[number];

export const DEVICE_PAYMENT_TOKEN_STATUSES = [
  'REQUESTED',
  'PENDING_VERIFICATION',
  'ACTIVE',
  'SUSPENDED',
  'DEACTIVATED',
  'DELETED',
] as const;
export type DevicePaymentTokenStatus = (typeof DEVICE_PAYMENT_TOKEN_STATUSES)[number];

export const WALLET_PROVISIONING_METHODS = ['IN_APP', 'PUSH_PROVISIONING'] as const;
export type WalletProvisioningMethod = (typeof WALLET_PROVISIONING_METHODS)[number];

const ALLOWED_TRANSITIONS: Readonly<Record<DevicePaymentTokenStatus, readonly DevicePaymentTokenStatus[]>> = {
  REQUESTED: ['PENDING_VERIFICATION', 'DELETED'],
  PENDING_VERIFICATION: ['ACTIVE', 'SUSPENDED', 'DELETED'],
  ACTIVE: ['SUSPENDED', 'DEACTIVATED', 'DELETED'],
  SUSPENDED: ['ACTIVE', 'DEACTIVATED', 'DELETED'],
  DEACTIVATED: ['DELETED'],
  DELETED: [],
};

export type DevicePaymentToken = {
  readonly tokenId: DevicePaymentTokenId;
  readonly cardId: CardId;
  readonly identityId: string;
  readonly customerId: CustomerId;
  readonly deviceId: DeviceId;
  readonly walletProvider: WalletProvider;
  readonly networkTokenReference: NetworkTokenReference;
  readonly providerReference: WalletProviderReference;
  readonly assuranceLevel: string;
  readonly provisioningMethod: WalletProvisioningMethod;
  readonly status: DevicePaymentTokenStatus;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
  readonly activatedAt: UtcInstant | null;
};

export type IllegalTokenTransition = {
  readonly code: 'ILLEGAL_TOKEN_TRANSITION';
  readonly from: DevicePaymentTokenStatus;
  readonly to: DevicePaymentTokenStatus;
};

export function canTransitionDevicePaymentToken(
  from: DevicePaymentTokenStatus,
  to: DevicePaymentTokenStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function freezeDevicePaymentToken(token: DevicePaymentToken): DevicePaymentToken {
  assertNoSensitiveCardData(token, 'devicePaymentToken');
  return Object.freeze({ ...token });
}

export function transitionDevicePaymentToken(
  token: DevicePaymentToken,
  to: DevicePaymentTokenStatus,
  now: UtcInstant,
): Result<DevicePaymentToken, IllegalTokenTransition> {
  if (!canTransitionDevicePaymentToken(token.status, to)) {
    return err({ code: 'ILLEGAL_TOKEN_TRANSITION', from: token.status, to });
  }
  return ok(
    freezeDevicePaymentToken({
      ...token,
      status: to,
      updatedAt: now,
      activatedAt: to === 'ACTIVE' ? now : token.activatedAt,
    }),
  );
}

export function tokenBoundToDevice(token: DevicePaymentToken, deviceId: DeviceId): boolean {
  return token.deviceId === deviceId;
}
