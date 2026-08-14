import { err, ok, type Result, type UtcInstant } from '@solstice/domain';
import {
  assertKernelAuthorization,
  canonicalJson,
  sha256Hex,
  type KernelAuthorization,
  type SealedEvidence,
} from '@solstice/kernel';
import {
  ChainReference,
  type SimulatedChain,
  type SimulatedTx,
} from '@solstice/chain-gateway';

export type ContributionId = string;

export type ProofCompletionState = 'COMPLETED' | 'HALTED' | 'DECLINED';

/**
 * Sealed Proof of Contribution.
 * Contains no raw data and no reconstructible individual detail.
 * Buyer is a verified sponsor id, not a contributor identity.
 */
export type ProofOfContribution = {
  readonly contributionId: ContributionId;
  readonly consentReference: string;
  readonly buyer: string;
  readonly purpose: string;
  readonly dataCategories: readonly string[];
  readonly computeJobReference: string;
  readonly completionState: ProofCompletionState;
  readonly compensationMinorUnits: bigint;
  readonly compensationAsset: 'PYR';
  readonly pyrSettlementReference: string;
  readonly cryptographicHash: string;
  readonly evidenceId: string;
  readonly chainTxId: string;
};

export type ProofVerifyResult = {
  readonly ok: true;
  readonly hashMatches: true;
  readonly chainIsHashOnly: true;
  readonly evidenceSealed: true;
};

export type ProofVerifyFailure =
  | { readonly ok: false; readonly reason: 'HASH_MISMATCH' }
  | { readonly ok: false; readonly reason: 'CHAIN_NOT_HASH' }
  | { readonly ok: false; readonly reason: 'EVIDENCE_MISSING' }
  | { readonly ok: false; readonly reason: 'RAW_FIELD_PRESENT' };

const RAW_KEYS = [
  'raw',
  'rawData',
  'record',
  'personalData',
  'wellnessReading',
  'profile',
  'customerName',
  'body',
] as const;

export function proofCanonicalFields(input: Omit<ProofOfContribution, 'cryptographicHash' | 'evidenceId' | 'chainTxId'>): string {
  return canonicalJson({
    contributionId: input.contributionId,
    consentReference: input.consentReference,
    buyer: input.buyer,
    purpose: input.purpose,
    dataCategories: input.dataCategories,
    computeJobReference: input.computeJobReference,
    completionState: input.completionState,
    compensationMinorUnits: input.compensationMinorUnits.toString(),
    compensationAsset: 'PYR',
    pyrSettlementReference: input.pyrSettlementReference,
  });
}

export function hashProofFields(
  input: Omit<ProofOfContribution, 'cryptographicHash' | 'evidenceId' | 'chainTxId'>,
): string {
  return sha256Hex(proofCanonicalFields(input));
}

export class ProofOfContributionRegistry {
  readonly #proofs = new Map<string, ProofOfContribution>();

  /** @kernelGated */
  issue(
    authorization: KernelAuthorization,
    input: {
      readonly contributionId: ContributionId;
      readonly consentReference: string;
      readonly buyer: string;
      readonly purpose: string;
      readonly dataCategories: readonly string[];
      readonly computeJobReference: string;
      readonly completionState: ProofCompletionState;
      readonly compensationMinorUnits: bigint;
      readonly pyrSettlementReference: string;
      readonly at: UtcInstant;
      readonly seal: (payload: { readonly kind: string; readonly [k: string]: unknown }, at: UtcInstant) => SealedEvidence;
      readonly chain: SimulatedChain;
    },
  ): ProofOfContribution {
    assertKernelAuthorization(authorization, 'ISSUE_PROOF_OF_CONTRIBUTION');
    if (typeof input.compensationMinorUnits !== 'bigint') {
      throw new TypeError('compensation must be bigint minor units');
    }
    const cryptographicHash = hashProofFields(input);
    const evidence = input.seal(
      {
        kind: 'proof.of_contribution',
        contributionId: input.contributionId,
        consentReference: input.consentReference,
        buyer: input.buyer,
        purpose: input.purpose,
        dataCategories: input.dataCategories,
        computeJobReference: input.computeJobReference,
        completionState: input.completionState,
        compensationMinorUnits: input.compensationMinorUnits.toString(),
        pyrSettlementReference: input.pyrSettlementReference,
        cryptographicHash,
      },
      input.at,
    );
    const submitted = input.chain.submit(ChainReference.hash(cryptographicHash));
    const confirmed = input.chain.confirm(submitted.txId);
    const proof: ProofOfContribution = Object.freeze({
      contributionId: input.contributionId,
      consentReference: input.consentReference,
      buyer: input.buyer,
      purpose: input.purpose,
      dataCategories: Object.freeze(input.dataCategories.slice()),
      computeJobReference: input.computeJobReference,
      completionState: input.completionState,
      compensationMinorUnits: input.compensationMinorUnits,
      compensationAsset: 'PYR',
      pyrSettlementReference: input.pyrSettlementReference,
      cryptographicHash,
      evidenceId: evidence.id,
      chainTxId: confirmed.txId,
    });
    this.#proofs.set(proof.contributionId, proof);
    return proof;
  }

  get(id: ContributionId): ProofOfContribution | undefined {
    return this.#proofs.get(id);
  }

  /**
   * Independent verification: recompute the hash from public fields,
   * confirm the chain reference is a hash only, and confirm the
   * evidence vault sealed the proof. Does not access underlying data.
   */
  verify(
    proof: ProofOfContribution,
    chain: SimulatedChain,
    evidenceIds: ReadonlySet<string>,
  ): Result<ProofVerifyResult, ProofVerifyFailure> {
    for (const key of RAW_KEYS) {
      if (key in proof) {
        return err({ ok: false, reason: 'RAW_FIELD_PRESENT' });
      }
    }
    const expected = hashProofFields(proof);
    if (expected !== proof.cryptographicHash) {
      return err({ ok: false, reason: 'HASH_MISMATCH' });
    }
    const tx = chain.query(proof.chainTxId);
    if (!tx || tx.reference.kind !== 'HASH' || tx.reference.value !== proof.cryptographicHash) {
      return err({ ok: false, reason: 'CHAIN_NOT_HASH' });
    }
    if (!evidenceIds.has(proof.evidenceId)) {
      return err({ ok: false, reason: 'EVIDENCE_MISSING' });
    }
    return ok({
      ok: true,
      hashMatches: true,
      chainIsHashOnly: true,
      evidenceSealed: true,
    });
  }
}

export type { SimulatedTx };
