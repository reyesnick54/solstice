/**
 * HELIOS EXEC12 — execution drop-copy ingest and three-way reconciliation.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import {
  ENVIRONMENT,
  LIVE_INVESTMENT_EXECUTION,
  LIVE_TRADING_ENABLED,
} from '../packages/config/src/flags.ts';
import { asCustomerId } from '../packages/domain/src/customer.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { EvidenceVault } from '../packages/evidence/src/vault.ts';
import {
  EXEC12_REQUIRED_INGEST_KINDS,
  EXECUTION_RECONCILIATION_BREAK_KINDS,
  HELIOS_EXEC12_EXECUTION_CONNECTIVITY,
  HELIOS_EXEC12_RECONCILIATION_QUALIFIED,
  HeliosExec12ReconciliationService,
  defaultExec12QualificationChecks,
  evaluateExec12ReconciliationQualification,
  fixtureBrokerWithUnknownOrder,
  fixtureCanonicalAccountView,
  fixtureMatchingBrokerSnapshot,
  fixtureMatchingCustodySnapshot,
} from '../packages/platform/src/helios/execution-connectivity/exec12/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const NOW = asUtcInstant('2026-11-07T16:00:00.000Z');
const CUSTOMER = asCustomerId('cust_exec12_a');
const ACCOUNT = 'acct_exec12_a';

function createService(): HeliosExec12ReconciliationService {
  const clock = new FrozenClock(NOW);
  const evidence = new EvidenceVault(clock);
  return new HeliosExec12ReconciliationService({ clock, evidence });
}

describe('HELIOS EXEC12 execution drop-copy and three-way reconciliation', () => {
  it('exports EXEC12 schema markers and break taxonomy', () => {
    assert.equal(HELIOS_EXEC12_EXECUTION_CONNECTIVITY, 'HELIOS_EXEC12_EXECUTION_CONNECTIVITY');
    assert.deepEqual(
      [...EXECUTION_RECONCILIATION_BREAK_KINDS],
      [
        'MISSING_EXTERNAL_ORDER',
        'UNKNOWN_EXTERNAL_ORDER',
        'FILL_MISMATCH',
        'QUANTITY_MISMATCH',
        'PRICE_MISMATCH',
        'FEE_MISMATCH',
        'POSITION_MISMATCH',
        'CASH_MISMATCH',
        'SETTLEMENT_MISMATCH',
        'CORPORATE_ACTION_MISMATCH',
      ],
    );
  });

  it('ingests required drop-copy event kinds with dedupe', () => {
    const service = createService();
    let ingestCount = 0;
    for (const ingestKind of EXEC12_REQUIRED_INGEST_KINDS) {
      const first = service.ingestDropCopy({
        ingestKind,
        providerId: 'sandbox_broker_exec12',
        brokerAccountId: ACCOUNT,
        customerId: CUSTOMER,
        dedupeKey: `${ingestKind}:first`,
        rawPayloadRef: `raw://${ingestKind}`,
        providerTimestamp: NOW,
      });
      assert.ok(first, ingestKind);
      ingestCount += 1;
      const duplicate = service.ingestDropCopy({
        ingestKind,
        providerId: 'sandbox_broker_exec12',
        brokerAccountId: ACCOUNT,
        customerId: CUSTOMER,
        dedupeKey: `${ingestKind}:first`,
        rawPayloadRef: `raw://${ingestKind}`,
        providerTimestamp: NOW,
      });
      assert.equal(duplicate, null);
    }
    assert.equal(ingestCount, EXEC12_REQUIRED_INGEST_KINDS.length);
    assert.equal(service.store.dropCopyEvents().length, EXEC12_REQUIRED_INGEST_KINDS.length);
  });

  it('three-way reconciliation matches aligned statements', () => {
    const service = createService();
    const canonical = fixtureCanonicalAccountView({ customerId: CUSTOMER, accountId: ACCOUNT, asOf: NOW });
    const broker = fixtureMatchingBrokerSnapshot({ customerId: CUSTOMER, accountId: ACCOUNT, asOf: NOW });
    const custody = fixtureMatchingCustodySnapshot({ customerId: CUSTOMER, accountId: ACCOUNT, asOf: NOW });
    service.recordBrokerSnapshot(broker);
    service.recordCustodySnapshot(custody);
    const run = service.reconcileThreeWay({ canonical, broker, custody });
    assert.equal(run.matched, true);
    assert.equal(run.breaks.length, 0);
    assert.equal(service.executionRestricted(String(CUSTOMER), ACCOUNT), false);
  });

  it('detects cash and position breaks with evidence and severity', () => {
    const service = createService();
    const canonical = fixtureCanonicalAccountView({ customerId: CUSTOMER, accountId: ACCOUNT, asOf: NOW });
    const broker = fixtureMatchingBrokerSnapshot({ customerId: CUSTOMER, accountId: ACCOUNT, asOf: NOW });
    const custody = fixtureMatchingCustodySnapshot({ customerId: CUSTOMER, accountId: ACCOUNT, asOf: NOW });
    const brokerMismatch = Object.freeze({
      ...broker,
      cashMinorUnits: '900000',
      positions: Object.freeze({ inst_spy: '90' }),
    });
    const run = service.reconcileThreeWay({
      canonical,
      broker: brokerMismatch,
      custody,
    });
    assert.equal(run.matched, false);
    assert.ok(run.breaks.some((row) => row.kind === 'CASH_MISMATCH'));
    assert.ok(run.breaks.some((row) => row.kind === 'POSITION_MISMATCH'));
    assert.ok(run.breaks.every((row) => row.evidenceRef.length > 0));
    assert.ok(run.breaks.every((row) => row.autoFixAttempted === false));
    assert.ok(run.breaks.every((row) => row.severity === 'HIGH' || row.severity === 'CRITICAL'));
  });

  it('unknown external order triggers execution restriction', () => {
    const service = createService();
    const canonical = fixtureCanonicalAccountView({ customerId: CUSTOMER, accountId: ACCOUNT, asOf: NOW });
    const broker = fixtureBrokerWithUnknownOrder({ customerId: CUSTOMER, accountId: ACCOUNT, asOf: NOW });
    const custody = fixtureMatchingCustodySnapshot({ customerId: CUSTOMER, accountId: ACCOUNT, asOf: NOW });
    const run = service.reconcileThreeWay({ canonical, broker, custody });
    const unknown = run.breaks.find((row) => row.kind === 'UNKNOWN_EXTERNAL_ORDER');
    assert.ok(unknown);
    assert.equal(unknown!.severity, 'CRITICAL');
    assert.equal(unknown!.ambiguousExternal, true);
    assert.equal(service.executionRestricted(String(CUSTOMER), ACCOUNT), true);
    const restriction = service.store.getRestriction(String(CUSTOMER), ACCOUNT);
    assert.ok(restriction);
    assert.equal(restriction!.state, 'RESTRICTED');
    assert.ok(restriction!.reasons.includes('UNKNOWN_EXTERNAL_ORDER'));
  });

  it('does not mutate canonical account view during reconciliation', () => {
    const service = createService();
    const canonical = fixtureCanonicalAccountView({ customerId: CUSTOMER, accountId: ACCOUNT, asOf: NOW });
    const broker = fixtureBrokerWithUnknownOrder({ customerId: CUSTOMER, accountId: ACCOUNT, asOf: NOW });
    const custody = fixtureMatchingCustodySnapshot({ customerId: CUSTOMER, accountId: ACCOUNT, asOf: NOW });
    const before = JSON.stringify(canonical);
    service.reconcileThreeWay({ canonical, broker, custody });
    const after = JSON.stringify(canonical);
    assert.equal(before, after);
  });

  it('HELIOS boundary lint passes for exec12 module', () => {
    const findings = lintHeliosBoundary(process.cwd());
    const exec12Findings = findings.filter((row) => row.file.includes('execution-connectivity/exec12'));
    assert.deepEqual(exec12Findings, []);
  });

  it('HELIOS_EXEC12_RECONCILIATION_QUALIFIED when checks pass', () => {
    const result = evaluateExec12ReconciliationQualification(defaultExec12QualificationChecks());
    assert.equal(result.marker, HELIOS_EXEC12_RECONCILIATION_QUALIFIED, result.blockers.join('; '));
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_TRADING_ENABLED, false);
    assert.equal(LIVE_INVESTMENT_EXECUTION, false);
  });
});
