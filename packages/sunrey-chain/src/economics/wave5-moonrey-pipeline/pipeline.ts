/**
 * Wave 5 — MoonRey monetary pipeline orchestration.
 *
 * Productive Sources → Oracle Mesh → Information Consensus →
 * Canonical Productive Event → Economic Claim → Evidence/Rights/Policy →
 * Productive Economic Contribution → GPUV → Monetary Policy →
 * MoonRey Issuance Proposal → Governance → Protocol ISSUE →
 * Validator Consensus → Finalized MoonRey State
 *
 * No earlier stage may directly mint. Extends Wave 3 proof-bound pipeline.
 */

import { createHash } from 'node:crypto';

import { ProtocolNativeSupplyAuthority } from '../../native-assets/economic-controls.ts';
import type { ProductiveCategoryId } from '../../native-assets/issuance-pipelines.ts';
import { expectedTotal } from '../supply.ts';
import { createEconomicProofBundle } from '../proof-bound/bundle.ts';
import type { ClaimRegistry } from '../proof-bound/claims.ts';
import {
  emptyClaimRegistry,
  getClaim,
  isClaimMonetized,
  registerEconomicClaim,
} from '../proof-bound/claims.ts';
import type { ConsumptionStore } from '../proof-bound/consumption.ts';
import { emptyConsumptionStore } from '../proof-bound/consumption.ts';
import {
  evidenceCommitment,
  policyCommitment,
  rightsCommitment,
} from '../proof-bound/commitments.ts';
import { executeProofBoundMoonReyIssuance } from '../proof-bound/pipeline.ts';
import { computeCommitmentRoots } from '../proof-bound/roots.ts';
import type { CommitmentRootSet } from '../proof-bound/roots.ts';
import type { ProductiveValueResult } from '../../productive/policy-governance/value-settlement/types.ts';
import type { VerifiedProductiveContribution } from '../../productive/verification.ts';
import { buildInformationConsensusReceipt, validateInformationConsensusReceipt } from './information-consensus.ts';
import { evaluateMonetaryPolicy } from './monetary-policy.ts';
import { validateGovernanceActor } from './governance.ts';
import { buildMoonReyIssuanceProposal, validateMoonReyIssuanceProposal } from './proposal.ts';
import { buildMoonReyEconomicReceipt } from './receipt.ts';
import type { DevProductiveScenario } from './fixtures.ts';
import { gpuvDigestOf } from './fixtures.ts';
import type {
  InformationConsensusReceipt,
  MoonReyEconomicReceipt,
  MoonReyIssuanceProposalInput,
  MoonReyPipelineRejection,
} from './types.ts';

export const NO_STAGE_BEFORE_AUTHORITY_MAY_MINT = true as const;
export const OBSERVATION_TO_PROPOSAL_SHORTCUT_FORBIDDEN = true as const;

export type Wave5MoonReyPipelineInput = {
  readonly actor: 'PROTOCOL' | 'HUMAN_GOVERNANCE';
  readonly network: 'DEVELOPMENT' | 'TESTNET' | 'MAINNET';
  readonly recipient: string;
  readonly contribution: VerifiedProductiveContribution;
  readonly eventId: string;
  readonly eventFingerprint: string;
  readonly gpuvResult: ProductiveValueResult;
  readonly informationConsensus: InformationConsensusReceipt;
  readonly governanceAuthorizationId: string;
  readonly nowUnixSeconds: bigint;
  readonly blockHeight?: number;
  readonly exchangePriceMinorUnits?: bigint;
  readonly aiApproved?: boolean;
  readonly forbiddenActor?: string;
};

export type Wave5MoonReyPipelineSuccess = {
  readonly ok: true;
  readonly proposal: MoonReyIssuanceProposalInput;
  readonly economicReceipt: MoonReyEconomicReceipt;
  readonly moonReyQuantity: bigint;
  readonly supplyBefore: bigint;
  readonly supplyAfter: bigint;
  readonly transactionId: string;
  readonly blockHeight: number;
};

