/**
 * Typed Consumer BFF payment resources (`/api/v1`).
 * Matches services/api + packages/payments platform resources.
 * Browser-safe. No Ledger, Kernel, or Execution Authority types.
 */

export const BFF_PAYMENT_STATUSES = [
  'DRAFT',
  'QUOTED',
  'AWAITING_APPROVAL',
  'AWAITING_STEP_UP_AUTH',
  'AWAITING_COMPLIANCE',
  'AUTHORIZED',
  'QUEUED',
  'SUBMITTED',
  'PROCESSING',
  'SETTLED',
  'FAILED',
  'CANCELLED',
  'RETURNED',
  'REVERSED',
] as const;
export type PaymentStatus = (typeof BFF_PAYMENT_STATUSES)[number];

export const RECIPIENT_DESTINATION_TYPES = [
  'SUNREY_USER',
  'DOMESTIC_BANK',
  'INTERNATIONAL_BANK',
  'WALLET',
] as const;
export type RecipientDestinationType = (typeof RECIPIENT_DESTINATION_TYPES)[number];

export const GROW_OPPORTUNITY_STATUSES = [
  'DETECTED',
  'ELIGIBLE',
  'INELIGIBLE',
  'PRESENTED',
  'DISMISSED',
  'ACCEPTED_FOR_PROPOSAL',
  'EXPIRED',
  'SUPERSEDED',
  'COMPLETED',
] as const;
export type GrowOpportunityStatus = (typeof GROW_OPPORTUNITY_STATUSES)[number];

export type GrowOpportunityCard = {
  readonly card: string;
  readonly opportunityId: string;
  readonly title: string;
  readonly summary: string;
  readonly category: string;
  readonly status: GrowOpportunityStatus;
  readonly eligible: boolean;
  readonly priority: number;
  readonly currency: string;
  readonly achievementPromised: false;
  readonly immediatelyExecutable: false;
};

export type GrowOpportunityFeed = {
  readonly schema: 'sunrey.consumer.grow.opportunities.v1';
  readonly generatedAt: string;
  readonly rankingVersion: string;
  readonly productionMoneyMovement: false;
  readonly items: readonly GrowOpportunityCard[];
  readonly suppressedCount: number;
};

export type GrowProposalReceipt = {
  readonly opportunityId: string;
  readonly proposalId: string;
  readonly status: 'ACCEPTED_FOR_PROPOSAL';
  readonly executesMoney: false;
  readonly productionMoneyMovement: false;
};

export type MoneyResource = {
  readonly minorUnits: string;
  readonly currency: string;
};

export type Recipient = {
  readonly id: string;
  readonly ownerId: string;
  readonly displayName: string;
  readonly destinationType: RecipientDestinationType;
  readonly country: string;
  readonly currency: string;
  readonly displayHint: string;
  readonly relationship: string | null;
  readonly purpose: string | null;
  readonly verificationStatus: 'PENDING' | 'ACTIVE' | 'REVIEW' | 'BLOCKED' | 'DISABLED';
  readonly screeningStatus: string;
  readonly createdAt: string;
};

export type PaymentQuote = {
  readonly quoteId: string;
  readonly sourceAmount: MoneyResource;
  readonly destinationAmount: MoneyResource | null;
  readonly currency: string;
  readonly fees: readonly { readonly code: string; readonly amount: MoneyResource; readonly description: string }[];
  readonly amountDebited: MoneyResource;
  readonly fx: { readonly rateLabel: string | null; readonly rateSource: string; readonly reference: string } | null;
  readonly estimatedRoute: {
    readonly railPreference: string;
    readonly paymentType: string;
    readonly corridorId: string | null;
  };
  readonly estimatedDeliveryClass: string;
  readonly settlementTimePromise: null;
  readonly requiredApprovals: readonly string[];
  readonly complianceState: string;
  readonly expiresAt: string;
  readonly productionMoneyMovement: false;
};

