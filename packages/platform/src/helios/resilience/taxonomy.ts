/**
 * HELIOS H31 — adversarial / failure / resilience qualification taxonomies.
 * Simulation and test-gated fault injection only.
 */

export const HELIOS_H31_RESILIENCE_SCHEMA = 'sunrey.helios.resilience.v1' as const;

export const RESILIENCE_FAILURE_DOMAINS = [
  'MARKET_DATA',
  'AI_MODEL',
  'TASK_WORKER',
  'AUTHORITY',
  'CAPITAL_RESERVATION',
  'ORDER_PROVIDER',
  'ACCOUNTING',
  'CUSTOMER_ISOLATION',
  'MULTI_DEVICE_RETRY',
  'CRASH_MATRIX',
  'SECURITY_SECRETS',
  'PERFORMANCE_UNDER_FAILURE',
] as const;

export type ResilienceFailureDomain = (typeof RESILIENCE_FAILURE_DOMAINS)[number];

/** Repository-aligned severity for qualification reporting. */
export const RESILIENCE_SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
export type ResilienceSeverity = (typeof RESILIENCE_SEVERITIES)[number];

export const RESILIENCE_SCENARIO_TIERS = ['FAST_CI', 'CHAOS_QUALIFICATION'] as const;
export type ResilienceScenarioTier = (typeof RESILIENCE_SCENARIO_TIERS)[number];

export const RESILIENCE_OUTCOMES = [
  'PROTECTED',
  'DEGRADED_BUT_SAFE',
  'INVARIANT_BREACH',
  'SCENARIO_ERROR',
] as const;
export type ResilienceOutcome = (typeof RESILIENCE_OUTCOMES)[number];

export type ResilienceScenarioId =
  | 'H31-MKT-001-stale-quote'
  | 'H31-MKT-002-delayed-feed'
  | 'H31-MKT-003-duplicate-observation'
  | 'H31-MKT-004-out-of-order-observation'
  | 'H31-MKT-005-conflicting-providers'
  | 'H31-MKT-006-source-outage'
  | 'H31-MKT-007-market-status-unavailable'
  | 'H31-MKT-008-bad-instrument-mapping'
  | 'H31-MKT-009-extreme-outlier'
  | 'H31-MKT-010-entitlement-unavailable'
  | 'H31-AI-001-grok-timeout'
  | 'H31-AI-002-grok-malformed-output'
  | 'H31-AI-003-grok-unavailable'
  | 'H31-AI-004-s3m-unavailable'
  | 'H31-AI-005-s3m-version-mismatch'
  | 'H31-AI-006-tool-loop-timeout'
  | 'H31-AI-007-excessive-tool-calls'
  | 'H31-AI-008-research-budget-exhaustion'
  | 'H31-AI-009-model-unsupported-claim'
  | 'H31-TSK-001-worker-dies-after-lease'
  | 'H31-TSK-002-duplicate-delivery'
  | 'H31-TSK-003-stale-lease-completion'
  | 'H31-TSK-004-concurrent-workers'
  | 'H31-TSK-005-queue-interruption'
  | 'H31-TSK-006-runtime-restart'
  | 'H31-AUT-001-mandate-revoked-mid-research'
  | 'H31-AUT-002-mandate-revoked-before-submission'
  | 'H31-AUT-003-approval-expires'
  | 'H31-AUT-004-capability-disabled'
  | 'H31-AUT-005-jurisdiction-changes'
  | 'H31-AUT-006-policy-version-changes'
  | 'H31-AUT-007-strategy-capsule-revoked'
  | 'H31-CAP-001-concurrent-work-order-budget-race'
  | 'H31-CAP-002-repeated-allocation-request'
  | 'H31-CAP-003-stale-available-cash-cache'
  | 'H31-CAP-004-budget-self-increase-blocked'
  | 'H31-ORD-001-duplicate-operation-identity'
  | 'H31-ORD-002-provider-unknown-not-success'
  | 'H31-ORD-003-reconciliation-explicit-mismatch'
  | 'H31-ACC-001-unknown-not-allowed'
  | 'H31-ACC-002-stale-evidence-not-current'
  | 'H31-ACC-003-provider-error-not-success'
  | 'H31-ISO-001-cross-customer-work-order'
  | 'H31-ISO-002-cross-customer-task'
  | 'H31-ISO-003-cross-customer-research-result'
  | 'H31-ISO-004-cross-customer-observation'
  | 'H31-ISO-005-concurrent-multi-customer-isolation'
  | 'H31-RET-001-repeated-clicks-idempotency'
  | 'H31-RET-002-worker-retry-no-duplicate-spend'
  | 'H31-RET-003-webhook-replay-suppressed'
  | 'H31-CRH-001-crash-after-reservation-before-response'
  | 'H31-CRH-002-crash-after-claim-before-complete'
  | 'H31-CRH-003-crash-during-reconciliation'
  | 'H31-SEC-001-no-secrets-in-error-payloads'
  | 'H31-PER-001-recovery-time-bounded'
  | 'H31-PER-002-duplicate-suppression-metrics';

