/**
 * HELIOS Execution Connectivity (EXEC01–EXEC15) — shared taxonomies.
 * Engineering architecture qualification only; not broker/custodian licensing.
 */

export const HELIOS_EXECUTION_CONNECTIVITY_SCHEMA = 'sunrey.helios.execution-connectivity.v1' as const;

export const HELIOS_BROKER_CUSTODY_EXECUTION_V1_QUALIFIED =
  'HELIOS_BROKER_CUSTODY_EXECUTION_V1_QUALIFIED' as const;

export const HELIOS_BROKER_CUSTODY_EXECUTION_V1_BLOCKED =
  'HELIOS_BROKER_CUSTODY_EXECUTION_V1_BLOCKED' as const;

export const EXEC_WORK_PACKAGES = Object.freeze([
  'EXEC01',
  'EXEC02',
  'EXEC03',
  'EXEC04',
  'EXEC05',
  'EXEC06',
  'EXEC07',
  'EXEC08',
  'EXEC09',
  'EXEC10',
  'EXEC11',
  'EXEC12',
  'EXEC13',
  'EXEC14',
  'EXEC15',
] as const);

export type ExecWorkPackageId = (typeof EXEC_WORK_PACKAGES)[number];

/** Simulation-only broker/custody provider progression — not regulatory approval. */
export const EXECUTION_PROVIDER_STATUSES = Object.freeze([
  'REGISTERED',
  'SANDBOX_CONFORMANCE',
  'ENGINEERING_QUALIFIED',
] as const);

export type ExecutionProviderStatus = (typeof EXECUTION_PROVIDER_STATUSES)[number];

export const EXEC15_E2E_PIPELINE_STAGES = Object.freeze([
  'research_thesis',
  'strategy_genome',
  'decision_validity_envelope',
  'customer_mandate',
  'deterministic_risk',
  'kernel_authorization',
  'capital_reservation',
  'parent_order',
  'smart_routing',
  'execution_algorithm',
  'pre_trade_firewall',
  'broker_adapter',
  'broker_acknowledgement',
  'partial_fill',
  'cancel_replace',
  'final_fill',
  'drop_copy',
  'settlement_obligation',
  'custody_position_update',
  'ledger_cash_reconciliation',
  'tca',
  'evidence_vault',
] as const);

export type Exec15E2ePipelineStage = (typeof EXEC15_E2E_PIPELINE_STAGES)[number];

export const EXEC15_ADVERSARIAL_SCENARIO_IDS = Object.freeze([
  'exec15_mandate_block',
  'exec15_stale_market_data',
  'exec15_duplicate_submission',
  'exec15_timeout_submission_unknown',
  'exec15_partial_fill_cancel_pending',
  'exec15_fill_before_ack',
  'exec15_broker_fill_custody_missing',
  'exec15_custody_without_fill',
  'exec15_internal_buying_power_wins',
  'exec15_margin_disabled',
  'exec15_ai_withdrawal_denied',
  'exec15_untrusted_market_data_mid_execution',
  'exec15_broker_disconnect_no_duplicate',
  'exec15_kill_switch',
  'exec15_settlement_failure_break',
] as const);

export type Exec15AdversarialScenarioId = (typeof EXEC15_ADVERSARIAL_SCENARIO_IDS)[number];
