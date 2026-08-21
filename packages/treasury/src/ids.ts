import type { Brand } from '../../domain/src/brand.ts';

export type TreasuryAccountId = Brand<string, 'TreasuryAccountId'>;
export type TreasuryPositionId = Brand<string, 'TreasuryPositionId'>;
export type ReservationId = Brand<string, 'ReservationId'>;
export type RouteDecisionId = Brand<string, 'RouteDecisionId'>;
export type RebalanceProposalId = Brand<string, 'RebalanceProposalId'>;
export type ForecastId = Brand<string, 'ForecastId'>;
export type KillSwitchId = Brand<string, 'KillSwitchId'>;
export type ConcentrationSnapshotId = Brand<string, 'ConcentrationSnapshotId'>;
export type SettlementExposureId = Brand<string, 'SettlementExposureId'>;
export type LiquiditySnapshotId = Brand<string, 'LiquiditySnapshotId'>;
export type FxInventoryId = Brand<string, 'FxInventoryId'>;
export type ReconciliationId = Brand<string, 'ReconciliationId'>;

export function asTreasuryAccountId(value: string): TreasuryAccountId {
  return value as TreasuryAccountId;
}

export function asReservationId(value: string): ReservationId {
  return value as ReservationId;
}

export function asRouteDecisionId(value: string): RouteDecisionId {
  return value as RouteDecisionId;
}

export function asRebalanceProposalId(value: string): RebalanceProposalId {
  return value as RebalanceProposalId;
}

export function asForecastId(value: string): ForecastId {
  return value as ForecastId;
}

export function asKillSwitchId(value: string): KillSwitchId {
  return value as KillSwitchId;
}

export function asConcentrationSnapshotId(value: string): ConcentrationSnapshotId {
  return value as ConcentrationSnapshotId;
}

export function asSettlementExposureId(value: string): SettlementExposureId {
  return value as SettlementExposureId;
}

export function asLiquiditySnapshotId(value: string): LiquiditySnapshotId {
  return value as LiquiditySnapshotId;
}

export function asFxInventoryId(value: string): FxInventoryId {
  return value as FxInventoryId;
}

export function asReconciliationId(value: string): ReconciliationId {
  return value as ReconciliationId;
}

export function asTreasuryPositionId(value: string): TreasuryPositionId {
  return value as TreasuryPositionId;
}

export type ProviderBalanceId = Brand<string, 'ProviderBalanceId'>;
export type SettlementRecordId = Brand<string, 'SettlementRecordId'>;
export type ReconciliationRunId = Brand<string, 'ReconciliationRunId'>;
export type ReconciliationBreakId = Brand<string, 'ReconciliationBreakId'>;
export type SuspenseItemId = Brand<string, 'SuspenseItemId'>;
export type DailyCloseId = Brand<string, 'DailyCloseId'>;
export type OperationalAlertId = Brand<string, 'OperationalAlertId'>;
export type LiquidityViewId = Brand<string, 'LiquidityViewId'>;

export function asProviderBalanceId(value: string): ProviderBalanceId {
  return value as ProviderBalanceId;
}

export function asSettlementRecordId(value: string): SettlementRecordId {
  return value as SettlementRecordId;
}

export function asReconciliationRunId(value: string): ReconciliationRunId {
  return value as ReconciliationRunId;
}

export function asReconciliationBreakId(value: string): ReconciliationBreakId {
  return value as ReconciliationBreakId;
}

export function asSuspenseItemId(value: string): SuspenseItemId {
  return value as SuspenseItemId;
}

export function asDailyCloseId(value: string): DailyCloseId {
  return value as DailyCloseId;
}

export function asOperationalAlertId(value: string): OperationalAlertId {
  return value as OperationalAlertId;
}

export function asLiquidityViewId(value: string): LiquidityViewId {
  return value as LiquidityViewId;
}