export type Payment = {
  readonly paymentId: string;
  readonly payerId: string;
  readonly sourceAccountId: string;
  readonly beneficiaryId: string | null;
  readonly destination: {
    readonly type: string;
    readonly accountId: string | null;
    readonly displayHint: string;
  };
  readonly amount: MoneyResource;
  readonly destinationAmount: MoneyResource;
  readonly currency: string;
  readonly paymentType: string;
  readonly railPreference: string;
  readonly purpose: string;
  readonly reference: string;
  readonly fees: readonly { readonly code: string; readonly amount: MoneyResource; readonly description: string }[];
  readonly fx: { readonly rateLabel: string | null; readonly rateSource: string; readonly reference: string } | null;
  readonly status: PaymentStatus;
  readonly createdAt: string;
  readonly expiresAt: string | null;
  readonly providerReference: string | null;
  readonly idempotencyKey: string;
  readonly approvalId: string | null;
  readonly workflowId: string | null;
  readonly productionMoneyMovement: false;
};

export type PaymentApproval = {
  readonly approvalId: string;
  readonly paymentId: string;
  readonly status: 'PENDING' | 'APPROVED' | 'REJECTED';
  readonly createdAt: string;
  readonly decidedAt: string | null;
};

export type RecipientCreateInput = {
  readonly accountId: string;
  readonly displayName: string;
  readonly destinationType?: RecipientDestinationType;
  readonly destinationAccountId?: string;
  readonly scheme?: string;
  readonly accountNumber?: string;
  readonly country?: string;
  readonly currency?: string;
  readonly kind?: 'PERSON' | 'BUSINESS';
  readonly relationship?: string;
  readonly purpose?: string;
};

export type PaymentQuoteInput = {
  readonly sourceAccountId: string;
  readonly amountMinorUnits: string;
  readonly currency: string;
  readonly beneficiaryId?: string;
  readonly destinationAccountId?: string;
  readonly railPreference?: string;
  readonly purpose?: string;
};

export type PaymentCreateInput = {
  readonly sourceAccountId: string;
  readonly amountMinorUnits: string;
  readonly currency: string;
  readonly beneficiaryId?: string;
  readonly destinationAccountId?: string;
  readonly quoteId?: string;
  readonly purpose?: string;
  readonly reference?: string;
  readonly paymentId?: string;
  readonly approveNow?: boolean;
  readonly stepUpSatisfied?: boolean;
};

/**
 * Typed Consumer BFF account / balance / activity models.
 * Matches services/api Consumer BFF and api/sunrey-consumer-bff-v1.openapi.yaml.
 * Browser-safe. No Ledger, Kernel, or Execution Authority types.
 */

export const FINANCIAL_ACCOUNT_LIFECYCLES = [
  'PENDING',
  'ACTIVE',
  'RESTRICTED',
  'FROZEN',
  'CLOSING',
  'CLOSED',
] as const;
export type FinancialAccountLifecycle = (typeof FINANCIAL_ACCOUNT_LIFECYCLES)[number];

export const FINANCIAL_PRODUCT_TYPES = [
  'CASH_ACCOUNT',
  'CHECKING_PAYMENT',
  'SAVINGS',
  'MULTI_CURRENCY',
  'INVESTMENT_CASH',
  'EXCHANGE_CASH',
] as const;
export type FinancialProductType = (typeof FINANCIAL_PRODUCT_TYPES)[number];

export const CONSUMER_ACTIVITY_STATUSES = [
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'REVERSED',
  'CANCELLED',
  'ACTION_REQUIRED',
] as const;
export type ConsumerActivityStatus = (typeof CONSUMER_ACTIVITY_STATUSES)[number];

export type MoneyView = {
  readonly currency: string;
  readonly minorUnits: string;
};

export type AccountBalanceView = {
  readonly posted: MoneyView;
  readonly ledger: MoneyView;
  readonly available: MoneyView;
  readonly held: MoneyView;
  readonly pending: MoneyView;
  readonly currency: string;
};

