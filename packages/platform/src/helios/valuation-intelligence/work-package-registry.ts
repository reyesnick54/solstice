import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { VAL_WORK_PACKAGES } from './taxonomy.ts';

export type ValWorkPackageRow = {
  readonly packageId: string;
  readonly title: string;
  readonly moduleRef: string;
  readonly status: 'IMPLEMENTED' | 'BLOCKED';
};

const MODULE_BY_PACKAGE: Record<
  string,
  { readonly title: string; readonly moduleRef: string }
> = {
  VAL01: {
    title: 'Probabilistic valuation domain',
    moduleRef: 'packages/platform/src/helios/valuation-intelligence/val01-canonical-domain.ts',
  },
  VAL02: {
    title: 'Business driver and cash-flow forecast engine',
    moduleRef: 'packages/platform/src/helios/valuation-intelligence/driver-forecast/index.ts',
  },
  VAL03: {
    title: 'Dynamic cost of capital engine',
    moduleRef: 'packages/platform/src/helios/valuation-intelligence/val03-cost-of-capital/engine.ts',
  },
  VAL04: {
    title: 'Probabilistic FCFF / FCFE DCF engine',
    moduleRef: 'packages/platform/src/helios/valuation-intelligence/val04-probabilistic-dcf/index.ts',
  },
  VAL05: {
    title: 'Reverse DCF and market-implied expectations',
    moduleRef: 'packages/platform/src/helios/valuation-intelligence/val05/service.ts',
  },
  VAL07: {
    title: 'Residual income, economic profit, and excess-return valuation',
    moduleRef: 'packages/platform/src/helios/valuation-intelligence/residual-income/index.ts',
  },
  VAL08: {
    title: 'Dynamic probabilistic comparable company engine',
    moduleRef: 'packages/platform/src/helios/valuation-intelligence/comparables/index.ts',
  },
  VAL11: {
    title: 'Adaptive multi-model valuation ensemble',
    moduleRef: 'packages/platform/src/helios/valuation-intelligence/ensemble/index.ts',
  },
};

const TEST_BY_PACKAGE: Record<string, string> = {
  VAL01: 'tests/helios-val01-valuation-intelligence-domain.test.ts',
  VAL02: 'tests/helios-val02-driver-forecast.test.ts',
  VAL03: 'tests/helios-val03-cost-of-capital.test.ts',
  VAL04: 'tests/helios-val04-probabilistic-dcf.test.ts',
  VAL05: 'tests/helios-val05-reverse-dcf.test.ts',
  VAL07: 'tests/helios-val07-residual-income.test.ts',
  VAL08: 'tests/helios-val08-probabilistic-comparables.test.ts',
  VAL11: 'tests/helios-val11-adaptive-ensemble.test.ts',
};

export function listValWorkPackages(root: string): readonly ValWorkPackageRow[] {
  return Object.freeze(
    VAL_WORK_PACKAGES.map((packageId) => {
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
