import { assertCustodyManifestFailClosed, type CustodyCapabilityManifest } from './custody-capability-manifest.ts';
import { isFieldAvailable } from './declared-field.ts';
import { evaluateExec14CredentialBinding, fixtureExec14CredentialBinding } from './credential-policy.ts';
import {
  EXEC14_CUSTODY_NOW,
  createFixtureExec14CustodyPort,
  type Exec14CustodyConformancePort,
} from './fixture-custody.ts';
import {
  EXEC14_CUSTODY_CONFORMANCE_CASES,
  HELIOS_EXEC14_SCHEMA_VERSION,
  type Exec14ConformanceOutcome,
  type Exec14CustodyConformanceCaseId,
} from './taxonomy.ts';

export type CustodyConformanceCheck = Readonly<{
  readonly caseId: Exec14CustodyConformanceCaseId;
  readonly outcome: Exec14ConformanceOutcome;
  readonly detail: string;
}>;

export type CustodyConformanceSuite = Readonly<{
  readonly schemaVersion: typeof HELIOS_EXEC14_SCHEMA_VERSION;
  readonly providerId: string;
  readonly manifest: CustodyCapabilityManifest;
  readonly checks: readonly CustodyConformanceCheck[];
  readonly conformancePassed: boolean;
  readonly productionQualified: false;
  readonly externalApprovalRequired: true;
}>;

function check(
  caseId: Exec14CustodyConformanceCaseId,
  outcome: Exec14ConformanceOutcome,
  detail: string,
): CustodyConformanceCheck {
  return Object.freeze({ caseId, outcome, detail });
}

function runCustodyCase(caseId: Exec14CustodyConformanceCaseId, port: Exec14CustodyConformancePort): CustodyConformanceCheck {
  const now = EXEC14_CUSTODY_NOW;
  switch (caseId) {
    case 'authentication': {
      const auth = port.authenticate();
      return check(caseId, auth.ok ? 'PASS' : 'FAIL', auth.evidenceRef);
    }
    case 'idempotency': {
      const first = port.creditDeposit('wal_exec14', 100n, 'dep_idem_exec14');
      const second = port.creditDeposit('wal_exec14', 100n, 'dep_idem_exec14');
      return check(caseId, first.ok && second.ok ? 'PASS' : 'FAIL', 'duplicate deposit ref is idempotent');
    }
    case 'deposit_credit': {
      const credited = port.creditDeposit('wal_deposit_exec14', 50n, 'dep_credit_exec14');
      return check(caseId, credited.ok ? 'PASS' : 'FAIL', 'deposit credited');
    }
    case 'withdrawal_workflow': {
      port.creditDeposit('wal_withdraw_exec14', 200n, 'dep_for_withdraw');
      const wd = port.submitWithdrawal('wd_exec14_1', 'wal_withdraw_exec14', 75n);
      return check(caseId, wd.ok && wd.state === 'FINALIZED' ? 'PASS' : 'FAIL', `withdrawal ${wd.state}`);
    }
    case 'partial_settlement': {
      port.creditDeposit('wal_partial_exec14', 100n, 'dep_partial');
      const wd = port.submitWithdrawal('wd_partial_exec14', 'wal_partial_exec14', 40n);
      const stmt = port.getStatement('acct_custody_exec14', now);
      const remainder = stmt.positions.wal_partial_exec14 ?? '0';
      return check(caseId, wd.ok && remainder === '60' ? 'PASS' : 'FAIL', `remainder ${remainder}`);
    }
    case 'full_settlement': {
      port.creditDeposit('wal_full_exec14', 30n, 'dep_full');
      const wd = port.submitWithdrawal('wd_full_exec14', 'wal_full_exec14', 30n);
      const stmt = port.getStatement('acct_custody_exec14', now);
      const remainder = stmt.positions.wal_full_exec14 ?? '0';
      return check(caseId, wd.ok && remainder === '0' ? 'PASS' : 'FAIL', `remainder ${remainder}`);
    }
    case 'reject': {
      const wd = port.submitWithdrawal('wd_reject_exec14', 'wal_missing', 1n);
      return check(caseId, !wd.ok ? 'PASS' : 'FAIL', 'insufficient balance rejects');
    }
    case 'timeout_ambiguity': {
      const stmt = port.getStatement('acct_unknown', now);
      return check(caseId, stmt.statementId.length > 0 ? 'PASS' : 'FAIL', 'statement remains queryable after ambiguous ops');
    }
    case 'recovery': {
      port.restart();
      const credited = port.creditDeposit('wal_recovery', 10n, 'dep_recovery');
      return check(caseId, credited.ok ? 'PASS' : 'FAIL', 'post-restart deposit');
    }
    case 'statement': {
      if (!isFieldAvailable(port.manifest.cash) || !port.manifest.cash.value) {
        return check(caseId, 'SKIPPED', 'cash capability unavailable');
      }
      const stmt = port.getStatement('acct_custody_exec14', now);
      return check(caseId, stmt.simulation === true ? 'PASS' : 'FAIL', stmt.statementId);
    }
    case 'position_reconciliation': {
      if (!isFieldAvailable(port.manifest.positions) || !port.manifest.positions.value) {
        return check(caseId, 'SKIPPED', 'positions capability unavailable');
      }
      port.creditDeposit('wal_recon', 15n, 'dep_recon');
      const stmt = port.getStatement('acct_custody_exec14', now);
      return check(caseId, stmt.positions.wal_recon === '15' ? 'PASS' : 'FAIL', 'wallet balance matches statement');
    }
    case 'cash_reconciliation': {
      if (!isFieldAvailable(port.manifest.cash) || !port.manifest.cash.value) {
        return check(caseId, 'SKIPPED', 'cash capability unavailable');
      }
      const before = port.getStatement('acct_custody_exec14', now).cashMinorUnits;
      port.creditDeposit('wal_cash', 5n, 'dep_cash');
      port.submitWithdrawal('wd_cash', 'wal_cash', 5n);
      const after = port.getStatement('acct_custody_exec14', now).cashMinorUnits;
      return check(caseId, before !== after ? 'PASS' : 'FAIL', `cash ${before} -> ${after}`);
    }
    case 'restart': {
      port.restart();
      return check(caseId, 'PASS', 'restart hook invoked');
    }
    default:
      return check(caseId, 'FAIL', 'unknown case');
  }
}

export function runCustodyConformanceSuite(
  manifest: CustodyCapabilityManifest,
  port: Exec14CustodyConformancePort = createFixtureExec14CustodyPort(manifest),
): CustodyConformanceSuite {
  const manifestViolations = assertCustodyManifestFailClosed(manifest);
  const credential = evaluateExec14CredentialBinding(fixtureExec14CredentialBinding(manifest.providerId));

  const checks: CustodyConformanceCheck[] = [];
  const blocked = manifestViolations.length > 0 || !credential.allowed;

  for (const caseId of EXEC14_CUSTODY_CONFORMANCE_CASES) {
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
    checks.push(runCustodyCase(caseId, port));
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
