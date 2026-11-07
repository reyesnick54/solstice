import type { CustomerId, UtcInstant } from '@solstice/domain';

import type {
  ExecutionDropCopyEventId,
  BrokerStatementSnapshotId,
  CustodyStatementSnapshotId,
  Exec12ReconciliationBreakId,
  Exec12ReconciliationRunId,
} from './ids.ts';
import type {
  Exec12ExecutionRestrictionReason,
  Exec12ExecutionRestrictionState,
  Exec12OperationalSeverity,
  ExecutionDropCopyIngestKind,
  ExecutionReconciliationBreakKind,
  HELIOS_EXEC12_SCHEMA,
} from './taxonomy.ts';

export type ExecutionDropCopyEvent = {
  readonly eventId: ExecutionDropCopyEventId;
  readonly schemaVersion: typeof HELIOS_EXEC12_SCHEMA;
  readonly ingestKind: ExecutionDropCopyIngestKind;
  readonly providerId: string;
  readonly brokerAccountId: string;
  readonly customerId: CustomerId;
  readonly brokerOrderId: string | null;
  readonly externalOperationId: string | null;
  readonly clientOrderId: string | null;
  readonly instrumentId: string | null;
  readonly quantityUnits: string | null;
  readonly priceMinorUnits: string | null;
  readonly feeMinorUnits: string | null;
  readonly cashDeltaMinorUnits: string | null;
  readonly currency: string | null;
  readonly settlementId: string | null;
  readonly corporateActionId: string | null;
  readonly providerTimestamp: UtcInstant;
  readonly ingestedAt: UtcInstant;
  readonly dedupeKey: string;
  readonly rawPayloadRef: string;
  readonly simulation: true;
  readonly liveBrokerConnected: false;
};

export type BrokerStatementOrderRow = {
  readonly brokerOrderId: string;
  readonly externalOperationId: string | null;
  readonly clientOrderId: string | null;
  readonly instrumentId: string;
  readonly side: 'BUY' | 'SELL';
  readonly quantityUnits: string;
  readonly filledQuantityUnits: string;
  readonly status: string;
};

export type BrokerStatementFillRow = {
  readonly brokerFillId: string;
  readonly brokerOrderId: string;
  readonly instrumentId: string;
  readonly quantityUnits: string;
  readonly priceMinorUnits: string;
  readonly feeMinorUnits: string;
  readonly currency: string;
};

export type BrokerStatementSnapshot = {
  readonly snapshotId: BrokerStatementSnapshotId;
  readonly schemaVersion: typeof HELIOS_EXEC12_SCHEMA;
  readonly providerId: string;
  readonly brokerAccountId: string;
  readonly customerId: CustomerId;
  readonly asOf: UtcInstant;
  readonly orders: readonly BrokerStatementOrderRow[];
  readonly fills: readonly BrokerStatementFillRow[];
  readonly positions: Readonly<Record<string, string>>;
  readonly cashMinorUnits: string;
  readonly currency: string;
  readonly feesTotalMinorUnits: string;
  readonly settlements: readonly BrokerStatementSettlementRow[];
  readonly simulation: true;
  readonly liveBrokerConnected: false;
};

export type BrokerStatementSettlementRow = {
  readonly settlementId: string;
  readonly brokerOrderId: string;
  readonly quantityUnits: string;
  readonly cashMinorUnits: string;
  readonly currency: string;
  readonly status: string;
};

export type CustodyStatementSnapshot = {
  readonly snapshotId: CustodyStatementSnapshotId;
  readonly schemaVersion: typeof HELIOS_EXEC12_SCHEMA;
  readonly custodianId: string;
  readonly custodyAccountId: string;
  readonly customerId: CustomerId;
  readonly asOf: UtcInstant;
  readonly positions: Readonly<Record<string, string>>;
  readonly cashMinorUnits: string;
  readonly currency: string;
  readonly settlements: readonly CustodyStatementSettlementRow[];
  readonly corporateActions: readonly CustodyCorporateActionRow[];
  readonly simulation: true;
  readonly liveCustodyConnected: false;
};

