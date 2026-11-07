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
    title: 'Workforce intelligence signals',
    moduleRef: 'packages/platform/src/helios/alternative-data-intelligence/alt04-workforce-signals.ts',
  },
  ALT05: {
    title: 'Digital demand signals',
    moduleRef: 'packages/platform/src/helios/alternative-data-intelligence/alt05-digital-demand.ts',
  },
  ALT06: {
    title: 'Product demand / pricing power',
    moduleRef: 'packages/platform/src/helios/alternative-data-intelligence/alt06-product-demand.ts',
  },
  ALT07: {
    title: 'Logistics, geospatial, innovation, procurement, supply chain modalities',
    moduleRef: 'packages/platform/src/helios/alternative-data-intelligence/alt07-physical-supply-modalities.ts',
  },
  ALT08: {
    title: 'AlternativeDataSkeptic gate',
    moduleRef: 'packages/platform/src/helios/alternative-data-intelligence/alt08-skeptic.ts',
  },
  ALT09: {
    title: 'Synthesis to AlternativeDataResearchState',
    moduleRef: 'packages/platform/src/helios/alternative-data-intelligence/alt09-synthesis.ts',
  },
  ALT10: {
    title: 'AAF V2 certification bridge',
    moduleRef: 'packages/platform/src/helios/alternative-data-intelligence/alt10-aaf-bridge.ts',
  },
  ALT11: {
    title: 'Strategy Genome certified features',
    moduleRef: 'packages/platform/src/helios/alternative-data-intelligence/alt11-strategy-genome-features.ts',
  },
  ALT12: {
    title: 'EVOL12 / EVOL09 evolution bridge',
    moduleRef: 'packages/platform/src/helios/alternative-data-intelligence/alt12-evolution-bridge.ts',
  },
  ALT13: {
    title: 'Counterfactual assessment bridge',
    moduleRef: 'packages/platform/src/helios/alternative-data-intelligence/alt13-counterfactual-bridge.ts',
  },
  ALT14: {
    title: 'Final qualification and adversarial harness',
    moduleRef: 'packages/platform/src/helios/alternative-data-intelligence/alt14-qualification.ts',
  },
};

export function listAltWorkPackages(root: string): readonly AltWorkPackageRow[] {
  return Object.freeze(
    ALT_WORK_PACKAGES.map((packageId) => {
      const meta = MODULE_BY_PACKAGE[packageId];
      const status =
        meta && existsSync(join(root, meta.moduleRef)) ? ('IMPLEMENTED' as const) : ('BLOCKED' as const);
      return Object.freeze({
        packageId,
        title: meta?.title ?? packageId,
        moduleRef: meta?.moduleRef ?? '',
        status,
      });
    }),
  );
}
