import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { VAL_WORK_PACKAGES } from './taxonomy.ts';

export type ValWorkPackageRow = {
  readonly workPackage: (typeof VAL_WORK_PACKAGES)[number];
  readonly title: string;
  readonly status: 'QUALIFIED' | 'BLOCKED';
  readonly moduleRef: string;
};

const MODULE_BY_PACKAGE: Record<string, { readonly title: string; readonly moduleRef: string }> = {
  VAL02: {
    title: 'Business driver and cash-flow forecast engine',
    moduleRef: 'packages/platform/src/helios/valuation-intelligence/driver-forecast/index.ts',
  },
};

export function buildValWorkPackageRegistry(root: string): readonly ValWorkPackageRow[] {
  return Object.freeze(
    VAL_WORK_PACKAGES.map((workPackage) => {
      const meta = MODULE_BY_PACKAGE[workPackage]!;
      const present = existsSync(join(root, meta.moduleRef));
      return Object.freeze({
        workPackage,
        title: meta.title,
        status: present ? ('QUALIFIED' as const) : ('BLOCKED' as const),
        moduleRef: meta.moduleRef,
      });
    }),
  );
}
