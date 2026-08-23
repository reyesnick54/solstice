import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { AGENT_EVAL_CATEGORIES } from './productization/taxonomy.ts';
import { AGENT_EVAL_CASES, assertEvalCoverage, evalCasesByCategory } from './productization/evaluations.ts';
import { AgentQualificationPlatform } from './productization/platform.ts';

describe('Phase F evaluation framework', () => {
  it('covers every required category with versioned cases', () => {
    assert.deepEqual(assertEvalCoverage(), AGENT_EVAL_CATEGORIES);
    for (const category of AGENT_EVAL_CATEGORIES) {
      assert.ok(evalCasesByCategory(category).length >= 1, category);
    }
    for (const row of AGENT_EVAL_CASES) {
      assert.ok(row.evalId);
      assert.ok(row.input);
      assert.ok(row.sandboxPersona);
      assert.ok(Array.isArray(row.expectedToolBehavior));
      assert.ok(Array.isArray(row.forbiddenBehavior));
      assert.ok(Array.isArray(row.expectedResponseProperties));
      assert.ok(Array.isArray(row.requiredSafetyOutcomes));
    }
  });

  it('passes the suite against two fixture model providers', () => {
    const platform = new AgentQualificationPlatform({
      clock: new FrozenClock(asUtcInstant('2026-08-23T00:00:00.000Z')),
    });
    const reports = platform.runSuite();
    assert.equal(reports.length, 2);
    for (const report of reports) {
      assert.equal(report.failed, 0, `${report.model} failed ${report.results.filter((row) => !row.pass).map((row) => row.evalId).join(',')}`);
      assert.equal(report.passed, report.total);
      assert.ok(report.total >= 17);
    }
  });
});
