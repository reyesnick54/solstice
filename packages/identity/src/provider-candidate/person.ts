import type { UtcInstant } from '../../../domain/src/time.ts';
import type { IdentityVerificationProvider, IdentityVerificationResult } from '../ports.ts';
import { normalizeIdentityVendorResponse } from './normalization.ts';
import { FIXTURE_IDENTITY_PROVIDER_ID } from './profile.ts';
import type { FakeIdentityTransport } from './transport.ts';

export class FixturePersonVerificationProvider implements IdentityVerificationProvider {
  readonly #transport: FakeIdentityTransport;
  constructor(transport: FakeIdentityTransport) {
    this.#transport = transport;
  }

  verifyPerson(identityId: string, now: UtcInstant): IdentityVerificationResult {
    const raw = this.#transport.exchange({
      capability: 'PERSON_VERIFICATION',
      subjectRef: identityId,
    });
    return normalizeIdentityVendorResponse(raw, {
      providerRef: `${FIXTURE_IDENTITY_PROVIDER_ID}:person:${identityId}`,
      now,
    });
  }
}
