/**
 * HELIOS EXEC14 — broker and custody provider conformance certification.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LIVE_CUSTODY_ENABLED, LIVE_INVESTMENT_EXECUTION, LIVE_TRADING_ENABLED } from '../packages/config/src/flags.ts';
import {
  EXEC14_BROKER_CONFORMANCE_CASES,
  EXEC14_CUSTODY_CONFORMANCE_CASES,
  HELIOS_EXEC14_PROVIDER_CONFORMANCE_QUALIFIED,
  assertBrokerManifestFailClosed,
  decideProviderProductionState,
  evaluateExec14ProviderConformanceQualification,
  fixtureSandboxBrokerManifest,
  fixtureSandboxCustodyManifest,
  fixtureSandboxProviderEvidence,
  runBrokerConformanceSuite,
  runCustodyConformanceSuite,
} from '../packages/platform/src/helios/execution-connectivity/exec14/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

describe('HELIOS EXEC14 provider conformance', () => {
  it('declares broker and custody capability manifests fail-closed', () => {
    const broker = fixtureSandboxBrokerManifest();
    const custody = fixtureSandboxCustodyManifest();
    assert.deepEqual(assertBrokerManifestFailClosed(broker), []);
    assert.equal(broker.liveOrderPlacementEnabled, false);
    assert.equal(custody.liveNetworkConnected, false);
    assert.equal(broker.streamingExecutionReports.availability, 'AVAILABLE');
    assert.equal(broker.dropCopy.availability, 'UNAVAILABLE');
  });

  it('runs broker conformance suite across required cases', () => {
    const suite = runBrokerConformanceSuite(fixtureSandboxBrokerManifest());
    assert.equal(suite.conformancePassed, true);
    assert.equal(suite.productionQualified, false);
    assert.equal(suite.externalApprovalRequired, true);
    const caseIds = new Set(suite.checks.map((row) => row.caseId));
    for (const required of EXEC14_BROKER_CONFORMANCE_CASES) {
      assert.ok(caseIds.has(required), `missing broker case ${required}`);
    }
  });

  it('runs custody conformance suite across required cases', () => {
    const suite = runCustodyConformanceSuite(fixtureSandboxCustodyManifest());
    assert.equal(suite.conformancePassed, true);
    assert.equal(suite.productionQualified, false);
    const caseIds = new Set(suite.checks.map((row) => row.caseId));
    for (const required of EXEC14_CUSTODY_CONFORMANCE_CASES) {
      assert.ok(caseIds.has(required), `missing custody case ${required}`);
    }
  });

  it('does not production-qualify providers when conformance alone passes', () => {
    const evidence = fixtureSandboxProviderEvidence('fixture_broker_exec14', 'BROKER');
    const decision = decideProviderProductionState(evidence);
    assert.equal(decision.productionActivationPossible, false);
    assert.equal(decision.state, 'PRODUCTION_DISABLED');
    assert.ok(decision.blockers.length > 0);
  });

  it('HELIOS_EXEC14_PROVIDER_CONFORMANCE_QUALIFIED when broker and custody suites pass', () => {
    const qualification = evaluateExec14ProviderConformanceQualification();
    assert.equal(qualification.marker, HELIOS_EXEC14_PROVIDER_CONFORMANCE_QUALIFIED);
    assert.equal(qualification.qualified, true);
    assert.equal(LIVE_TRADING_ENABLED, false);
    assert.equal(LIVE_INVESTMENT_EXECUTION, false);
    assert.equal(LIVE_CUSTODY_ENABLED, false);
    const findings = lintHeliosBoundary(process.cwd());
    assert.equal(findings.length, 0);
  });
});
