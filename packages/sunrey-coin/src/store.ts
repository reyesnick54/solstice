import type {
  AuthorizedContributionVector,
  BurnRecord,
  CoinHold,
  EligibilityRecord,
  IssuanceRecord,
  ReconciliationSnapshot,
  SunReyCoinIssuanceProposal,
  TransferRecord,
} from './types.ts';

export class SunReyCoinStore {
  readonly vectors = new Map<string, AuthorizedContributionVector>();
  readonly byReplay = new Map<string, AuthorizedContributionVector>();
  readonly eligibility = new Map<string, EligibilityRecord>();
  readonly proposals = new Map<string, SunReyCoinIssuanceProposal>();
  readonly issuances = new Map<string, IssuanceRecord>();
  readonly issuedReplay = new Set<string>();
  readonly transfers = new Map<string, TransferRecord>();
  readonly burns = new Map<string, BurnRecord>();
  readonly holds = new Map<string, CoinHold>();
  readonly reconciliations: ReconciliationSnapshot[] = [];

  putVector(vector: AuthorizedContributionVector): void {
    this.vectors.set(vector.vectorId, vector);
    this.byReplay.set(vector.replayKey, vector);
  }

  putEligibility(record: EligibilityRecord): void {
    this.eligibility.set(record.eligibilityId, record);
  }

  putProposal(proposal: SunReyCoinIssuanceProposal): void {
    this.proposals.set(proposal.proposalId, proposal);
  }

  putIssuance(record: IssuanceRecord, replayKey: string): void {
    this.issuances.set(record.issuanceId, record);
    this.issuedReplay.add(replayKey);
  }

  putTransfer(record: TransferRecord): void {
    this.transfers.set(record.transferId, record);
  }

  putBurn(record: BurnRecord): void {
    this.burns.set(record.burnId, record);
  }

  putHold(hold: CoinHold): void {
    this.holds.set(hold.holdId, hold);
  }

  putReconciliation(snapshot: ReconciliationSnapshot): void {
    this.reconciliations.push(snapshot);
  }
}