export type Wave5MoonReyPipelineFailure = {
  readonly ok: false;
  readonly code: MoonReyPipelineRejection;
  readonly supplyUnchanged: true;
  readonly claimUnconsumed: true;
};

export type Wave5MoonReyPipelineResult = Wave5MoonReyPipelineSuccess | Wave5MoonReyPipelineFailure;

function mapCategory(category: string): ProductiveCategoryId {
  const map: Record<string, ProductiveCategoryId> = {
    ENERGY: 'ENERGY',
    COMPUTE: 'COMPUTE',
    MANUFACTURING: 'MANUFACTURING_OUTPUT',
    MANUFACTURING_OUTPUT: 'MANUFACTURING_OUTPUT',
    RESOURCES: 'RESOURCES',
    AGRICULTURE: 'AGRICULTURE',
    LOGISTICS: 'LOGISTICS',
    LOGISTICS_TRANSPORTATION: 'LOGISTICS',
    REAL_ESTATE_PRODUCTIVE_INFRASTRUCTURE: 'REAL_ESTATE_PRODUCTIVE_INFRASTRUCTURE',
  };
  return map[category] ?? 'OTHER_APPROVED_PRODUCTIVE_VALUE';
}

function buildProofFixtures(
  contribution: VerifiedProductiveContribution,
  gpuvResult: ProductiveValueResult,
  nowUnixSeconds: bigint,
): {
  readonly evidence: ReturnType<typeof evidenceCommitment>;
  readonly rights: ReturnType<typeof rightsCommitment>;
  readonly policy: ReturnType<typeof policyCommitment>;
  readonly roots: CommitmentRootSet;
} {
  const evidence = evidenceCommitment({
    commitmentId: `evc.${contribution.contributionId}`,
    evidenceClass: 'VERIFIED_PRODUCTIVE_EVIDENCE',
    subjectCommitment: contribution.objectId,
    provenanceRef: contribution.oracleFactIds.join(','),
    verificationPolicyVersion: 'productive.verify.v1',
    sealedAtUtc: new Date(Number(nowUnixSeconds) * 1000).toISOString(),
  });
  const rights = rightsCommitment({
    commitmentId: `rtc.${contribution.contributionId}`,
    rightsClass: 'SOURCE_RIGHTS',
    purpose: 'PRODUCTIVE_ECONOMIC_CONTRIBUTION_SETTLEMENT',
    scopeCommitment: contribution.rightsReferences.join(',') || 'license.fixture',
    holderCommitment: contribution.controller,
    validFromUnixSeconds: contribution.measurementPeriod.validFromUnixSeconds,
    expiresAtUnixSeconds: contribution.measurementPeriod.validUntilUnixSeconds,
    active: true,
  });
  const policy = policyCommitment({
    commitmentId: `plc.${contribution.contributionId}`,
    policyPackId: 'moonrey.issuance.policy',
    policyVersion: 'moonrey.issuance.v1',
    methodologyVersion: `gpuv.${gpuvResult.valueFunctionPolicyVersion}`,
    active: true,
    activatedAtHeight: 1,
  });
  const roots = computeCommitmentRoots({
    evidenceCommitmentHashes: [evidence.commitmentHash],
    rightsCommitmentHashes: [rights.commitmentHash],
    policyCommitmentHashes: [policy.commitmentHash],
  });
  return { evidence, rights, policy, roots };
}