export type ConsumerAccount = {
  readonly id: string;
  readonly productType: FinancialProductType | string;
  readonly status: FinancialAccountLifecycle | string;
  readonly domainStatus: string;
  readonly currency: string;
  readonly openedAt: string;
  readonly closedAt: string | null;
  readonly restrictions: readonly string[];
  readonly productConfiguration: {
    readonly licensingClaim: 'NOT_A_LICENSED_BANK_ACCOUNT';
    readonly environment: 'simulation';
    readonly liveBanking: false;
  };
};

export type ConsumerActivity = {
  readonly activityId: string;
  readonly type: string;
  readonly direction: string;
  readonly amount: MoneyView;
  readonly currency: string;
  readonly status: ConsumerActivityStatus | string;
  readonly counterpartyDisplay: string | null;
  readonly description: string;
  readonly occurredAt: string;
  readonly completedAt: string | null;
  readonly category: string;
  readonly relatedActionId: string | null;
  readonly fee?: MoneyView | null;
};

export const GROW_EXECUTION_STATES = [
  'AUTHORIZED',
  'QUEUED',
  'SUBMITTED',
  'PROCESSING',
  'PARTIALLY_COMPLETED',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'REVERSED',
  'REQUIRES_REVIEW',
] as const;
export type GrowExecutionState = (typeof GROW_EXECUTION_STATES)[number];

export type GrowExecutionProposal = {
  readonly proposalId: string;
  readonly version: number;
  readonly state: string;
  readonly amount: MoneyResource;
  readonly serverOwned: true;
  readonly clientInstructionsTrusted: false;
  readonly productionMoneyMovement: false;
  readonly executionAuthorityId: null;
  readonly guaranteedOutcome?: false;
};

export type GrowExecution = {
  readonly executionId: string;
  readonly state: GrowExecutionState | string;
  readonly submittedIsNotCompleted: boolean;
  readonly productionMoneyMovement: false;
};

export const GROW_PLAN_STATUSES = [
  'DRAFT',
  'PROPOSED',
  'ACTIVE',
  'PAUSED',
  'SUPERSEDED',
  'COMPLETED',
  'CANCELLED',
] as const;
export type GrowPlanStatus = (typeof GROW_PLAN_STATUSES)[number];

export const GROW_PROPOSAL_STATUSES = [
  'DRAFT',
  'READY',
  'PRESENTED',
  'AWAITING_APPROVAL',
  'AWAITING_STEP_UP',
  'AWAITING_COMPLIANCE',
  'APPROVED',
  'EXECUTING',
  'EXECUTED',
  'REJECTED',
  'EXPIRED',
  'FAILED',
  'CANCELLED',
  'SUPERSEDED',
] as const;
export type GrowProposalStatus = (typeof GROW_PROPOSAL_STATUSES)[number];

export const GROW_RISK_PROFILES = ['CONSERVATIVE', 'BALANCED', 'GROWTH'] as const;
export type GrowRiskProfile = (typeof GROW_RISK_PROFILES)[number];

export type GrowPlanCreateInput = {
  readonly startingCapitalMinorUnits: string;
  readonly currency: string;
  readonly timeHorizonMonths: number;
  readonly riskProfile: GrowRiskProfile;
  readonly goalTargetMinorUnits?: string;
  readonly recurringContributionMinorUnits?: string;
  readonly liquidityRequirementMinorUnits?: string;
  readonly sourceAccountId?: string;
  readonly goalRefs?: readonly string[];
};

export type GrowPlan = {
  readonly planId: string;
  readonly ownerId: string;
  readonly status: GrowPlanStatus;
  readonly riskProfile: GrowRiskProfile;
  readonly timeHorizonMonths: number;
  readonly guaranteedOutcome: false;
  readonly productionActive: false;
  readonly primaryProposal?: { readonly proposalId: string } | null;
};

export type GrowPlanProposal = {
  readonly proposalId: string;
  readonly planId: string;
  readonly status: GrowProposalStatus;
  readonly amount: MoneyResource;
  readonly guaranteedOutcome: false;
  readonly issuedAuthority: null;
  readonly executionAuthorityId: null;
  readonly serverIssued: true;
};
export type GrowProductProposal = GrowPlanProposal;
export type GrowProposal = GrowPlanProposal;

