import type { UtcInstant } from '../../domain/src/time.ts';
import type {
  AgentApprovalId,
  AgentConversationId,
  AgentExecutionRequestId,
  AgentMemoryId,
  AgentMessageId,
  AgentProposalRefId,
  AgentReceiptId,
  AgentRevocationId,
  AgentRuntimeEventId,
  AgentSafetyEventId,
  MandatePolicyVersion,
  UserAgentId,
  UserAgentMandateId,
} from './ids.ts';
import type {
  AgentActionClass,
  AgentApprovalClass,
  AgentAssetId,
  AgentAssistScope,
  AgentIdentityKind,
  AgentLifecycleState,
  AgentMandateRefusalCode,
  AgentRuntimeEventKind,
  AgentType,
  ConversationStatus,
  ExpectedOutcomeClass,
  ExplanationComplexity,
  MandateMode,
  MandateState,
  MemoryCategory,
  MemoryClassification,
  MemorySource,
  MessageRole,
  PersonalizationVerbosity,
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

export type AgentModelPolicy = {
  readonly modelRef: string;
  readonly allowExternalProviders: false;
  readonly storeHiddenReasoning: false;
};

export type AgentToolPolicy = {
  readonly entitledTools: readonly string[];
  readonly mutatingFinancialToolsForbidden: true;
};

export type AgentRiskPolicy = {
  readonly riskPolicyId: string;
  readonly mayAssumeUserAuthority: false;
  readonly mayBecomeExecutionAuthority: false;
};

export type UserAgent = {
  readonly agentId: UserAgentId;
  readonly owner: MandateOwner;
  readonly ownerId: string;
  readonly identityKind: AgentIdentityKind;
  readonly agentType: AgentType;
  readonly name: string;
  readonly label: string;
  readonly modelRef: string;
  readonly policyRef: string;
  readonly modelPolicy: AgentModelPolicy;
  readonly toolPolicy: AgentToolPolicy;
  readonly mandateId: UserAgentMandateId | null;
  readonly jurisdiction: string | null;
  readonly riskPolicy: AgentRiskPolicy;
  readonly createdAt: UtcInstant;
  readonly status: AgentLifecycleState;
  readonly receivesMasterKey: false;
  readonly isCustomer: false;
  readonly isExecutionAuthority: false;
};

export type AgentTimeWindow = {
  readonly startHourUtc: number;
  readonly endHourUtc: number;
};

export type AgentBudget = {
  readonly perTransaction: bigint;
  readonly perPeriod: bigint;
  readonly periodHours: number;
  readonly perAsset: Readonly<Record<string, string>>;
  readonly perMarket: Readonly<Record<string, string>>;
  readonly perActionClass: Readonly<Record<string, string>>;
  readonly maxProposalAmount?: bigint;
  readonly dailyProposalAggregate?: bigint;
  readonly perToolBudget?: Readonly<Record<string, string>>;
  readonly allowedCurrencies?: readonly string[];
  readonly allowedAssetClasses?: readonly string[];
  readonly jurisdiction?: string | null;
  readonly timeWindows?: readonly AgentTimeWindow[];
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
  readonly assistScopes: readonly AgentAssistScope[];
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

export type AgentConversation = {
  readonly conversationId: AgentConversationId;
  readonly ownerId: string;
  readonly agentId: UserAgentId;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
  readonly status: ConversationStatus;
  readonly title: string;
  readonly contextVersion: number;
  readonly proposalRefs: readonly string[];
  readonly isFinancialRecord: false;
};

export type AgentMessage = {
  readonly messageId: AgentMessageId;
  readonly conversationId: AgentConversationId;
  readonly role: MessageRole;
  readonly content: string;
  readonly createdAt: UtcInstant;
  readonly visible: boolean;
  readonly proposalRef: string | null;
  readonly toolEventId: string | null;
  readonly hiddenReasoning: false;
};

export type AgentToolEvent = {
  readonly toolEventId: string;
  readonly conversationId: AgentConversationId;
  readonly messageId: AgentMessageId | null;
  readonly toolName: string;
  readonly ok: boolean;
  readonly summary: string;
  readonly proposalRef: string | null;
  readonly executedFinancialMutation: false;
  readonly createdAt: UtcInstant;
};

export type AgentMemory = {
  readonly memoryId: AgentMemoryId;
  readonly agentId: UserAgentId;
  readonly ownerId: string;
  readonly category: MemoryCategory;
  readonly content: string;
  readonly source: MemorySource;
  readonly confidence: 'USER_DECLARED' | 'CONFIRMED' | 'REFERENCED';
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
  readonly expiresAt: UtcInstant | null;
  readonly userEditable: boolean;
  readonly dataClassification: MemoryClassification;
  readonly personalization: boolean;
};

export type AgentPersonalization = {
  readonly ownerId: string;
  readonly agentId: UserAgentId;
  readonly verbosity: PersonalizationVerbosity;
  readonly displayCurrency: string;
  readonly language: string;
  readonly explanationComplexity: ExplanationComplexity;
  readonly personalizationMemoryEnabled: boolean;
  readonly altersFinancialMathematics: false;
  readonly altersRegulatoryDisclosures: false;
};

export type AgentRuntimeEvent = {
  readonly eventId: AgentRuntimeEventId;
  readonly kind: AgentRuntimeEventKind;
  readonly agentId: UserAgentId | null;
  readonly ownerId: string | null;
  readonly conversationId: AgentConversationId | null;
  readonly memoryId: AgentMemoryId | null;
  readonly mandateId: UserAgentMandateId | null;
  readonly at: UtcInstant;
  readonly detail: string;
  readonly containsConversationContent: false;
};

export type PegReadView = {
  readonly subjectId: string;
  readonly authoritativeBalance: false;
  readonly ledgerWins: true;
  readonly goalLabels: readonly string[];
  readonly incomeLabels: readonly string[];
  readonly obligationLabels: readonly string[];
  readonly opportunityTitles: readonly string[];
};

export type ConversationContext = {
  readonly conversationId: AgentConversationId;
  readonly contextVersion: number;
  readonly recentMessages: readonly AgentMessage[];
  readonly activeProposalId: string | null;
  readonly currentUserRequest: string;
  readonly financialContext: PegReadView | null;
  readonly toolResults: readonly AgentToolEvent[];
  readonly tokenBudget: number;
  readonly assembledChars: number;
  readonly omittedLifetimeHistory: true;
};

export type ContextAuthorizationDecision = {
  readonly allowed: boolean;
  readonly releasedObjectIds: readonly string[];
  readonly deniedObjectIds: readonly string[];
  readonly code: AgentMandateRefusalCode | null;
  readonly detail: string;
};

export type AgentRuntimeSnapshot = {
  readonly agents: readonly UserAgent[];
  readonly mandates: readonly UserAgentMandate[];
  readonly proposals: readonly AgentTransactionProposal[];
  readonly usage: readonly AgentMandateUsage[];
  readonly conversations: readonly AgentConversation[];
  readonly messages: readonly AgentMessage[];
  readonly toolEvents: readonly AgentToolEvent[];
  readonly memories: readonly AgentMemory[];
  readonly personalization: readonly AgentPersonalization[];
  readonly runtimeEvents: readonly AgentRuntimeEvent[];
};
