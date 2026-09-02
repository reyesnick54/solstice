/**
 * Wave 6 — Development/simulation fixtures for human economy issuance tests.
 */

import { evidenceHash } from '../issuance.ts';
import type { HumanContributionDomain } from './types.ts';
import type {
  CanonicalContributionEventRef,
  PseudonymousActorRef,
  VerificationReceiptRef,
} from './types.ts';

const DOMAIN_TO_CLASS: Record<HumanContributionDomain, string> = {
  RESEARCH: 'RESEARCH_CONTRIBUTION',
  WORK: 'LABOR_CONTRIBUTION',
  EDUCATION: 'GOVERNED_PARTICIPATION_EVENT',
  COMPUTATION: 'VERIFIED_HUMAN_ECONOMIC_CONTRIBUTION',
};

export function fixtureContributionEvent(domain: HumanContributionDomain, seed: string): CanonicalContributionEventRef {
  return Object.freeze({
    contributionEventId: `hec.event.${domain.toLowerCase()}.${seed}`,
    contributionClass: DOMAIN_TO_CLASS[domain],
    fingerprint: evidenceHash(`fp:${domain}:${seed}`),
    verificationReceiptId: `verify.receipt.${seed}`,
    registeredAtUtc: '2026-09-02T00:00:00.000Z',
  });
}

export function fixturePseudonymousActor(seed: string): PseudonymousActorRef {
  return Object.freeze({
    actorCommitment: evidenceHash(`actor:${seed}`),
    containsRawPersonalData: false,
  });
}

export function fixtureVerificationReceipt(seed: string, verifierSeed = seed): VerificationReceiptRef {
  return Object.freeze({
    receiptId: `verify.receipt.${seed}`,
    verificationPolicyVersion: 'sunrey.human-contribution.verification.v1',
    verifierCommitment: evidenceHash(`verifier:${verifierSeed}`),
    verifiedAtUtc: '2026-09-02T00:00:00.000Z',
  });
}

export const HUMAN_ECONOMY_CONTRIBUTION_DOMAINS = ['RESEARCH', 'WORK', 'EDUCATION', 'COMPUTATION'] as const;
