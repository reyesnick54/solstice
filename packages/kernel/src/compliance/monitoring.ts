import { randomUUID } from 'node:crypto';

import type { UtcInstant } from '../../../domain/src/time.ts';

export type MonitoringEvent = {
  readonly journalId?: string;
  readonly intentId?: string;
  readonly subjectRef: string;
  readonly counterpartyRef?: string;
  readonly amountMinor: bigint;
  readonly failedTransfer: boolean;
  readonly highRiskCorridor: boolean;
  readonly now: UtcInstant;
};

export type MonitoringAlert = {
  readonly alertId: string;
  readonly alertKind: 'TRANSACTION_MONITORING';
  readonly ruleId: string;
  readonly legalConfidence: 'RESEARCH_REQUIRED';
  readonly subjectRef: string;
  readonly outcome: 'REVIEW' | 'HOLD';
  readonly reasonCodes: readonly string[];
  readonly journalId: string | null;
  readonly intentId: string | null;
  readonly createdAt: UtcInstant;
};

/**
 * Engineering test rules only. Substantive regulatory thresholds remain
 * RESEARCH_REQUIRED and are not encoded as confirmed law.
 */
export function evaluateTransactionMonitoring(
  event: MonitoringEvent,
  recentCount: number,
  recentAmountMinor: bigint,
): readonly MonitoringAlert[] {
  const alerts: MonitoringAlert[] = [];
  const base = {
    alertKind: 'TRANSACTION_MONITORING' as const,
    legalConfidence: 'RESEARCH_REQUIRED' as const,
    subjectRef: event.subjectRef,
    journalId: event.journalId ?? null,
    intentId: event.intentId ?? null,
    createdAt: event.now,
  };
  if (recentCount > 5) {
    alerts.push(
      Object.freeze({
        ...base,
        alertId: randomUUID(),
        ruleId: 'sim-velocity',
        outcome: 'REVIEW',
        reasonCodes: Object.freeze(['SIM_VELOCITY_TRIGGER']),
      }),
    );
  }
  if (event.amountMinor > 9_000_000n) {
    alerts.push(
      Object.freeze({
        ...base,
        alertId: randomUUID(),
        ruleId: 'sim-unusual-amount',
        outcome: 'HOLD',
        reasonCodes: Object.freeze(['SIM_UNUSUAL_AMOUNT']),
      }),
    );
  }
  if (recentCount >= 3 && recentAmountMinor > 8_000_000n && event.amountMinor < 1_000_000n) {
    alerts.push(
      Object.freeze({
        ...base,
        alertId: randomUUID(),
        ruleId: 'sim-structuring-pattern',
        outcome: 'REVIEW',
        reasonCodes: Object.freeze(['SIM_STRUCTURING_PATTERN']),
      }),
    );
  }
  if (event.highRiskCorridor) {
    alerts.push(
      Object.freeze({
        ...base,
        alertId: randomUUID(),
        ruleId: 'sim-high-risk-corridor',
        outcome: 'REVIEW',
        reasonCodes: Object.freeze(['SIM_HIGH_RISK_CORRIDOR']),
      }),
    );
  }
  if (event.failedTransfer && recentCount >= 3) {
    alerts.push(
      Object.freeze({
        ...base,
        alertId: randomUUID(),
        ruleId: 'sim-repeated-failed-transfers',
        outcome: 'REVIEW',
        reasonCodes: Object.freeze(['SIM_REPEATED_FAILED_TRANSFERS']),
      }),
    );
  }
  return Object.freeze(alerts);
}
