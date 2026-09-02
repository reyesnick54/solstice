/**
 * Wave 9 — CI-fast chaos and reliability regression gate.
 */

import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_MONEY_ENABLED, LIVE_PAYMENTS_ENABLED } from '../packages/config/src/flags.ts';
import { runChaosRecoverySuite } from '../packages/sunrey-chain/src/sync/chaos.ts';
import {
  runComplianceOutageTest,
  runRateLimitStormTest,
  runTwentyFiveProviderOutageTest,
} from '../packages/external-data/src/index.ts';
import { ExchangeSettlementRecovery } from '../packages/sunrey-exchange/src/operation-recovery.ts';
import { runEventBacklogScenarios } from '../performance/wave9/scenarios/event-backlog.ts';
import { runRateLimitBehavior } from '../performance/wave9/scenarios/rate-limit.ts';
import { runBlockchainFailureScenarios } from '../performance/wave9/scenarios/blockchain-failure.ts';
import { runExchangeFailureScenarios } from '../performance/wave9/scenarios/exchange-failure.ts';
import { BOTTLENECK_FINDINGS } from '../performance/wave9/scenarios/bottleneck-report.ts';
import { PRODUCTION_INFRASTRUCTURE_REQUIREMENTS } from '../performance/wave9/scenarios/regional-failure.ts';

const ROOT = join(import.meta.dirname, '..');

describe('Wave 9 — reliability and chaos regression', () => {
  it('1. simulation-only guard holds', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_MONEY_ENABLED, false);
    assert.equal(LIVE_PAYMENTS_ENABLED, false);
  });

  it('2. blockchain chaos recovery suite passes', () => {
    const result = runChaosRecoverySuite();
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.restartPreservedState, true);
      assert.equal(result.value.supplyIdentical, true);
      assert.equal(result.value.duplicateTxRejected, true);
    }
  });

  it('3. provider outage degrades without crash', () => {
    const outage = runTwentyFiveProviderOutageTest();
    assert.equal(outage.passed, true);
    const compliance = runComplianceOutageTest();
    assert.equal(compliance.passed, true);
    const rateLimit = runRateLimitStormTest();
    assert.equal(rateLimit.passed, true);
  });

  it('4. event backlog idempotency and dead-letter', async () => {
    const result = await runEventBacklogScenarios();
    assert.notEqual(result.status, 'TARGET_NOT_MET');
    const idempotent = result.cases.find((row) => row.name === 'idempotent-consumer-recovery');
    assert.ok(idempotent);
    assert.equal(idempotent.status, 'TARGET_MET');
  });

  it('5. rate limit produces controlled 429', async () => {
    const result = await runRateLimitBehavior();
    const rateLimitCase = result.cases.find((row) => row.name === 'rate-limit-429-after-threshold');
    assert.ok(rateLimitCase);
    assert.equal(rateLimitCase.status, 'TARGET_MET');
    const noCrash = result.cases.find((row) => row.name === 'api-burst-no-crash');
    assert.ok(noCrash);
    assert.equal(noCrash.status, 'TARGET_MET');
  });

  it('6. exchange settlement recovery is idempotent', async () => {
    const result = await runExchangeFailureScenarios();
    assert.notEqual(result.status, 'TARGET_NOT_MET');
    const recovery = new ExchangeSettlementRecovery();
    void recovery.prepare(
      {
        tradeId: 'tr_ci',
        settlementId: 'set_ci',
        buyAssetId: 'SUNREY_COIN',
        sellAssetId: 'MOONREY_COIN',
        buyQuantityMinor: '1',
        sellQuantityMinor: '2',
      },
      '2026-09-02T12:00:00.000Z',
    );
    recovery.recordTrade();
    recovery.reserve();
    recovery.startDvp();
    recovery.finalizeChainLeg();
    recovery.applySettlementCallback();
    assert.equal(recovery.duplicateCallbackIsNoop(), true);
  });

  it('7. blockchain failure scenarios pass', async () => {
    const result = await runBlockchainFailureScenarios();
    assert.notEqual(result.status, 'TARGET_NOT_MET');
  });

  it('8. bottleneck report and regional requirements documented', () => {
    assert.ok(BOTTLENECK_FINDINGS.length >= 5);
    assert.ok(PRODUCTION_INFRASTRUCTURE_REQUIREMENTS.redundancy.length > 0);
    assert.match(String(PRODUCTION_INFRASTRUCTURE_REQUIREMENTS.rpo), /not contractual/i);
  });

  it('9. Wave 9 documentation exists', () => {
    assert.equal(existsSync(join(ROOT, 'docs/security/WAVE9_RELIABILITY_AND_CHAOS_REPORT.md')), true);
    assert.equal(existsSync(join(ROOT, 'docs/runbooks/SUNREY_DISASTER_RECOVERY_MASTER_RUNBOOK.md')), true);
    assert.equal(existsSync(join(ROOT, 'performance/wave9/README.md')), true);
  });

  it('10. chaos scripts restricted to simulation', () => {
    for (const script of [
      'scripts/chaos/restart-sandbox.mjs',
      'scripts/chaos/provider-failure.mjs',
      'scripts/chaos/blockchain-recovery.mjs',
      'scripts/chaos/network-delay.mjs',
      'scripts/chaos/service-unavailable.mjs',
    ]) {
      assert.equal(existsSync(join(ROOT, script)), true);
    }
  });
});
