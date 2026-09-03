// @ts-nocheck
/**
 * Wave 3 — Proof-bound monetary issuance pipeline.
 *
 * Extends the canonical Chunk 71 pathway. Proof objects do not mint;
 * only validated MonetaryIssuanceAuthority mutates AssetSupplyBook.
 *
 * Information authorization ≠ monetary authorization.
 */

import { createHash } from 'node:crypto';

import type { ProtocolNativeSupplyAuthority } from '../../native-assets/economic-controls.ts';
import {
  runMoonReyIssuancePipeline,
  runSunReyIssuancePipeline,
  type PipelineResult,
} from '../../native-assets/issuance-pipelines.ts';
import { expectedTotal } from '../supply.ts';
import type { AssetSupplyBook } from '../supply.ts';
import type { ClaimRegistry } from './claims.ts';
import { getClaim, isClaimMonetized, markClaimMonetized } from './claims.ts';
import type { ConsumptionStore } from './consumption.ts';
import { attemptConsume, isMonetizationKeyConsumed } from './consumption.ts';
import { buildMonetaryIssuanceReceipt } from './receipt.ts';
import type { CommitmentRootSet } from './roots.ts';
import { monetaryStateCommitment } from './roots.ts';
import type {
  EconomicProofBundle,
  EvidenceCommitment,
  MonetaryIssuanceReceipt,
  PolicyCommitment,
  ProofBoundRejection,
  RightsCommitment,
} from './types.ts';
import { verifyAssetDomainMatch, verifyProofBundle } from './verification.ts';

export type ProofBoundIssuanceInput = {
  readonly actor: 'PROTOCOL' | 'HUMAN_GOVERNANCE';
  readonly network: 'DEVELOPMENT' | 'TESTNET' | 'MAINNET';
  readonly recipient: string;
  readonly quantity: bigint;
  readonly replayIdentifier: string;
  readonly bundle: EconomicProofBundle;
  readonly evidence: EvidenceCommitment;
  readonly rights: RightsCommitment;
  readonly policy: PolicyCommitment;
  readonly roots: CommitmentRootSet;
  readonly nowUnixSeconds: bigint;
  readonly expectedPurpose?: string;
  readonly contributionVerified?: boolean;
  readonly contributionId?: string;
  readonly fingerprint?: string;
  readonly authorizationId?: string;
  readonly category?: string;
};

export type ProofBoundIssuanceSuccess = {
  readonly ok: true;
  readonly pipeline: PipelineResult & { readonly ok: true };
  readonly book: AssetSupplyBook;
  readonly receipt: MonetaryIssuanceReceipt;
  readonly transactionId: string;
  readonly blockHeight: number;
};

export type ProofBoundIssuanceFailure = {
  readonly ok: false;
  readonly code: ProofBoundRejection | import('../../native-assets/issuance-pipelines.ts').PipelineRefusal;
  readonly supplyUnchanged: true;
};

export type ProofBoundIssuanceResult = ProofBoundIssuanceSuccess | ProofBoundIssuanceFailure;

function transactionIdOf(bundle: EconomicProofBundle, assetId: string): string {
  return createHash('sha256')
    .update(`tx:${assetId}:${bundle.monetizationKey}:${bundle.bundleId}`)
    .digest('hex');
}

export function executeProofBoundSunReyIssuance(
  authority: ProtocolNativeSupplyAuthority,
  registry: ClaimRegistry,
  consumption: ConsumptionStore,
  input: ProofBoundIssuanceInput,
  blockHeight = 1,
): ProofBoundIssuanceResult {
  const supplyBefore = expectedTotal(authority.book('SUNREY_COIN'));
  const claim = getClaim(registry, input.bundle.economicClaimId);
  if (!claim) {
    return { ok: false, code: 'CLAIM_NOT_FOUND', supplyUnchanged: true };
  }
  if (isClaimMonetized(registry, input.bundle.economicClaimId)) {
    return { ok: false, code: 'CLAIM_ALREADY_MONETIZED', supplyUnchanged: true };
  }
  if (isMonetizationKeyConsumed(consumption, input.bundle.monetizationKey)) {
    return { ok: false, code: 'DUPLICATE_MONETIZATION_KEY', supplyUnchanged: true };
  }
  const domainCheck = verifyAssetDomainMatch(input.bundle, 'SUNREY_COIN');
  if (!domainCheck.ok) {
    return { ok: false, code: domainCheck.code, supplyUnchanged: true };
  }
  const proofCheck = verifyProofBundle(input.bundle, {
    roots: input.roots,
    evidence: input.evidence,
    rights: input.rights,
    policy: input.policy,
    claim,
    nowUnixSeconds: input.nowUnixSeconds,
    expectedPurpose: input.expectedPurpose,
  });
  if (!proofCheck.ok) {
    return { ok: false, code: proofCheck.code, supplyUnchanged: true };
  }
  const pipeline = runSunReyIssuancePipeline(authority, {
    actor: input.actor,
    network: input.network,
    recipient: input.recipient,
    quantity: input.quantity,
    replayIdentifier: input.replayIdentifier,
    contributionVerified: input.contributionVerified ?? true,
    valuationMethodology: input.bundle.valuation.methodologyId,
  });
  if (!pipeline.ok) {
    return { ok: false, code: pipeline.code, supplyUnchanged: true };
  }
  if (expectedTotal(pipeline.book) <= supplyBefore) {
    return { ok: false, code: 'ZERO_SUPPLY_CHANGE_ON_FAILURE', supplyUnchanged: true };
  }
  const txId = transactionIdOf(input.bundle, 'SUNREY_COIN');
  const stateCommitment = monetaryStateCommitment({
    assetId: 'SUNREY_COIN',
    supplyTotal: expectedTotal(pipeline.book).toString(),
    blockHeight,
    transactionId: txId,
  });
  const consumed = attemptConsume(consumption, {
    monetizationKey: input.bundle.monetizationKey,
    economicClaimId: input.bundle.economicClaimId,
    bundleId: input.bundle.bundleId,
    assetId: 'SUNREY_COIN',
    quantity: input.quantity.toString(),
    transactionId: txId,
    blockHeight,
    stateCommitment,
    consumedAtUtc: new Date(Number(input.nowUnixSeconds) * 1000).toISOString(),
  });
  if (!consumed.ok) {
    return { ok: false, code: consumed.code, supplyUnchanged: true };
  }
  markClaimMonetized(registry, input.bundle.economicClaimId);
  const receipt = buildMonetaryIssuanceReceipt({
    transactionId: txId,
    assetId: 'SUNREY_COIN',
    quantity: input.quantity,
    bundle: input.bundle,
    finalizedBlockHeight: blockHeight,
    supplyTotal: expectedTotal(pipeline.book),
  });
  return {
    ok: true,
    pipeline,
    book: pipeline.book,
    receipt,
    transactionId: txId,
    blockHeight,
  };
}

