import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  PRODUCTION_SAFETY_EXTENDED_IDS,
  PRODUCTION_SAFETY_SMOKE_IDS,
  runProductionSafetySmokeCampaign,
} from './campaign.ts';
import { SCENARIO_CATALOG, runScenarioIsolated, scenarioById } from './catalog.ts';
import { ENVIRONMENT, LIVE_MONEY_ENABLED } from '../../config/src/flags.ts';
import {
  CRITICAL_PRODUCTION_INVARIANTS,
  proveIsolation,
  productionSafetySummary,
} from './production-safety.ts';
import { PRODUCTION_SAFETY_FIXTURE_VERSION } from './types.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');

describe('chunk 157 production safety campaign', () => {
  it('gives every new scenario a deterministic seed, fixture version, and invariant set', () => {
    const production = SCENARIO_CATALOG.filter((row) => row.fixtureVersion === PRODUCTION_SAFETY_FIXTURE_VERSION);
    assert.ok(production.length >= 90, `production catalog ${production.length}`);
    const ids = production.map((row) => row.scenarioId);
    assert.equal(new Set(ids).size, ids.length);
    const seeds = new Set(production.map((row) => row.seed));
    assert.equal(seeds.size, production.length);
    for (const row of production) {
      assert.ok(row.seed > 0);
      assert.ok(row.expectedSecurityProperties.length > 0, row.scenarioId);
      assert.equal(row.initialState.testCredentialsOnly, true);
    }
  });

  it('runs the bounded production-safety smoke campaign without invariant breaches', () => {
    const report = runProductionSafetySmokeCampaign();
    assert.equal(report.scenarioCount, PRODUCTION_SAFETY_SMOKE_IDS.length);
    assert.equal(report.failed, 0, report.results.filter((row) => !row.passed).map((row) => `${row.scenarioId}:${row.notes}`).join('; '));
    assert.equal(report.invariantBreaches, 0);
    assert.equal(report.severities.INVARIANT_BREACH, 0);
    const summary = productionSafetySummary(report.results);
    assert.equal(summary.INVARIANT_BREACHES, 0);
    assert.equal(summary.LEDGER_BYPASS_SUCCEEDED, false);
    assert.equal(summary.KERNEL_BYPASS_SUCCEEDED, false);
    assert.equal(summary.AI_AUTHORITY_ESCALATION_SUCCEEDED, false);
    assert.equal(summary.RAW_SECRET_EXPOSED, false);
    assert.equal(summary.CROSS_ASSET_CONTAMINATION, false);
    assert.equal(summary.BLIND_RETRY_AFTER_UNKNOWN, false);
    assert.equal(summary.REFERENCE_PRICE_MINT_SUCCEEDED, false);
    assert.equal(summary.DIRECT_ASSETSUPPLYBOOK_MUTATION_SUCCEEDED, false);
    assert.equal(summary.REAL_EXTERNAL_TARGET_CONTACTED, false);
    assert.equal(summary.PRODUCTION_ACTIVE, false);
    for (const id of CRITICAL_PRODUCTION_INVARIANTS) {
      const held = report.results.some((row) => row.invariants.some((item) => item.invariantId === id && item.held));
      assert.equal(held, true, id);
    }
  });

  it('replays a production-safety scenario deterministically', () => {
    const first = runScenarioIsolated('CRED-WRONG-WORKLOAD');
    const second = runScenarioIsolated('CRED-WRONG-WORKLOAD');
    assert.equal(first.passed, true);
    assert.equal(first.severity, second.severity);
    assert.equal(first.attackBlocked, second.attackBlocked);
    assert.equal(first.safetyHeld, second.safetyHeld);
    assert.equal(first.notes, second.notes);
    assert.equal(first.seed, second.seed);
    assert.equal(first.fixtureVersion, PRODUCTION_SAFETY_FIXTURE_VERSION);
    assert.doesNotMatch(first.notes, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });

  it('cannot contact an external network, read a real secret, or mutate LIVE flags', () => {
    const isolation = proveIsolation();
    assert.equal(isolation.contactsPublicInternet, false);
    assert.equal(isolation.realSecretRead, false);
    assert.equal(isolation.liveFlagsRemainDisabled, true);
    assert.equal(isolation.productionActive, false);
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_MONEY_ENABLED, false);
    for (const id of PRODUCTION_SAFETY_SMOKE_IDS) {
      const scenario = scenarioById(id);
      assert.ok(scenario, id);
      assert.equal(scenario.initialState.testCredentialsOnly, true);
    }
  });

  it('does not create a second range or pentest package', () => {
    assert.equal(existsSync(join(ROOT, 'packages/red-team')), false);
    assert.equal(existsSync(join(ROOT, 'packages/chaos-v2')), false);
    assert.equal(existsSync(join(ROOT, 'packages/security-range-v2')), false);
    assert.equal(existsSync(join(ROOT, 'packages/pentest')), false);
    assert.equal(existsSync(join(ROOT, 'packages/adversarial-v2')), false);
  });

  it('keeps the extended campaign larger than smoke', () => {
    assert.ok(PRODUCTION_SAFETY_EXTENDED_IDS.length > PRODUCTION_SAFETY_SMOKE_IDS.length);
  });
});
