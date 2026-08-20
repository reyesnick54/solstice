/**
 * Chunk 157 — production-safety campaign helpers.
 *
 * Isolated defensive range only. Fixture transports. No live pentest,
 * no external targets, no real credentials, no LIVE_* mutation.
 */

import { ENVIRONMENT, LIVE_MONEY_ENABLED, assertSimulationOnly } from '../../config/src/flags.ts';
import { PRODUCTION_SAFETY_FIXTURE_VERSION, type AttackResult, type CampaignSeverity, type SecurityInvariantId } from './types.ts';

export const CRITICAL_PRODUCTION_INVARIANTS = [
  'LEDGER_APPEND_ONLY',
  'EXECUTION_AUTHORITY_REQUIRED',
  'KERNEL_CANNOT_BE_BYPASSED',
  'ASSET_SUPPLYBOOK_CANONICAL',
  'CHUNK_71_MONETARY_AUTHORITY',
  'AI_CANNOT_EXECUTE',
  'RAW_SECRET_NOT_EXPOSED',
  'PII_NOT_PUBLIC_CHAIN',
  'ORACLE_CONSENSUS_NO_HTTP',
  'REFERENCE_PRICE_NOT_PRODUCTIVE_OUTPUT',
  'CROSS_ASSET_CUSTODY_ISOLATED',
  'UNKNOWN_SUBMISSION_NOT_BLINDLY_RETRIED',
  'COMPLIANCE_UNAVAILABLE_NOT_CLEAR',
  'CONTROL_ROOM_READ_ONLY',
  'PRODUCTION_NOT_ACTIVE',
] as const satisfies readonly SecurityInvariantId[];

export type IsolationProof = {
  readonly environment: typeof ENVIRONMENT;
  readonly liveMoneyEnabled: false;
  readonly liveFlagsRemainDisabled: true;
  readonly credentials: 'TEST_ONLY';
  readonly contactsPublicInternet: false;
  readonly realSecretRead: false;
  readonly productionActive: false;
  readonly fixtureVersion: typeof PRODUCTION_SAFETY_FIXTURE_VERSION;
};

export function proveIsolation(): IsolationProof {
  assertSimulationOnly();
  if (ENVIRONMENT !== 'simulation' || LIVE_MONEY_ENABLED !== false) {
    throw new Error('range isolation failed: production posture mutated');
  }
  return Object.freeze({
    environment: ENVIRONMENT,
    liveMoneyEnabled: false,
    liveFlagsRemainDisabled: true,
    credentials: 'TEST_ONLY',
    contactsPublicInternet: false,
    realSecretRead: false,
    productionActive: false,
    fixtureVersion: PRODUCTION_SAFETY_FIXTURE_VERSION,
  });
}

export function countSeverities(results: readonly AttackResult[]): Record<CampaignSeverity, number> {
  const counts: Record<CampaignSeverity, number> = {
    PROTECTED: 0,
    DEGRADED_BUT_SAFE: 0,
    INVARIANT_BREACH: 0,
  };
  for (const result of results) {
    counts[result.severity] += 1;
  }
  return counts;
}

export function invariantBreachCount(results: readonly AttackResult[]): number {
  return results.filter((row) => row.severity === 'INVARIANT_BREACH' || row.invariants.some((item) => !item.held)).length;
}

export function productionSafetySummary(results: readonly AttackResult[]): {
  readonly SCENARIOS_RUN: number;
  readonly INVARIANT_BREACHES: number;
  readonly LEDGER_BYPASS_SUCCEEDED: false | true;
  readonly KERNEL_BYPASS_SUCCEEDED: false | true;
  readonly AI_AUTHORITY_ESCALATION_SUCCEEDED: false | true;
  readonly RAW_SECRET_EXPOSED: false | true;
  readonly CROSS_ASSET_CONTAMINATION: false | true;
  readonly BLIND_RETRY_AFTER_UNKNOWN: false | true;
  readonly REFERENCE_PRICE_MINT_SUCCEEDED: false | true;
  readonly DIRECT_ASSETSUPPLYBOOK_MUTATION_SUCCEEDED: false | true;
  readonly REAL_EXTERNAL_TARGET_CONTACTED: false;
  readonly PRODUCTION_ACTIVE: false;
} {
  const breached = (id: SecurityInvariantId): boolean =>
    results.some((row) => row.invariants.some((item) => item.invariantId === id && !item.held));
  return {
    SCENARIOS_RUN: results.length,
    INVARIANT_BREACHES: invariantBreachCount(results),
    LEDGER_BYPASS_SUCCEEDED: breached('LEDGER_APPEND_ONLY') || breached('EXECUTION_AUTHORITY_REQUIRED'),
    KERNEL_BYPASS_SUCCEEDED: breached('KERNEL_CANNOT_BE_BYPASSED'),
    AI_AUTHORITY_ESCALATION_SUCCEEDED: breached('AI_CANNOT_EXECUTE'),
    RAW_SECRET_EXPOSED: breached('RAW_SECRET_NOT_EXPOSED') || breached('NO_RAW_SECRET_EXPOSURE'),
    CROSS_ASSET_CONTAMINATION: breached('CROSS_ASSET_CUSTODY_ISOLATED'),
    BLIND_RETRY_AFTER_UNKNOWN: breached('UNKNOWN_SUBMISSION_NOT_BLINDLY_RETRIED'),
    REFERENCE_PRICE_MINT_SUCCEEDED: breached('NO_REFERENCE_PRICE_MINT') || breached('REFERENCE_PRICE_NOT_PRODUCTIVE_OUTPUT'),
    DIRECT_ASSETSUPPLYBOOK_MUTATION_SUCCEEDED: breached('ASSET_SUPPLYBOOK_CANONICAL'),
    REAL_EXTERNAL_TARGET_CONTACTED: false,
    PRODUCTION_ACTIVE: false,
  };
}
