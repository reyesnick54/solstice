import type { UtcInstant } from '../../../domain/src/time.ts';
import type {
  ActionCardStatus,
  ActionCardType,
  ActionCenterView,
  AvailableActionControl,
  ConversationIntent,
  ConversationRefusalCode,
  StatementSourceKind,
  UncertaintyClass,
} from './taxonomy.ts';

export type ConversationActorKind = 'HUMAN' | 'AGENT';

export type ConversationActor = {
  readonly actorId: string;
  readonly subjectId: string;
  readonly kind: ConversationActorKind;
  readonly sessionId: string;
  readonly deviceId: string | null;
  readonly authenticationAssurance: 'AAL1' | 'STEP_UP_SATISFIED';
};

export type MoneyTerm = {
  readonly currency: string;
  readonly minorUnits: string;
  readonly uncertainty: UncertaintyClass;
  readonly source: StatementSourceKind;
};

export type SlotName =
  | 'recipient'
  | 'amount'
  | 'currency'
  | 'sourceAccount'
  | 'destinationAccount'
  | 'destinationCurrency'
  | 'sourceCurrency'
  | 'asset'
  | 'destination'
  | 'goal'
  | 'card';

export type SlotValue = {
  readonly name: SlotName;
  readonly raw: string;
  readonly resolvedId: string | null;
  readonly displayLabel: string | null;
  readonly uncertainty: UncertaintyClass;
  readonly guessed: false;
};

export type SlotQuestion = {
  readonly slot: SlotName;
  readonly prompt: string;
  readonly reason: 'REQUIRED' | 'AMBIGUOUS';
};

export type ResolvableEntity = {
  readonly id: string;
  readonly kind: 'ACCOUNT' | 'BENEFICIARY' | 'HOLDING' | 'CARD' | 'GOAL' | 'ASSET';
  readonly ownerSubjectId: string;
  readonly labels: readonly string[];
  readonly currency?: string;
  readonly assetId?: string;
  readonly eligible?: boolean;
};

export type EntityResolution =
  | { readonly ok: true; readonly entity: ResolvableEntity; readonly ambiguous: false }
  | { readonly ok: false; readonly code: 'ENTITY_AMBIGUOUS' | 'ENTITY_NOT_FOUND' | 'RESOURCE_NOT_OWNED'; readonly candidates: readonly ResolvableEntity[]; readonly question: SlotQuestion };

export type ConversationToolName =
  | 'resolveEntities'
  | 'getFinancialSnapshot'
  | 'getGrowthOpportunities'
  | 'getGrowthPlan'
  | 'getGrowthScenarios'
  | 'getFxQuote'
  | 'getMarketData'
  | 'checkExchangeEligibility'
  | 'createPaymentProposal'
  | 'createFxProposal'
  | 'createGrowthProposal'
  | 'createExchangeProposal'
  | 'modifyProposal'
  | 'getProposalStatus'
  | 'getExecutionStatus';

export type ConversationToolResult = {
  readonly tool: ConversationToolName;
  readonly ok: boolean;
  readonly value: Readonly<Record<string, unknown>>;
  readonly mayExecute: false;
  readonly source: StatementSourceKind;
  readonly uncertainty: UncertaintyClass;
};

export type DomainProposalRef = {
  readonly proposalId: string;
  readonly version: number;
  readonly kind: ActionCardType;
  readonly contentHash: string;
  readonly supersedesProposalId: string | null;
  readonly serverIssued: true;
  readonly clientFabricated: false;
  readonly amount: MoneyTerm;
  readonly fees: MoneyTerm;
  readonly rate?: MoneyTerm;
  readonly destinationLabel: string;
  readonly sourceLabel: string;
  readonly assetLabel: string;
  readonly riskSummary: string;
  readonly expiry: UtcInstant;
  readonly requiresStepUp: boolean;
  readonly requiresAcknowledgements: boolean;
  readonly executionAuthorityId: null;
};

export type HumanApprovalRecord = {
  readonly approvalId: string;
  readonly actionId: string;
  readonly proposalId: string;
  readonly proposalVersion: number;
  readonly userId: string;
  readonly sessionId: string;
  readonly deviceId: string | null;
  readonly timestamp: UtcInstant;
  readonly authenticationAssurance: 'AAL1' | 'STEP_UP_SATISFIED';
  readonly acknowledgements: readonly string[];
  readonly originatedFromAgent: false;
  readonly actorKind: 'HUMAN';
};

export type ActionCardFinancialTerms = {
  readonly amount: MoneyTerm;
  readonly fees: MoneyTerm;
  readonly rate: MoneyTerm | null;
  readonly source: string;
  readonly destination: string;
  readonly asset: string;
};

export type ActionCard = {
  readonly schema: 'sunrey.consumer.action-card.v1';
  readonly actionId: string;
  readonly proposalId: string | null;
  readonly proposalVersion: number | null;
  readonly type: ActionCardType;
  readonly title: string;
  readonly summary: string;
  readonly financialTerms: ActionCardFinancialTerms;
  readonly fees: MoneyTerm;
  readonly risk: string;
  readonly expiry: UtcInstant;
  readonly approvalRequirement: 'CUSTOMER_CONFIRMATION' | 'STEP_UP_AUTHENTICATION' | 'MANUAL_REVIEW';
  readonly stepUpRequirement: boolean;
  readonly status: ActionCardStatus;
  readonly availableActions: readonly AvailableActionControl[];
  readonly productionMoneyMovement: false;
  readonly agentIsApprover: false;
};

