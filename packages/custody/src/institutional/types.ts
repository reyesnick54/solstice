import type { UtcInstant } from '../../../domain/src/time.ts';
import type { HsmKeyHandle } from '../../../security/src/hsm-kms.ts';
import type { NativeCustodyAssetId } from '../native-assets.ts';
import type { DestinationScreeningOutcome, TravelRuleApplicability } from '../taxonomy.ts';
import type { TravelRuleDecision } from '../types.ts';
import type {
  ApprovalId,
  CompromiseIncidentId,
  CustodyWalletId,
  InstitutionalDestinationId,
  NativeWithdrawalId,
  PreviewId,
  RebalanceProposalId,
  VaultId,
} from './ids.ts';
import type {
  ApprovalMode,
  CustodyType,
  CustodyWalletClass,
  HumanCustodyActor,
  InstitutionalDestinationStatus,
  InstitutionalReconciliationOutcome,
  InstitutionalSecurityControl,
  InstitutionalWithdrawalState,
  SecurityTier,
  SigningProviderKind,
  VaultStatus,
  WithdrawalPolicyDecision,
} from './taxonomy.ts';

export type SigningPolicy = {
  readonly providerKind: SigningProviderKind;
  readonly requiredSuiteId: string;
  readonly purpose: 'WALLET_SIGNING';
};

export type ApprovalPolicy = {
  readonly mode: ApprovalMode;
  readonly requiredApprovals: number;
  readonly authorizedApproverIds: readonly string[];
  readonly highValueThreshold: bigint;
};

export type VelocityPolicy = {
  readonly maxPerWithdrawal: bigint;
  readonly dailyLimit: bigint;
  readonly epochLimit: bigint;
};

export type DestinationPolicy = {
  readonly requireApproved: true;
  readonly coolingPeriodHeights: bigint;
  readonly allowNewWithoutReview: false;
};

export type CustodyWalletV1 = {
  readonly schemaVersion?: 1;
  readonly walletId: CustodyWalletId;
  readonly vaultId: VaultId;
  readonly classifications: readonly CustodyWalletClass[];
  readonly address: string;
  readonly assetId: 'SUNREY_COIN';
  readonly signerHandle: HsmKeyHandle | null;
  readonly createdAt: UtcInstant;
};

export type CustodyWalletV2 = {
  readonly schemaVersion: 2;
  readonly walletId: CustodyWalletId;
  readonly vaultId: VaultId;
  readonly assetId: NativeCustodyAssetId;
  readonly address: string;
  readonly network: string;
  readonly chainId: string;
  readonly signerHandle: HsmKeyHandle | null;
  readonly securityTier: SecurityTier;
  readonly classifications: readonly CustodyWalletClass[];
  readonly createdAt: UtcInstant;
};

export type CustodyWallet = CustodyWalletV1 | CustodyWalletV2;

type CustodyVaultBase = {
  readonly vaultId: VaultId;
  readonly custodyType: CustodyType;
  readonly network: string;
  readonly walletIds: readonly CustodyWalletId[];
  readonly signingPolicy: SigningPolicy;
  readonly approvalPolicy: ApprovalPolicy;
  readonly velocityPolicy: VelocityPolicy;
  readonly destinationPolicy: DestinationPolicy;
  readonly securityTier: SecurityTier;
  readonly status: VaultStatus;
  readonly providerReference: string;
  readonly createdAt: UtcInstant;
};

export type CustodyVaultV1 = CustodyVaultBase & {
  readonly authorizedAssets: readonly ['SUNREY_COIN'];
  readonly schemaVersion: 1;
};

export type CustodyVaultV2 = CustodyVaultBase & {
  readonly authorizedAssets: readonly NativeCustodyAssetId[];
  readonly schemaVersion: 2;
};

export type CustodyVault = CustodyVaultV1 | CustodyVaultV2;

export type InstitutionalDestination = {
  readonly destinationId: InstitutionalDestinationId;
  readonly vaultId: VaultId;
  readonly address: string;
  readonly label: string;
  readonly status: InstitutionalDestinationStatus;
  readonly approvedAtHeight: bigint | null;
  readonly lastChangedAt: UtcInstant;
  readonly changeAuthorizedBy: string | null;
};

export type ApprovalAction = {
  readonly approvalId: ApprovalId;
  readonly withdrawalId: NativeWithdrawalId;
  readonly actorId: string;
  readonly actorKind: HumanCustodyActor;
  readonly decidedAt: UtcInstant;
  readonly decision: 'APPROVE' | 'REJECT';
  readonly boundPreviewHash: string | null;
};

