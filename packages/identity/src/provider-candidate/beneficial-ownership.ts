import type { UtcInstant } from '../../../domain/src/time.ts';
import type { BeneficialOwnershipProvider } from '../ports.ts';
import { FIXTURE_IDENTITY_PROVIDER_ID } from './profile.ts';
import type { FakeIdentityTransport } from './transport.ts';

export class FixtureBeneficialOwnershipProvider implements BeneficialOwnershipProvider {
  readonly #transport: FakeIdentityTransport;
  constructor(transport: FakeIdentityTransport) {
    this.#transport = transport;
  }

  lookupBeneficialOwners(registrationRef: string, now: UtcInstant): {
    readonly ownerRefs: readonly string[];
    readonly providerRef: string;
    readonly observedAt: UtcInstant;
    readonly legalOwnershipConclusion: false;
  } {
    this.#transport.exchange({
      capability: 'BENEFICIAL_OWNERSHIP',
      subjectRef: registrationRef,
    });
    return Object.freeze({
      ownerRefs: Object.freeze([`opaque-owner:${registrationRef}`]),
      providerRef: `${FIXTURE_IDENTITY_PROVIDER_ID}:ubo:${registrationRef}`,
      observedAt: now,
      legalOwnershipConclusion: false,
    });
  }
}
