import type { MetricRegistry, StructuredLogSink, TraceCollector } from '../observability.ts';
import { assertAllowedMetricLabels } from './catalog.ts';
import type {
  AiSafetySnapshot,
  ComplianceSnapshot,
  CredentialSnapshot,
  CustodySnapshot,
  DomainSnapshots,
  EconomicSnapshot,
  EventFabricSnapshot,
  ExchangeSnapshot,
  FinancialSafetySnapshot,
  PaymentSnapshot,
  PersistenceSnapshot,
  ProviderRuntimeSnapshot,
  SafeMetricLabels,
  SecuritySignalSnapshot,
} from './types.ts';

function labels(input: SafeMetricLabels): Record<string, string> {
  const safe = assertAllowedMetricLabels(input);
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(safe)) {
    if (value !== undefined) {
      out[key] = value;
    }
  }
  return out;
}

export function ingestCredentialSnapshot(metrics: MetricRegistry, snapshot: CredentialSnapshot): void {
  const common = labels({
    domain: snapshot.domain,
    providerClass: snapshot.providerClass,
    environment: snapshot.environment,
  });
  metrics.observe('credential_expiry_horizon', snapshot.expiryHorizonHours, common);
  metrics.observe('credential_rotation_required', snapshot.rotationRequired ? 1n : 0n, common);
  metrics.observe('credential_scope_rejections', snapshot.scopeRejections, common);
  metrics.observe('credential_resolution_failures', snapshot.resolutionFailures, common);
}

export function ingestProviderSnapshot(metrics: MetricRegistry, snapshot: ProviderRuntimeSnapshot): void {
  const common = labels({
    domain: snapshot.domain,
    providerClass: snapshot.providerClass,
    environment: snapshot.environment,
    status: snapshot.technicalHealth,
  });
  metrics.observe('provider_sessions', snapshot.sessions, common);
  metrics.observe('provider_auth_failures', snapshot.authFailures, common);
  metrics.observe('provider_circuit_open', snapshot.circuitOpen ? 1n : 0n, common);
  metrics.observe('provider_schema_drift', snapshot.schemaDrift ? 1n : 0n, common);
  metrics.observe('provider_revalidation_required', snapshot.revalidationRequired ? 1n : 0n, common);
}

export function ingestPaymentSnapshot(metrics: MetricRegistry, snapshot: PaymentSnapshot): void {
  const common = labels({
    domain: snapshot.domain,
    providerClass: snapshot.providerClass,
    environment: snapshot.environment,
  });
  metrics.observe('payment_submission_unknown', snapshot.submissionUnknown, common);
  metrics.observe('payment_reconciliation_required', snapshot.reconciliationRequired, common);
  metrics.observe('payment_callback_replays', snapshot.callbackReplays, common);
  metrics.observe('payment_settlement_lag', snapshot.settlementLagMs, common);
  metrics.observe('fx_quote_stale_rejections', snapshot.fxQuoteStaleRejections, common);
}

export function ingestComplianceSnapshot(metrics: MetricRegistry, snapshot: ComplianceSnapshot): void {
  const common = labels({
    domain: snapshot.domain,
    providerClass: snapshot.providerClass,
    environment: snapshot.environment,
  });
  metrics.observe('kyc_provider_unavailable', snapshot.kycUnavailable ? 1n : 0n, common);
  metrics.observe('sanctions_provider_unavailable', snapshot.sanctionsUnavailable ? 1n : 0n, common);
  metrics.observe('aml_provider_unavailable', snapshot.amlUnavailable ? 1n : 0n, common);
  metrics.observe('compliance_manual_review_queue', snapshot.manualReviewQueue, common);
}

export function ingestCustodySnapshot(metrics: MetricRegistry, snapshot: CustodySnapshot): void {
  const common = labels({
    domain: snapshot.domain,
    asset: snapshot.asset,
    environment: snapshot.environment,
  });
  if (snapshot.asset === 'SUNREY_COIN') {
    metrics.observe('sunrey_custody_reconciliation', snapshot.reconciliationMismatches, common);
  } else if (snapshot.asset === 'MOONREY_COIN') {
    metrics.observe('moonrey_custody_reconciliation', snapshot.reconciliationMismatches, common);
  }
  metrics.observe('cross_asset_rejection_count', snapshot.crossAssetRejections, common);
  metrics.observe('custody_submission_unknown', snapshot.submissionUnknown, common);
  metrics.observe('hsm_health', snapshot.hsmHealthy ? 1n : 0n, common);
}

export function ingestPersistenceSnapshot(metrics: MetricRegistry, snapshot: PersistenceSnapshot): void {
  const common = labels({ domain: snapshot.domain, environment: snapshot.environment });
  metrics.observe('postgres_primary_health', snapshot.primaryHealthy ? 1n : 0n, common);
  metrics.observe('replica_lag', snapshot.replicaLagMs, common);
  metrics.observe('outbox_backlog', snapshot.outboxBacklog, common);
  metrics.observe('inbox_failed', snapshot.inboxFailed, common);
  metrics.observe('dead_letter_count', snapshot.deadLetterCount, common);
  metrics.observe('recovery_reconciliation_queue', snapshot.recoveryReconciliationQueue, common);
  metrics.observe('backup_age', snapshot.backupAgeMs, common);
}

