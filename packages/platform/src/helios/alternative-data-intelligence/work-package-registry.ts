import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { ALT_WORK_PACKAGES } from './taxonomy.ts';
import { CANONICAL_ALT_MODULES } from './canonical-alt-modules.ts';

export type AltWorkPackageRow = {
  readonly packageId: string;
  readonly title: string;
  readonly moduleRef: string;
  readonly implementationOwner: string;
  readonly status: 'IMPLEMENTED' | 'BLOCKED';
};

const OPTIONAL_TESTS: Record<string, string> = Object.fromEntries(
  CANONICAL_ALT_MODULES.filter((row) => row.qualificationTest).map((row) => [row.packageId, row.qualificationTest!]),
);

export function listAltWorkPackages(root: string): readonly AltWorkPackageRow[] {
  return Object.freeze(
    ALT_WORK_PACKAGES.map((packageId) => {
      const meta = CANONICAL_ALT_MODULES.find((row) => row.packageId === packageId);
      const moduleOk = meta !== undefined && existsSync(join(root, meta.entryModule));
      const testRel = OPTIONAL_TESTS[packageId];
      const testOk = testRel ? existsSync(join(root, testRel)) : true;
      const status = moduleOk && testOk ? ('IMPLEMENTED' as const) : ('BLOCKED' as const);
      return Object.freeze({
        packageId,
        title: meta?.capability ?? packageId,
        moduleRef: meta?.entryModule ?? '',
        implementationOwner: meta?.implementationOwner ?? '',
        status,
      });
    }),
  );
}
