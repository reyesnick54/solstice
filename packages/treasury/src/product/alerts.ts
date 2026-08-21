import type { UtcInstant } from '../../../domain/src/time.ts';
import type { OperationalAlertId } from '../ids.ts';

export const OPERATIONAL_ALERT_KINDS = [
  'LARGE_RECONCILIATION_BREAK',
  'SETTLEMENT_OVERDUE',
  'PROVIDER_STATEMENT_MISSING',
  'SUSPENSE_AGING',
  'INSUFFICIENT_TREASURY_LIQUIDITY',
  'UNEXPECTED_CURRENCY_EXPOSURE',
  'FAILED_SETTLEMENT_BATCH',
] as const;
export type OperationalAlertKind = (typeof OPERATIONAL_ALERT_KINDS)[number];

export const OPERATIONAL_ALERT_STATUSES = ['OPEN', 'ACKNOWLEDGED', 'CLEARED'] as const;
export type OperationalAlertStatus = (typeof OPERATIONAL_ALERT_STATUSES)[number];

export type OperationalAlert = {
  readonly alertId: OperationalAlertId;
  readonly kind: OperationalAlertKind;
  readonly severity: 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly domain: string;
  readonly provider: string | null;
  readonly currency: string | null;
  readonly amountMinor: bigint | null;
  readonly message: string;
  readonly references: readonly string[];
  readonly status: OperationalAlertStatus;
  readonly createdAt: UtcInstant;
};

export function freezeOperationalAlert(input: OperationalAlert): OperationalAlert {
  return Object.freeze({
    ...input,
    references: Object.freeze([...input.references]),
  });
}
