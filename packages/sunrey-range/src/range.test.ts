import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { SMOKE_SCENARIO_IDS, runCampaign, runSmokeCampaign } from './campaign.ts';
import { SCENARIO_CATALOG, runScenarioIsolated, scenarioById } from './catalog.ts';
import { createRangeEnvironment } from './environment.ts';
import { containsSecrets, evidenceRecord, redact } from './evidence.ts';
import { catalogComplete, INVARIANT_CATALOG, invariantIds } from './invariants.ts';
import { SECURITY_INVARIANT_IDS } from './types.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');

describe('sunrey adversarial range', () => {
  it('registers at least 50 deterministic scenarios spanning major subsystems', () => {
    assert.ok(SCENARIO_CATALOG.length >= 50, `catalog size ${SCENARIO_CATALOG.length}`);
    const prefixes = new Set(SCENARIO_CATALOG.map((row) => row.scenarioId.split('-')[0]));
    for (const required of ['BFT', 'NET', 'SIGNER', 'WALLET', 'ORACLE', 'MOONREY', 'MACHINE', 'EXCH', 'INFO', 'CUSTODY', 'GOV', 'INTEROP', 'API', 'COMPOUND']) {
      assert.equal(prefixes.has(required), true, required);
    }
    const ids = SCENARIO_CATALOG.map((row) => row.scenarioId);
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(SCENARIO_CATALOG.every((row) => row.initialState.testCredentialsOnly && row.initialState.validatorCount === 7), true);
  });

  it('has a complete machine-readable invariant catalog', () => {
    assert.equal(catalogComplete(), true);
    assert.deepEqual(invariantIds(), SECURITY_INVARIANT_IDS);
    for (const id of SECURITY_INVARIANT_IDS) {
      assert.equal(typeof INVARIANT_CATALOG[id].statement, 'string');
    }
  });

  it('creates an isolated 7-validator range with test-only credentials', () => {
    const env = createRangeEnvironment(57);
    assert.equal(env.credentials, 'TEST_ONLY');
    assert.equal(env.actors.filter((row) => row.role === 'VALIDATOR').length, 7);
    assert.equal(env.network.networkId, 'net_sunrey_range_dev');
    assert.match(env.testnetGenesis, /^[0-9a-f]{64}$/);
  });

  it('runs the bounded smoke campaign', () => {
    const report = runSmokeCampaign();
    assert.equal(report.scenarioCount, SMOKE_SCENARIO_IDS.length);
    assert.equal(report.failed, 0, report.results.filter((row) => !row.passed).map((row) => `${row.scenarioId}:${row.notes}`).join('; '));
    assert.equal(report.scorecard.label, 'ENGINEERING_TEST_SCORECARD');
    assert.equal(report.scorecard.notAMarketingRating, true);
    assert.equal(report.scorecard.categories.LIVE_INTERNET_SCANNING, 'OUT_OF_SCOPE');
  });

  it('replays a scenario deterministically and stores secret-free evidence', () => {
    const first = runScenarioIsolated('BFT-DOUBLE-PROPOSAL');
    const second = runScenarioIsolated('BFT-DOUBLE-PROPOSAL');
    assert.equal(first.passed, true);
    assert.equal(first.attackBlocked, second.attackBlocked);
    assert.equal(first.safetyHeld, second.safetyHeld);
    assert.equal(first.notes, second.notes);
    const record = evidenceRecord(first);
    assert.equal(record.secretsPresent, false);
    assert.equal(containsSecrets(redact(record)), false);
  });

  it('can look up every catalog id', () => {
    for (const row of SCENARIO_CATALOG) {
      assert.equal(scenarioById(row.scenarioId)?.scenarioId, row.scenarioId);
    }
  });

  it('keeps the required assurance documents', () => {
    assert.equal(existsSync(join(ROOT, 'docs/assurance/chunk-57-adversarial-range.md')), true);
    assert.equal(existsSync(join(ROOT, 'docs/assurance/attack-matrix.md')), true);
    assert.equal(existsSync(join(ROOT, 'docs/assurance/security-invariants.md')), true);
    assert.equal(existsSync(join(ROOT, 'docs/assurance/range-operations.md')), true);
    assert.equal(existsSync(join(ROOT, 'docs/architecture/chunk-57-adversarial-range.md')), true);
    const matrix = readFileSync(join(ROOT, 'docs/assurance/attack-matrix.md'), 'utf8');
    for (const row of SCENARIO_CATALOG) {
      assert.equal(matrix.includes(row.scenarioId), true, row.scenarioId);
    }
  });

  it('does not create a competing red-team package', () => {
    assert.equal(existsSync(join(ROOT, 'packages/red-team')), false);
    assert.equal(existsSync(join(ROOT, 'packages/attack-sim')), false);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-pentest')), false);
  });

  it('runs the full catalog when RANGE_FULL_CAMPAIGN=1', { skip: process.env.RANGE_FULL_CAMPAIGN !== '1' }, () => {
    const report = runCampaign();
    assert.ok(report.scenarioCount >= 50);
    assert.equal(report.failed, 0, report.results.filter((row) => !row.passed).map((row) => `${row.scenarioId}:${row.notes}`).join('; '));
  });
});