export type GrowMoney = {
  readonly minorUnits: string;
  readonly currency: string;
};

export type GrowProfile = {
  readonly schema: 'sunrey.grow.profile.v1';
  readonly subjectId: string;
  readonly generatedAt: string;
  readonly netPositionByCurrency: readonly { readonly amount: GrowMoney }[];
  readonly cash: readonly { readonly amount: GrowMoney }[];
  readonly investments: readonly unknown[];
  readonly income: readonly { readonly amount: GrowMoney }[];
  readonly expenses: readonly { readonly amount: GrowMoney }[];
  readonly goals: readonly GrowGoal[];
  readonly riskProfile: GrowSuitability | null;
  readonly liquidity: readonly { readonly amount: GrowMoney }[];
  readonly financialStrengths: readonly string[];
  readonly areasToImprove: readonly string[];
  readonly authoritativeBalance: false;
  readonly ledgerWins: true;
};

export type GrowGoal = {
  readonly goalId: string;
  readonly name: string;
  readonly goalKind: string;
  readonly targetAmount: GrowMoney;
  readonly currency: string;
  readonly targetDate: string | null;
  readonly priority: number;
  readonly status: 'ACTIVE' | 'PAUSED' | 'ACHIEVED' | 'CANCELLED';
};

export type GrowGoalCreateInput = {
  readonly goalKind: string;
  readonly name: string;
  readonly targetMinorUnits: string;
  readonly currency: string;
  readonly priority?: number;
  readonly targetDate?: string;
};

export type GrowInsight = {
  readonly insightId: string;
  readonly type: string;
  readonly severity: string;
  readonly evidence: readonly string[];
  readonly calculatedAt: string;
  readonly confidence: 'DERIVED';
  readonly recommendation: null;
};

export type GrowSuitability = {
  readonly questionnaireVersion: string;
  readonly riskTolerance: string;
  readonly riskCapacity: string;
  readonly timeHorizon: string;
  readonly liquidityNeed: string;
  readonly method: 'DETERMINISTIC_QUESTIONNAIRE';
  readonly llmFabricated: false;
};

export type GrowSnapshot = {
  readonly snapshotId: string;
  readonly subjectId: string;
  readonly generatedAt: string;
  readonly cash: readonly { readonly amount: GrowMoney }[];
  readonly financialGoals: readonly GrowGoal[];
  readonly insights: readonly GrowInsight[];
  readonly crossCurrencyTotal: null;
  readonly authoritativeBalance: false;
  readonly ledgerWins: true;
  readonly guaranteedReturn: false;
};

export type AccountStatementData = {
  readonly statementId: string;
  readonly accountId: string;
  readonly currency: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly opening: MoneyView;
  readonly closing: MoneyView;
  readonly transactions: readonly {
    readonly postedAt: string;
    readonly direction: string;
    readonly amount: MoneyView;
    readonly description: string;
    readonly reference: string;
  }[];
};

export type AgentResource = {
  readonly agentId: string;
  readonly ownerId: string;
  readonly agentType: string;
  readonly name: string;
  readonly status: string;
  readonly createdAt: string;
  readonly mandateId: string | null;
  readonly isCustomer: false;
  readonly isFinancialAuthority: false;
};

export type AgentConversationResource = {
  readonly conversationId: string;
  readonly agentId: string;
  readonly title: string;
  readonly status: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly contextVersion: number;
  readonly isFinancialRecord: false;
};

export type AgentMemoryResource = {
  readonly memoryId: string;
  readonly category: string;
  readonly content: string;
  readonly source: string;
  readonly userEditable: boolean;
};

export type AgentMessageResponse = {
  readonly conversationId: string;
  readonly userMessage: { readonly role: string; readonly content: string };
  readonly agentMessage: { readonly role: string; readonly content: string } | null;
  readonly stream: readonly { readonly kind: string; readonly text: string }[];
  readonly financialStateChanged: false;
  readonly executionCompleted: false;
};

/**
 * Grow My Money portfolio views. Authoritative values come from
 * packages/investments. Frontend math is not authoritative.
 * Not a live securities brokerage.
 */
