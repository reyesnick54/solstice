import type { UtcInstant } from '../../../domain/src/time.ts';

export type PaymentOpsView = {
  readonly paymentId: string;
  readonly customerId: string | null;
  readonly status: string;
  readonly exceptionClass: string | null;
  readonly providerStatus: string | null;
  readonly returnRef: string | null;
  readonly reversalRef: string | null;
  readonly beneficiaryReview: boolean;
  readonly providerMismatch: boolean;
  readonly amountMinor: string;
  readonly currency: string;
  readonly updatedAt: UtcInstant;
  readonly ledgerEditableByStaff: false;
};

export type TreasuryOpsView = {
  readonly providerId: string;
  readonly providerBalanceMinor: string;
  readonly currency: string;
  readonly settlementStatus: string;
  readonly liquidityMinor: string;
  readonly isCustomerLedgerBalance: false;
  readonly updatedAt: UtcInstant;
};

export type ReconciliationOpsView = {
  readonly breakId: string;
  readonly runId: string;
  readonly domain: string;
  readonly status: string;
  readonly severity: string;
  readonly amountMinor: string | null;
  readonly currency: string | null;
  readonly agedHours: number;
  readonly suspense: boolean;
  readonly dailyCloseId: string | null;
  readonly owner: string | null;
  readonly updatedAt: UtcInstant;
  readonly silentOverwriteForbidden: true;
};

export type SurveillanceOpsView = {
  readonly alertId: string;
  readonly kind: string;
  readonly marketId: string;
  readonly subjectRefs: readonly string[];
  readonly legalGuilt: false;
  readonly restrictionProposed: boolean;
  readonly restrictionApplied: false;
  readonly createdAt: UtcInstant;
};

export type CustodyOpsView = {
  readonly walletId: string;
  readonly status: string;
  readonly pendingDeposits: number;
  readonly pendingWithdrawals: number;
  readonly failedWithdrawals: number;
  readonly providerStatus: string;
  readonly chainTxRef: string | null;
  readonly travelRuleState: string | null;
  readonly analyticsRiskState: string | null;
  readonly reconciliationBreaks: number;
  readonly privateKeyMaterial: never | null;
  readonly updatedAt: UtcInstant;
};

export type ProviderOpsView = {
  readonly providerId: string;
  readonly environment: string;
  readonly lifecycle: string;
  readonly health: string;
  readonly circuitBreaker: string;
  readonly certification: boolean;
  readonly capabilities: readonly string[];
  readonly credentialReferenceStatus: 'PRESENT' | 'MISSING' | 'ROTATION_DUE';
  readonly webhookHealth: string;
  readonly lastError: string | null;
  readonly killSwitch: boolean;
  readonly rawCredential: never | null;
  readonly productionAuthorized: false;
  readonly updatedAt: UtcInstant;
};

export type AgentOpsView = {
  readonly agentId: string;
  readonly available: boolean;
  readonly modelProviderStatus: string;
  readonly toolFailures: number;
  readonly policyBlocks: number;
  readonly financialEscalations: number;
  readonly supportEscalations: number;
  readonly abusePatterns: readonly string[];
  readonly evidenceMutableByStaff: false;
  readonly updatedAt: UtcInstant;
};

export type SecurityOpsView = {
  readonly eventId: string;
  readonly kind: string;
  readonly subjectRef: string | null;
  readonly sessionRisk: string | null;
  readonly privileged: boolean;
  readonly providerAuthFailure: boolean;
  readonly repeatedDenial: boolean;
  readonly incidentId: string | null;
  readonly rawSecret: never | null;
  readonly occurredAt: UtcInstant;
};

export type SupportCustomerView = {
  readonly customerId: string;
  readonly displayId: string;
  readonly accountStatus: string;
  readonly productStatus: readonly string[];
  readonly recentActivitySafe: readonly string[];
  readonly openCaseIds: readonly string[];
  readonly providerActionStatus: string | null;
  readonly supportHistoryIds: readonly string[];
  readonly sensitiveKycVisible: boolean;
  readonly balancesVisible: boolean;
};
