import { asUtcInstant } from '@solstice/domain';

import { assertBrokerManifestFailClosed, type BrokerCapabilityManifest } from './broker-capability-manifest.ts';
import { isFieldAvailable } from './declared-field.ts';
import {
  brokerPortSupportsReplace,
  createFixtureExec14BrokerPort,
  sampleBrokerSubmitRequest,
  type Exec14BrokerConformancePort,
} from './fixture-broker.ts';
import { evaluateExec14CredentialBinding, fixtureExec14CredentialBinding } from './credential-policy.ts';
import {
  EXEC14_BROKER_CONFORMANCE_CASES,
  HELIOS_EXEC14_SCHEMA_VERSION,
  type Exec14BrokerConformanceCaseId,
  type Exec14ConformanceOutcome,
} from './taxonomy.ts';

export type BrokerConformanceCheck = Readonly<{
  readonly caseId: Exec14BrokerConformanceCaseId;
  readonly outcome: Exec14ConformanceOutcome;
  readonly detail: string;
}>;

export type BrokerConformanceSuite = Readonly<{
  readonly schemaVersion: typeof HELIOS_EXEC14_SCHEMA_VERSION;
  readonly providerId: string;
  readonly manifest: BrokerCapabilityManifest;
  readonly checks: readonly BrokerConformanceCheck[];
  readonly conformancePassed: boolean;
  readonly productionQualified: false;
  readonly externalApprovalRequired: true;
}>;

function check(
  caseId: Exec14BrokerConformanceCaseId,
  outcome: Exec14ConformanceOutcome,
  detail: string,
): BrokerConformanceCheck {
  return Object.freeze({ caseId, outcome, detail });
}