export function executeWave5MoonReyPipeline(
  authority: ProtocolNativeSupplyAuthority,
  registry: ClaimRegistry,
  consumption: ConsumptionStore,
  input: Wave5MoonReyPipelineInput,
): Wave5MoonReyPipelineResult {
  const blockHeight = input.blockHeight ?? 1;
  const supplyBefore = expectedTotal(authority.book('MOONREY_COIN'));
  const fail = (code: MoonReyPipelineRejection): Wave5MoonReyPipelineFailure =>
    Object.freeze({ ok: false, code, supplyUnchanged: true, claimUnconsumed: true });

  if (input.forbiddenActor) {
    const govErr = validateGovernanceActor({
      actor: input.forbiddenActor,
      authorizationId: input.governanceAuthorizationId,
      aiApproved: input.aiApproved,
      network: input.network,
    });
    if (govErr) return fail(govErr);
  }

  const govErr = validateGovernanceActor({
    actor: input.actor,
    authorizationId: input.governanceAuthorizationId,
    aiApproved: input.aiApproved,
    network: input.network,
  });
  if (govErr) return fail(govErr);

  const consensusErr = validateInformationConsensusReceipt(input.informationConsensus);
  if (consensusErr) return fail(consensusErr);

  if (input.gpuvResult.state !== 'VALUED_SIMULATION') {
    return fail('GPUV_INVALID');
  }
  if (input.gpuvResult.canMint || input.gpuvResult.productionActivated) {
    return fail('GPUV_INVALID');
  }

  const monetary = evaluateMonetaryPolicy({
    gpuvQuantity: input.gpuvResult.productiveValueQuantity,
    exchangePriceMinorUnits: input.exchangePriceMinorUnits,
    network: input.network,
  });
  if (!monetary.ok) return fail(monetary.code);

  const economicClaimId = input.contribution.claimId;
  let claim = getClaim(registry, economicClaimId);
  if (!claim) {
    const registered = registerEconomicClaim(registry, {
      economicClaimId,
      economicDomain: 'PRODUCTIVE_ECONOMY',
      contributionClass: 'VERIFIED_PRODUCTIVE_CONTRIBUTION',
      fingerprint: input.contribution.fingerprint,
      subjectCommitment: input.contribution.objectId,
      registeredAtUtc: new Date(Number(input.nowUnixSeconds) * 1000).toISOString(),
      lifecycleState: 'VERIFIED',
    });
    if (!registered.ok) {
      if (registered.code === 'CLAIM_FINGERPRINT_DUPLICATE') return fail('DUPLICATE_CLAIM');
      return fail('CLAIM_INVALID');
    }
    claim = getClaim(registry, economicClaimId)!;
  }
  if (isClaimMonetized(registry, economicClaimId)) {
    return fail('CLAIM_ALREADY_CONSUMED');
  }

  const { evidence, rights, policy, roots } = buildProofFixtures(
    input.contribution,
    input.gpuvResult,
    input.nowUnixSeconds,
  );
  const gpuvDigest = gpuvDigestOf(input.gpuvResult);
  const bundle = createEconomicProofBundle({
    economicClaimId,
    claimCommitment: claim.claimCommitment,
    economicDomain: 'PRODUCTIVE_ECONOMY',
    evidence,
    rights,
    policy,
    roots: {
      evidenceRoot: roots.evidenceRoot,
      rightsRoot: roots.rightsRoot,
      policyRoot: roots.policyRoot,
      blockHeight,
      stateCommitment: `state.${blockHeight}`,
    },
    valuation: {
      valuationId: input.gpuvResult.productiveValueId,
      methodologyId: 'GPUV_VALUATION',
      methodologyVersion: `gpuv.${input.gpuvResult.valueFunctionPolicyVersion}`,
      referenceValue: input.gpuvResult.productiveValueQuantity.toString(),
      denomination: 'GPUV_NOT_MOONREY',
    },
    governance: {
      authorizationId: input.governanceAuthorizationId,
      authorizedQuantity: monetary.evaluation.derivedMoonReyQuantity.toString(),
      governancePolicyVersion: 'moonrey.governance.v1',
    },
  });

  const proposal = buildMoonReyIssuanceProposal({
    productiveClaimId: economicClaimId,
    claimCommitment: claim.claimCommitment,
    productiveContributionId: input.contribution.contributionId,
    informationConsensus: input.informationConsensus,
    bundle,
    gpuvValuationId: input.gpuvResult.productiveValueId,
    gpuvQuantity: input.gpuvResult.productiveValueQuantity,
    gpuvDigest,
    monetaryPolicy: monetary.evaluation,
    governanceAuthorizationId: input.governanceAuthorizationId,
    productiveCategory: input.contribution.category,
    productiveAssetId: input.contribution.objectId,
    network: input.network,
  });

  const proposalErr = validateMoonReyIssuanceProposal(proposal, bundle);
  if (proposalErr) return fail(proposalErr);

  const issuance = executeProofBoundMoonReyIssuance(
    authority,
    registry,
    consumption,
    {
      actor: input.actor,
      network: input.network,
      recipient: input.recipient,
      quantity: monetary.evaluation.derivedMoonReyQuantity,
      replayIdentifier: bundle.monetizationKey,
      bundle,
      evidence,
      rights,
      policy,
      roots,
      nowUnixSeconds: input.nowUnixSeconds,
      expectedPurpose: 'PRODUCTIVE_ECONOMIC_CONTRIBUTION_SETTLEMENT',
      contributionId: input.contribution.contributionId,
      fingerprint: input.contribution.fingerprint,
      authorizationId: input.governanceAuthorizationId,
      category: mapCategory(input.contribution.category),
    },
    blockHeight,
  );

  if (!issuance.ok) {
    return fail(issuance.code);
  }

  const supplyAfter = expectedTotal(issuance.book);
  if (supplyAfter <= supplyBefore) {
    return fail('ZERO_SUPPLY_CHANGE_ON_FAILURE');
  }

  const economicReceipt = buildMoonReyEconomicReceipt({
    proposal,
    informationConsensus: input.informationConsensus,
    bundle,
    issuanceReceipt: issuance.receipt,
    finalizedBlockHeight: blockHeight,
    supplyTotal: supplyAfter,
  });

  return Object.freeze({
    ok: true,
    proposal,
    economicReceipt,
    moonReyQuantity: monetary.evaluation.derivedMoonReyQuantity,
    supplyBefore,
    supplyAfter,
    transactionId: issuance.transactionId,
    blockHeight,
  });
}

