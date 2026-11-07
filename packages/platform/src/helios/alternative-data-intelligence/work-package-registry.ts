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
  ALT01: {
    title: 'Canonical alternative-data research domain',
    moduleRef: 'packages/platform/src/helios/alternative-data-intelligence/alt01-canonical-domain.ts',
  },
  ALT02: {
    title: 'Entity resolution and observation hygiene',
    moduleRef: 'packages/platform/src/helios/alternative-data-intelligence/alt02-entity-resolution.ts',
  },
  ALT03: {
    title: 'Provider ingestion (fixture port)',
    moduleRef: 'packages/platform/src/helios/alternative-data-intelligence/alt03-provider-ingestion.ts',
  },
  ALT04: {
    title: 'Workforce and hiring alternative-data intelligence',
    moduleRef: 'packages/platform/src/helios/alternative-data-intelligence/alt04-workforce/index.ts',
  },
  ALT05: {
    title: 'Digital demand and attention intelligence',
    moduleRef: 'packages/platform/src/helios/alternative-data-intelligence/alt05/index.ts',
  },
  ALT06: {
    title: 'Product demand / pricing power',
    moduleRef: 'packages/platform/src/helios/alternative-data-intelligence/alt06-product-demand.ts',
  },
  ALT07: {
    title: 'Maritime, logistics, and commodity flow intelligence',
    moduleRef: 'packages/platform/src/helios/alternative-data-intelligence/alt07-logistics-flow/index.ts',
  },
  ALT08: {
    title: 'AlternativeDataSkeptic gate',
    moduleRef: 'packages/platform/src/helios/alternative-data-intelligence/alt08-skeptic.ts',
  },
  ALT09: {
    title: 'Patent, technology, and commercialization intelligence',
    moduleRef: 'packages/platform/src/helios/alternative-data-intelligence/alt09/index.ts',
  },
  ALT10: {
    title: 'AAF V2 certification bridge',
    moduleRef: 'packages/platform/src/helios/alternative-data-intelligence/alt10-aaf-bridge.ts',
  },
  ALT11: {
    title: 'Supply-chain knowledge graph and risk propagation',
    moduleRef: 'packages/platform/src/helios/alternative-data/alt11-supply-chain-graph/index.ts',
  },
  ALT12: {
    title: 'Missing-aware multimodal fusion and signal routing',
    moduleRef: 'packages/platform/src/helios/alternative-data-intelligence/alt12/index.ts',
  },
  ALT13: {
    title: 'Counterfactual assessment bridge',
    moduleRef: 'packages/platform/src/helios/alternative-data-intelligence/alt13-counterfactual-bridge.ts',
  },
  ALT14: {
    title: 'Final qualification, adversarial harness, EVOL bridge',
    moduleRef: 'packages/platform/src/helios/alternative-data-intelligence/alt14-qualification.ts',
  },
};

const OPTIONAL_TESTS: Record<string, string> = {
  ALT04: 'tests/helios-alt04-workforce-intelligence.test.ts',
  ALT05: 'tests/helios-alt05-digital-demand.test.ts',
  ALT07: 'tests/helios-alt07-logistics-flow.test.ts',
  ALT09: 'tests/helios-alt09-innovation-intelligence-qualification.test.ts',
  ALT11: 'tests/helios-alt11-supply-chain-graph.test.ts',
  ALT12: 'tests/helios-alt12-multimodal-fusion.test.ts',
  ALT14: 'tests/helios-alt14-alternative-data-qualification.test.ts',
};

export function listAltWorkPackages(root: string): readonly AltWorkPackageRow[] {
  return Object.freeze(
    ALT_WORK_PACKAGES.map((packageId) => {
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
