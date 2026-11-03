/**
 * HELIOS open-source integration OS08 — event-triggered agentic research taxonomies.
 */

export const HELIOS_OS08_TRIGGERED_AGENTIC_RESEARCH_QUALIFIED =
  'HELIOS_OS08_TRIGGERED_AGENTIC_RESEARCH_QUALIFIED' as const;

export { TRIGGER_SPECIALIST_CLASSES, type TriggerSpecialistClass } from '../os07/research-monitor-contract.ts';

export const TRIGGER_ROUTER_OUTCOMES = [
  'RESEARCH_COMPLETED',
  'RESEARCH_DENIED',
  'DEDUPED',
  'COOLDOWN',
  'LIMIT_EXCEEDED',
  'VOI_DENIED',
  'VOI_REDUCED',
  'IDEMPOTENT_REPLAY',
  'MESH_FAILED',
] as const;

export type TriggerRouterOutcome = (typeof TRIGGER_ROUTER_OUTCOMES)[number];

export const TRIGGER_ROUTER_REASON_CODES = [
  'IDEMPOTENCY_REPLAY',
  'DEDUPE_WINDOW',
  'COOLDOWN_ACTIVE',
  'CUSTOMER_CONCURRENCY_CAP',
  'SYSTEM_CONCURRENCY_CAP',
  'CUSTOMER_DAILY_CAP',
  'SYSTEM_DAILY_CAP',
  'CUSTOMER_SPEND_CAP',
  'SYSTEM_SPEND_CAP',
  'VOI_DO_NOT_RESEARCH',
  'VOI_WAIT_FOR_DATA',
  'VOI_BUDGET_REDUCED',
  'RESEARCH_ONLY_SCOPE',
  'EXECUTION_PATH_FORBIDDEN',
  'MESH_ERROR',
] as const;

export type TriggerRouterReasonCode = (typeof TRIGGER_ROUTER_REASON_CODES)[number];

/** Mesh specialist role names (string) — kept local to avoid platform → mesh package import. */
export const MESH_SPECIALIST_ROLE_NAMES = [
  'OPPORTUNITY_RESEARCH',
  'MACRO_FX',
  'STAT_ARB_RELATIVE_VALUE',
  'VOLATILITY',
  'MICROSTRUCTURE',
  'EVIDENCE_VERIFIER',
  'ADVERSARIAL_CRITIC',
] as const;

export type MeshSpecialistRoleName = (typeof MESH_SPECIALIST_ROLE_NAMES)[number];
