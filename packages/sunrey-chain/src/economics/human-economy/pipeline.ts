// @ts-nocheck
/**
 * Wave 6 — Governed SunRey Human Economy issuance pipeline.
 *
 * Human Activity → proofs → PEVE → Monetary Policy → Proposal → Governance
 * → Wave 3 proof-bound ISSUE → Finality.
 *
 * No earlier component may directly mint. Reuses Wave 3 claim consumption.
 */

import type { ProtocolNativeSupplyAuthority } from '../../native-assets/economic-controls.ts';
import { expectedTotal } from '../supply.ts';
import { createEconomicProofBundle } from '../proof-bound/bundle.ts';
import type { ClaimRegistry } from '../proof-bound/claims.ts';
import { getClaim, registerEconomicClaim } from '../proof-bound/claims.ts';
import type { ConsumptionStore } from '../proof-bound/consumption.ts';
import {
  deserializeConsumptionStore,
  loadConsumptionStore,
  persistConsumptionStore,
  replayConsumptionLog,
  serializeConsumptionStore,
} from '../proof-bound/consumption.ts';
import {
  evidenceCommitment,
  policyCommitment,
  rightsCommitment,
} from '../proof-bound/commitments.ts';
import { executeProofBoundSunReyIssuance } from '../proof-bound/pipeline.ts';
import { computeCommitmentRoots } from '../proof-bound/roots.ts';
import type {
  EvidenceCommitment,
  PolicyCommitment,
  RightsCommitment,
} from '../proof-bound/types.ts';
import type { DomainCircuitBreakerRegistry } from './circuit-breakers.ts';
import { isDomainVerificationPaused } from './circuit-breakers.ts';
import type { ClaimChallengeRegistry } from './challenges.ts';
import { hasActiveChallenge } from './challenges.ts';
import type { HumanEconomyMonitoringStore } from './monitoring.ts';
import { incrementMetric } from './monitoring.ts';
import {
  createPeveValuationRef,
  createSunReyHumanEconomyIssuanceProposal,
  proposalIdOf,
  validateProposalForIssuance,
} from './proposal.ts';
import { validateGovernanceAuthorization } from './governance.ts';
import { buildSunReyEconomicReceipt } from './receipt.ts';
import type {
  CanonicalContributionEventRef,
  HumanContributionDomain,
  HumanEconomyPipelineRejection,
  PseudonymousActorRef,
  SunReyEconomicReceipt,
  SunReyHumanEconomyIssuanceProposal,
  VerificationReceiptRef,
} from './types.ts';

export type HumanEconomyIssuanceInput = {
  readonly actor: 'PROTOCOL' | 'HUMAN_GOVERNANCE';
  readonly network: 'DEVELOPMENT' | 'TESTNET' | 'MAINNET';
  readonly recipient: string;
  readonly contributionDomain: HumanContributionDomain;
  readonly economicClaimId: string;
  readonly claimFingerprint: string;
  readonly subjectCommitment: string;
  readonly canonicalContributionEvent: CanonicalContributionEventRef;
  readonly pseudonymousActor: PseudonymousActorRef;
  readonly verificationReceipt: VerificationReceiptRef;
  readonly peveReferenceValue: bigint;
  readonly peveMethodologyId?: string;
  readonly peveMethodologyVersion?: string;
  readonly governance: {
    readonly authorizationId: string;
    readonly authorizedQuantity: string;
    readonly governancePolicyVersion: string;
    readonly authorizedBy: 'HUMAN_GOVERNANCE' | 'PROTOCOL';
  };
  readonly nowUnixSeconds: bigint;
  readonly usePeveAsQuantity?: boolean;
  readonly rawUserData?: boolean;
  readonly contributionVerified?: boolean;
  readonly wrongPeveMethodology?: boolean;
  readonly rightsInactive?: boolean;
  readonly rightsWrongPurpose?: boolean;
  readonly tamperedEvidence?: boolean;
};