export type GrowPortfolioMoney = {
  readonly minorUnits: string;
  readonly currency: string;
};

export type GrowPortfolio = {
  readonly schema: 'sunrey.grow.portfolio.v1';
  readonly portfolioId: string;
  readonly ownerId: string;
  readonly status: string;
  readonly baseCurrency: string;
  readonly displayCurrency: string;
  readonly strategyRef: string | null;
  readonly riskProfileRef: string | null;
  readonly goalLinks: readonly string[];
  readonly restrictions: readonly string[];
  readonly cash: GrowMoney;
  readonly invested: GrowMoney;
  readonly total: GrowMoney;
  readonly environment: 'simulation';
  readonly liveState: false;
  readonly securitiesBrokerageLive: false;
  readonly authoritativeCalculator: 'INVESTMENT_PLATFORM';
  readonly frontendMathAuthoritative: false;
  readonly liveInvestmentExecution: false;
};

export type GrowHoldings = {
  readonly schema: 'sunrey.grow.holdings.v1';
  readonly portfolioId: string;
  readonly holdings: readonly {
    readonly instrumentId: string;
    readonly identifier: string;
    readonly displayName: string;
    readonly assetClass: string;
    readonly quantityUnits: string;
    readonly averageCost: GrowMoney;
    readonly remainingCost: GrowMoney;
    readonly marketPriceMinorUnits: string | null;
    readonly marketValue: GrowMoney | null;
    readonly unrealized: GrowMoney | null;
    readonly realized: GrowMoney;
    readonly income: GrowMoney;
    readonly currency: string;
    readonly valuation: {
      readonly source: string;
      readonly timestamp: string;
      readonly freshnessMs: string;
      readonly quality: string;
      readonly stale: boolean;
    };
  }[];
  readonly frontendMathAuthoritative: false;
};

export type GrowPerformance = {
  readonly schema: 'sunrey.grow.performance.v1';
  readonly methodology: string;
  readonly formula: string;
  readonly absoluteReturn: GrowMoney;
  readonly periodReturnBps: string | null;
  readonly realized: GrowMoney;
  readonly unrealized: GrowMoney;
  readonly income: GrowMoney;
  readonly cashFlows: readonly { readonly at: string; readonly kind: string; readonly amount: GrowMoney }[];
  readonly benchmark: { readonly benchmarkId: string; readonly periodReturnBps: string; readonly deltaBps: string | null } | null;
  readonly insufficientData: boolean;
  readonly llmAuthoritative: false;
  readonly frontendMathAuthoritative: false;
  readonly depositsAreNotPerformance: true;
};

export type GrowAllocation = {
  readonly schema: 'sunrey.grow.allocation.v1';
  readonly actual: {
    readonly byAssetClass: readonly { readonly key: string; readonly weightBps: string; readonly marketValue: GrowMoney }[];
    readonly byInstrument: readonly { readonly key: string; readonly weightBps: string; readonly marketValue: GrowMoney }[];
    readonly byCurrency: readonly { readonly key: string; readonly weightBps: string; readonly marketValue: GrowMoney }[];
    readonly byRiskClass: readonly { readonly key: string; readonly weightBps: string; readonly marketValue: GrowMoney }[];
  };
  readonly target: {
    readonly cashTargetBps: string;
    readonly weights: readonly { readonly key: string; readonly weightBps: string }[];
  } | null;
  readonly frontendMathAuthoritative: false;
};

export type GrowRisk = {
  readonly schema: 'sunrey.grow.risk.v1';
  readonly concentration: { readonly largestInstrumentId: string | null; readonly largestWeightBps: string };
  readonly drawdownBps: string | null;
  readonly volatilityBps: string | null;
  readonly volatilityAvailable: boolean;
  readonly currencyExposure: readonly { readonly currency: string; readonly weightBps: string }[];
  readonly liquidityExposure: readonly { readonly liquidity: string; readonly weightBps: string }[];
  readonly assetClassExposure: readonly { readonly assetClass: string; readonly weightBps: string }[];
  readonly fabricatedStatistics: false;
  readonly frontendMathAuthoritative: false;
};

