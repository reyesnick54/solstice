import type { Exec12OperationalSeverity, ExecutionReconciliationBreakKind } from './taxonomy.ts';

export function severityForExec12BreakKind(kind: ExecutionReconciliationBreakKind): Exec12OperationalSeverity {
  switch (kind) {
    case 'UNKNOWN_EXTERNAL_ORDER':
    case 'MISSING_EXTERNAL_ORDER':
      return 'CRITICAL';
    case 'FILL_MISMATCH':
    case 'QUANTITY_MISMATCH':
    case 'PRICE_MISMATCH':
    case 'POSITION_MISMATCH':
    case 'CASH_MISMATCH':
    case 'SETTLEMENT_MISMATCH':
      return 'HIGH';
    case 'FEE_MISMATCH':
    case 'CORPORATE_ACTION_MISMATCH':
      return 'MEDIUM';
    default:
      return 'HIGH';
  }
}

export function isAmbiguousExternalBreak(kind: ExecutionReconciliationBreakKind): boolean {
  return kind === 'UNKNOWN_EXTERNAL_ORDER';
}
