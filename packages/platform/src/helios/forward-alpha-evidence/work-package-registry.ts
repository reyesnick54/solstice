import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type { AlphaWorkPackageRow } from './types.ts';
import { ALPHA_WORK_PACKAGES } from './taxonomy.ts';

const MODULE_BY_PACKAGE: Record<string, { readonly title: string; readonly moduleRef: string }> = {
  ALPHA01: {
    title: 'Forward alpha evidence domain',
    moduleRef: 'packages/platform/src/helios/forward-alpha-evidence/alpha01-evidence-domain.ts',
  },
  ALPHA02: {
    title: 'Pre-registration and statistical policy freeze',
    moduleRef: 'packages/platform/src/helios/forward-alpha-evidence/alpha02-pre-registration.ts',
  },
  ALPHA03: {
    title: 'Prequential evaluation',
    moduleRef: 'packages/platform/src/helios/forward-alpha-evidence/alpha03-prequential-evaluation.ts',
  },
  ALPHA04: {
    title: 'Shadow capital forward book',
    moduleRef: 'packages/platform/src/helios/forward-alpha-evidence/alpha04-shadow-capital.ts',
  },
  ALPHA05: {
    title: 'Benchmark attribution',
    moduleRef: 'packages/platform/src/helios/forward-alpha/alpha05/index.ts',
  },
  ALPHA06: {
    title: 'Execution realism overlay',
    moduleRef: 'packages/platform/src/helios/forward-alpha-evidence/alpha06-execution-realism.ts',
  },
  ALPHA07: {
    title: 'Sequential inference',
    moduleRef: 'packages/platform/src/helios/forward-alpha-evidence/alpha07-sequential-inference.ts',
  },
  ALPHA08: {
    title: 'Multiple-testing firewall',
    moduleRef: 'packages/platform/src/helios/forward-alpha-evidence/alpha08-multiple-testing-firewall.ts',
  },
  ALPHA09: {
    title: 'Risk and tail metrics',
    moduleRef: 'packages/platform/src/helios/forward-alpha-evidence/alpha09-risk-tail-metrics.ts',
  },
  ALPHA10: {
    title: 'Regime robustness',
    moduleRef: 'packages/platform/src/helios/forward-alpha-evidence/alpha10-regime-robustness.ts',
  },
  ALPHA11: {
    title: 'Decay detection',
    moduleRef: 'packages/platform/src/helios/forward-alpha-evidence/alpha11-decay-detection.ts',
  },
  ALPHA12: {
    title: 'Capacity evidence',
    moduleRef: 'packages/platform/src/helios/forward-alpha-evidence/alpha12-capacity.ts',
  },
  ALPHA13: {
    title: 'Portfolio-level evidence',
    moduleRef: 'packages/platform/src/helios/forward-alpha-evidence/alpha13-portfolio-evidence.ts',
  },
  ALPHA14: {
    title: 'Evidence committee gate',
    moduleRef: 'packages/platform/src/helios/forward-alpha-evidence/alpha14-evidence-committee.ts',
  },
  ALPHA15: {
    title: 'Final forward-alpha evidence and reality gate',
    moduleRef: 'packages/platform/src/helios/forward-alpha-evidence/alpha15-qualification.ts',
  },
};

export function buildAlphaWorkPackageRegistry(root: string): readonly AlphaWorkPackageRow[] {
  return Object.freeze(
    ALPHA_WORK_PACKAGES.map((workPackage) => {
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

export function alphaWorkPackagesQualified(rows: readonly AlphaWorkPackageRow[]): boolean {
  return rows.every((row) => row.status === 'QUALIFIED');
}

export function alphaWorkPackageBlockers(rows: readonly AlphaWorkPackageRow[]): readonly string[] {
  return Object.freeze(
    rows.filter((row) => row.status === 'BLOCKED').map((row) => `${row.workPackage}:${row.moduleRef}`),
  );
}
