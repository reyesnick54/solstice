/**
 * HELIOS EXEC12 — execution drop-copy and three-way reconciliation taxonomy.
 * Simulation-only; does not enable live broker or custody connectivity.
 */

export const HELIOS_EXEC12_SCHEMA = 'helios.exec12-execution-drop-copy-reconciliation.v1' as const;

export const HELIOS_EXEC12_EXECUTION_CONNECTIVITY = 'HELIOS_EXEC12_EXECUTION_CONNECTIVITY' as const;

export const EXECUTION_DROP_COPY_INGEST_KINDS = [
  'ORDER_ACKNOWLEDGEMENT',
  'EXECUTION_REPORT',
  'TRADE_CORRECTION',
  'BUST',
  'CANCEL_ACKNOWLEDGEMENT',
  'POSITION',
  'CASH',
  'FEE',
  'SETTLEMENT',
  'CORPORATE_ACTION',
] as const;
export type ExecutionDropCopyIngestKind = (typeof EXECUTION_DROP_COPY_INGEST_KINDS)[number];

export const EXECUTION_RECONCILIATION_BREAK_KINDS = [
  'MISSING_EXTERNAL_ORDER',
  'UNKNOWN_EXTERNAL_ORDER',
  'FILL_MISMATCH',
  'QUANTITY_MISMATCH',
  'PRICE_MISMATCH',
  'FEE_MISMATCH',
  'POSITION_MISMATCH',
  'CASH_MISMATCH',
  'SETTLEMENT_MISMATCH',
  'CORPORATE_ACTION_MISMATCH',
] as const;
export type ExecutionReconciliationBreakKind = (typeof EXECUTION_RECONCILIATION_BREAK_KINDS)[number];

export const EXEC12_OPERATIONAL_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type Exec12OperationalSeverity = (typeof EXEC12_OPERATIONAL_SEVERITIES)[number];

export const EXEC12_EXECUTION_RESTRICTION_REASONS = [
  'AMBIGUOUS_EXTERNAL_ORDER',
  'OPEN_RECONCILIATION_BREAK',
  'UNKNOWN_EXTERNAL_ORDER',
] as const;
export type Exec12ExecutionRestrictionReason = (typeof EXEC12_EXECUTION_RESTRICTION_REASONS)[number];

export const EXEC12_EXECUTION_RESTRICTION_STATES = ['NONE', 'RESTRICTED'] as const;
export type Exec12ExecutionRestrictionState = (typeof EXEC12_EXECUTION_RESTRICTION_STATES)[number];
