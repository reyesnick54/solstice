import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { SHADOW_LAB_WORK_PACKAGES } from './taxonomy.ts';
import type { ShadowLabWorkPackageRow } from './types.ts';

const MODULE_BY_PACKAGE: Record<string, { readonly title: string; readonly moduleRef: string }> = {
  ALPHA16: {
    title: 'Current-main forward-alpha qualification dependency',
    moduleRef: 'packages/platform/src/helios/autonomous-shadow-lab/alpha16-current-main.ts',
  },
  ALPHA17: {
    title: 'Campaign orchestration',
    moduleRef: 'packages/platform/src/helios/autonomous-shadow-lab/alpha17-campaign-orchestration.ts',
  },
  ALPHA18: {
    title: 'Forward data admission',
    moduleRef: 'packages/platform/src/helios/autonomous-shadow-lab/alpha18-forward-data-admission.ts',
  },
  ALPHA19: {
    title: 'Outcome maturity',
    moduleRef: 'packages/platform/src/helios/autonomous-shadow-lab/alpha19-outcome-maturity.ts',
  },
  ALPHA20: {
    title: 'Experimental cohorts',
    moduleRef: 'packages/platform/src/helios/autonomous-shadow-lab/alpha20-experimental-cohorts.ts',
  },
  ALPHA21: {
    title: 'Continuous shadow portfolio',
    moduleRef: 'packages/platform/src/helios/autonomous-shadow-lab/alpha21-continuous-shadow-portfolio.ts',
  },
  ALPHA22: {
    title: 'Control room',
    moduleRef: 'packages/platform/src/helios/autonomous-shadow-lab/alpha22-control-room.ts',
  },
  ALPHA23: {
    title: 'Automatic demotion',
    moduleRef: 'packages/platform/src/helios/autonomous-shadow-lab/alpha23-automatic-demotion.ts',
  },
  ALPHA24: {
    title: 'Recurring evidence reports',
    moduleRef: 'packages/platform/src/helios/autonomous-shadow-lab/alpha24-recurring-evidence-reports.ts',
  },
  ALPHA25: {
    title: 'Autonomous shadow lab final qualification',
    moduleRef: 'packages/platform/src/helios/autonomous-shadow-lab/alpha25-qualification.ts',
  },
};

export function buildShadowLabWorkPackageRegistry(root: string): readonly ShadowLabWorkPackageRow[] {
  return Object.freeze(
    SHADOW_LAB_WORK_PACKAGES.map((workPackage) => {
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

export function shadowLabWorkPackagesQualified(rows: readonly ShadowLabWorkPackageRow[]): boolean {
  return rows.every((row) => row.status === 'QUALIFIED');
}

export function shadowLabWorkPackageBlockers(rows: readonly ShadowLabWorkPackageRow[]): readonly string[] {
  return Object.freeze(
    rows.filter((row) => row.status === 'BLOCKED').map((row) => `${row.workPackage}:${row.moduleRef}`),
  );
}
