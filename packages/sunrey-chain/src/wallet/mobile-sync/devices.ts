/**
 * Mobile device registration and Chunk 96 device-trust consumption.
 *
 * A revoked device loses authenticated sync access. Push tokens are
 * notification routing metadata only — never wallet authorization.
 */

import {
  reject,
  type DeviceRiskSignal,
  type DeviceTrustState,
  type MobileDeviceRegistration,
  type MobileSyncRejection,
} from './types.ts';

export type DeviceSyncAuthorization = {
  readonly allowed: boolean;
  readonly deviceId: string;
  readonly walletId: string;
  readonly trustState: DeviceTrustState;
  readonly reason: string;
};

export type WalletDeviceTrustPort = {
  readonly source: MobileDeviceRegistration['source'];
  register(input: {
    readonly deviceId: string;
    readonly walletId: string;
    readonly platform: MobileDeviceRegistration['platform'];
    readonly riskSignal?: DeviceRiskSignal;
    readonly nowUtc: string;
  }): MobileDeviceRegistration;
  trust(deviceId: string): MobileDeviceRegistration | null;
  revoke(deviceId: string, reason: string): MobileDeviceRegistration | null;
  status(deviceId: string): MobileDeviceRegistration | null;
  authorizeSync(deviceId: string, walletId: string): DeviceSyncAuthorization;
  list(walletId?: string): readonly MobileDeviceRegistration[];
};

export class InMemoryWalletDeviceTrust implements WalletDeviceTrustPort {
  readonly source = 'SIMULATION_ADAPTER' as const;
  private readonly devices = new Map<string, MobileDeviceRegistration>();

  register(input: {
    readonly deviceId: string;
    readonly walletId: string;
    readonly platform: MobileDeviceRegistration['platform'];
    readonly riskSignal?: DeviceRiskSignal;
    readonly nowUtc: string;
  }): MobileDeviceRegistration {
    const existing = this.devices.get(input.deviceId);
    if (existing && existing.trustState === 'REVOKED') {
      return existing;
    }
    const registration: MobileDeviceRegistration = Object.freeze({
      registrationId: `reg.${input.deviceId}`,
      deviceId: input.deviceId,
      walletId: input.walletId,
      platform: input.platform,
      trustState: input.riskSignal === 'COMPROMISE_SUSPECTED' ? 'PENDING' : 'TRUSTED',
      riskSignal: input.riskSignal ?? 'NONE',
      registeredAtUtc: input.nowUtc,
      source: this.source,
    });
    this.devices.set(input.deviceId, registration);
    return registration;
  }

  trust(deviceId: string): MobileDeviceRegistration | null {
    const current = this.devices.get(deviceId);
    if (!current || current.trustState === 'REVOKED') {
      return current ?? null;
    }
    const next = Object.freeze({ ...current, trustState: 'TRUSTED' as const });
    this.devices.set(deviceId, next);
    return next;
  }

  revoke(deviceId: string, _reason: string): MobileDeviceRegistration | null {
    const current = this.devices.get(deviceId);
    if (!current) {
      return null;
    }
    const next = Object.freeze({ ...current, trustState: 'REVOKED' as const });
    this.devices.set(deviceId, next);
    return next;
  }

  status(deviceId: string): MobileDeviceRegistration | null {
    return this.devices.get(deviceId) ?? null;
  }

  authorizeSync(deviceId: string, walletId: string): DeviceSyncAuthorization {
    const registration = this.devices.get(deviceId);
    if (!registration) {
      return Object.freeze({
        allowed: false,
        deviceId,
        walletId,
        trustState: 'PENDING',
        reason: 'DEVICE_NOT_REGISTERED',
      });
    }
    if (registration.walletId !== walletId) {
      return Object.freeze({
        allowed: false,
        deviceId,
        walletId,
        trustState: registration.trustState,
        reason: 'DEVICE_UNTRUSTED',
      });
    }
    if (registration.trustState === 'REVOKED' || registration.trustState === 'COMPROMISED') {
      return Object.freeze({
        allowed: false,
        deviceId,
        walletId,
        trustState: registration.trustState,
        reason: 'DEVICE_REVOKED',
      });
    }
    if (registration.trustState !== 'TRUSTED') {
      return Object.freeze({
        allowed: false,
        deviceId,
        walletId,
        trustState: registration.trustState,
        reason: 'DEVICE_UNTRUSTED',
      });
    }
    return Object.freeze({
      allowed: true,
      deviceId,
      walletId,
      trustState: registration.trustState,
      reason: 'OK',
    });
  }

  list(walletId?: string): readonly MobileDeviceRegistration[] {
    const all = [...this.devices.values()];
    return walletId ? all.filter((device) => device.walletId === walletId) : all;
  }
}

/**
 * Bind a Chunk 96 wallet-security device-trust surface when present.
 * The local adapter remains the simulation default.
 */
export function bindChunk96DeviceTrust(port: WalletDeviceTrustPort | undefined): WalletDeviceTrustPort {
  return port ?? new InMemoryWalletDeviceTrust();
}

export function refusePushTokenAuthorization(): MobileSyncRejection {
  return reject('PUSH_TOKEN_NOT_AUTHORIZATION', 'a push token is notification routing metadata, not wallet authorization');
}

export function applyDeviceRiskSignal(
  registration: MobileDeviceRegistration,
  signal: DeviceRiskSignal,
): MobileDeviceRegistration {
  const trustState: DeviceTrustState =
    signal === 'COMPROMISE_SUSPECTED' ? 'COMPROMISED' : registration.trustState === 'REVOKED' ? 'REVOKED' : 'TRUSTED';
  return Object.freeze({
    ...registration,
    riskSignal: signal,
    trustState,
  });
}
