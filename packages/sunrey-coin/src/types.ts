import type { UtcInstant } from '../../domain/src/time.ts';
import type { AssetQuantity } from '../../money/src/asset-quantity.ts';
import type {
  BurnRecordId,
  CoinHoldId,
  ContributionVectorId,
  EligibilityId,
  FormulaVersionId,
  IssuanceProposalId,
  IssuanceRecordId,
  ReconciliationSnapshotId,
  SunReyCoinAssetId,
  SupplyPolicyId,
  TransferRecordId,
} from './ids.ts';
import type {
  CoinHoldState,
  EligibilityState,
  ReconciliationOutcome,
  TickerStatus,
} from './taxonomy.ts';

export type SunReyCoinFailure = {
  readonly code: string;
  readonly message: string;
};

export type SunReyCoinAsset = {
  readonly assetId: SunReyCoinAssetId;
  readonly displayName: 'SunRey Coin';
  readonly precision: number;
  readonly class: 'SIMULATION_NETWORK_UTILITY';
  readonly status: 'ENGINEERING_SIMULATION';
  readonly simulationEnabled: true;
  readonly liveEnabled: false;
  readonly tickerStatus: TickerStatus;
  readonly supplyPolicyId: SupplyPolicyId;
  readonly legalClassification: 'UNCLASSIFIED_SIMULATION';
  readonly createdAt: UtcInstant;
};

export type SunReyCoinSupplyPolicy = {
  readonly policyId: SupplyPolicyId;
  readonly version: number;
  readonly legalState: 'ENGINEERING_SIMULATION';
  readonly issuanceEnabled: boolean;
  readonly transferEnabled: boolean;
  readonly burnEnabled: boolean;
  readonly simulationOnly: true;
  readonly perEventLimitScaled: bigint;
  readonly perPeriodLimitScaled: bigint;
  readonly simulationCapScaled: bigint;
  readonly formulaRef: FormulaVersionId;
  readonly roundingMode: 'FLOOR';
  readonly createdAt: UtcInstant;
};

export type ContributionFactors = {
  readonly provenance: bigint;
  readonly verification: bigint;
  readonly freshness: bigint;
  readonly completeness: bigint;
  readonly authorizedScope: bigint;
  readonly uniqueness: bigint;
  readonly computationParticipation: bigint;
  readonly researchComputeUtility: bigint;
};

export type AuthorizedContributionVector = {
  readonly vectorId: ContributionVectorId;
  readonly subjectId: string;
  readonly receiptId: string;
  readonly contributionId: string;
  readonly jobId: string;
  readonly purposeId: string;
  readonly purposeVersion: string;
  readonly consentRefs: readonly { readonly consentId: string; readonly version: string }[];
  readonly formulaVersion: FormulaVersionId;
  readonly peveFormulaRef: string | null;
  readonly factors: ContributionFactors;
  readonly replayKey: string;
  readonly eligibility: EligibilityState;
  readonly amount: AssetQuantity;
  readonly createdAt: UtcInstant;
  readonly humanWorthAssigned: false;
};

export type EligibilityRecord = {
  readonly eligibilityId: EligibilityId;
  readonly vectorId: ContributionVectorId;
  readonly state: EligibilityState;
  readonly reason: string;
  readonly createdAt: UtcInstant;
};

export type SunReyCoinIssuanceProposal = {
  readonly proposalId: IssuanceProposalId;
  readonly vectorId: ContributionVectorId;
  readonly subjectId: string;
  readonly custodyAccountId: string;
  readonly amount: AssetQuantity;
  readonly financialEffect: false;
  readonly createdAt: UtcInstant;
};

export type IssuanceRecord = {
  readonly issuanceId: IssuanceRecordId;
  readonly proposalId: IssuanceProposalId;
  readonly journalId: string;
  readonly executionAuthorityId: string;
  readonly intentId: string;
  readonly createdAt: UtcInstant;
};

export type TransferRecord = {
  readonly transferId: TransferRecordId;
  readonly journalId: string;
  readonly sourceAccountId: string;
  readonly destinationAccountId: string;
  readonly amount: AssetQuantity;
  readonly createdAt: UtcInstant;
};

export type BurnRecord = {
  readonly burnId: BurnRecordId;
  readonly journalId: string;
  readonly sourceAccountId: string;
  readonly amount: AssetQuantity;
  readonly createdAt: UtcInstant;
};

export type SunReyCoinPosition = {
  readonly ownerId: string;
  readonly accountId: string;
  readonly assetId: SunReyCoinAssetId;
  readonly available: AssetQuantity;
  readonly held: AssetQuantity;
  readonly pending: AssetQuantity;
  readonly settled: AssetQuantity;
  readonly marketPrice: 'UNAVAILABLE';
};

export type CoinHold = {
  readonly holdId: CoinHoldId;
  readonly accountId: string;
  readonly amount: AssetQuantity;
  readonly state: CoinHoldState;
  readonly createdAt: UtcInstant;
  readonly closedAt: UtcInstant | null;
};

export type SupplySnapshot = {
  readonly issued: AssetQuantity;
  readonly burned: AssetQuantity;
  readonly holdings: AssetQuantity;
  readonly circulating: AssetQuantity;
};

export type ReconciliationSnapshot = {
  readonly snapshotId: ReconciliationSnapshotId;
  readonly issued: AssetQuantity;
  readonly burned: AssetQuantity;
  readonly holdings: AssetQuantity;
  readonly outcome: ReconciliationOutcome;
  readonly createdAt: UtcInstant;
};

export type FutureChainAdapter = {
  readonly implemented: false;
  readonly chain: 'NOT_IMPLEMENTED';
  readonly wallets: 'NOT_IMPLEMENTED';
  readonly addresses: 'NOT_IMPLEMENTED';
  readonly keys: 'NOT_IMPLEMENTED';
};
