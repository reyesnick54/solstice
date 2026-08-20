import type { FraudRiskProvider, ProviderScreenResponse, ScreeningRequest } from '../ports.ts';
import { normalizeComplianceVendorResponse } from './normalization.ts';
import { FIXTURE_AML_PROVIDER_ID } from './profile.ts';
import type { FakeComplianceTransport } from './transport.ts';

export class FixtureFraudRiskProvider implements FraudRiskProvider {
  readonly #transport: FakeComplianceTransport;
  constructor(transport: FakeComplianceTransport) {
    this.#transport = transport;
  }

  evaluate(request: ScreeningRequest): ProviderScreenResponse & {
    readonly freezesFunds: false;
    readonly deletesAccount: false;
    readonly reversesSettlement: false;
  } {
    const raw = this.#transport.exchange({
      capability: 'FRAUD',
      subjectRef: request.subjectRef,
    });
    return Object.freeze({
      ...normalizeComplianceVendorResponse(raw, request, `${FIXTURE_AML_PROVIDER_ID}-fraud`),
      freezesFunds: false,
      deletesAccount: false,
      reversesSettlement: false,
    });
  }
}
