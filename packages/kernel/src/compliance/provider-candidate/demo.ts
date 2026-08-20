import { FrozenClock } from '../../../../config/src/clock.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';
import { createFixtureComplianceProviderPorts } from './fixtures.ts';
import { fixtureSanctionsProviderProfile } from './profile.ts';

export function runComplianceProviderCandidateDemo(
  now: UtcInstant = '2026-08-20T12:00:00.000Z' as UtcInstant,
) {
  const clock = new FrozenClock(now);
  const ports = createFixtureComplianceProviderPorts();
  const request = {
    subjectKind: 'PERSON' as const,
    subjectRef: 'fixture-subject-clear',
    jurisdiction: 'GB',
    now: clock.now(),
  };
  return Object.freeze({
    profile: fixtureSanctionsProviderProfile(),
    sanctions: ports.sanctions.screen(request),
    pep: ports.pep.screen(request),
    productionAuthorized: false,
    providerClearEqualsKernelAllow: false,
  });
}
