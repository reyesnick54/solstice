import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { ALPHA_WORK_PACKAGES } from './taxonomy.ts';

export type AlphaWorkPackageRow = {
  readonly packageId: string;
  readonly title: string;
  readonly moduleRef: string;
  readonly status: 'IMPLEMENTED' | 'BLOCKED';
};

const MODULE_BY_PACKAGE: Record<string, { readonly title: string; readonly moduleRef: string }> = {
  ALPHA02: {
    title: 'Strategy pre-registration and forward campaign freeze',
    moduleRef: 'packages/platform/src/helios/forward-alpha/alpha02/index.ts',
  },
  ALPHA06: {
    title: 'Forward implementation and execution realism',
    moduleRef: 'packages/platform/src/helios/forward-alpha/alpha06/index.ts',
  },
  ALPHA08: {
    title: 'Forward data-snooping firewall',
    moduleRef: 'packages/platform/src/helios/forward-alpha/alpha08/index.ts',
  },
  ALPHA11: {
    title: 'Alpha decay, drift, and break detection',
    moduleRef: 'packages/platform/src/helios/forward-alpha/alpha11/index.ts',
  },
};

const OPTIONAL_TESTS: Record<string, string> = {
  ALPHA02: 'tests/helios-alpha02-forward-preregistration.test.ts',
  ALPHA06: 'tests/helios-alpha06-forward-execution-realism.test.ts',
  ALPHA08: 'tests/helios-forward-alpha08-data-snooping-firewall.test.ts',
  ALPHA11: 'tests/helios-alpha11-alpha-decay.test.ts',
};

export function listAlphaWorkPackages(root: string): readonly AlphaWorkPackageRow[] {
  return Object.freeze(
    ALPHA_WORK_PACKAGES.map((packageId) => {
      const meta = MODULE_BY_PACKAGE[packageId];
      const moduleOk = meta !== undefined && existsSync(join(root, meta.moduleRef));
      const testRel = OPTIONAL_TESTS[packageId];
      const testOk = testRel ? existsSync(join(root, testRel)) : true;
      const status = moduleOk && testOk ? ('IMPLEMENTED' as const) : ('BLOCKED' as const);
      return Object.freeze({
        packageId,
        title: meta?.title ?? packageId,
        moduleRef: meta?.moduleRef ?? '',
        status,
      });
    }),
  );
}
