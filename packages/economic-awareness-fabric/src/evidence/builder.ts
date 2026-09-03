import type { EconomicEvidence, EconomicObservation } from '@solstice/sunrey-chain/economic-proof';
import { economicProofDigest } from '@solstice/sunrey-chain/economic-proof';

export type EvidenceProposal = {
  readonly proposalId: string;
  readonly observationIds: readonly string[];
  readonly evidence: EconomicEvidence;
  readonly proposedAtUtc: string;
};

export function proposeEvidenceFromObservations(
  observations: readonly EconomicObservation[],
  buildEvidence: (observations: readonly EconomicObservation[]) => EconomicEvidence,
  proposedAtUtc: string,
): EvidenceProposal | null {
  if (observations.length === 0) return null;

  const evidence = buildEvidence(observations);
  const proposalId = economicProofDigest('fabric-evidence-proposal', {
    observationIds: observations.map((o) => o.observationId),
    evidenceId: evidence.evidenceId,
    proposedAtUtc,
  });

  return Object.freeze({
    proposalId,
    observationIds: Object.freeze(observations.map((o) => o.observationId)),
    evidence,
    proposedAtUtc,
  });
}
