import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { MD_WORK_PACKAGES } from './taxonomy.ts';

export type MdWorkPackageRow = {
  readonly packageId: string;
  readonly title: string;
  readonly moduleRef: string;
  readonly status: 'IMPLEMENTED' | 'BLOCKED';
};

const MODULE_BY_PACKAGE: Record<string, { readonly title: string; readonly moduleRef: string }> = {
  MD01: {
    title: 'Canonical market-data fabric',
    moduleRef: 'packages/platform/src/helios/market-data/md01/index.ts',
  },
  MD02: {
    title: 'Precision time and knowable-at envelope',
    moduleRef: 'packages/platform/src/helios/market-data/md02/index.ts',
  },
  MD03: {
    title: 'Sequence recovery and gap handling',
    moduleRef: 'packages/platform/src/helios/market-data/md03/index.ts',
  },
  MD04: {
    title: 'Deterministic order books',
    moduleRef: 'packages/platform/src/helios/market-data/md04-order-book/index.ts',
  },
  MD05: {
    title: 'Redundant feed arbitration',
    moduleRef: 'packages/platform/src/helios/market-data/md05/index.ts',
  },
  MD06: {
    title: 'Instrument master',
    moduleRef: 'packages/platform/src/helios/market-data/md06-instrument-master/index.ts',
  },
  MD07: {
    title: 'U.S. equity consolidated/direct market state',
    moduleRef: 'packages/platform/src/helios/market-data/md07-us-equity/index.ts',
  },
  MD08: {
    title: 'Derivatives market data intelligence',
    moduleRef: 'packages/platform/src/helios/market-data/md08/index.ts',
  },
  MD09: {
    title: 'Multi-venue crypto',
    moduleRef: 'packages/platform/src/helios/market-data/md09/index.ts',
  },
  MD10: {
    title: 'FX, rates, and commodity reference fabric',
    moduleRef: 'packages/platform/src/helios/market-data/md10/index.ts',
  },
  MD11: {
    title: 'Deterministic replay',
    moduleRef: 'packages/sunrey-exchange/src/market-data/md11/index.ts',
  },
  MD12: {
    title: 'Quality and microstructure',
    moduleRef: 'packages/platform/src/helios/market-data/md12/index.ts',
  },
  MD13: {
    title: 'Live-data resilience and chaos',
    moduleRef: 'packages/platform/src/helios/market-data-live/md13/index.ts',
  },
  MD14: {
    title: 'Final production-shaped qualification',
    moduleRef: 'packages/platform/src/helios/market-data/md14-qualification.ts',
  },
};

const OPTIONAL_TESTS: Record<string, string> = {
  MD01: 'tests/helios-md01-market-data-fabric.test.ts',
  MD02: 'tests/helios-md02-precision-market-time.test.ts',
  MD05: 'tests/helios-md05-redundant-market-truth.test.ts',
  MD03: 'tests/helios-md03-sequence-recovery.test.ts',
  MD04: 'tests/helios-md04-order-book-engine.test.ts',
  MD06: 'tests/helios-md06-instrument-master.test.ts',
  MD07: 'tests/helios-md07-us-equity-market-state.test.ts',
  MD08: 'tests/helios-md08-derivatives-market-data.test.ts',
  MD09: 'tests/helios-md09-crypto-market-data.test.ts',
  MD10: 'tests/helios-md10-macro-market-reference.test.ts',
  MD11: 'tests/helios-md11-deterministic-replay.test.ts',
  MD12: 'tests/helios-md12-data-quality-microstructure.test.ts',
  MD13: 'tests/helios-md13-live-data-resilience.test.ts',
  MD14: 'tests/helios-md14-market-data-qualification.test.ts',
};

export function listMdWorkPackages(root: string): readonly MdWorkPackageRow[] {
  return Object.freeze(
    MD_WORK_PACKAGES.map((packageId) => {
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
