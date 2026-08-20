import { FrozenClock } from '../../../config/src/clock.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import { createFixtureIdentityProviderPorts } from './fixtures.ts';
import { fixtureIdentityProviderProfile } from './profile.ts';

export function runIdentityProviderCandidateDemo(now: UtcInstant = '2026-08-20T12:00:00.000Z' as UtcInstant) {
  const clock = new FrozenClock(now);
  const ports = createFixtureIdentityProviderPorts();
  const profile = fixtureIdentityProviderProfile();
  const person = ports.identityVerification.verifyPerson('idn_fixture_person', clock.now());
  return Object.freeze({
    profile,
    person,
    productionAuthorized: profile.productionAuthorized,
    liveVendorConnected: profile.liveVendorConnected,
    kycVerifiedOpensAccount: false,
  });
}
