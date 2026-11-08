import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type { AlphaWorkPackageRow } from './types.ts';
import { ALPHA_WORK_PACKAGES } from './taxonomy.ts';
import { CANONICAL_ALPHA_MODULES } from './canonical-alpha-modules.ts';

const TITLES: Record<string, string> = {
  ALPHA01: 'Forward alpha evidence domain',
  ALPHA02: 'Pre-registration and statistical policy freeze',
  ALPHA03: 'Prequential evaluation',
  ALPHA04: 'Shadow capital forward book',
  ALPHA05: 'Benchmark attribution',
  ALPHA06: 'Execution realism overlay',
  ALPHA07: 'Sequential inference',
  ALPHA08: 'Multiple-testing firewall',
  ALPHA09: 'Risk and tail metrics',
  ALPHA10: 'Regime robustness',
  ALPHA11: 'Decay detection',
  ALPHA12: 'Capacity evidence',
  ALPHA13: 'Portfolio-level evidence',
  ALPHA14: 'Evidence committee gate',
  ALPHA15: 'Final forward-alpha evidence and reality gate',
};

export function buildAlphaWorkPackageRegistry(root: string): readonly AlphaWorkPackageRow[] {
  return Object.freeze(
    ALPHA_WORK_PACKAGES.map((workPackage) => {
      const meta = CANONICAL_ALPHA_MODULES.find((row) => row.packageId === workPackage);
      const moduleRef = meta?.entryModule ?? '';
      const moduleOk = moduleRef.length > 0 && existsSync(join(root, moduleRef));
      const testRel = meta?.qualificationTest;
      const testOk = testRel ? existsSync(join(root, testRel)) : true;
      const qualified = moduleOk && testOk;
      return Object.freeze({
        workPackage,
        title: meta?.capability ?? TITLES[workPackage] ?? workPackage,
        status: qualified ? ('QUALIFIED' as const) : ('BLOCKED' as const),
        moduleRef,
        implementationOwner: meta?.implementationOwner ?? '',
        qualificationTest: testRel ?? '',
      });
    }),
  );
}

export function alphaWorkPackagesQualified(rows: readonly AlphaWorkPackageRow[]): boolean {
  return rows.every((row) => row.status === 'QUALIFIED');
}

export function alphaWorkPackageBlockers(rows: readonly AlphaWorkPackageRow[]): readonly string[] {
  return Object.freeze(
    rows
      .filter((row) => row.status === 'BLOCKED')
      .map((row) => {
        const parts = [`${row.workPackage}:${row.moduleRef}`];
        if (row.qualificationTest) {
          parts.push(`test:${row.qualificationTest}`);
        }
        return parts.join(';');
      }),
  );
}