export const CONVERSATION_INTENTS = [
  'INFORMATION_REQUEST',
  'FINANCIAL_ANALYSIS',
  'PAYMENT_REQUEST',
  'FX_REQUEST',
  'GROWTH_REQUEST',
  'INVESTMENT_REQUEST',
  'EXCHANGE_REQUEST',
  'WITHDRAWAL_REQUEST',
  'CARD_MANAGEMENT',
  'GOAL_MANAGEMENT',
  'DATA_PERMISSION_REQUEST',
  'SUPPORT_REQUEST',
  'PROPOSAL_MODIFICATION',
] as const;
export type ConversationIntent = (typeof CONVERSATION_INTENTS)[number];

export const ACTION_CARD_TYPES = [
  'PAYMENT',
  'FX',
  'GROWTH',
  'INVESTMENT',
  'EXCHANGE',
  'WITHDRAWAL',
  'CARD_CONTROL',
] as const;
export type ActionCardType = (typeof ACTION_CARD_TYPES)[number];

export const ACTION_CENTER_VIEWS = [
  'AWAITING_APPROVAL',
  'PROCESSING',
  'COMPLETED',
  'REJECTED',
  'EXPIRED',
  'REQUIRES_ATTENTION',
] as const;
export type ActionCenterView = (typeof ACTION_CENTER_VIEWS)[number];

export type ActionCard = {
  readonly schema: 'sunrey.consumer.action-card.v1';
  readonly actionId: string;
  readonly proposalId: string | null;
  readonly type: ActionCardType | string;
  readonly title: string;
  readonly summary: string;
  readonly status: string;
  readonly availableActions: readonly string[];
  readonly stepUpRequirement: boolean;
  readonly productionMoneyMovement: false;
  readonly agentIsApprover: false;
};

export type ConversationTurn = {
  readonly schema: 'sunrey.consumer.conversation-turn.v1';
  readonly conversationId: string;
  readonly languagePhase: string;
  readonly questions: readonly { readonly slot: string; readonly prompt: string }[];
  readonly card: ActionCard | null;
  readonly action: { readonly actionId: string; readonly status: string; readonly proposalId: string | null } | null;
  readonly explanation: Readonly<Record<string, unknown>> | null;
  readonly agentIsApprover: false;
  readonly productionMoneyMovement: false;
};

export const WALLET_STATUSES = ['PENDING', 'ACTIVE', 'RESTRICTED', 'FROZEN', 'CLOSED'] as const;
export type WalletStatus = (typeof WALLET_STATUSES)[number];

export const CUSTODY_MODELS = ['SUNREY_NATIVE', 'EXTERNAL_CUSTODY', 'INTERNAL_OPERATIONAL'] as const;
export type CustodyModel = (typeof CUSTODY_MODELS)[number];

export const CLIENT_FINALITY_STATES = [
  'PENDING',
  'BROADCAST',
  'CONFIRMING',
  'FINALIZED',
  'FAILED',
  'REVIEW',
] as const;
export type ClientFinalityState = (typeof CLIENT_FINALITY_STATES)[number];

export const TRAVEL_RULE_CUSTOMER_STATES = [
  'NOT_REQUIRED',
  'ADDITIONAL_INFORMATION_REQUIRED',
  'PROCESSING',
  'COMPLETE',
  'REVIEW',
] as const;
export type TravelRuleCustomerState = (typeof TRAVEL_RULE_CUSTOMER_STATES)[number];

export type ConsumerWallet = {
  readonly schema: 'sunrey.consumer.wallet.v1';
  readonly walletId: string;
  readonly ownerId: string;
  readonly assetId: string;
  readonly networkId: string;
  readonly custodyModel: CustodyModel;
  readonly status: WalletStatus;
  readonly withdrawalEnabled: boolean;
  readonly addressRefs: readonly string[];
  readonly balance: {
    readonly totalMinorUnits: string;
    readonly availableMinorUnits: string;
    readonly pendingMinorUnits: string;
    readonly assetId: string;
    readonly providerBalanceIsTruth: false;
    readonly blendedReturn: null;
  };
  readonly providerRef: string | null;
  readonly createdAt: string;
  readonly productionSigningAuthorized: false;
  readonly productionMoneyMovement: false;
};