export type GroundedExplanation = {
  readonly schema: 'sunrey.agent.explanation.v1';
  readonly actionId: string;
  readonly why: string;
  readonly whatWillHappen: string;
  readonly amount: MoneyTerm;
  readonly fees: MoneyTerm;
  readonly rate: MoneyTerm | null;
  readonly risks: string;
  readonly liquidity: string;
  readonly timelineEstimate: { readonly text: string; readonly uncertainty: 'ESTIMATE' };
  readonly alternatives: readonly string[];
  readonly whyApprovalIsRequired: string;
  readonly whatDataWasUsed: readonly {
    readonly statement: string;
    readonly source: StatementSourceKind;
    readonly uncertainty: UncertaintyClass;
    readonly clientVisibleSource: string;
  }[];
  readonly inventedByModel: false;
  readonly unsupportedNumericClaims: false;
};

export type ActionHistoryEntry = {
  readonly at: UtcInstant;
  readonly kind:
    | 'INTENT_CLASSIFIED'
    | 'SLOT_ASKED'
    | 'ENTITY_RESOLVED'
    | 'PROPOSAL_CREATED'
    | 'PROPOSAL_MODIFIED'
    | 'PROPOSAL_SUPERSEDED'
    | 'APPROVED'
    | 'REJECTED'
    | 'STEP_UP_REQUIRED'
    | 'EXECUTION_STARTED'
    | 'STATUS'
    | 'COMPLETED'
    | 'FAILED'
    | 'REFUSED';
  readonly summary: string;
  readonly status: ActionCardStatus | null;
  readonly refs: readonly string[];
};

export type ConversationEvent = {
  readonly seq: number;
  readonly conversationId: string;
  readonly actionId: string | null;
  readonly at: UtcInstant;
  readonly kind:
    | 'MESSAGE'
    | 'TOOL_PROGRESS'
    | 'ACTION_CARD'
    | 'STATUS'
    | 'EXPLANATION'
    | 'NOTIFICATION';
  readonly payload: Readonly<Record<string, unknown>>;
};

export type SafeNotification = {
  readonly notificationId: string;
  readonly kind:
    | 'PROPOSAL_AWAITING_APPROVAL'
    | 'EXECUTION_COMPLETED'
    | 'EXECUTION_FAILED'
    | 'COMPLIANCE_REVIEW_REQUIRED'
    | 'PLAN_MONITORING_OPPORTUNITY';
  readonly title: string;
  readonly body: string;
  readonly actionId: string | null;
  readonly sensitiveDataIncluded: false;
  readonly channelSafe: true;
};

export type ConversationMessage = {
  readonly messageId: string;
  readonly role: 'USER' | 'AGENT' | 'SYSTEM';
  readonly text: string;
  readonly at: UtcInstant;
  readonly languagePhase:
    | 'UNDERSTANDING'
    | 'COLLECTING'
    | 'PROPOSAL_CREATED'
    | 'EXPLAINING'
    | 'AWAITING_APPROVAL'
    | 'STEP_UP'
    | 'APPROVED'
    | 'SUBMITTED'
    | 'COMPLETED'
    | 'FAILED'
    | 'REFUSED';
  readonly claimsCompletion: false;
};

export type ConversationSession = {
  readonly conversationId: string;
  readonly subjectId: string;
  readonly createdAt: UtcInstant;
  readonly intent: ConversationIntent | null;
  readonly slots: Readonly<Record<string, SlotValue>>;
  readonly activeActionId: string | null;
  readonly messages: readonly ConversationMessage[];
};

export type ConversationalAction = {
  readonly actionId: string;
  readonly conversationId: string;
  readonly subjectId: string;
  readonly intent: ConversationIntent;
  readonly type: ActionCardType;
  readonly status: ActionCardStatus;
  readonly proposal: DomainProposalRef | null;
  readonly card: ActionCard;
  readonly explanation: GroundedExplanation | null;
  readonly history: readonly ActionHistoryEntry[];
  readonly approval: HumanApprovalRecord | null;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
};

export type ConversationRefusal = {
  readonly ok: false;
  readonly code: ConversationRefusalCode;
  readonly message: string;
  readonly agentIsApprover: false;
  readonly productionMoneyMovement: false;
};

export type ConversationTurnResult = {
  readonly ok: true;
  readonly conversation: ConversationSession;
  readonly action: ConversationalAction | null;
  readonly card: ActionCard | null;
  readonly questions: readonly SlotQuestion[];
  readonly events: readonly ConversationEvent[];
  readonly notification: SafeNotification | null;
  readonly languagePhase: ConversationMessage['languagePhase'];
  readonly agentIsApprover: false;
  readonly productionMoneyMovement: false;
};

export type ActionCenterItem = {
  readonly actionId: string;
  readonly type: ActionCardType;
  readonly title: string;
  readonly status: ActionCardStatus;
  readonly view: ActionCenterView;
  readonly proposalId: string | null;
  readonly updatedAt: UtcInstant;
  readonly availableActions: readonly AvailableActionControl[];
};

export type ConversationCatalog = {
  readonly subjectId: string;
  readonly accounts: readonly ResolvableEntity[];
  readonly beneficiaries: readonly ResolvableEntity[];
  readonly holdings: readonly ResolvableEntity[];
  readonly cards: readonly ResolvableEntity[];
  readonly goals: readonly ResolvableEntity[];
  readonly assets: readonly ResolvableEntity[];
};
