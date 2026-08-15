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