export function ingestEconomicSnapshot(metrics: MetricRegistry, snapshot: EconomicSnapshot): void {
  const common = labels({ domain: snapshot.domain, environment: snapshot.environment });
  metrics.observe('oracle_quorum_degradation', snapshot.oracleQuorumDegraded ? 1n : 0n, common);
  metrics.observe('productive_value_review_queue', snapshot.productiveValueReviewQueue, common);
  metrics.observe('human_contribution_review_queue', snapshot.humanContributionReviewQueue, common);
  metrics.observe('supply_reconciliation', snapshot.supplyReconciliationMismatches, common);
}

export function ingestEventFabricSnapshot(metrics: MetricRegistry, snapshot: EventFabricSnapshot): void {
  const common = labels({ domain: snapshot.domain, environment: snapshot.environment });
  metrics.observe('outbox_backlog', snapshot.outboxBacklog, common);
  metrics.observe('inbox_failed', snapshot.inboxFailed, common);
  metrics.observe('dead_letter_count', snapshot.deadLetterCount, common);
}

export function ingestExchangeSnapshot(metrics: MetricRegistry, snapshot: ExchangeSnapshot): void {
  const common = labels({ domain: snapshot.domain, environment: snapshot.environment });
  metrics.observe('pending_settlement_count', snapshot.pendingSettlements, common);
  metrics.observe('reconciliation_mismatch', snapshot.reconciliationMismatches, common);
}

export function ingestDomainSnapshots(metrics: MetricRegistry, snapshots: DomainSnapshots): void {
  for (const row of snapshots.credentials ?? []) {
    ingestCredentialSnapshot(metrics, row);
  }
  for (const row of snapshots.providers ?? []) {
    ingestProviderSnapshot(metrics, row);
  }
  for (const row of snapshots.payments ?? []) {
    ingestPaymentSnapshot(metrics, row);
  }
  for (const row of snapshots.compliance ?? []) {
    ingestComplianceSnapshot(metrics, row);
  }
  for (const row of snapshots.custody ?? []) {
    ingestCustodySnapshot(metrics, row);
  }
  if (snapshots.persistence) {
    ingestPersistenceSnapshot(metrics, snapshots.persistence);
  }
  if (snapshots.economic) {
    ingestEconomicSnapshot(metrics, snapshots.economic);
  }
  if (snapshots.events) {
    ingestEventFabricSnapshot(metrics, snapshots.events);
  }
  if (snapshots.exchange) {
    ingestExchangeSnapshot(metrics, snapshots.exchange);
  }
}

export function recordSecuritySignals(logs: StructuredLogSink, snapshot: SecuritySignalSnapshot, requestId: string, traceId: string): void {
  const signals: Array<[boolean, 'CREDENTIAL_MISUSE' | 'SECRET_LEAK_GUARD' | 'HSM_UNAVAILABLE' | 'WEBHOOK_REPLAY' | 'SIGNATURE_FAILURE' | 'SSRF_REJECTION' | 'UNEXPECTED_ENDPOINT' | 'PROVIDER_SCOPE_MISMATCH']> = [
    [snapshot.credentialMisuse, 'CREDENTIAL_MISUSE'],
    [snapshot.secretLeakGuardRejection, 'SECRET_LEAK_GUARD'],
    [snapshot.hsmUnavailable, 'HSM_UNAVAILABLE'],
    [snapshot.webhookReplay, 'WEBHOOK_REPLAY'],
    [snapshot.signatureFailure, 'SIGNATURE_FAILURE'],
    [snapshot.ssrfRejection, 'SSRF_REJECTION'],
    [snapshot.unexpectedEndpointAttempt, 'UNEXPECTED_ENDPOINT'],
    [snapshot.providerScopeMismatch, 'PROVIDER_SCOPE_MISMATCH'],
  ];
  for (const [active, code] of signals) {
    if (active) {
      logs.security(code, `security signal ${code}`, requestId, traceId);
    }
  }
}

export function recordAiSafetyAttempt(logs: StructuredLogSink, snapshot: AiSafetySnapshot, requestId: string, traceId: string): void {
  logs.security(
    'AI_AUTHORITY_ATTEMPT',
    `AI ${snapshot.actorClass} attempted ${snapshot.attempt}; alert only, no human score`,
    requestId,
    traceId,
  );
}

export function recordFinancialSafety(logs: StructuredLogSink, snapshot: FinancialSafetySnapshot, requestId: string, traceId: string): void {
  if (snapshot.ledgerImbalance || snapshot.supplyMismatch) {
    logs.emit({
      service: 'sunrey-control-room',
      requestId,
      traceId,
      severity: 'CRITICAL',
      eventCode: 'LEDGER_OR_SUPPLY_INVARIANT',
      message: 'financial safety invariant failed; balances were not altered',
    });
  }
}

export function startOperationalTrace(
  traces: TraceCollector,
  name: string,
  service: string,
  attributes: Record<string, string> = {},
) {
  return traces.start(name, service, undefined, attributes);
}