export type DepositAddress = {
  readonly schema: 'sunrey.consumer.deposit-address.v1';
  readonly addressId: string;
  readonly walletId: string;
  readonly address: string;
  readonly networkId: string;
  readonly assetId: string;
  readonly qrPayload: string;
  readonly createdAt: string;
};

export type WalletTransaction = {
  readonly schema: 'sunrey.consumer.wallet-transaction.v1';
  readonly transactionId: string;
  readonly walletId: string;
  readonly kind: string;
  readonly amountMinorUnits: string;
  readonly finality: ClientFinalityState;
  readonly travelRule: TravelRuleCustomerState;
  readonly createdAt: string;
  readonly txRef: string | null;
};

export type WithdrawalQuote = {
  readonly schema: 'sunrey.consumer.withdrawal-quote.v1';
  readonly quoteId: string;
  readonly walletId: string;
  readonly destination: string;
  readonly amountMinorUnits: string;
  readonly travelRule: TravelRuleCustomerState;
  readonly requiredApproval: string;
  readonly expiresAt: string;
  readonly estimate: true;
  readonly productionMoneyMovement: false;
};

export type WithdrawalResource = {
  readonly schema: 'sunrey.consumer.withdrawal.v1';
  readonly withdrawalId: string;
  readonly walletId: string;
  readonly amountMinorUnits: string;
  readonly finality: ClientFinalityState;
  readonly travelRule: TravelRuleCustomerState;
  readonly status: string;
  readonly originatedFromAgent: boolean;
  readonly productionSigningAuthorized: false;
  readonly productionMoneyMovement: false;
};

export type AssetDetail = {
  readonly schema: 'sunrey.consumer.asset-detail.v1';
  readonly assetId: string;
  readonly displayName: string;
  readonly wallet: ConsumerWallet | null;
  readonly eligibility: {
    readonly depositAvailable: boolean;
    readonly withdrawalAvailable: boolean;
    readonly exchangeAvailable: boolean;
  };
  readonly productionMoneyMovement: false;
};

export type WithdrawalQuoteInput = {
  readonly destination: string;
  readonly amountMinorUnits: string;
  readonly networkId?: string;
};

export type WithdrawalCreateInput = {
  readonly quoteId?: string;
  readonly destination?: string;
  readonly amountMinorUnits?: string;
  readonly stepUpSatisfied?: boolean;
  readonly originatedFromAgent?: boolean;
};

export type VaultHome = {
  readonly schema: 'sunrey.consumer.vault.home.v1';
  readonly fabric: string;
  readonly ownerSubjectId: string;
  readonly recordCount: number;
  readonly categoryCount: number;
  readonly sourceCount: number;
  readonly disputedCount: number;
  readonly productionActive: false;
  readonly liveMonetizationEnabled: false;
  readonly sunreyOwnsUserData: false;
};

export type VaultCategory = {
  readonly categoryId: string;
  readonly label: string;
  readonly classification: string;
  readonly availability: string;
  readonly ingestEnabled: boolean;
  readonly agentAccessEligible: boolean;
  readonly shareability: string;
  readonly liveMonetizationEnabled: false;
};

export type VaultCategories = {
  readonly schema: 'sunrey.consumer.vault.categories.v1';
  readonly version: string;
  readonly productionActive: false;
  readonly liveMonetizationEnabled: false;
  readonly items: readonly VaultCategory[];
};

export type VaultRecord = {
  readonly schema: 'sunrey.vault.data-record.v1';
  readonly dataRecordId: string;
  readonly ownerSubjectId: string;
  readonly dataCategory: string;
  readonly dataKind: string;
  readonly verificationState: string;
  readonly classification: string;
  readonly status: string;
  readonly productionActive: false;
};

export type VaultRecords = {
  readonly schema: 'sunrey.consumer.vault.records.v1';
  readonly items: readonly VaultRecord[];
  readonly productionActive: false;
};

