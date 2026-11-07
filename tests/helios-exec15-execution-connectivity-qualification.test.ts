/**
 * HELIOS EXEC15 — broker, custody, and execution connectivity qualification.
 */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  ENVIRONMENT,
  LIVE_CUSTODY_ENABLED,
  LIVE_INVESTMENT_EXECUTION,
  LIVE_TRADING_ENABLED,
} from '../packages/config/src/flags.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  EXEC15_ADVERSARIAL_SCENARIO_IDS,
  EXEC15_E2E_PIPELINE_STAGES,
  EXEC_WORK_PACKAGES,
  HELIOS_BROKER_CUSTODY_EXECUTION_V1_QUALIFIED,
  evaluateExecutionConnectivityQualification,
  listExecWorkPackages,
  runAllExec15AdversarialScenarios,
  runExec15SyntheticE2ePipeline,
  assertExecutionConnectivityRealitySafe,
  describeExecutionConnectivityRealityPosture,
} from '../packages/platform/src/helios/execution-connectivity/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const NOW = asUtcInstant('2026-11-07T16:00:00.000Z');
const ROOT = process.cwd();

describe('HELIOS EXEC15 — execution connectivity qualification', () => {
  it('architecture guard: execution-connectivity package stays inside helios boundary', () => {
    const findings = lintHeliosBoundary(ROOT).filter((row) => row.file.includes('helios/execution-connectivity'));
    assert.equal(findings.length, 0, JSON.stringify(findings));
  });

  it('production safety: simulation only; live execution and custody disabled', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_TRADING_ENABLED, false);
    assert.equal(LIVE_INVESTMENT_EXECUTION, false);
    assert.equal(LIVE_CUSTODY_ENABLED, false);
    const mapPath = join(ROOT, 'docs/productization/sunrey-authority-map.json');
    const freezePath = join(ROOT, 'docs/productization/sunrey-architecture-freeze.json');
    assert.ok(existsSync(mapPath));
    assert.ok(existsSync(freezePath));
    const map = JSON.parse(readFileSync(mapPath, 'utf8')) as {
      productionPosture?: { production_authorized?: boolean };
    };
    const freeze = JSON.parse(readFileSync(freezePath, 'utf8')) as {
      productionPosture?: { production_authorized?: boolean };
    };
    assert.equal(map.productionPosture?.production_authorized, false);
    assert.equal(freeze.productionPosture?.production_authorized, false);
  });

  it('reality gate passes under simulation posture', () => {
    assert.doesNotThrow(() => assertExecutionConnectivityRealitySafe(ROOT));
    const posture = describeExecutionConnectivityRealityPosture(ROOT);
    assert.equal(posture.liveTradingEnabled, false);
    assert.equal(posture.productionAuthorized, false);
  });

  it('lists EXEC01–EXEC15 as IMPLEMENTED', () => {
    const workPackages = listExecWorkPackages(ROOT);
    assert.equal(workPackages.length, EXEC_WORK_PACKAGES.length);
    assert.ok(
      workPackages.every((row) => row.status === 'IMPLEMENTED'),
      workPackages.filter((r) => r.status !== 'IMPLEMENTED').map((r) => r.packageId).join(', '),
    );
  });

  it('required execution docs exist', () => {
    const docs = [
      'docs/helios/execution/HELIOS_EXECUTION_CONNECTIVITY_FINAL_REPORT.md',
      'docs/helios/execution/EXECUTION_CAPABILITY_MATRIX.md',
      'docs/helios/execution/BROKER_CONFORMANCE_REPORT.md',
      'docs/helios/execution/CUSTODY_RECONCILIATION_REPORT.md',
      'docs/helios/execution/EXECUTION_CHAOS_REPORT.md',
      'docs/helios/execution/BEST_EXECUTION_ENGINEERING_EVIDENCE.md',
    ];
    for (const doc of docs) {
      assert.ok(existsSync(join(ROOT, doc)), doc);
    }
  });

  it('runs synthetic E2E pipeline without granting live authority', () => {
    const result = runExec15SyntheticE2ePipeline({
      nowUtc: NOW,
      eventTime: '2026-06-01T14:30:00.000Z',
      knowableAt: '2026-06-01T14:30:00.500Z',
      mandateMaxNotionalMinor: 2_000_000n,
      proposedNotionalMinor: 100_000n,
      kernelAllowed: true,
    });
    assert.equal(result.stages.length, EXEC15_E2E_PIPELINE_STAGES.length);
    assert.equal(result.ok, true);
    assert.equal(result.grantsExecutionAuthority, false);
    assert.equal(result.grantsLiveBrokerSubmit, false);
  });

  it('passes fifteen adversarial scenarios', () => {
    assert.equal(EXEC15_ADVERSARIAL_SCENARIO_IDS.length, 15);
    const rows = runAllExec15AdversarialScenarios();
    assert.equal(rows.length, 15);
    assert.ok(rows.every((row) => row.passed), rows.filter((r) => !r.passed).map((r) => r.scenarioId).join(', '));
  });

  it('evaluates EXEC15 qualification marker when docs and modules present', () => {
    const result = evaluateExecutionConnectivityQualification({
      root: ROOT,
      gitSha: '0'.repeat(40),
      evaluatedAt: NOW,
      subprocessGatesOk: true,
    });
    assert.equal(result.qualified, true, result.blockers.join('; '));
    assert.equal(result.marker, HELIOS_BROKER_CUSTODY_EXECUTION_V1_QUALIFIED);
    assert.equal(result.adversarialScenariosPassed, 15);
    assert.equal(result.e2ePipelineOk, true);
  });
});
