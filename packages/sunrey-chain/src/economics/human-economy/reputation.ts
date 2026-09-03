/**
 * Wave 6 — Contribution verifier reputation signals.
 *
 * Reputation is a risk signal, not truth. Used for monitoring and circuit
 * breaker decisions, never as automatic issuance authority.
 */

import type { HumanContributionDomain, VerifierReputationSignal } from './types.ts';

export type VerifierReputationRegistry = {
  readonly signals: Map<string, VerifierReputationSignal>;
};

export function emptyVerifierReputationRegistry(): VerifierReputationRegistry {
  return { signals: new Map() };
}

export function recordVerifierReputation(
  registry: VerifierReputationRegistry,
  signal: Omit<VerifierReputationSignal, 'reputationIsRiskSignalNotTruth'>,
): VerifierReputationSignal {
  const stored: VerifierReputationSignal = Object.freeze({
    ...signal,
    reputationIsRiskSignalNotTruth: true,
  });
  registry.signals.set(`${signal.verifierCommitment}:${signal.contributionDomain}`, stored);
  return stored;
}

export function getVerifierReputation(
  registry: VerifierReputationRegistry,
  verifierCommitment: string,
  contributionDomain: HumanContributionDomain,
): VerifierReputationSignal | undefined {
  return registry.signals.get(`${verifierCommitment}:${contributionDomain}`);
}

export function computeReputationRiskScore(signal: VerifierReputationSignal): number {
  const accuracyWeight = 10000 - signal.verificationAccuracyBps;
  const disputeWeight = signal.disputeRateBps * 2;
  const revocationWeight = signal.revocationFrequencyBps * 3;
  const issuerPenalty =
    signal.issuerStatus === 'REVOKED' ? 5000 : signal.issuerStatus === 'SUSPENDED' ? 2500 : 0;
  const independencePenalty = signal.sourceIndependence === 'AFFILIATED' ? 1000 : 0;
  return Math.min(
    10000,
    accuracyWeight + disputeWeight + revocationWeight + issuerPenalty + independencePenalty,
  );
}

export function reputationExceedsRiskThreshold(signal: VerifierReputationSignal, threshold = 7000): boolean {
  return computeReputationRiskScore(signal) >= threshold;
}

export function reputationIsNotTruth(): true {
  return true;
}
