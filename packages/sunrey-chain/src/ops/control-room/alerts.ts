import { AlertEngine } from '../alerts.ts';
import type { AlertCode, AlertSeverity, FiredAlert } from '../types.ts';
import type { DomainSnapshots, ErrorBudget } from './types.ts';

export function fireBurnRateAlert(engine: AlertEngine, budget: ErrorBudget, nowUtc: string): FiredAlert | undefined {
  if (budget.burnCategory === 'FAST' || budget.burnCategory === 'EXHAUSTED') {
    return engine.fire(
      'FAST_ERROR_BUDGET_BURN',
      budget.sloId,
      `fast burn ${budget.burnRateBps.toString()} bps remaining=${budget.remainingFailures.toString()}`,
      nowUtc,
    );
  }
  if (budget.burnCategory === 'SLOW') {
    return engine.fire(
      'SLOW_ERROR_BUDGET_BURN',
      budget.sloId,
      `slow burn ${budget.burnRateBps.toString()} bps remaining=${budget.remainingFailures.toString()}`,
      nowUtc,
    );
  }
  return undefined;
}

export function evaluateDomainAlerts(engine: AlertEngine, snapshots: DomainSnapshots, nowUtc: string): readonly FiredAlert[] {
  const before = engine.active().length;
  maybeFire(engine, snapshots.events?.outboxBacklog ?? snapshots.persistence?.outboxBacklog ?? 0n, 0n, 'OUTBOX_BACKLOG', 'event-fabric', 'outbox backlog present', nowUtc);
  const credential = snapshots.credentials?.[0];
  if (credential && credential.expiryHorizonHours < 168n) {
    engine.fire('CREDENTIAL_EXPIRY', credential.providerClass, 'credential approaching expiry horizon', nowUtc);
  }
  if (snapshots.economic?.oracleQuorumDegraded) {
    engine.fire('ORACLE_QUORUM_DEGRADATION', 'oracle', 'oracle quorum degraded', nowUtc);
  }
  if ((snapshots.economic?.supplyReconciliationMismatches ?? 0n) > 0n) {
    engine.fire('SUPPLY_RECONCILIATION', 'economic-constitution', 'native supply reconciliation mismatch', nowUtc);
  }
  const unknown = snapshots.payments?.reduce((sum, row) => sum + row.submissionUnknown, 0n) ?? 0n;
  maybeFire(engine, unknown, 0n, 'PAYMENT_SUBMISSION_UNKNOWN', 'payments', 'SUBMISSION_UNKNOWN remainder', nowUtc);
  const unavailable = (snapshots.providers ?? []).some((row) => row.technicalHealth === 'UNAVAILABLE' || row.circuitOpen);
  if (unavailable) {
    engine.fire('PROVIDER_UNAVAILABLE', 'providers', 'provider technically unavailable', nowUtc);
  }
  if (snapshots.financialSafety?.ledgerImbalance) {
    engine.fire('LEDGER_IMBALANCE', 'ledger', 'ledger imbalance invariant failed', nowUtc);
  }
  if ((snapshots.custody ?? []).some((row) => row.reconciliationMismatches > 0n)) {
    engine.fire('CUSTODY_RECONCILIATION_MISMATCH', 'custody', 'custody reconciliation mismatch', nowUtc);
  }
  if (snapshots.security?.credentialMisuse || (credential?.scopeRejections ?? 0n) > 0n) {
    engine.fire('CREDENTIAL_MISUSE', 'security', 'credential misuse or scope rejection', nowUtc);
  }
  if ((snapshots.aiSafety ?? []).length > 0) {
    engine.fire('AI_AUTHORITY_ATTEMPT', 'ai', 'AI attempted a forbidden authority action; alert only', nowUtc);
  }
  return engine.active().slice(before);
}

function maybeFire(
  engine: AlertEngine,
  observed: bigint,
  threshold: bigint,
  code: AlertCode,
  componentId: string,
  details: string,
  nowUtc: string,
): void {
  if (observed > threshold) {
    engine.fire(code, componentId, details, nowUtc);
  }
}

export function alertSeverityForBurn(category: ErrorBudget['burnCategory']): AlertSeverity {
  if (category === 'FAST' || category === 'EXHAUSTED') {
    return 'CRITICAL';
  }
  if (category === 'SLOW') {
    return 'WARNING';
  }
  return 'INFO';
}

export const REAL_ALERT_PROVIDER_CONNECTED = false as const;
