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
    title: 'Canonical observation fabric',
    moduleRef: 'packages/platform/src/helios/observation/fabric.ts',
  },
  MD02: {
    title: 'Precision time and knowable-at envelope',
    moduleRef: 'packages/platform/src/helios/observation/information-time.ts',
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
    title: 'Redundant-source reconciliation',
    moduleRef: 'packages/platform/src/helios/observation/lineage.ts',
  },
  MD06: {
    title: 'Instrument master',
    moduleRef: 'packages/platform/src/helios/market-observation/instrument-registry.ts',
  },
  MD07: {
    title: 'U.S. equity consolidated/direct market state',
    moduleRef: 'packages/platform/src/helios/market-data/md07-us-equity/index.ts',
  },
  MD08: {
    title: 'Derivatives and listed contracts',
    moduleRef: 'packages/platform/src/helios/multi-asset/market-calendar/registry.ts',
  },
  MD09: {
    title: 'Crypto multi-venue fabric',
    moduleRef: 'packages/platform/src/helios/adaptive-alpha-fabric/aaf09-external-crypto/fabric.ts',
  },
  MD10: {
    title: 'FX, rates, and commodity reference fabric',
    moduleRef: 'packages/platform/src/helios/market-data/md10/index.ts',
  },
  MD11: {
    title: 'Deterministic replay',
    moduleRef: 'packages/platform/src/helios/execution-twin/bytex-native/replay.ts',
  },
  MD12: {
    title: 'Quality and microstructure',
    moduleRef: 'packages/platform/src/helios/multi-asset/data-quality.ts',
  },
  MD13: {
    title: 'Operations, conformance, and chaos evidence',
    moduleRef: 'packages/external-data/src/certification/market-data/harness.ts',
  },
  MD14: {
    title: 'Final production-shaped qualification',
    moduleRef: 'packages/platform/src/helios/market-data/md14-qualification.ts',
  },
};

const OPTIONAL_TESTS: Record<string, string> = {
  MD01: 'tests/helios-h08-observation-provenance-freshness-entitlements.test.ts',
  MD03: 'tests/helios-md03-sequence-recovery.test.ts',
  MD04: 'tests/helios-md04-order-book-engine.test.ts',
  MD06: 'tests/helios-m01-multi-asset-instrument.test.ts',
  MD07: 'tests/helios-md07-us-equity-market-state.test.ts',
  MD08: 'tests/helios-multi-asset-m03-market-calendar-contracts.test.ts',
  MD09: 'tests/helios-m06-crypto-market-data.test.ts',
  MD10: 'tests/helios-md10-macro-market-reference.test.ts',
  MD11: 'tests/helios-native03-bytex-runtime.test.ts',
  MD12: 'tests/helios-m04-multi-asset-market-state.test.ts',
  MD13: 'tests/helios-aaf07-external-market-data-certification.test.ts',
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
