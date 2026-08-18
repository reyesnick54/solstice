import type { UtcInstant } from '../../domain/src/time.ts';
import type {
  AgentApprovalId,
  AgentExecutionRequestId,
  AgentProposalRefId,
  AgentReceiptId,
  AgentRevocationId,
  AgentSafetyEventId,
  MandatePolicyVersion,
  UserAgentId,
  UserAgentMandateId,
} from './ids.ts';
import type {
  AgentActionClass,
  AgentApprovalClass,
  AgentAssetId,
  AgentMandateRefusalCode,
  ExpectedOutcomeClass,
  MandateMode,
  MandateState,
  ProposalState,
  RevocationScope,
  SafetyEventKind,
} from './taxonomy.ts';

export type MandateOwnerKind = 'USER' | 'WALLET' | 'ACCOUNT' | 'ORGANIZATION';

export type MandateOwner = {
  readonly kind: MandateOwnerKind;
  readonly ownerId: string;
  readonly walletId: string;
  readonly accountId: string;
  readonly organizationId?: string;
};

export type UserAgent = {
  readonly agentId: UserAgentId;
  readonly owner: MandateOwner;
  readonly label: string;
  readonly modelRef: string;
  readonly policyRef: string;
  readonly createdAt: UtcInstant;
  readonly status: 'ACTIVE' | 'REVOKED';
  readonly receivesMasterKey: false;
};

export type AgentBudget = {
  readonly perTransaction: bigint;
  readonly perPeriod: bigint;
  readonly periodHours: number;
  readonly perAsset: Readonly<Record<string, string>>;
  readonly perMarket: Readonly<Record<string, string>>;
  readonly perActionClass: Readonly<Record<string, string>>;
};

export type AgentAssetPermission = {
  readonly assetId: AgentAssetId | string;
  readonly listedAssetId?: string;
  readonly wildcard: false;
};

export type AgentMarketPermission = {
  readonly marketId: string;
};

export type AgentDestinationPermission = {
  readonly kind: 'TRUSTED_DESTINATION' | 'APPROVED_MERCHANT' | 'MACHINE_SERVICE' | 'SPECIFIC_ADDRESS';
  readonly destinationId: string;
};

export type AgentPermission = {
  readonly actionClasses: readonly AgentActionClass[];
  readonly assets: readonly AgentAssetPermission[];
  readonly markets: readonly AgentMarketPermission[];
  readonly destinations: readonly AgentDestinationPermission[];
  readonly humanInformationAccess: false | { readonly granted: true; readonly scopeId: string };
  readonly allowWildcardAssets: false;
};

export type AgentApprovalRequirement = {
  readonly class: AgentApprovalClass;
  readonly highRiskAlwaysHuman: true;
};

export type AgentMandatePolicy = {
  readonly policyVersion: MandatePolicyVersion;
  readonly mode: MandateMode;
  readonly environment: 'simulation' | 'sandbox';
  readonly riskPolicyId: string;
  readonly jurisdictionPackId: string | null;
  readonly frequencyMaxPerPeriod: number;
  readonly expiry: UtcInstant;
  readonly approval: AgentApprovalRequirement;
  readonly delegatedSigningKeyId: string | null;
  readonly revocationPolicy: 'FUTURE_AUTHORIZATION_ONLY';
  readonly pendingAfterRevocation: 'INELIGIBLE';
};

export type UserAgentMandate = {
  readonly mandateId: UserAgentMandateId;
  readonly agentId: UserAgentId;
  readonly owner: MandateOwner;
  readonly state: MandateState;
  readonly policy: AgentMandatePolicy;
  readonly permissions: AgentPermission;
  readonly budget: AgentBudget;
  readonly createdByActorId: string;
  readonly createdAt: UtcInstant;
  readonly mandateHash: string;
  readonly economicMandateRef?: string;
};

export type AgentTransactionProposal = {
  readonly proposalId: AgentProposalRefId;
  readonly mandateId: UserAgentMandateId;
  readonly mandateHash: string;
  readonly policyVersion: MandatePolicyVersion;
  readonly agentId: UserAgentId;
  readonly intent: AgentActionClass | string;
  readonly reasonCode: string;
  readonly strategyRef: string | null;
  readonly assetId: string;
  readonly quantity: bigint;
  readonly destinationOrMarket: string;
  readonly fees: bigint;
  readonly riskCheckIds: readonly string[];
  readonly expectedOutcomeClass: ExpectedOutcomeClass;
  readonly modelRef: string;
  readonly operationalRationale: string;
  readonly guaranteedReturn: false;
  readonly createdAt: UtcInstant;
  readonly state: ProposalState;
  readonly proposalHash: string;
  readonly walletId: string;
  readonly networkId: string;
};