export type TransactionPreview = {
  readonly previewId: PreviewId;
  readonly source: string;
  readonly destination: string;
  readonly assetId: NativeCustodyAssetId;
  readonly quantity: bigint;
  readonly feeAssetId: NativeCustodyAssetId;
  readonly maxFee: bigint;
  readonly nonce: bigint;
  readonly networkId: string;
  readonly chainId: string;
  readonly expectedStateEffect: string;
  readonly canonicalBytesHex: string;
  readonly previewHash: string;
};

export type ColdSigningPackage = {
  readonly schemaVersion: 1 | 2;
  readonly unsignedCanonicalHex: string;
  readonly approvalEvidence: readonly ApprovalAction[];
  readonly networkId: string;
  readonly chainId: string;
  readonly assetId: NativeCustodyAssetId;
  readonly quantity: bigint;
  readonly feeLimit: bigint;
  readonly expirationUnixSeconds: bigint;
  readonly transactionHash: string;
  readonly previewHash: string;
};

export type ColdSignatureImport = {
  readonly signedCanonicalHex: string;
  readonly signerPublicKeyHex: string;
  readonly suiteId: string;
  readonly signatureHex: string;
};

export type NativeWithdrawal = {
  readonly withdrawalId: NativeWithdrawalId;
  readonly vaultId: VaultId;
  readonly walletId: CustodyWalletId;
  readonly destinationId: InstitutionalDestinationId;
  readonly assetId: NativeCustodyAssetId;
  readonly quantity: bigint;
  readonly state: InstitutionalWithdrawalState;
  readonly policyDecision: WithdrawalPolicyDecision | null;
  readonly screeningOutcome: DestinationScreeningOutcome | null;
  readonly travelRule: TravelRuleDecision | null;
  readonly preview: TransactionPreview | null;
  readonly approvals: readonly ApprovalAction[];
  readonly chainTxId: string | null;
  readonly submittedOnce: boolean;
  readonly createdAt: UtcInstant;
};

export type NativeDepositRecord = {
  readonly depositKey: string;
  readonly vaultId: VaultId;
  readonly walletId: CustodyWalletId;
  readonly address: string;
  readonly txId: string;
  readonly height: bigint;
  readonly quantity: bigint;
  readonly assetId: NativeCustodyAssetId;
  readonly screeningOutcome: DestinationScreeningOutcome;
  readonly mempoolRejected: true;
  readonly createdAt: UtcInstant;
};

export type DerivedPositionV1 = {
  readonly schemaVersion?: 1;
  readonly vaultId: VaultId;
  readonly walletId: CustodyWalletId;
  readonly address: string;
  readonly onChain: bigint;
  readonly attributed: bigint;
  readonly pendingWithdrawals: bigint;
  readonly reservedForExchange: bigint;
  readonly notALedgerBalance: true;
};

export type DerivedPosition = {
  readonly schemaVersion: 2;
  readonly assetId: NativeCustodyAssetId;
  readonly vaultId: VaultId;
  readonly walletId: CustodyWalletId;
  readonly address: string;
  readonly onChain: bigint;
  readonly attributed: bigint;
  readonly pendingWithdrawals: bigint;
  readonly reservedForExchange: bigint;
  readonly notALedgerBalance: true;
};

export type RebalanceProposal = {
  readonly proposalId: RebalanceProposalId;
  readonly fromVaultId: VaultId;
  readonly toVaultId: VaultId;
  readonly quantity: bigint;
  readonly direction: 'COLD_TO_WARM' | 'WARM_TO_HOT';
  readonly proposedBy: 'POLICY' | 'AI';
  readonly canSign: false;
  readonly canApprove: false;
  readonly createdAt: UtcInstant;
};

export type InstitutionalReconciliationReport = {
  readonly outcome: InstitutionalReconciliationOutcome;
  readonly notes: readonly string[];
  readonly createdAt: UtcInstant;
  readonly autoAdjustedOnChain: false;
  readonly autoCorrected: false;
};

export type SecurityControlState = {
  readonly kind: InstitutionalSecurityControl;
  readonly active: boolean;
  readonly actorId: string;
  readonly actorKind: HumanCustodyActor;
};

export type CompromiseIncident = {
  readonly incidentId: CompromiseIncidentId;
  readonly vaultId: VaultId;
  readonly keyId: string;
  readonly signingDisabled: true;
  readonly historicalSignaturesRewritten: false;
  readonly createdAt: UtcInstant;
};

export type RecoveryManifest = {
  readonly walletMetadata: readonly {
    readonly walletId: string;
    readonly address: string;
    readonly assetId: NativeCustodyAssetId;
  }[];
  readonly keyHandles: readonly { readonly handleId: string; readonly keyId: string }[];
  readonly approvalPolicy: ApprovalPolicy;
  readonly coldBackupRefs: readonly string[];
  readonly hsmDisasterRecoveryRef: string;
  readonly encryptedConfiguration: string;
  readonly containsPlaintextSigningMaterial: false;
};

export type TravelRuleApplicabilityView = TravelRuleApplicability;