export type VaultExportJob = {
  readonly exportId: string;
  readonly subjectId: string;
  readonly status: 'REQUESTED' | 'COMPLETED' | 'FAILED';
  readonly legalPortabilityClaim: false;
};

export type NativeEconomyOverview = {
  readonly schema: 'sunrey.consumer.native-economy.v1';
  readonly tickerStatus: 'NOT_ASSIGNED';
  readonly productionActive: false;
  readonly valuationIsNotMarketPrice: true;
  readonly sunrey: {
    readonly name: 'SunRey Coin';
    readonly protocolNative: true;
    readonly economicModel: string;
    readonly hinMetrics: { readonly available: false; readonly reason: string };
  };
  readonly moonrey: {
    readonly name: 'MoonRey Coin';
    readonly protocolNative: true;
    readonly economicModel: string;
    readonly approvedUnderlyingMetrics: readonly unknown[];
  };
};

export type NativeEconomySupply = {
  readonly schema: 'sunrey.consumer.native-economy.v1';
  readonly tickerStatus: 'NOT_ASSIGNED';
  readonly network: string;
  readonly policyVersion: string;
  readonly privilegedIssuanceEndpoints: readonly never[];
  readonly assets: readonly {
    readonly protocolStatus: string;
    readonly supply: {
      readonly totalSupply: string;
      readonly circulatingSupply: string;
      readonly issuedSupply: string;
    };
  }[];
};

export type ExchangeMarket = {
  readonly marketId: string;
  readonly instrument: string;
  readonly baseAssetId: string;
  readonly quoteAssetId: string;
  readonly state: string;
};

export type ExchangeMarkets = {
  readonly schema: 'sunrey.consumer.exchange.markets.v1';
  readonly productionTradingEnabled: false;
  readonly items: readonly ExchangeMarket[];
  readonly screens?: readonly string[];
};

export type ExchangeOrderPreview = {
  readonly previewId: string;
  readonly marketId: string;
  readonly instrument: string;
  readonly side: 'BUY' | 'SELL';
  readonly quantity: string;
  readonly estimatedPriceUnits: string | null;
  readonly guaranteedExecutionPrice: false;
  readonly productionTradingEnabled: false;
};

export type ExchangeOrderSubmit = {
  readonly accepted: true;
  readonly requiresExecution: true;
  readonly proposalId: string | null;
};

export type DataPermissionCatalog = {
  readonly schema: 'sunrey.consumer.data.permissions.v1';
  readonly termsVersion: string;
  readonly implicitMonetizationOptIn: false;
  readonly purposes: readonly {
    readonly purposeId: string;
    readonly necessity: 'REQUIRED_FOR_CORE_SERVICE' | 'OPTIONAL' | 'OPTIONAL_COMPENSATED';
    readonly granted: boolean;
    readonly requiredForBasicAccount: boolean;
  }[];
};

export type DataConsentGrant = {
  readonly grantId: string;
  readonly consentId: string;
  readonly purposeId: string;
  readonly dataCategories: readonly string[];
  readonly status: string;
  readonly termsVersion: string;
};

export type DataConsentList = {
  readonly schema: 'sunrey.consumer.data.consents.v1';
  readonly items: readonly DataConsentGrant[];
};

export type HinParticipation = {
  readonly state: 'NOT_ENROLLED' | 'ENROLLED' | 'PAUSED' | 'WITHDRAWN' | 'RESTRICTED';
  readonly financialServicesRemainOpen: true;
};

export type DataRightsRequestResource = {
  readonly requestId: string;
  readonly type: string;
  readonly state: string;
  readonly applicable: boolean;
};

export type ActionCenterList = {
  readonly schema: 'sunrey.consumer.action-center.v1';
  readonly view: string;
  readonly items: readonly {
    readonly actionId: string;
    readonly type: string;
    readonly title: string;
    readonly status: string;
    readonly view: string;
    readonly availableActions: readonly string[];
  }[];
  readonly productionMoneyMovement: false;
};
