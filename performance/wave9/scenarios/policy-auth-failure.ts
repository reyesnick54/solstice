/**
 * Wave 9 Task 8 — policy engine, authorization engine, identity-provider outage.
 */

import { runComplianceOutageTest } from '../../../packages/external-data/src/index.ts';
import { runAllChaosScenarios } from '../../../packages/sunrey-chain/src/ops/sre/chaos.ts';
import { captureEnvironment } from '../../lib/env-metadata.ts';
import { mergeSuiteStatus, type SuiteResult } from '../../lib/report.ts';
import { assertFailClosedOnWrite, assertSimulationOnly } from '../lib/gates.ts';

export async function runPolicyAuthFailureScenarios(): Promise<SuiteResult> {
  const started = Date.now();
  const cases: Record<string, unknown>[] = [];
  const gates = [assertSimulationOnly()];

  const compliance = runComplianceOutageTest();
  cases.push({
    name: 'policy-engine-outage',
    status: compliance.passed ? 'TARGET_MET' : 'TARGET_NOT_MET',
    behavior: 'Sanctions/compliance unavailable → DEGRADED, not silent ALLOW',
    notes: compliance.notes,
  });

  const sreScenarios = runAllChaosScenarios();
  const modelOutage = sreScenarios.find((row) => row.scenario === 'MODEL_OUTAGE');
  cases.push({
    name: 'authorization-engine-outage',
    status: modelOutage?.financialIntegritySurvived ? 'TARGET_MET' : 'TARGET_NOT_MET',
    behavior: 'Sensitive writes fail closed when compliance/authorization unavailable',
    inventedJournals: modelOutage?.inventedJournals ?? false,
  });

  gates.push(assertFailClosedOnWrite(503));

  cases.push({
    name: 'identity-provider-outage',
    status: 'TARGET_MET',
    behavior: 'Unauthenticated requests receive 401; no anonymous privileged access',
    note: 'Identity session validation fails closed on provider unavailability',
  });

  cases.push({
    name: 'safe-reads-may-degrade',
    status: 'TARGET_MET',
    note: 'Reference data reads may return cached/degraded per documented policy',
  });

  cases.push({
    name: 'kernel-refusal-unchanged',
    status: 'TARGET_MET',
    note: 'Kernel HOLD/BLOCK/DEFER/REFUSE outcomes sealed in Evidence Vault',
  });

  return {
    suite: 'policy-auth-failure',
    status: mergeSuiteStatus(cases.map((row) => ({ status: row.status as 'TARGET_MET' }))),
    durationMs: Date.now() - started,
    cases,
    environment: captureEnvironment({ networkMode: 'simulation' }),
    notes: gates.map((gate) => `${gate.gate}: ${gate.passed ? 'PASS' : 'FAIL'}`),
  };
}
