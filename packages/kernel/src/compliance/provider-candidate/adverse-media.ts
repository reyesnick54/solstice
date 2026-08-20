import type { AdverseMediaProvider, ScreeningRequest } from '../ports.ts';
import type { ProviderScreenResponse } from '../ports.ts';
import type { AdverseMediaReference } from '../result.ts';
import { normalizeComplianceVendorResponse, safeAdverseMediaReferences } from './normalization.ts';
import { FIXTURE_AML_PROVIDER_ID } from './profile.ts';
import type { FakeComplianceTransport } from './transport.ts';

export class FixtureAdverseMediaProvider implements AdverseMediaProvider {
  readonly #transport: FakeComplianceTransport;
  constructor(transport: FakeComplianceTransport) {
    this.#transport = transport;
  }

  screen(request: ScreeningRequest): ProviderScreenResponse & {
    readonly references: readonly AdverseMediaReference[];
    readonly copyrightedCopyStored: false;
    readonly treatedAsGuilt: false;
  } {
    const raw = this.#transport.exchange({
      capability: 'ADVERSE_MEDIA',
      subjectRef: request.subjectRef,
    });
    const normalized = normalizeComplianceVendorResponse(raw, request, `${FIXTURE_AML_PROVIDER_ID}-media`);
    return Object.freeze({
      ...normalized,
      references: safeAdverseMediaReferences(request, normalized.outcome === 'REVIEW'),
      copyrightedCopyStored: false,
      treatedAsGuilt: false,
    });
  }
}