export function executeDevScenario(
  scenario: DevProductiveScenario,
  options?: {
    readonly recipient?: string;
    readonly governanceAuthorizationId?: string;
    readonly nowUnixSeconds?: bigint;
    readonly blockHeight?: number;
  },
): Wave5MoonReyPipelineResult {
  const authority = new ProtocolNativeSupplyAuthority();
  const registry = emptyClaimRegistry();
  const consumption = emptyConsumptionStore();
  return executeWave5MoonReyPipeline(authority, registry, consumption, {
    actor: 'PROTOCOL',
    network: 'DEVELOPMENT',
    recipient: options?.recipient ?? `acct.${scenario.suffix}`,
    contribution: scenario.contribution,
    eventId: scenario.event.eventId,
    eventFingerprint: scenario.event.eventFingerprint,
    gpuvResult: scenario.gpuvResult,
    informationConsensus: scenario.informationConsensus,
    governanceAuthorizationId: options?.governanceAuthorizationId ?? `gov.${scenario.suffix}.wave5`,
    nowUnixSeconds: options?.nowUnixSeconds ?? 1_700_000_000n,
    blockHeight: options?.blockHeight ?? 1,
  });
}

/**
 * @deprecated Simulation-only guard. Observations cannot propose issuance directly.
 * Use executeWave5MoonReyPipeline with full claim/proof/value separation.
 */
export function rejectObservationToProposalShortcut(input: {
  readonly observationIds: readonly string[];
  readonly gpuvQuantity: bigint;
}): { readonly ok: false; readonly code: 'OBSERVATION_CANNOT_PROPOSE_ISSUANCE'; readonly minted: false } {
  void input;
  return { ok: false, code: 'OBSERVATION_CANNOT_PROPOSE_ISSUANCE', minted: false };
}

export function pipelineStageDigest(stage: string, inputId: string): string {
  return createHash('sha256').update(`wave5-stage:${stage}:${inputId}`).digest('hex');
}