export type CustodyStatementSettlementRow = {
  readonly settlementId: string;
  readonly instrumentId: string;
  readonly quantityUnits: string;
  readonly cashMinorUnits: string;
  readonly currency: string;
  readonly status: string;
};

export type CustodyCorporateActionRow = {
  readonly corporateActionId: string;
  readonly instrumentId: string;
  readonly actionType: string;
  readonly quantityDeltaUnits: string;
};

export type ReconciliationBreakCore = {
  readonly breakId: Exec12ReconciliationBreakId;
  readonly runId: Exec12ReconciliationRunId;
  readonly kind: ExecutionReconciliationBreakKind;
  readonly severity: Exec12OperationalSeverity;
  readonly customerId: CustomerId;
  readonly accountId: string;
  readonly orderId: string | null;
  readonly instrumentId: string | null;
  readonly sunReyValue: string | null;
  readonly brokerValue: string | null;
  readonly custodyValue: string | null;
  readonly description: string;
  readonly evidenceRef: string;
  readonly detectedAt: UtcInstant;
  readonly ambiguousExternal: boolean;
  readonly autoFixAttempted: false;
};

export type ExecutionReconciliationBreak = ReconciliationBreakCore & {
  readonly domain: 'EXECUTION';
};

export type PositionReconciliationBreak = ReconciliationBreakCore & {
  readonly domain: 'POSITION';
};

export type CashReconciliationBreak = ReconciliationBreakCore & {
  readonly domain: 'CASH';
};

export type SettlementReconciliationBreak = ReconciliationBreakCore & {
  readonly domain: 'SETTLEMENT';
};

export type Exec12ReconciliationBreak =
  | ExecutionReconciliationBreak
  | PositionReconciliationBreak
  | CashReconciliationBreak
  | SettlementReconciliationBreak;

export type Exec12ThreeWayReconciliationRun = {
  readonly runId: Exec12ReconciliationRunId;
  readonly schemaVersion: typeof HELIOS_EXEC12_SCHEMA;
  readonly customerId: CustomerId;
  readonly accountId: string;
  readonly brokerSnapshotId: BrokerStatementSnapshotId | null;
  readonly custodySnapshotId: CustodyStatementSnapshotId | null;
  readonly matched: boolean;
  readonly breaks: readonly Exec12ReconciliationBreak[];
  readonly evidenceRef: string;
  readonly completedAt: UtcInstant;
};

export type Exec12CanonicalOrderView = {
  readonly orderId: string;
  readonly externalOperationId: string;
  readonly instrumentId: string;
  readonly quantityUnits: string;
  readonly filledQuantityUnits: string;
  readonly status: string;
};

export type Exec12CanonicalFillView = {
  readonly orderId: string;
  readonly providerFillId: string;
  readonly quantityUnits: string;
  readonly priceMinorUnits: string;
  readonly feeMinorUnits: string;
};

export type Exec12CanonicalAccountView = {
  readonly customerId: CustomerId;
  readonly accountId: string;
  readonly currency: string;
  readonly cashMinorUnits: string;
  readonly positions: Readonly<Record<string, string>>;
  readonly orders: readonly Exec12CanonicalOrderView[];
  readonly fills: readonly Exec12CanonicalFillView[];
  readonly settlementIds: readonly string[];
  readonly corporateActionIds: readonly string[];
};

export type Exec12ExecutionRestriction = {
  readonly customerId: CustomerId;
  readonly accountId: string;
  readonly state: Exec12ExecutionRestrictionState;
  readonly reasons: readonly Exec12ExecutionRestrictionReason[];
  readonly activeBreakIds: readonly Exec12ReconciliationBreakId[];
  readonly imposedAt: UtcInstant;
  readonly evidenceRef: string;
};

export type Exec12ReconciliationStoreSnapshot = {
  readonly dropCopyEvents: readonly ExecutionDropCopyEvent[];
  readonly brokerSnapshots: readonly BrokerStatementSnapshot[];
  readonly custodySnapshots: readonly CustodyStatementSnapshot[];
  readonly runs: readonly Exec12ThreeWayReconciliationRun[];
  readonly breaks: readonly Exec12ReconciliationBreak[];
  readonly restrictions: readonly Exec12ExecutionRestriction[];
};
