import type { PepProvider, ProviderScreenResponse, ScreeningRequest } from '../ports.ts';
import { normalizeComplianceVendorResponse } from './normalization.ts';
import { FIXTURE_PEP_PROVIDER_ID } from './profile.ts';
import type { FakeComplianceTransport } from './transport.ts';

export class FixturePepProvider implements PepProvider {
  readonly #transport: FakeComplianceTransport;
  constructor(transport: FakeComplianceTransport) {
    this.#transport = transport;
  }

  screen(request: ScreeningRequest): ProviderScreenResponse {
    const raw = this.#transport.exchange({
      capability: 'PEP',
      subjectRef: request.subjectRef,
    });
    return normalizeComplianceVendorResponse(raw, request, FIXTURE_PEP_PROVIDER_ID);
  }
}