export type HumanEconomyIssuanceSuccess = {
  readonly ok: true;
  readonly proposal: SunReyHumanEconomyIssuanceProposal;
  readonly receipt: SunReyEconomicReceipt;
  readonly transactionId: string;
  readonly blockHeight: number;
  readonly supplyTotal: bigint;
};

export type HumanEconomyIssuanceFailure = {
  readonly ok: false;
  readonly code: HumanEconomyPipelineRejection;
  readonly supplyUnchanged: true;
};

export type HumanEconomyIssuanceResult = HumanEconomyIssuanceSuccess | HumanEconomyIssuanceFailure;

export type HumanEconomyPipelineContext = {
  readonly authority: ProtocolNativeSupplyAuthority;
  readonly claimRegistry: ClaimRegistry;
  readonly consumption: ConsumptionStore;
  readonly challenges?: ClaimChallengeRegistry;
  readonly circuitBreakers?: DomainCircuitBreakerRegistry;
  readonly monitoring?: HumanEconomyMonitoringStore;
  readonly blockHeight?: number;
};

export function executeHumanEconomySunReyIssuance(
  ctx: HumanEconomyPipelineContext,
  input: HumanEconomyIssuanceInput,
): HumanEconomyIssuanceResult {
  if (ctx.monitoring) {
    incrementMetric(ctx.monitoring, 'contributionsSubmitted');
  }
  if (input.rawUserData) {
    if (ctx.monitoring) incrementMetric(ctx.monitoring, 'contributionsRejected');
    return { ok: false, code: 'RAW_USER_DATA', supplyUnchanged: true };
  }
  if (input.contributionVerified === false) {
    if (ctx.monitoring) incrementMetric(ctx.monitoring, 'contributionsRejected');
    return { ok: false, code: 'UNVERIFIED_CONTRIBUTION', supplyUnchanged: true };
  }
  if (ctx.circuitBreakers && isDomainVerificationPaused(ctx.circuitBreakers, input.contributionDomain)) {
    if (ctx.monitoring) incrementMetric(ctx.monitoring, 'sunReyProposalRejections');
    return { ok: false, code: 'DOMAIN_VERIFICATION_PAUSED', supplyUnchanged: true };
  }
  if (ctx.challenges && hasActiveChallenge(ctx.challenges, input.economicClaimId)) {
    if (ctx.monitoring) incrementMetric(ctx.monitoring, 'challengedClaims');
    return { ok: false, code: 'CLAIM_ALREADY_MONETIZED', supplyUnchanged: true };
  }
  const governanceCheck = validateGovernanceAuthorization({
    authorizationId: input.governance.authorizationId,
    authorizedQuantity: input.governance.authorizedQuantity,
    governancePolicyVersion: input.governance.governancePolicyVersion,
    authorizedBy: input.governance.authorizedBy,
  });
  if (!governanceCheck.ok) {
    if (ctx.monitoring) incrementMetric(ctx.monitoring, 'sunReyProposalRejections');
    return { ok: false, code: governanceCheck.code, supplyUnchanged: true };
  }
  let claim = getClaim(ctx.claimRegistry, input.economicClaimId);
  if (!claim) {
    const registered = registerEconomicClaim(ctx.claimRegistry, {
      economicClaimId: input.economicClaimId,
      economicDomain: 'HUMAN_ECONOMY',
      contributionClass: input.canonicalContributionEvent.contributionClass,
      fingerprint: input.claimFingerprint,
      subjectCommitment: input.subjectCommitment,
      registeredAtUtc: input.canonicalContributionEvent.registeredAtUtc,
      lifecycleState: 'VERIFIED',
    });
    if (!registered.ok) {
      if (ctx.monitoring) incrementMetric(ctx.monitoring, 'duplicateDetected');
      return { ok: false, code: registered.code, supplyUnchanged: true };
    }
    claim = registered.claim;
  }
  if (ctx.monitoring) incrementMetric(ctx.monitoring, 'peveCalculations');
  const peve = createPeveValuationRef({
    valuationId: `peve.${input.economicClaimId}`,
    methodologyId: input.peveMethodologyId ?? 'HIN_VALUATION',
    methodologyVersion: input.peveMethodologyVersion ?? 'hin.valuation.v1',
    referenceValue: input.peveReferenceValue.toString(),
    denomination: 'REFERENCE_UNITS',
  });
  const draftProposal = createSunReyHumanEconomyIssuanceProposal({
    proposalId: proposalIdOf(input.economicClaimId, 'draft'),
    economicClaimId: input.economicClaimId,
    canonicalContributionEvent: input.canonicalContributionEvent,
    pseudonymousActor: input.pseudonymousActor,
    verificationReceipt: input.verificationReceipt,
    evidenceProofRef: `evidence:${input.economicClaimId}`,
    rightsProofRef: `rights:${input.economicClaimId}`,
    policyProofRef: `policy:${input.economicClaimId}`,
    peveValuation: peve,
    monetizationKey: 'draft',
    network: input.network,
    governanceAuthorizationId: input.governance.authorizationId,
    usePeveAsQuantity: input.usePeveAsQuantity,
  });
  if (!draftProposal.ok) {
    if (ctx.monitoring) incrementMetric(ctx.monitoring, 'sunReyProposalRejections');
    return { ok: false, code: draftProposal.code, supplyUnchanged: true };
  }
  const quantity = BigInt(draftProposal.proposal.proposedSunReyQuantity);
  const evidence = evidenceCommitment({
    commitmentId: `evc.${input.economicClaimId}`,
    evidenceClass: 'VERIFIED_HUMAN_CONTRIBUTION_EVIDENCE',
    subjectCommitment: input.subjectCommitment,
    provenanceRef: input.verificationReceipt.receiptId,
    verificationPolicyVersion: input.verificationReceipt.verificationPolicyVersion,
    sealedAtUtc: input.canonicalContributionEvent.registeredAtUtc,
  });
  const rights = rightsCommitment({
    commitmentId: `rtc.${input.economicClaimId}`,
    rightsClass: 'CONSENT',
    purpose: input.rightsWrongPurpose
      ? 'WRONG_PURPOSE'
      : 'HUMAN_ECONOMIC_CONTRIBUTION_SETTLEMENT',
    scopeCommitment: input.canonicalContributionEvent.fingerprint,
    holderCommitment: input.pseudonymousActor.actorCommitment,
    validFromUnixSeconds: input.nowUnixSeconds - 3600n,
    expiresAtUnixSeconds: input.nowUnixSeconds + 86_400n,
    active: input.rightsInactive !== true,
  });
  const methodologyVersion = input.wrongPeveMethodology
    ? 'hin.valuation.wrong.v1'
    : (input.peveMethodologyVersion ?? 'hin.valuation.v1');
  const policy = policyCommitment({
    commitmentId: `plc.${input.economicClaimId}`,
    policyPackId: 'human.issuance.policy',
    policyVersion: 'sunrey.human.issuance.v1',
    methodologyVersion,
    active: !input.wrongPeveMethodology,
    activatedAtHeight: 1,
  });
  const roots = computeCommitmentRoots({
    evidenceCommitmentHashes: [evidence.commitmentHash],
    rightsCommitmentHashes: [rights.commitmentHash],
    policyCommitmentHashes: [policy.commitmentHash],
  });
  const bundle = createEconomicProofBundle({
    economicClaimId: input.economicClaimId,
    claimCommitment: claim.claimCommitment,
    economicDomain: 'HUMAN_ECONOMY',
    evidence,
    rights,
    policy,
    roots: {
      evidenceRoot: roots.evidenceRoot,
      rightsRoot: roots.rightsRoot,
      policyRoot: roots.policyRoot,
      blockHeight: ctx.blockHeight ?? 1,
      stateCommitment: 'state.fixture',
    },
    valuation: {
      valuationId: peve.valuationId,
      methodologyId: peve.methodologyId,
      methodologyVersion: peve.methodologyVersion,
      referenceValue: peve.referenceValue,
      denomination: peve.denomination,
    },
    governance: {
      authorizationId: input.governance.authorizationId,
      authorizedQuantity: quantity.toString(),
      governancePolicyVersion: input.governance.governancePolicyVersion,
    },
  });
  const tamperedBundle = input.tamperedEvidence
    ? Object.freeze({ ...bundle, evidenceCommitmentHash: '0'.repeat(64) })
    : bundle;
  const proposalResult = createSunReyHumanEconomyIssuanceProposal({
    proposalId: proposalIdOf(input.economicClaimId, bundle.monetizationKey),
    economicClaimId: input.economicClaimId,
    canonicalContributionEvent: input.canonicalContributionEvent,
    pseudonymousActor: input.pseudonymousActor,
    verificationReceipt: input.verificationReceipt,
    evidenceProofRef: evidence.commitmentHash,
    rightsProofRef: rights.commitmentHash,
    policyProofRef: policy.commitmentHash,
    peveValuation: peve,
    monetizationKey: bundle.monetizationKey,
    network: input.network,
    governanceAuthorizationId: input.governance.authorizationId,
    usePeveAsQuantity: input.usePeveAsQuantity,
  });
  if (!proposalResult.ok) {
    if (ctx.monitoring) incrementMetric(ctx.monitoring, 'sunReyProposalRejections');
    return { ok: false, code: proposalResult.code, supplyUnchanged: true };
  }
  const proposalCheck = validateProposalForIssuance(proposalResult.proposal);
  if (!proposalCheck.ok) {
    if (ctx.monitoring) incrementMetric(ctx.monitoring, 'sunReyProposalRejections');
    return { ok: false, code: proposalCheck.code, supplyUnchanged: true };
  }
  if (ctx.monitoring) incrementMetric(ctx.monitoring, 'sunReyProposals');
  const blockHeight = ctx.blockHeight ?? 1;
  const supplyBefore = expectedTotal(ctx.authority.book('SUNREY_COIN'));
  const issued = executeProofBoundSunReyIssuance(
    ctx.authority,
    ctx.claimRegistry,
    ctx.consumption,
    {
      actor: input.actor,
      network: input.network,
      recipient: input.recipient,
      quantity,
      replayIdentifier: bundle.monetizationKey,
      bundle: tamperedBundle,
      evidence,
      rights,
      policy,
      roots,
      nowUnixSeconds: input.nowUnixSeconds,
      expectedPurpose: 'HUMAN_ECONOMIC_CONTRIBUTION_SETTLEMENT',
      contributionVerified: input.contributionVerified ?? true,
    },
    blockHeight,
  );
  if (!issued.ok) {
    if (ctx.monitoring) incrementMetric(ctx.monitoring, 'sunReyProposalRejections');
    return { ok: false, code: issued.code, supplyUnchanged: true };
  }
  if (expectedTotal(issued.book) <= supplyBefore) {
    return { ok: false, code: 'ZERO_SUPPLY_CHANGE_ON_FAILURE', supplyUnchanged: true };
  }
  const finalProposal: SunReyHumanEconomyIssuanceProposal = Object.freeze({
    ...proposalResult.proposal,
    status: 'ISSUED',
  });
  const receipt = buildSunReyEconomicReceipt({
    baseReceipt: issued.receipt,
    proposal: finalProposal,
    bundle,
    supplyTotal: expectedTotal(issued.book),
  });
  if (ctx.monitoring) incrementMetric(ctx.monitoring, 'contributionsVerified');
  return {
    ok: true,
    proposal: finalProposal,
    receipt,
    transactionId: issued.transactionId,
    blockHeight: issued.blockHeight,
    supplyTotal: expectedTotal(issued.book),
  };
}

export {
  deserializeConsumptionStore,
  loadConsumptionStore,
  persistConsumptionStore,
  replayConsumptionLog,
  serializeConsumptionStore,
};

export type { EvidenceCommitment, PolicyCommitment, RightsCommitment };
