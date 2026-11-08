/**
 * HELIOS ALPHA15 — forward-alpha evidence final qualification and reality gate.
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
  ALPHA_WORK_PACKAGES,
  HELIOS_FORWARD_ALPHA_EVIDENCE_V1_QUALIFIED,
  architectureMarkerImpliesAlphaProven,
  assertForwardAlphaProductionPosture,
  buildAlphaWorkPackageRegistry,
  clampRealityStatusForSourceKind,
  defaultSimulationRealityGateInput,
  evaluateForwardAlphaEvidenceQualification,
  isInvestmentPerformanceProofStatus,
  resolveAlphaRealityGate,
  sourceKindForbiddenForPerformanceProof,
} from '../packages/platform/src/helios/forward-alpha-evidence/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const NOW = asUtcInstant('2026-11-08T07:45:00.000Z');
const ROOT = process.cwd();

describe('HELIOS ALPHA15 — forward alpha evidence qualification', () => {
  it('architecture guard: forward-alpha-evidence stays inside helios boundary', () => {
    const findings = lintHeliosBoundary(ROOT).filter((row) =>
      row.file.includes('helios/forward-alpha-evidence'),
    );
    assert.equal(findings.length, 0, JSON.stringify(findings));
  });

  it('production safety: simulation only; live surfaces disabled', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_TRADING_ENABLED, false);
    assert.equal(LIVE_INVESTMENT_EXECUTION, false);
    assert.equal(LIVE_CUSTODY_ENABLED, false);
    assert.doesNotThrow(() => assertForwardAlphaProductionPosture(ROOT));
    const mapPath = join(ROOT, 'docs/productization/sunrey-authority-map.json');
    const map = JSON.parse(readFileSync(mapPath, 'utf8')) as {
      productionPosture?: { production_authorized?: boolean };
    };
    assert.equal(map.productionPosture?.production_authorized, false);
  });

  it('lists ALPHA01–ALPHA15 as QUALIFIED', () => {
    const rows = buildAlphaWorkPackageRegistry(ROOT);
    assert.equal(rows.length, ALPHA_WORK_PACKAGES.length);
    assert.ok(
      rows.every((row) => row.status === 'QUALIFIED'),
      rows.filter((r) => r.status !== 'QUALIFIED').map((r) => r.workPackage).join(', '),
    );
  });

  it('required forward-alpha docs exist', () => {
    const docs = [
      'docs/helios/alpha/HELIOS_FORWARD_ALPHA_FINAL_REPORT.md',
      'docs/helios/alpha/FORWARD_ALPHA_CAPABILITY_MATRIX.md',
      'docs/helios/alpha/FORWARD_ALPHA_STATISTICAL_VALIDATION.md',
      'docs/helios/alpha/FORWARD_ALPHA_EXECUTION_REPORT.md',
      'docs/helios/alpha/FORWARD_ALPHA_REGIME_REPORT.md',
      'docs/helios/alpha/FORWARD_ALPHA_CAPACITY_REPORT.md',
      'docs/helios/alpha/FORWARD_ALPHA_REALITY_GATE.md',
    ];
    for (const doc of docs) {
      assert.ok(existsSync(join(ROOT, doc)), doc);
    }
  });

  it('AlphaRealityGate: simulation defaults to FORWARD_CAMPAIGN_READY or lower', () => {
    const gate = resolveAlphaRealityGate(defaultSimulationRealityGateInput());
    assert.ok(
      gate.status === 'ARCHITECTURE_QUALIFIED' || gate.status === 'FORWARD_CAMPAIGN_READY',
      gate.status,
    );
    assert.equal(architectureMarkerImpliesAlphaProven(gate.status), false);
    assert.equal(gate.investmentPerformanceClaimed, false);
  });

  it('synthetic fixtures never yield investment-performance proof statuses', () => {
    const attempts: Array<ReturnType<typeof defaultSimulationRealityGateInput>> = [
      defaultSimulationRealityGateInput({
        sourceKind: 'SYNTHETIC_HARNESS',
        chronologicalForwardDecisionCount: 99,
        preliminaryPositiveForward: true,
        statisticalPolicySatisfied: true,
        paperExecutionAfterRealisticCosts: true,
        liveRegulatedCapitalEvidence: true,
        liveTradingEnabled: true,
        liveInvestmentExecution: true,
      }),
      defaultSimulationRealityGateInput({
        sourceKind: 'HISTORICAL_FIXTURE',
        chronologicalForwardDecisionCount: 50,
        preliminaryPositiveForward: true,
        statisticalPolicySatisfied: true,
        robustnessRegimesSatisfied: 3,
      }),
    ];
    for (const input of attempts) {
      const gate = resolveAlphaRealityGate(input);
      assert.equal(isInvestmentPerformanceProofStatus(gate.status), false, gate.status);
      assert.equal(sourceKindForbiddenForPerformanceProof(input.sourceKind), true);
      const clamped = clampRealityStatusForSourceKind('FORWARD_ALPHA_SUPPORTED', input.sourceKind);
      assert.equal(isInvestmentPerformanceProofStatus(clamped), false);
    }
  });

  it('LIVE_ALPHA_SUPPORTED impossible while live flags are false', () => {
    const gate = resolveAlphaRealityGate(
      defaultSimulationRealityGateInput({
        sourceKind: 'GENUINE_FORWARD_CAMPAIGN',
        chronologicalForwardDecisionCount: 120,
        preliminaryPositiveForward: true,
        statisticalPolicySatisfied: true,
        robustnessRegimesSatisfied: 3,
        paperExecutionAfterRealisticCosts: true,
        liveRegulatedCapitalEvidence: true,
        liveTradingEnabled: false,
        liveInvestmentExecution: false,
      }),
    );
    assert.notEqual(gate.status, 'LIVE_ALPHA_SUPPORTED');
  });

  it('evaluates ALPHA15 qualification marker when modules and docs present', () => {
    const result = evaluateForwardAlphaEvidenceQualification({
      root: ROOT,
      gitSha: '0'.repeat(40),
      evaluatedAt: NOW,
      subprocessGatesOk: true,
    });
    assert.equal(result.qualified, true, result.blockers.join('; '));
    assert.equal(result.marker, HELIOS_FORWARD_ALPHA_EVIDENCE_V1_QUALIFIED);
    assert.equal(result.realityGate.investmentPerformanceClaimed, false);
  });
});
