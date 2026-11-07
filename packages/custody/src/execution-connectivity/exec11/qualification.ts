import { runExec11CustodyIsolationHarness } from './harness.ts';
import {
  HELIOS_EXEC11_CUSTODY_ISOLATION_BLOCKED,
  HELIOS_EXEC11_CUSTODY_ISOLATION_QUALIFIED,
} from './taxonomy.ts';
import type { Exec11QualificationChecks } from './types.ts';

export type Exec11CustodyIsolationQualification = {
  readonly marker:
    | typeof HELIOS_EXEC11_CUSTODY_ISOLATION_QUALIFIED
    | typeof HELIOS_EXEC11_CUSTODY_ISOLATION_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
  readonly checks: Exec11QualificationChecks;
};

export function evaluateExec11CustodyIsolationQualification(
  checks: Exec11QualificationChecks = runExec11CustodyIsolationHarness(),
): Exec11CustodyIsolationQualification {
  const entries = Object.entries(checks) as [keyof Exec11QualificationChecks, boolean][];
  const blockers = entries.filter(([, passed]) => !passed).map(([key]) => key);
  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified ? HELIOS_EXEC11_CUSTODY_ISOLATION_QUALIFIED : HELIOS_EXEC11_CUSTODY_ISOLATION_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
    checks,
  });
}
