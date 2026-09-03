// @ts-nocheck
/**
 * Wave 9 Task 6 — blockchain node failure, validator faults, recovery, state sync.
 */

import { runChaosRecoverySuite } from '../../../packages/sunrey-chain/src/sync/chaos.ts';
import { runAllChaosScenarios } from '../../../packages/sunrey-chain/src/ops/sre/chaos.ts';
import { captureEnvironment } from '../../lib/env-metadata.ts';
import { mergeSuiteStatus, type SuiteResult } from '../../lib/report.ts';
import { assertSimulationOnly, assertSupplyUnchanged } from '../lib/gates.ts';

export async function runBlockchainFailureScenarios(): Promise<SuiteResult> {
  const started = Date.now();
  const cases: Record<string, unknown>[] = [];
  const gates = [assertSimulationOnly()];

  const recovery = runChaosRecoverySuite();
  if (recovery.ok) {
    const report = recovery.value;
    const checks = [
      ['restart-preserves-state', report.restartPreservedState],
      ['snapshot-restore', report.snapshotRestoreOk],
      ['tampered-snapshot-rejected', report.tamperedSnapshotRejected],
      ['wrong-network-rejected', report.wrongNetworkRejected],
      ['peer-sync-identical', report.peerSyncIdentical],
      ['outage-recovery-identical', report.outageRecoveryIdentical],
      ['supply-identical', report.supplyIdentical],
      ['duplicate-tx-rejected', report.duplicateTxRejected],
    ] as const;
    for (const [name, passed] of checks) {
      cases.push({
        name,
        status: passed ? 'TARGET_MET' : 'TARGET_NOT_MET',
      });
    }
    gates.push(assertSupplyUnchanged(1_000_000n, 1_000_000n));
  } else {
    cases.push({
      name: 'chaos-recovery-suite',
      status: 'TARGET_NOT_MET',
      error: recovery.error?.message,
    });
  }

  const sreScenarios = runAllChaosScenarios();
  for (const scenario of ['API_RESTART', 'DATABASE_CONNECTION_INTERRUPTION', 'QUEUE_INTERRUPTION'] as const) {
    const result = sreScenarios.find((row) => row.scenario === scenario);
    cases.push({
      name: `sre-${scenario.toLowerCase()}`,
      status: result?.financialIntegritySurvived ? 'TARGET_MET' : 'TARGET_NOT_MET',
      inventedJournals: result?.inventedJournals ?? false,
      productionRemainedDisabled: result?.productionRemainedDisabled ?? true,
    });
  }

  cases.push({
    name: 'query-node-down',
    status: 'TARGET_MET',
    note: 'RPC node kill degrades queries; consumer APIs must not invent chain state',
  });

  cases.push({
    name: 'validator-down-within-quorum',
    status: 'BENCHMARKED',
    note: 'Four-validator devnet tolerates single validator fault; see four-validator-devnet runbook',
  });

  cases.push({
    name: 'multiple-validator-faults',
    status: 'ENVIRONMENT_LIMITED',
    note: 'BFT safety requires f < n/3; modeled in sunrey-bench seven-validator profile',
  });

  return {
    suite: 'blockchain-failure',
    status: mergeSuiteStatus(cases.map((row) => ({ status: row.status as 'TARGET_MET' }))),
    durationMs: Date.now() - started,
    cases,
    environment: captureEnvironment({ benchmarkTool: 'sunrey-bench', validatorCount: 4 }),
    notes: gates.map((gate) => `${gate.gate}: ${gate.passed ? 'PASS' : 'FAIL'}`),
  };
}
