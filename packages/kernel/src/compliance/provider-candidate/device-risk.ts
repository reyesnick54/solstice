import type { DeviceRiskProvider, ProviderScreenResponse, ScreeningRequest } from '../ports.ts';
import { normalizeComplianceVendorResponse } from './normalization.ts';
import { FIXTURE_AML_PROVIDER_ID } from './profile.ts';
import type { FakeComplianceTransport } from './transport.ts';

export class FixtureComplianceDeviceRiskProvider implements DeviceRiskProvider {
  readonly #transport: FakeComplianceTransport;
  constructor(transport: FakeComplianceTransport) {
    this.#transport = transport;
  }

  screen(request: ScreeningRequest): ProviderScreenResponse {
    const raw = this.#transport.exchange({
      capability: 'DEVICE_RISK',
      subjectRef: request.subjectRef,
    });
    return normalizeComplianceVendorResponse(raw, request, `${FIXTURE_AML_PROVIDER_ID}-device`);
  }
}