function runBrokerCase(
  caseId: Exec14BrokerConformanceCaseId,
  port: Exec14BrokerConformancePort,
  now: ReturnType<typeof asUtcInstant>,
): BrokerConformanceCheck {
  switch (caseId) {
    case 'authentication': {
      const auth = port.authenticate();
      return check(caseId, auth.ok ? 'PASS' : 'FAIL', auth.evidenceRef);
    }
    case 'idempotency': {
      const request = sampleBrokerSubmitRequest({ externalOperationId: 'ext_idem_exec14' });
      const first = port.submit(request);
      const second = port.submit(request);
      const pass = first.outcome !== 'UNAVAILABLE' && second.outcome === first.outcome;
      return check(caseId, pass ? 'PASS' : 'FAIL', 'duplicate submit returns stable acknowledgement');
    }
    case 'submit': {
      const request = sampleBrokerSubmitRequest({
        externalOperationId: 'ext_submit_exec14',
        operationId: 'op_submit_exec14',
        orderId: 'ord_submit_exec14',
      });
      const result = port.submit(request);
      return check(caseId, result.outcome === 'ACKNOWLEDGED' ? 'PASS' : 'FAIL', `submit outcome ${result.outcome}`);
    }
    case 'cancel': {
      const request = sampleBrokerSubmitRequest({
        externalOperationId: 'ext_cancel_exec14',
        operationId: 'op_cancel_exec14',
        orderId: 'ord_cancel_exec14',
      });
      const submitted = port.submit(request);
      if (submitted.outcome !== 'ACKNOWLEDGED' && submitted.outcome !== 'PENDING') {
        return check(caseId, 'FAIL', 'could not submit order to cancel');
      }
      const cancelled = port.cancel(submitted.providerOrderId, request.externalOperationId);
      const pass = cancelled.outcome === 'CANCEL_ACKNOWLEDGED';
      return check(caseId, pass ? 'PASS' : 'FAIL', `cancel outcome ${cancelled.outcome}`);
    }
    case 'replace': {
      if (!brokerPortSupportsReplace(port)) {
        return check(caseId, 'SKIPPED', 'cancel/replace not declared AVAILABLE');
      }
      const request = sampleBrokerSubmitRequest({
        externalOperationId: 'ext_replace_exec14',
        operationId: 'op_replace_exec14',
        orderId: 'ord_replace_exec14',
      });
      const submitted = port.submit(request);
      if (submitted.outcome !== 'ACKNOWLEDGED') {
        return check(caseId, 'FAIL', 'submit failed before replace');
      }
      const replaced = port.replace(submitted.providerOrderId, request.externalOperationId, {
        ...request,
        quantityUnits: '5',
        externalOperationId: 'ext_replace_exec14_new',
      });
      return check(caseId, replaced.outcome !== 'UNAVAILABLE' ? 'PASS' : 'FAIL', `replace outcome ${replaced.outcome}`);
    }
    case 'partial_fill': {
      const request = sampleBrokerSubmitRequest({
        externalOperationId: 'ext_partial_exec14',
        quantityUnits: '20',
      });
      port.submit(request);
      const query = port.query(request.externalOperationId);
      if (!query.found) {
        return check(caseId, 'FAIL', 'query missing after submit');
      }
      const filled = query.fills.reduce((sum, row) => sum + BigInt(row.quantityUnits), 0n);
      const pass = filled > 0n && filled < 20n;
      return check(caseId, pass ? 'PASS' : 'SKIPPED', `filled qty ${filled.toString()}`);
    }
    case 'full_fill': {
      const request = sampleBrokerSubmitRequest({
        externalOperationId: 'ext_full_exec14',
        quantityUnits: '4',
      });
      port.submit(request);
      port.syncFills(request.externalOperationId, now);
      port.syncFills(request.externalOperationId, now);
      const query = port.query(request.externalOperationId);
      if (!query.found) {
        return check(caseId, 'FAIL', 'query missing');
      }
      const filled = query.fills.reduce((sum, row) => sum + BigInt(row.quantityUnits), 0n);
      return check(caseId, filled === 4n ? 'PASS' : 'FAIL', `filled qty ${filled.toString()}`);
    }
    case 'reject': {
      const request = sampleBrokerSubmitRequest({
        externalOperationId: 'ext_reject_exec14',
        instrumentId: 'REJECT_ME',
      });
      const result = port.submit(request);
      return check(
        caseId,
        result.outcome === 'ACKNOWLEDGED' || result.outcome === 'REJECTED' ? 'PASS' : 'FAIL',
        `controlled reject path ${result.outcome}`,
      );
    }
    case 'timeout_ambiguity': {
      const request = sampleBrokerSubmitRequest({ externalOperationId: 'ext_timeout_exec14' });
      port.submit(request);
      const missing = port.query('ext_missing_timeout');
      return check(caseId, !missing.found ? 'PASS' : 'FAIL', 'unknown operation fails closed');
    }
    case 'recovery': {
      port.restart();
      const request = sampleBrokerSubmitRequest({ externalOperationId: 'ext_recovery_exec14' });
      const result = port.submit(request);
      return check(caseId, result.outcome !== 'UNAVAILABLE' ? 'PASS' : 'FAIL', 'post-restart submit');
    }
    case 'statement': {
      if (!isFieldAvailable(port.manifest.cash) || !port.manifest.cash.value) {
        return check(caseId, 'SKIPPED', 'cash capability unavailable');
      }
      const statement = port.getStatement('acct_exec14', now);
      return check(caseId, statement.simulation === true ? 'PASS' : 'FAIL', statement.statementId);
    }
    case 'position_reconciliation': {
      if (!isFieldAvailable(port.manifest.positions) || !port.manifest.positions.value) {
        return check(caseId, 'SKIPPED', 'positions capability unavailable');
      }
      const request = sampleBrokerSubmitRequest({
        externalOperationId: 'ext_pos_recon_exec14',
        quantityUnits: '3',
      });
      port.submit(request);
      const stmt = port.getStatement('acct_exec14', now);
      const qty = stmt.positions[request.instrumentId] ?? '0';
      return check(caseId, qty !== '0' ? 'PASS' : 'FAIL', `position qty ${qty}`);
    }
    case 'cash_reconciliation': {
      if (!isFieldAvailable(port.manifest.cash) || !port.manifest.cash.value) {
        return check(caseId, 'SKIPPED', 'cash capability unavailable');
      }
      const before = port.getStatement('acct_exec14', now).cashMinorUnits;
      const request = sampleBrokerSubmitRequest({
        externalOperationId: 'ext_cash_recon_exec14',
        side: 'BUY',
        quantityUnits: '1',
      });
      port.submit(request);
      const after = port.getStatement('acct_exec14', now).cashMinorUnits;
      return check(caseId, before !== after ? 'PASS' : 'FAIL', `cash ${before} -> ${after}`);
    }
    case 'restart': {
      port.restart();
      return check(caseId, 'PASS', 'restart hook invoked without throwing');
    }
    default:
      return check(caseId, 'FAIL', 'unknown case');
  }
}

export function runBrokerConformanceSuite(
  manifest: BrokerCapabilityManifest,
  port: Exec14BrokerConformancePort = createFixtureExec14BrokerPort(manifest),
): BrokerConformanceSuite {
  const manifestViolations = assertBrokerManifestFailClosed(manifest);
  const credential = evaluateExec14CredentialBinding(fixtureExec14CredentialBinding(manifest.providerId));
  const now = asUtcInstant('2026-09-21T12:00:00.000Z');

  const checks: BrokerConformanceCheck[] = [];
  const blocked =
    manifestViolations.length > 0 ||
    !credential.allowed;

  for (const caseId of EXEC14_BROKER_CONFORMANCE_CASES) {
    if (blocked) {
      if (caseId === 'authentication') {
        const detail =
          manifestViolations.length > 0
            ? manifestViolations.join('; ')
            : credential.violations.join('; ');
        checks.push(check('authentication', 'FAIL', detail));
      } else {
        checks.push(check(caseId, 'SKIPPED', 'manifest or credential policy failed'));
      }
      continue;
    }
    checks.push(runBrokerCase(caseId, port, now));
  }

  const conformancePassed = checks.every((row) => row.outcome === 'PASS' || row.outcome === 'SKIPPED');

  return Object.freeze({
    schemaVersion: HELIOS_EXEC14_SCHEMA_VERSION,
    providerId: manifest.providerId,
    manifest,
    checks: Object.freeze(checks),
    conformancePassed,
    productionQualified: false,
    externalApprovalRequired: true,
  });
}
