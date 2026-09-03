// @ts-nocheck
/**
 * Wave 6 — Formal SunRey Human Economy issuance proposal.
 *
 * References all proof objects and enforces PEVE ≠ SunRey quantity.
 */

import { createHash } from 'node:crypto';

import { valuationDigest } from '../proof-bound/commitments.ts';
import { governanceRequirements } from './governance.ts';
import { deriveProposedSunReyQuantity } from './monetary-policy.ts';
import {
  SUNREY_HUMAN_ECONOMY_PROPOSAL_SCHEMA,
  type CanonicalContributionEventRef,
  type HumanEconomyPipelineRejection,
  type PeveValuationRef,
  type PseudonymousActorRef,
  type SunReyHumanEconomyIssuanceProposal,
  type VerificationReceiptRef,
} from './types.ts';

export function createPeveValuationRef(input: {
  readonly valuationId: string;
  readonly methodologyId: string;
  readonly methodologyVersion: string;
  readonly referenceValue: string;
  readonly denomination: string;
}): PeveValuationRef {
  return Object.freeze({
    valuationId: input.valuationId,
    methodologyId: input.methodologyId,
    methodologyVersion: input.methodologyVersion,
    referenceValue: input.referenceValue,
    denomination: input.denomination,
    valuationDigest: valuationDigest(
      input.valuationId,
      input.methodologyId,
      input.methodologyVersion,
      input.referenceValue,
    ),
    peveEqualsSunReyQuantity: false,
  });
}

export function createSunReyHumanEconomyIssuanceProposal(input: {
  readonly proposalId: string;
  readonly economicClaimId: string;
  readonly canonicalContributionEvent: CanonicalContributionEventRef;
  readonly pseudonymousActor: PseudonymousActorRef;
  readonly verificationReceipt: VerificationReceiptRef;
  readonly evidenceProofRef: string;
  readonly rightsProofRef: string;
  readonly policyProofRef: string;
  readonly peveValuation: PeveValuationRef;
  readonly monetizationKey: string;
  readonly network: SunReyHumanEconomyIssuanceProposal['network'];
  readonly governanceAuthorizationId?: string | null;
  readonly usePeveAsQuantity?: boolean;
}):
  | { readonly ok: true; readonly proposal: SunReyHumanEconomyIssuanceProposal }
  | { readonly ok: false; readonly code: HumanEconomyPipelineRejection } {
  const derivation = deriveProposedSunReyQuantity({
    peve: input.peveValuation,
    network: input.network,
    usePeveAsQuantity: input.usePeveAsQuantity,
  });
  if (!derivation.ok) {
    return { ok: false, code: derivation.code };
  }
  const proposal: SunReyHumanEconomyIssuanceProposal = Object.freeze({
    schema: SUNREY_HUMAN_ECONOMY_PROPOSAL_SCHEMA,
    proposalId: input.proposalId,
    schemaVersion: 1,
    economicClaimId: input.economicClaimId,
    canonicalContributionEvent: input.canonicalContributionEvent,
    pseudonymousActor: input.pseudonymousActor,
    verificationReceipt: input.verificationReceipt,
    evidenceProofRef: input.evidenceProofRef,
    rightsProofRef: input.rightsProofRef,
    policyProofRef: input.policyProofRef,
    peveValuation: input.peveValuation,
    monetaryPolicy: derivation.monetaryPolicy,
    proposedSunReyQuantity: derivation.proposedSunReyQuantity.toString(),
    peveReferenceValue: derivation.peveReferenceValue.toString(),
    quantityDerivedFromPeve: false,
    governanceRequirements: governanceRequirements(),
    governanceAuthorizationId: input.governanceAuthorizationId ?? null,
    monetizationKey: input.monetizationKey,
    network: input.network,
    status: input.governanceAuthorizationId ? 'AUTHORIZED_SIMULATION' : 'AWAITING_GOVERNANCE',
    productionIssuanceDisabled: true,
  });
  return { ok: true, proposal };
}

export function proposalIdOf(economicClaimId: string, monetizationKey: string): string {
  return createHash('sha256')
    .update(`sunrey.human-economy.proposal:${economicClaimId}:${monetizationKey}`)
    .digest('hex');
}

export function validateProposalForIssuance(
  proposal: SunReyHumanEconomyIssuanceProposal,
): { readonly ok: true } | { readonly ok: false; readonly code: HumanEconomyPipelineRejection } {
  if (proposal.schema !== SUNREY_HUMAN_ECONOMY_PROPOSAL_SCHEMA) {
    return { ok: false, code: 'INVALID_PROPOSAL' };
  }
  if (proposal.quantityDerivedFromPeve !== false) {
    return { ok: false, code: 'PEVE_EQUALS_SUNREY_QUANTITY_FORBIDDEN' };
  }
  if (proposal.productionIssuanceDisabled !== true) {
    return { ok: false, code: 'PRODUCTION_ISSUANCE_DISABLED' };
  }
  if (!proposal.governanceAuthorizationId) {
    return { ok: false, code: 'GOVERNANCE_AUTHORIZATION_MISSING' };
  }
  if (BigInt(proposal.proposedSunReyQuantity) === BigInt(proposal.peveReferenceValue)) {
    return { ok: false, code: 'PEVE_EQUALS_SUNREY_QUANTITY_FORBIDDEN' };
  }
  return { ok: true };
}
