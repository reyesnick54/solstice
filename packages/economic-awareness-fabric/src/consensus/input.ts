import type { CanonicalEconomicClaim, EconomicEvidence, VerifiedEconomicFact } from '../../../sunrey-chain/src/economic-proof/types.ts';
import { verifiedFactRequiresPromotionPipeline } from '../authority/fail-closed.ts';

/**
 * Information Consensus input — proposes candidates for Wave 3 promotion.
 * Does NOT finalize consensus or mint.
 */
export type InformationConsensusInput = {
  readonly inputId: string;
  readonly economicDomain: string;
  readonly economy: 'HUMAN' | 'PRODUCTIVE';
  readonly evidence: readonly EconomicEvidence[];
  readonly proposedFact: VerifiedEconomicFact | null;
  readonly proposedClaim: CanonicalEconomicClaim | null;
  readonly corroborationCount: number;
  readonly quorumRequired: number;
  readonly submittedAtUtc: string;
};

export type InformationConsensusInputResult =
  | { readonly accepted: true; readonly input: InformationConsensusInput }
  | { readonly accepted: false; readonly reason: string };

export function buildInformationConsensusInput(
  base: Omit<InformationConsensusInput, 'inputId'> & { inputId?: string },
): InformationConsensusInputResult {
  const factCheck = verifiedFactRequiresPromotionPipeline(base.proposedFact);
  if (!factCheck.ok && base.proposedFact !== null) {
    return { accepted: false, reason: factCheck.detail };
  }

  if (base.corroborationCount < base.quorumRequired) {
    return {
      accepted: false,
      reason: `corroboration ${base.corroborationCount} below quorum ${base.quorumRequired}`,
    };
  }

  if (base.evidence.length === 0) {
    return { accepted: false, reason: 'evidence required for consensus input' };
  }

  return {
    accepted: true,
    input: Object.freeze({
      ...base,
      inputId: base.inputId ?? `ici_${base.submittedAtUtc}`,
    }),
  };
}
