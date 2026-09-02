/**
 * Persistence ports for Wave 3 economic proof records.
 *
 * Full records belong in bounded databases / Evidence Vault.
 * Blockchain stores cryptographic commitments only — databases are not monetary authorities.
 */

import type {
  CanonicalEconomicClaim,
  EconomicEvidence,
  EconomicObservation,
  VerifiedEconomicFact,
} from './types.ts';

export type ProofRecordKind = 'observation' | 'evidence' | 'verifiedFact' | 'claim';

export type ProofVaultSeal = {
  readonly kind: ProofRecordKind;
  readonly objectId: string;
  readonly schemaVersion: string;
  readonly commitment: string;
  readonly sealedAtUtc: string;
  readonly economicDomain: string;
};

export type EconomicProofObservationStore = {
  putObservation(observation: EconomicObservation): void;
  getObservation(observationId: string): EconomicObservation | undefined;
  listObservations(): readonly EconomicObservation[];
};

export type EconomicProofEvidenceStore = {
  putEvidence(evidence: EconomicEvidence): void;
  getEvidence(evidenceId: string): EconomicEvidence | undefined;
  listEvidence(): readonly EconomicEvidence[];
};

export type EconomicProofVerifiedFactStore = {
  putVerifiedFact(fact: VerifiedEconomicFact): void;
  getVerifiedFact(verifiedFactId: string): VerifiedEconomicFact | undefined;
  listVerifiedFacts(): readonly VerifiedEconomicFact[];
};

export type EconomicProofClaimStore = {
  putClaim(claim: CanonicalEconomicClaim): void;
  getClaim(economicClaimId: string): CanonicalEconomicClaim | undefined;
  listClaims(): readonly CanonicalEconomicClaim[];
};

export type EconomicProofPersistencePorts = {
  readonly observations: EconomicProofObservationStore;
  readonly evidence: EconomicProofEvidenceStore;
  readonly verifiedFacts: EconomicProofVerifiedFactStore;
  readonly claims: EconomicProofClaimStore;
  readonly vaultSeals: readonly ProofVaultSeal[];
  sealCommitment(seal: ProofVaultSeal): void;
};

export type ChainCommitmentBatch = {
  readonly batchId: string;
  readonly sealedAtUtc: string;
  readonly commitments: readonly ProofVaultSeal[];
  readonly batchRoot: string;
};

export type EconomicProofChainAnchorPort = {
  anchorBatch(batch: ChainCommitmentBatch): string;
  getAnchoredBatch(batchId: string): ChainCommitmentBatch | undefined;
};

export class InMemoryEconomicProofPersistence implements EconomicProofPersistencePorts {
  private readonly observationMap = new Map<string, EconomicObservation>();
  private readonly evidenceMap = new Map<string, EconomicEvidence>();
  private readonly factMap = new Map<string, VerifiedEconomicFact>();
  private readonly claimMap = new Map<string, CanonicalEconomicClaim>();
  private readonly sealList: ProofVaultSeal[] = [];

  readonly observations: EconomicProofObservationStore = {
    putObservation: (observation) => {
      this.observationMap.set(observation.observationId, Object.freeze(observation));
    },
    getObservation: (observationId) => this.observationMap.get(observationId),
    listObservations: () => [...this.observationMap.values()],
  };

  readonly evidence: EconomicProofEvidenceStore = {
    putEvidence: (evidence) => {
      this.evidenceMap.set(evidence.evidenceId, Object.freeze(evidence));
    },
    getEvidence: (evidenceId) => this.evidenceMap.get(evidenceId),
    listEvidence: () => [...this.evidenceMap.values()],
  };

  readonly verifiedFacts: EconomicProofVerifiedFactStore = {
    putVerifiedFact: (fact) => {
      this.factMap.set(fact.verifiedFactId, Object.freeze(fact));
    },
    getVerifiedFact: (verifiedFactId) => this.factMap.get(verifiedFactId),
    listVerifiedFacts: () => [...this.factMap.values()],
  };

  readonly claims: EconomicProofClaimStore = {
    putClaim: (claim) => {
      this.claimMap.set(claim.economicClaimId, Object.freeze(claim));
    },
    getClaim: (economicClaimId) => this.claimMap.get(economicClaimId),
    listClaims: () => [...this.claimMap.values()],
  };

  get vaultSeals(): readonly ProofVaultSeal[] {
    return this.sealList;
  }

  sealCommitment(seal: ProofVaultSeal): void {
    this.sealList.push(Object.freeze(seal));
  }
}