export function executeProofBoundMoonReyIssuance(
  authority: ProtocolNativeSupplyAuthority,
  registry: ClaimRegistry,
  consumption: ConsumptionStore,
  input: ProofBoundIssuanceInput & {
    readonly contributionId: string;
    readonly fingerprint: string;
    readonly authorizationId: string;
    readonly category: string;
  },
  blockHeight = 1,
): ProofBoundIssuanceResult {
  const supplyBefore = expectedTotal(authority.book('MOONREY_COIN'));
  const claim = getClaim(registry, input.bundle.economicClaimId);
  if (!claim) {
    return { ok: false, code: 'CLAIM_NOT_FOUND', supplyUnchanged: true };
  }
  if (isClaimMonetized(registry, input.bundle.economicClaimId)) {
    return { ok: false, code: 'CLAIM_ALREADY_MONETIZED', supplyUnchanged: true };
  }
  if (isMonetizationKeyConsumed(consumption, input.bundle.monetizationKey)) {
    return { ok: false, code: 'DUPLICATE_MONETIZATION_KEY', supplyUnchanged: true };
  }
  const domainCheck = verifyAssetDomainMatch(input.bundle, 'MOONREY_COIN');
  if (!domainCheck.ok) {
    return { ok: false, code: domainCheck.code, supplyUnchanged: true };
  }
  const proofCheck = verifyProofBundle(input.bundle, {
    roots: input.roots,
    evidence: input.evidence,
    rights: input.rights,
    policy: input.policy,
    claim,
    nowUnixSeconds: input.nowUnixSeconds,
    expectedPurpose: input.expectedPurpose,
  });
  if (!proofCheck.ok) {
    return { ok: false, code: proofCheck.code, supplyUnchanged: true };
  }
  const pipeline = runMoonReyIssuancePipeline(authority, {
    actor: input.actor,
    network: input.network,
    recipient: input.recipient,
    quantity: input.quantity,
    replayIdentifier: input.replayIdentifier,
    contributionId: input.contributionId,
    fingerprint: input.fingerprint,
    authorizationId: input.authorizationId,
    category: input.category as import('../../native-assets/issuance-pipelines.ts').ProductiveCategoryId,
    sourceConnected: true,
  });
  if (!pipeline.ok) {
    return { ok: false, code: pipeline.code, supplyUnchanged: true };
  }
  if (expectedTotal(pipeline.book) <= supplyBefore) {
    return { ok: false, code: 'ZERO_SUPPLY_CHANGE_ON_FAILURE', supplyUnchanged: true };
  }
  const txId = transactionIdOf(input.bundle, 'MOONREY_COIN');
  const stateCommitment = monetaryStateCommitment({
    assetId: 'MOONREY_COIN',
    supplyTotal: expectedTotal(pipeline.book).toString(),
    blockHeight,
    transactionId: txId,
  });
  const consumed = attemptConsume(consumption, {
    monetizationKey: input.bundle.monetizationKey,
    economicClaimId: input.bundle.economicClaimId,
    bundleId: input.bundle.bundleId,
    assetId: 'MOONREY_COIN',
    quantity: input.quantity.toString(),
    transactionId: txId,
    blockHeight,
    stateCommitment,
    consumedAtUtc: new Date(Number(input.nowUnixSeconds) * 1000).toISOString(),
  });
  if (!consumed.ok) {
    return { ok: false, code: consumed.code, supplyUnchanged: true };
  }
  markClaimMonetized(registry, input.bundle.economicClaimId);
  const receipt = buildMonetaryIssuanceReceipt({
    transactionId: txId,
    assetId: 'MOONREY_COIN',
    quantity: input.quantity,
    bundle: input.bundle,
    finalizedBlockHeight: blockHeight,
    supplyTotal: expectedTotal(pipeline.book),
  });
  return {
    ok: true,
    pipeline,
    book: pipeline.book,
    receipt,
    transactionId: txId,
    blockHeight,
  };
}

/**
 * Ordinary transfers do not require economic-origin proofs.
 * Already-issued assets need only normal transaction/account authorization.
 */
export function transferRequiresEconomicProof(): false {
  return false;
}

/**
 * Burn semantics per existing architecture:
 * - VOLUNTARY_USER_BURN: ordinary owner authorization only
 * - FEE_BURN: protocol fee market path
 * - PROTOCOL_ECONOMIC_PENALTY: governance/policy authorization
 * Burn proofs are distinct from issuance proofs (receiptKind: MONETARY_BURN).
 */
export function burnRequiresGovernance(burnClass: string): boolean {
  return burnClass === 'PROTOCOL_ECONOMIC_PENALTY';
}
