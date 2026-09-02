import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import { providerUniquenessCommitment, rejectsLowEntropyIdentityMaterial } from './commitments.ts';
import type { UniquenessProofId } from './ids.ts';
import { uniquenessProofIdFor } from './ids.ts';
import type { IdentityFailure, RecordUniquenessProofInput, UniquenessProofReceipt } from './types.ts';

export type UniquenessPolicyPort = {
  readonly policyId: string;
  readonly requiredProviderCapability: string;
};

export type UniquenessProofBoundary = {
  /**
   * Establish that an economic actor corresponds to one verified participant
   * under the relevant uniqueness policy without publishing identity documents.
   */
  recordProof(
    input: RecordUniquenessProofInput,
    existingByCommitment: ReadonlyMap<string, UniquenessProofReceipt>,
  ): Result<UniquenessProofReceipt, IdentityFailure>;
  findByCommitment(commitment: string): UniquenessProofReceipt | null;
  findConflictingActor(
    commitment: string,
    humanActorId: string,
    existingByCommitment: ReadonlyMap<string, UniquenessProofReceipt>,
  ): UniquenessProofReceipt | null;
};

export function buildUniquenessProofReceipt(
  input: RecordUniquenessProofInput,
): Result<{ readonly receipt: UniquenessProofReceipt; readonly commitment: string }, IdentityFailure> {
  if (rejectsLowEntropyIdentityMaterial(input.providerSubjectToken)) {
    return err({
      code: 'LOW_ENTROPY_IDENTITY_MATERIAL',
      message: 'provider subject token must be an opaque provider token, not raw identity material',
    });
  }
  const commitment = providerUniquenessCommitment({
    providerRef: input.providerRef,
    providerSubjectToken: input.providerSubjectToken,
    jurisdiction: input.jurisdiction,
    saltRef: input.saltRef,
  });
  const proofId = uniquenessProofIdFor(`${input.humanActorId}:${commitment}`);
  const receipt: UniquenessProofReceipt = Object.freeze({
    proofId,
    humanActorId: input.humanActorId,
    policyId: input.policyId,
    providerRef: input.providerRef,
    providerUniquenessCommitment: commitment,
    evidenceCommitment: input.evidenceCommitment,
    jurisdiction: input.jurisdiction,
    establishedAt: input.establishedAt,
    expiresAt: input.expiresAt ?? null,
    rawIdentityDocumentsPublished: false,
  });
  return ok({ receipt, commitment });
}

export function uniquenessProofIsFresh(receipt: UniquenessProofReceipt, now: UtcInstant): boolean {
  if (receipt.expiresAt === null) {
    return true;
  }
  return Date.parse(now) < Date.parse(receipt.expiresAt);
}

export function createUniquenessProofBoundary(
  store: {
    readonly proofs: Map<UniquenessProofId, UniquenessProofReceipt>;
    readonly commitmentIndex: Map<string, UniquenessProofId>;
  },
): UniquenessProofBoundary {
  return {
    recordProof(input, existingByCommitment) {
      const built = buildUniquenessProofReceipt(input);
      if (!built.ok) {
        return built;
      }
      const conflict = existingByCommitment.get(built.value.commitment);
      if (conflict && conflict.humanActorId !== input.humanActorId) {
        return err({
          code: 'UNIQUENESS_CONFLICT',
          message: 'provider uniqueness commitment already bound to a different human economic identity',
        });
      }
      store.proofs.set(built.value.receipt.proofId, built.value.receipt);
      store.commitmentIndex.set(built.value.commitment, built.value.receipt.proofId);
      return ok(built.value.receipt);
    },
    findByCommitment(commitment) {
      const proofId = store.commitmentIndex.get(commitment);
      if (!proofId) {
        return null;
      }
      return store.proofs.get(proofId) ?? null;
    },
    findConflictingActor(commitment, humanActorId, existingByCommitment) {
      const existing = existingByCommitment.get(commitment);
      if (!existing || existing.humanActorId === humanActorId) {
        return null;
      }
      return existing;
    },
  };
}
