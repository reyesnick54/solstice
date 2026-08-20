import type { UtcInstant } from '../../../domain/src/time.ts';
import type { BusinessIdentity } from '../model.ts';
import type { BusinessVerificationProvider, IdentityVerificationResult } from '../ports.ts';
import { normalizeIdentityVendorResponse } from './normalization.ts';
import { FIXTURE_IDENTITY_PROVIDER_ID } from './profile.ts';
import type { FakeIdentityTransport } from './transport.ts';

export class FixtureBusinessVerificationProvider implements BusinessVerificationProvider {
  readonly #transport: FakeIdentityTransport;
  constructor(transport: FakeIdentityTransport) {
    this.#transport = transport;
  }

  verifyBusiness(business: BusinessIdentity, now: UtcInstant): IdentityVerificationResult {
    const raw = this.#transport.exchange({
      capability: 'BUSINESS_VERIFICATION',
      subjectRef: business.id,
    });
    return normalizeIdentityVendorResponse(raw, {
      providerRef: `${FIXTURE_IDENTITY_PROVIDER_ID}:business:${business.id}`,
      now,
    });
  }
}
