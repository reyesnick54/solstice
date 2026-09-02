import type { HumanEconomicIdentityId, IdentityLinkId, IdentityRecoveryId, IdentityRevocationId, UniquenessProofId } from './ids.ts';
import type {
  HumanEconomicIdentity,
  IdentityControllerLink,
  IdentityRecoverySession,
  IdentityRevocationRecord,
  SybilControlSignal,
  UniquenessProofReceipt,
} from './types.ts';

export type HumanEconomicIdentitySnapshot = {
  readonly identities: readonly HumanEconomicIdentity[];
  readonly links: readonly IdentityControllerLink[];
  readonly uniquenessProofs: readonly UniquenessProofReceipt[];
  readonly recoveries: readonly IdentityRecoverySession[];
  readonly revocations: readonly IdentityRevocationRecord[];
  readonly sybilSignals: readonly SybilControlSignal[];
};

export class HumanEconomicIdentityStore {
  readonly identities = new Map<HumanEconomicIdentityId, HumanEconomicIdentity>();
  readonly links = new Map<IdentityLinkId, IdentityControllerLink>();
  readonly uniquenessProofs = new Map<UniquenessProofId, UniquenessProofReceipt>();
  readonly uniquenessCommitmentIndex = new Map<string, UniquenessProofId>();
  readonly recoveries = new Map<IdentityRecoveryId, IdentityRecoverySession>();
  readonly revocations = new Map<IdentityRevocationId, IdentityRevocationRecord>();
  readonly sybilSignals: SybilControlSignal[] = [];

  snapshot(): HumanEconomicIdentitySnapshot {
    return Object.freeze({
      identities: Object.freeze([...this.identities.values()]),
      links: Object.freeze([...this.links.values()]),
      uniquenessProofs: Object.freeze([...this.uniquenessProofs.values()]),
      recoveries: Object.freeze([...this.recoveries.values()]),
      revocations: Object.freeze([...this.revocations.values()]),
      sybilSignals: Object.freeze([...this.sybilSignals]),
    });
  }

  hydrate(snapshot: HumanEconomicIdentitySnapshot): void {
    this.identities.clear();
    this.links.clear();
    this.uniquenessProofs.clear();
    this.uniquenessCommitmentIndex.clear();
    this.recoveries.clear();
    this.revocations.clear();
    this.sybilSignals.length = 0;
    for (const identity of snapshot.identities) {
      this.identities.set(identity.humanActorId, identity);
    }
    for (const link of snapshot.links) {
      this.links.set(link.linkId, link);
    }
    for (const proof of snapshot.uniquenessProofs) {
      this.uniquenessProofs.set(proof.proofId, proof);
      this.uniquenessCommitmentIndex.set(proof.providerUniquenessCommitment, proof.proofId);
    }
    for (const recovery of snapshot.recoveries) {
      this.recoveries.set(recovery.recoveryId, recovery);
    }
    for (const revocation of snapshot.revocations) {
      this.revocations.set(revocation.revocationId, revocation);
    }
    this.sybilSignals.push(...snapshot.sybilSignals);
  }
}
