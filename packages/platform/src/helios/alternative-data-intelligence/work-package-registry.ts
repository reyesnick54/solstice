import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { ALT_WORK_PACKAGES } from './taxonomy.ts';

export type AltWorkPackageRow = {
  readonly packageId: string;
  readonly title: string;
  readonly moduleRef: string;
  readonly status: 'IMPLEMENTED' | 'BLOCKED';
};

const MODULE_BY_PACKAGE: Record<string, { readonly title: string; readonly moduleRef: string }> = {
  ALT12: {
    title: 'Missing-aware multimodal fusion and signal routing',
    moduleRef: 'packages/platform/src/helios/alternative-data-intelligence/alt12/index.ts',
  },
};

const TEST_BY_PACKAGE: Record<string, string> = {
  ALT12: 'tests/helios-alt12-multimodal-fusion.test.ts',
};

export function listAltWorkPackages(root: string): readonly AltWorkPackageRow[] {
  return Object.freeze(
    ALT_WORK_PACKAGES.map((packageId) => {
      const meta = MODULE_BY_PACKAGE[packageId];
      const testPath = join(root, TEST_BY_PACKAGE[packageId] ?? '');
      const status =
        meta && existsSync(join(root, meta.moduleRef)) && existsSync(testPath) ? 'IMPLEMENTED' : 'BLOCKED';
      return Object.freeze({
        packageId,
        title: meta?.title ?? packageId,
        moduleRef: meta?.moduleRef ?? '',
        status,
      });
    }),
  );
}