export type ResilienceScenarioDefinition = {
  readonly testId: ResilienceScenarioId;
  readonly domain: ResilienceFailureDomain;
  readonly tier: ResilienceScenarioTier;
  readonly failureInjected: string;
  readonly expectedBehavior: string;
  readonly criticalIfBreached: boolean;
};

export const RESILIENCE_SCENARIO_CATALOG: readonly ResilienceScenarioDefinition[] = Object.freeze([
  { testId: 'H31-MKT-001-stale-quote', domain: 'MARKET_DATA', tier: 'FAST_CI', failureInjected: 'stale quote beyond freshness policy', expectedBehavior: 'freshness degraded; no synthetic fallback price', criticalIfBreached: false },
  { testId: 'H31-MKT-002-delayed-feed', domain: 'MARKET_DATA', tier: 'FAST_CI', failureInjected: 'delayed feed arrival', expectedBehavior: 'delay classified; observation usable with degraded flag', criticalIfBreached: false },
  { testId: 'H31-MKT-003-duplicate-observation', domain: 'MARKET_DATA', tier: 'FAST_CI', failureInjected: 'duplicate observation event', expectedBehavior: 'deduplicated; single canonical envelope', criticalIfBreached: true },
  { testId: 'H31-MKT-004-out-of-order-observation', domain: 'MARKET_DATA', tier: 'FAST_CI', failureInjected: 'out-of-order sequence', expectedBehavior: 'sequence gap detected; no silent reorder', criticalIfBreached: false },
  { testId: 'H31-MKT-005-conflicting-providers', domain: 'MARKET_DATA', tier: 'FAST_CI', failureInjected: 'conflicting provider values', expectedBehavior: 'independence assessed; contradiction surfaced', criticalIfBreached: false },
  { testId: 'H31-MKT-006-source-outage', domain: 'MARKET_DATA', tier: 'FAST_CI', failureInjected: 'source outage', expectedBehavior: 'ingest fails or degrades safely', criticalIfBreached: false },
  { testId: 'H31-MKT-007-market-status-unavailable', domain: 'MARKET_DATA', tier: 'FAST_CI', failureInjected: 'market status missing', expectedBehavior: 'quality degraded; no fabricated open market', criticalIfBreached: false },
  { testId: 'H31-MKT-008-bad-instrument-mapping', domain: 'MARKET_DATA', tier: 'FAST_CI', failureInjected: 'missing canonical instrument', expectedBehavior: 'reject ingest with INSTRUMENT_REQUIRED', criticalIfBreached: false },
  { testId: 'H31-MKT-009-extreme-outlier', domain: 'MARKET_DATA', tier: 'FAST_CI', failureInjected: 'extreme price outlier', expectedBehavior: 'outlier flagged; not treated as trusted reference', criticalIfBreached: false },
  { testId: 'H31-MKT-010-entitlement-unavailable', domain: 'MARKET_DATA', tier: 'FAST_CI', failureInjected: 'entitlement denied', expectedBehavior: 'entitlement unusable; observation excluded', criticalIfBreached: false },
  { testId: 'H31-AI-001-grok-timeout', domain: 'AI_MODEL', tier: 'FAST_CI', failureInjected: 'Grok timeout', expectedBehavior: 'timeout status; no fabricated intelligence', criticalIfBreached: true },
  { testId: 'H31-AI-002-grok-malformed-output', domain: 'AI_MODEL', tier: 'FAST_CI', failureInjected: 'malformed Grok JSON', expectedBehavior: 'parse failure; no unauthorized fallback', criticalIfBreached: true },
  { testId: 'H31-AI-003-grok-unavailable', domain: 'AI_MODEL', tier: 'FAST_CI', failureInjected: 'Grok unavailable', expectedBehavior: 'PROVIDER_UNAVAILABLE; no synthetic result', criticalIfBreached: true },
  { testId: 'H31-AI-004-s3m-unavailable', domain: 'AI_MODEL', tier: 'FAST_CI', failureInjected: 'S3M serving unavailable', expectedBehavior: 'fail closed; no fabricated inference', criticalIfBreached: true },
  { testId: 'H31-AI-005-s3m-version-mismatch', domain: 'AI_MODEL', tier: 'FAST_CI', failureInjected: 'S3M version mismatch', expectedBehavior: 'reject unqualified model version', criticalIfBreached: true },
  { testId: 'H31-AI-006-tool-loop-timeout', domain: 'AI_MODEL', tier: 'FAST_CI', failureInjected: 'tool loop timeout', expectedBehavior: 'LIMIT_REACHED or timeout; bounded exit', criticalIfBreached: false },
  { testId: 'H31-AI-007-excessive-tool-calls', domain: 'AI_MODEL', tier: 'FAST_CI', failureInjected: 'excessive tool calls', expectedBehavior: 'LIMIT_REACHED; no unbounded loop', criticalIfBreached: true },
  { testId: 'H31-AI-008-research-budget-exhaustion', domain: 'AI_MODEL', tier: 'FAST_CI', failureInjected: 'research budget exhausted', expectedBehavior: 'BUDGET_EXHAUSTED; no overspend', criticalIfBreached: true },
  { testId: 'H31-AI-009-model-unsupported-claim', domain: 'AI_MODEL', tier: 'FAST_CI', failureInjected: 'unsupported factual claim', expectedBehavior: 'assertion kind UNKNOWN/CONTRADICTED; no EA grant', criticalIfBreached: true },
  { testId: 'H31-TSK-001-worker-dies-after-lease', domain: 'TASK_WORKER', tier: 'FAST_CI', failureInjected: 'worker crash after lease', expectedBehavior: 'lease expires; task reclaimable idempotently', criticalIfBreached: true },
  { testId: 'H31-TSK-002-duplicate-delivery', domain: 'TASK_WORKER', tier: 'FAST_CI', failureInjected: 'duplicate task completion', expectedBehavior: 'TASK_ALREADY_COMPLETED; no double spend', criticalIfBreached: true },
  { testId: 'H31-TSK-003-stale-lease-completion', domain: 'TASK_WORKER', tier: 'FAST_CI', failureInjected: 'stale lease generation', expectedBehavior: 'reject completion; no forged result', criticalIfBreached: true },
  { testId: 'H31-TSK-004-concurrent-workers', domain: 'TASK_WORKER', tier: 'FAST_CI', failureInjected: 'concurrent worker claim', expectedBehavior: 'single active lease', criticalIfBreached: true },
  { testId: 'H31-TSK-005-queue-interruption', domain: 'TASK_WORKER', tier: 'FAST_CI', failureInjected: 'work order paused', expectedBehavior: 'dispatch blocked while paused', criticalIfBreached: false },
  { testId: 'H31-TSK-006-runtime-restart', domain: 'TASK_WORKER', tier: 'FAST_CI', failureInjected: 'orchestrator restart', expectedBehavior: 'state restored; budget unchanged', criticalIfBreached: true },
  { testId: 'H31-AUT-001-mandate-revoked-mid-research', domain: 'AUTHORITY', tier: 'FAST_CI', failureInjected: 'mandate revoked mid-research', expectedBehavior: 'new dispatch blocked', criticalIfBreached: true },
  { testId: 'H31-AUT-002-mandate-revoked-before-submission', domain: 'AUTHORITY', tier: 'FAST_CI', failureInjected: 'mandate revoked before submission', expectedBehavior: 'consequential action blocked', criticalIfBreached: true },
  { testId: 'H31-AUT-003-approval-expires', domain: 'AUTHORITY', tier: 'FAST_CI', failureInjected: 'approval expired', expectedBehavior: 'APPROVAL_EXPIRED in envelope', criticalIfBreached: true },
  { testId: 'H31-AUT-004-capability-disabled', domain: 'AUTHORITY', tier: 'FAST_CI', failureInjected: 'capability disabled', expectedBehavior: 'authority revalidation refuses dispatch', criticalIfBreached: true },
  { testId: 'H31-AUT-005-jurisdiction-changes', domain: 'AUTHORITY', tier: 'FAST_CI', failureInjected: 'jurisdiction capability disabled', expectedBehavior: 'JURISDICTION_CAPABILITY_DISABLED', criticalIfBreached: true },
  { testId: 'H31-AUT-006-policy-version-changes', domain: 'AUTHORITY', tier: 'FAST_CI', failureInjected: 'policy version drift', expectedBehavior: 'REVALIDATION_REQUIRED', criticalIfBreached: false },
  { testId: 'H31-AUT-007-strategy-capsule-revoked', domain: 'AUTHORITY', tier: 'FAST_CI', failureInjected: 'strategy capsule revoked', expectedBehavior: 'STRATEGY_CAPSULE_REVOKED blocks proposal', criticalIfBreached: true },
  { testId: 'H31-CAP-001-concurrent-work-order-budget-race', domain: 'CAPITAL_RESERVATION', tier: 'FAST_CI', failureInjected: 'two tasks race for budget', expectedBehavior: 'BUDGET_EXHAUSTED on second; no overspend', criticalIfBreached: true },
  { testId: 'H31-CAP-002-repeated-allocation-request', domain: 'CAPITAL_RESERVATION', tier: 'FAST_CI', failureInjected: 'repeated allocation with same idempotency', expectedBehavior: 'idempotent replay; no double reservation', criticalIfBreached: true },
  { testId: 'H31-CAP-003-stale-available-cash-cache', domain: 'CAPITAL_RESERVATION', tier: 'FAST_CI', failureInjected: 'stale cash snapshot', expectedBehavior: 'CAPITAL_UNAVAILABLE or revalidation', criticalIfBreached: true },
  { testId: 'H31-CAP-004-budget-self-increase-blocked', domain: 'CAPITAL_RESERVATION', tier: 'FAST_CI', failureInjected: 'budget self-increase attempt', expectedBehavior: 'BUDGET_SELF_INCREASE_FORBIDDEN', criticalIfBreached: true },
  { testId: 'H31-ORD-001-duplicate-operation-identity', domain: 'ORDER_PROVIDER', tier: 'FAST_CI', failureInjected: 'duplicate operation identity', expectedBehavior: 'idempotent task identity; no duplicate effect', criticalIfBreached: true },
  { testId: 'H31-ORD-002-provider-unknown-not-success', domain: 'ORDER_PROVIDER', tier: 'FAST_CI', failureInjected: 'provider returns unknown status', expectedBehavior: 'reconciliation explicit; not success', criticalIfBreached: true },
  { testId: 'H31-ORD-003-reconciliation-explicit-mismatch', domain: 'ORDER_PROVIDER', tier: 'FAST_CI', failureInjected: 'provider vs ledger mismatch', expectedBehavior: 'mismatch explicit; unsafe reuse blocked', criticalIfBreached: true },
  { testId: 'H31-ACC-001-unknown-not-allowed', domain: 'ACCOUNTING', tier: 'FAST_CI', failureInjected: 'UNKNOWN envelope status', expectedBehavior: 'no UNKNOWN classified as ALLOWED', criticalIfBreached: true },
  { testId: 'H31-ACC-002-stale-evidence-not-current', domain: 'ACCOUNTING', tier: 'FAST_CI', failureInjected: 'stale evidence', expectedBehavior: 'EVIDENCE_STALE; not current', criticalIfBreached: true },
  { testId: 'H31-ACC-003-provider-error-not-success', domain: 'ACCOUNTING', tier: 'FAST_CI', failureInjected: 'provider error', expectedBehavior: 'error not silently converted to success', criticalIfBreached: true },
  { testId: 'H31-ISO-001-cross-customer-work-order', domain: 'CUSTOMER_ISOLATION', tier: 'FAST_CI', failureInjected: 'cross-customer work order access', expectedBehavior: 'access denied', criticalIfBreached: true },
  { testId: 'H31-ISO-002-cross-customer-task', domain: 'CUSTOMER_ISOLATION', tier: 'FAST_CI', failureInjected: 'cross-customer task claim', expectedBehavior: 'WORK_ORDER_NOT_FOUND', criticalIfBreached: true },
  { testId: 'H31-ISO-003-cross-customer-research-result', domain: 'CUSTOMER_ISOLATION', tier: 'FAST_CI', failureInjected: 'cross-customer research read', expectedBehavior: 'result not visible', criticalIfBreached: true },
  { testId: 'H31-ISO-004-cross-customer-observation', domain: 'CUSTOMER_ISOLATION', tier: 'FAST_CI', failureInjected: 'cross-customer observation scope', expectedBehavior: 'scoped store isolation', criticalIfBreached: true },
  { testId: 'H31-ISO-005-concurrent-multi-customer-isolation', domain: 'CUSTOMER_ISOLATION', tier: 'CHAOS_QUALIFICATION', failureInjected: 'concurrent multi-customer load with one provider failure', expectedBehavior: 'unrelated customer state unaffected', criticalIfBreached: true },
  { testId: 'H31-RET-001-repeated-clicks-idempotency', domain: 'MULTI_DEVICE_RETRY', tier: 'FAST_CI', failureInjected: 'repeated API clicks', expectedBehavior: 'stable idempotency; single effect', criticalIfBreached: true },
  { testId: 'H31-RET-002-worker-retry-no-duplicate-spend', domain: 'MULTI_DEVICE_RETRY', tier: 'FAST_CI', failureInjected: 'worker retry after transient failure', expectedBehavior: 'retryable without duplicate spend', criticalIfBreached: true },
  { testId: 'H31-RET-003-webhook-replay-suppressed', domain: 'MULTI_DEVICE_RETRY', tier: 'FAST_CI', failureInjected: 'webhook replay', expectedBehavior: 'duplicate event suppressed', criticalIfBreached: true },
  { testId: 'H31-CRH-001-crash-after-reservation-before-response', domain: 'CRASH_MATRIX', tier: 'FAST_CI', failureInjected: 'crash after budget reservation', expectedBehavior: 'restart preserves reservation; converges', criticalIfBreached: true },
  { testId: 'H31-CRH-002-crash-after-claim-before-complete', domain: 'CRASH_MATRIX', tier: 'FAST_CI', failureInjected: 'crash after task claim', expectedBehavior: 'lease recovery; no duplicate completion', criticalIfBreached: true },
  { testId: 'H31-CRH-003-crash-during-reconciliation', domain: 'CRASH_MATRIX', tier: 'FAST_CI', failureInjected: 'crash during reconciliation snapshot', expectedBehavior: 'state converges on restart', criticalIfBreached: true },
  { testId: 'H31-SEC-001-no-secrets-in-error-payloads', domain: 'SECURITY_SECRETS', tier: 'FAST_CI', failureInjected: 'fault with embedded secret in dependency', expectedBehavior: 'secrets redacted from errors/logs', criticalIfBreached: true },
  { testId: 'H31-PER-001-recovery-time-bounded', domain: 'PERFORMANCE_UNDER_FAILURE', tier: 'CHAOS_QUALIFICATION', failureInjected: 'restart recovery under load', expectedBehavior: 'recovery completes within bounded window', criticalIfBreached: false },
  { testId: 'H31-PER-002-duplicate-suppression-metrics', domain: 'PERFORMANCE_UNDER_FAILURE', tier: 'CHAOS_QUALIFICATION', failureInjected: 'burst duplicate events', expectedBehavior: 'duplicate suppression holds under load', criticalIfBreached: true },
]);

export function scenarioDefinition(testId: ResilienceScenarioId): ResilienceScenarioDefinition {
  const row = RESILIENCE_SCENARIO_CATALOG.find((item) => item.testId === testId);
  if (!row) {
    throw new Error(`unknown resilience scenario: ${testId}`);
  }
  return row;
}

export function scenariosForTier(tier: ResilienceScenarioTier): readonly ResilienceScenarioDefinition[] {
  return RESILIENCE_SCENARIO_CATALOG.filter((row) => row.tier === tier);
}
