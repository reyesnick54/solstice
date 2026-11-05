import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { VAL_WORK_PACKAGES } from './taxonomy.ts';

export type ValWorkPackageRow = {
  readonly packageId: string;
  readonly title: string;
  readonly moduleRef: string;
  readonly status: 'IMPLEMENTED' | 'BLOCKED';
};

const MODULE_BY_PACKAGE: Record<string, { readonly title: string; readonly moduleRef: string }> = {
  VAL01: {
    title: 'Probabilistic valuation domain',
    moduleRef: 'packages/platform/src/helios/valuation-intelligence/val01-canonical-domain.ts',
  },
};

export function listValWorkPackages(root: string): readonly ValWorkPackageRow[] {
  return Object.freeze(
    VAL_WORK_PACKAGES.map((packageId) => {
      const meta = MODULE_BY_PACKAGE[packageId];
      const testPath = join(root, 'tests/helios-val01-valuation-intelligence-domain.test.ts');
      const status = meta && existsSync(join(root, meta.moduleRef)) && existsSync(testPath) ? 'IMPLEMENTED' : 'BLOCKED';
      return Object.freeze({
        packageId,
        title: meta?.title ?? packageId,
        moduleRef: meta?.moduleRef ?? '',
        status,
      });
    }),
  );
}
