/**
 * ACCESS-22 cross-package integration qualification.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  ACCESS_22_INVARIANT_IDS,
  ACCESS_22_SCENARIO_IDS,
  ACCESS_DUAL_ECONOMY_ENGINEERING_QUALIFIED,
  qualifyDualEconomyAccess,
} from '../packages/sunrey-economics/src/dual-economy-access-stress/index.ts';
import { runEconomicsCommand } from '../packages/sunrey-economics/src/cli.ts';
import { qualifyAccessEconomy } from '../packages/sunrey-economics/src/access-economy/index.ts';
import { runStressCampaign } from '../packages/sunrey-economics/src/stress/campaign.ts';

describe('ACCESS-22 full dual-economy access qualification', () => {
  it('qualifies all 45 scenarios with every invariant holding at SCALE_1K', () => {
    const report = qualifyDualEconomyAccess({ seed: 22022, monteCarloRuns: 25 });
    assert.equal(report.scenarioCount, 45);
    assert.equal(report.invariantCount, ACCESS_22_INVARIANT_IDS.length);
    assert.deepEqual(report.invariantViolations, []);
    assert.equal(report.qualificationState, ACCESS_DUAL_ECONOMY_ENGINEERING_QUALIFIED);
  });

  it('composes with ACCESS-13 and Chunk 76 stress without regression', () => {
    const access13 = qualifyAccessEconomy({ seed: 22022 });
    const stress = runStressCampaign('access-economy');
    const access22 = qualifyDualEconomyAccess({ seed: 22022, monteCarloRuns: 15 });
    assert.equal(access13.allInvariantsHeld, true);
    assert.equal(stress.violations, 0);
    assert.equal(access22.allInvariantsHeld, true);
  });

  it('exposes access22 CLI qualify plane', () => {
    const output = runEconomicsCommand(['access22', 'qualify', '--seed', '22022']);
    assert.match(output, /ACCESS_DUAL_ECONOMY_ENGINEERING_QUALIFIED/);
    assert.match(output, /violations=0/);
  });

  it('records qualification documentation', () => {
    const doc = readFileSync('docs/economics/ACCESS_22_FULL_ECONOMIC_QUALIFICATION.md', 'utf8');
    assert.match(doc, /ACCESS-22/);
    assert.match(doc, /45/);
    assert.match(doc, /ACCESS_DUAL_ECONOMY_ENGINEERING_QUALIFIED/);
    assert.match(doc, /ACCESS22-01/);
    assert.match(doc, /ACCESS22-45/);
  });
});
