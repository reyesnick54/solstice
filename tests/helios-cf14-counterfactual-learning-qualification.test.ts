/**
 * HELIOS CF14 — counterfactual learning final qualification (CF01–CF14).
 */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_TRADING_ENABLED } from '../packages/config/src/flags.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  HELIOS_COUNTERFACTUAL_LEARNING_V1_QUALIFIED,
  evaluateCounterfactualLearningQualification,
  listCfWorkPackages,
} from '../packages/platform/src/helios/counterfactual-learning/cf14-qualification.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const NOW = asUtcInstant('2026-11-06T12:00:00.000Z');
const ROOT = process.cwd();

describe('HELIOS CF14 — counterfactual learning qualification', () => {
  it('architecture guard: counterfactual-learning stays inside helios boundary', () => {
    const findings = lintHeliosBoundary(ROOT).filter((row) =>
      row.file.includes('helios/counterfactual-learning'),
    );
    assert.equal(findings.length, 0, JSON.stringify(findings));
  });

  it('production safety: simulation only', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_TRADING_ENABLED, false);
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

  it('lists CF01–CF13 as IMPLEMENTED', () => {
    const workPackages = listCfWorkPackages(ROOT);
    assert.ok(workPackages.every((row) => row.status === 'IMPLEMENTED'));
    assert.equal(workPackages.length, 13);
  });

  it('required counterfactual docs exist', () => {
    const docs = [
      'docs/helios/counterfactual/HELIOS_COUNTERFACTUAL_LEARNING_FINAL_REPORT.md',
      'docs/helios/counterfactual/COUNTERFACTUAL_CAPABILITY_MATRIX.md',
      'docs/helios/counterfactual/OFF_POLICY_VALIDATION_REPORT.md',
      'docs/helios/counterfactual/REJECTED_OPPORTUNITY_RESEARCH_REPORT.md',
      'docs/helios/counterfactual/COUNTERFACTUAL_MODEL_RISK_REPORT.md',
    ];
    for (const doc of docs) {
      assert.ok(existsSync(join(ROOT, doc)), doc);
    }
  });

  it('qualifies CF14 with marker HELIOS_COUNTERFACTUAL_LEARNING_V1_QUALIFIED', () => {
    const qualification = evaluateCounterfactualLearningQualification({
      root: ROOT,
      gitSha: 'cf14_qualify_sha',
      evaluatedAt: NOW,
    });
    assert.equal(qualification.qualified, true, qualification.blockers.join('; '));
    assert.equal(qualification.marker, HELIOS_COUNTERFACTUAL_LEARNING_V1_QUALIFIED);
    assert.equal(qualification.blockers.length, 0);
  });
});