export type AgentExecutionRequest = {
  readonly requestId: AgentExecutionRequestId;
  readonly proposalHash: string;
  readonly mandateHash: string;
  readonly walletPolicyHash: string;
  readonly kernelStateHash: string;
  readonly marketRestrictionHash: string;
  readonly transactionContentHash: string;
  readonly createdAt: UtcInstant;
};

export type AgentMandateUsage = {
  readonly mandateId: UserAgentMandateId;
  readonly spentThisPeriod: bigint;
  readonly spentTotal: bigint;
  readonly transactionsThisPeriod: number;
  readonly periodStartedAt: UtcInstant;
  readonly byAsset: Readonly<Record<string, string>>;
  readonly byMarket: Readonly<Record<string, string>>;
  readonly byActionClass: Readonly<Record<string, string>>;
};

export type AgentMandateRevocation = {
  readonly revocationId: AgentRevocationId;
  readonly scope: RevocationScope;
  readonly targetId: string;
  readonly actorId: string;
  readonly at: UtcInstant;
  readonly appliesToFutureAuthorization: true;
};

export type AgentExecutionReceipt = {
  readonly receiptId: AgentReceiptId;
  readonly requestId: AgentExecutionRequestId;
  readonly proposalHash: string;
  readonly mandateHash: string;
  readonly approvalId: AgentApprovalId | null;
  readonly kernelDecision: string | null;
  readonly walletAuthorization: string | null;
  readonly transactionHash: string | null;
  readonly finality: 'NOT_SUBMITTED' | 'SUBMITTED' | 'FINALIZED' | 'REJECTED';
  readonly outcomeClass: ExpectedOutcomeClass | 'REFUSED' | 'FAILED';
  readonly createdAt: UtcInstant;
};

export type AgentSafetyEvent = {
  readonly eventId: AgentSafetyEventId;
  readonly kind: SafetyEventKind;
  readonly mandateId: UserAgentMandateId | null;
  readonly proposalId: AgentProposalRefId | null;
  readonly detail: string;
  readonly increasesRiskAutomatically: false;
  readonly at: UtcInstant;
};

export type AgentActivityEntry = {
  readonly at: UtcInstant;
  readonly kind: 'MANDATE' | 'PROPOSAL' | 'APPROVAL' | 'EXECUTION' | 'REVOCATION' | 'SAFETY';
  readonly summary: string;
  readonly refs: readonly string[];
};

export type AgentActivityReport = {
  readonly ownerId: string;
  readonly walletId: string;
  readonly generatedAt: UtcInstant;
  readonly entries: readonly AgentActivityEntry[];
};

export type AgentExplanation = {
  readonly proposalId: AgentProposalRefId;
  readonly what: string;
  readonly why: string;
  readonly amountAtRisk: string;
  readonly fees: string;
  readonly applicableLimits: readonly string[];
  readonly requiredApproval: AgentApprovalClass;
  readonly certainty: 'NONE_FABRICATED';
};

export type MandateRefusal = {
  readonly ok: false;
  readonly code: AgentMandateRefusalCode;
  readonly detail: string;
};

export type SigningIntentSummary = {
  readonly title: string;
  readonly agentId: string;
  readonly mandateId: string;
  readonly action: string;
  readonly assetId: string;
  readonly quantity: string;
  readonly destinationOrMarket: string;
  readonly fees: string;
  readonly approvalClass: AgentApprovalClass;
  readonly proposalHash: string;
};

export type KernelPortDecision = {
  readonly status: string;
  readonly evidenceRecordId: string;
};

export type WalletAuthorizationView = {
  readonly walletId: string;
  readonly accountId: string;
  readonly networkId: string;
  readonly policyHash: string;
  readonly delegatedKeyId: string | null;
  readonly masterKeyHeldByAgent: false;
};

export type ExchangeEligibilityView = {
  readonly marketId: string;
  readonly eligible: boolean;
  readonly marketState: string;
  readonly priceProtectionOk: boolean;
  readonly dvpRequired: true;
  readonly restrictionHash: string;
  readonly refusal?: string;
};

export type RiskRestrictionView = {
  readonly restricted: boolean;
  readonly reason: string | null;
  readonly isWalletAuthority: false;
};

export type JurisdictionView = {
  readonly packId: string | null;
  readonly actionAvailable: boolean;
};
