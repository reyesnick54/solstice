/**
 * Deterministic DEVELOPMENT/SIMULATION fixtures.
 *
 * These do not invent a valuation algorithm. Quantity is supplied
 * explicitly by the fixture caller.
 */

import { evidenceHash } from '../issuance.ts';
import type { MonetaryContributionClass, VerifiedHumanEconomicContribution } from './types.ts';

export function fixtureVerifiedContribution(input?: {
  readonly contributionId?: string;
  readonly fingerprint?: string;
  readonly contributionClass?: MonetaryContributionClass;
  readonly verificationState?: VerifiedHumanEconomicContribution['verificationState'];
  readonly supersededContributionId?: string;
}): VerifiedHumanEconomicContribution {
  const contributionId = input?.contributionId ?? 'hec.contrib.demo.1';
  const fingerprintSeed = input?.fingerprint ?? contributionId;
  return Object.freeze({
    contributionId,
    fingerprint: fingerprintSeed.length === 64 && /^[0-9a-f]+$/.test(fingerprintSeed)
      ? fingerprintSeed
      : evidenceHash(`fingerprint:${fingerprintSeed}`),
    contributionClass: input?.contributionClass ?? 'COMMUNITY_CONTRIBUTION',
    verificationState: input?.verificationState ?? 'VERIFIED',
    verificationPolicyVersion: 'sunrey.human-contribution.verification.v1',
    verificationEvidenceDigest: evidenceHash(`verify:${contributionId}`),
    measurementBasis: 'AUTHORIZED_EVENT_COUNT',
    measurementUnit: 'EVENT',
    measurementPeriod: '2026-08',
    jurisdictionPolicyRef: 'policy.sim.jurisdiction.unconfigured',
    containsRawPersonalData: false,
    pdvSourceExposed: false,
    cleanRoomSourceExposed: false,
    peveScoreUsedAsQuantity: false,
    humanWorthScore: false,
    ...(input?.supersededContributionId !== undefined
      ? { supersededContributionId: input.supersededContributionId }
      : {}),
  });
}

export function fixtureUnverifiedContribution(): VerifiedHumanEconomicContribution {
  return Object.freeze({
    ...fixtureVerifiedContribution({ contributionId: 'hec.contrib.unverified' }),
    verificationState: 'UNVERIFIED',
  });
}
