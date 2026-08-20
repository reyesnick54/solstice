import type { ProviderScreenResponse, SanctionsProvider, ScreeningRequest } from '../ports.ts';
import { normalizeComplianceVendorResponse } from './normalization.ts';
import { FIXTURE_SANCTIONS_PROVIDER_ID } from './profile.ts';
import type { FakeComplianceTransport } from './transport.ts';

export class FixtureSanctionsProvider implements SanctionsProvider {
  readonly #transport: FakeComplianceTransport;
  constructor(transport: FakeComplianceTransport) {
    this.#transport = transport;
  }

  screen(request: ScreeningRequest): ProviderScreenResponse {
    const raw = this.#transport.exchange({
      capability: 'SANCTIONS',
      subjectRef: request.subjectRef,
    });
    return normalizeComplianceVendorResponse(raw, request, FIXTURE_SANCTIONS_PROVIDER_ID);
  }
}
