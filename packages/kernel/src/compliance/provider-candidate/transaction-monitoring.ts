import type { ProviderScreenResponse, ScreeningRequest, TransactionMonitoringProvider } from '../ports.ts';
import { normalizeComplianceVendorResponse } from './normalization.ts';
import { FIXTURE_AML_PROVIDER_ID } from './profile.ts';
import type { FakeComplianceTransport } from './transport.ts';

export class FixtureTransactionMonitoringProvider implements TransactionMonitoringProvider {
  readonly #transport: FakeComplianceTransport;
  constructor(transport: FakeComplianceTransport) {
    this.#transport = transport;
  }

  evaluate(request: ScreeningRequest & { readonly journalId?: string }): ProviderScreenResponse & {
    readonly reversesJournal: false;
  } {
    const raw = this.#transport.exchange({
      capability: 'TRANSACTION_MONITORING',
      subjectRef: request.journalId ?? request.subjectRef,
    });
    return Object.freeze({
      ...normalizeComplianceVendorResponse(raw, request, FIXTURE_AML_PROVIDER_ID),
      reversesJournal: false,
    });
  }
}
