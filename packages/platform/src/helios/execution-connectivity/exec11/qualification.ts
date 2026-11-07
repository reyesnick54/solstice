import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { EXEC11_CANONICAL_OWNER, EXEC11_HELIOS_OWNER } from './canonical-owners.ts';

export const HELIOS_EXEC11_CUSTODY_ISOLATION_QUALIFIED = 'HELIOS_EXEC11_CUSTODY_ISOLATION_QUALIFIED' as const;

export const HELIOS_EXEC11_CUSTODY_ISOLATION_BLOCKED = 'HELIOS_EXEC11_CUSTODY_ISOLATION_BLOCKED' as const;

export type Exec11HeliosQualificationChecks = {
  readonly canonicalOwnerPresent: boolean;
  readonly heliosBridgePresent: boolean;
  readonly qualificationScriptPresent: boolean;
  readonly integrationTestPresent: boolean;
  readonly extendsCanonicalCustody: boolean;
};

export type Exec11HeliosQualificationResult = {
  readonly marker: typeof HELIOS_EXEC11_CUSTODY_ISOLATION_QUALIFIED | typeof HELIOS_EXEC11_CUSTODY_ISOLATION_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

function repoFile(root: string, rel: string): boolean {
  return existsSync(join(root, rel));
}

export function evaluateExec11HeliosConnectivityQualification(
  root: string,
  checks: Exec11HeliosQualificationChecks = assessExec11HeliosConnectivityQualification(root),
): Exec11HeliosQualificationResult {
  const blockers: string[] = [];
  if (!checks.canonicalOwnerPresent) blockers.push('canonical_owner');
  if (!checks.heliosBridgePresent) blockers.push('helios_bridge');
  if (!checks.qualificationScriptPresent) blockers.push('qualification_script');
  if (!checks.integrationTestPresent) blockers.push('integration_test');
  if (!checks.extendsCanonicalCustody) blockers.push('extends_canonical_custody');

  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified ? HELIOS_EXEC11_CUSTODY_ISOLATION_QUALIFIED : HELIOS_EXEC11_CUSTODY_ISOLATION_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}

export function assessExec11HeliosConnectivityQualification(root: string): Exec11HeliosQualificationChecks {
  const canonical = join(root, EXEC11_CANONICAL_OWNER, 'index.ts');
  const helios = join(root, EXEC11_HELIOS_OWNER, 'index.ts');
  return Object.freeze({
    canonicalOwnerPresent: repoFile(root, `${EXEC11_CANONICAL_OWNER}index.ts`),
    heliosBridgePresent: existsSync(helios),
    qualificationScriptPresent: repoFile(root, 'scripts/helios-exec11-custody-isolation-qualify.ts'),
    integrationTestPresent: repoFile(root, 'tests/helios-exec11-custody-isolation.test.ts'),
    extendsCanonicalCustody: existsSync(canonical) && repoFile(root, 'packages/custody/src/regulated/withdrawal-gate.ts'),
  });
}
