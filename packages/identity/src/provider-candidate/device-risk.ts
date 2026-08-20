import type { UtcInstant } from '../../../domain/src/time.ts';
import type { DeviceRiskProvider, DeviceRiskSignal, RegisteredDevice } from '../auth.ts';
import { FIXTURE_IDENTITY_PROVIDER_ID } from './profile.ts';
import type { FakeIdentityTransport } from './transport.ts';

export class FixtureDeviceRiskProvider implements DeviceRiskProvider {
  readonly #transport: FakeIdentityTransport;
  constructor(transport: FakeIdentityTransport) {
    this.#transport = transport;
  }

  assess(device: RegisteredDevice, now: UtcInstant): DeviceRiskSignal {
    const raw = this.#transport.exchange({
      capability: 'DEVICE_RISK',
      subjectRef: device.deviceId,
    });
    const review = raw.scenario !== 'ok' && raw.scenario !== 'verified';
    return Object.freeze({
      deviceId: device.deviceId,
      recommendedState: review ? 'REVIEW_REQUIRED' : 'KNOWN',
      reasonCode: review ? 'FIXTURE_DEVICE_REVIEW' : `${FIXTURE_IDENTITY_PROVIDER_ID}:device-known`,
      observedAt: now,
    });
  }
}
