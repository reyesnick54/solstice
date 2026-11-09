/**
 * HELIOS ALPHA25 — autonomous shadow investment laboratory qualification.
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
  AUTONOMOUS_SHADOW_LAB_ARCHITECTURE_QUALIFIED,
  HELIOS_AUTONOMOUS_SHADOW_LAB_V1_QUALIFIED,
  SHADOW_LAB_CHAOS_SCENARIOS,
  SHADOW_LAB_LONG_RUN_STEPS,
  SHADOW_LAB_WORK_PACKAGES,
  buildShadowLabWorkPackageRegistry,
  evaluateAutonomousShadowLabQualification,
  evaluateShadowLabRealityGate,
  runShadowLabChaosHarness,
  runShadowLabLongRun,
} from '../packages/platform/src/helios/autonomous-shadow-lab/index.ts';
import { assertForwardAlphaProductionPosture } from '../packages/platform/src/helios/forward-alpha-evidence/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const NOW = asUtcInstant('2026-11-08T12:48:00.000Z');
const ROOT = process.cwd();

describe('HELIOS ALPHA25 — autonomous shadow lab qualification', () => {
  it('architecture guard: autonomous-shadow-lab stays inside helios boundary', () => {
    const findings = lintHeliosBoundary(ROOT).filter((row) =>
      row.file.includes('helios/autonomous-shadow-lab'),
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

  it('lists ALPHA16–ALPHA25 as QUALIFIED', () => {
    const rows = buildShadowLabWorkPackageRegistry(ROOT);
    assert.equal(rows.length, SHADOW_LAB_WORK_PACKAGES.length);
    assert.ok(
      rows.every((row) => row.status === 'QUALIFIED'),
      rows.filter((r) => r.status !== 'QUALIFIED').map((r) => r.workPackage).join(', '),
    );
  });

  it('required shadow-lab docs exist', () => {
    const docs = [
      'docs/helios/alpha/HELIOS_AUTONOMOUS_SHADOW_LAB_FINAL_REPORT.md',
      'docs/helios/alpha/SHADOW_LAB_CAPABILITY_MATRIX.md',
      'docs/helios/alpha/SHADOW_LAB_RESILIENCE_REPORT.md',
      'docs/helios/alpha/SHADOW_LAB_OPERATIONS_REPORT.md',
      'docs/helios/alpha/SHADOW_LAB_EVIDENCE_INTEGRITY_REPORT.md',
    ];
    for (const doc of docs) {
      assert.ok(existsSync(join(ROOT, doc)), doc);
    }
  });

  it('long-run simulation completes all steps without duplicate decisions', () => {
    const result = runShadowLabLongRun({
      campaignId: 'test-campaign',
      now: NOW,
      strategyIds: ['s1', 's2', 's3'],
      degradingStrategyId: 's3',
    });
    assert.equal(result.steps.length, SHADOW_LAB_LONG_RUN_STEPS.length);
    assert.equal(result.allStepsOk, true, result.steps.filter((s) => !s.ok).map((s) => s.step).join(', '));
    assert.equal(result.duplicateDecisionIds.length, 0);
    assert.equal(result.evidenceChainIntact, true);
    assert.equal(result.demotedStrategyId, 's3');
  });

  it('chaos harness recovers all scenarios without rewriting production history', () => {
    const chaos = runShadowLabChaosHarness();
    assert.equal(chaos.scenarios.length, SHADOW_LAB_CHAOS_SCENARIOS.length);
    assert.equal(chaos.allRecovered, true, chaos.scenarios.filter((s) => !s.recovered).map((s) => s.scenario).join(', '));
    assert.equal(chaos.anyHistoryRewritten, false);
  });

  it('real evidence gate: architecture qualified; not FORWARD_ALPHA_SUPPORTED under harness', () => {
    const gate = evaluateShadowLabRealityGate(true, 'SYNTHETIC_HARNESS');
    assert.equal(gate.architectureQualified, true);
    assert.equal(gate.forwardAlphaSupportedClaimed, false);
    assert.equal(gate.alphaRealityStatus, 'FORWARD_CAMPAIGN_READY');
    assert.ok(gate.notes.includes(AUTONOMOUS_SHADOW_LAB_ARCHITECTURE_QUALIFIED));
  });

  it('evaluates ALPHA25 qualification marker when modules, docs, and harness pass', () => {
    const result = evaluateAutonomousShadowLabQualification({
      root: ROOT,
      gitSha: '0'.repeat(40),
      evaluatedAt: NOW,
      subprocessGatesOk: true,
    });
    assert.equal(result.qualified, true, result.blockers.join('; '));
    assert.equal(result.marker, HELIOS_AUTONOMOUS_SHADOW_LAB_V1_QUALIFIED);
    assert.equal(result.realityGate.forwardAlphaSupportedClaimed, false);
  });
});
