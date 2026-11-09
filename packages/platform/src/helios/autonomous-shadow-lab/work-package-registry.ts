import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { CANONICAL_SHADOW_MODULES } from './canonical-shadow-modules.ts';
import { SHADOW_LAB_WORK_PACKAGES } from './taxonomy.ts';
import type { ShadowLabWorkPackageRow } from './types.ts';

export function buildShadowLabWorkPackageRegistry(root: string): readonly ShadowLabWorkPackageRow[] {
  return Object.freeze(
    SHADOW_LAB_WORK_PACKAGES.map((workPackage) => {
      const meta = CANONICAL_SHADOW_MODULES.find((row) => row.packageId === workPackage);
      const moduleRef = meta?.entryModule ?? '';
      const bridgeOk = meta ? existsSync(join(root, meta.bridgeModule)) : false;
      const entryOk = moduleRef.length > 0 && existsSync(join(root, moduleRef));
      const testRel = meta?.qualificationTest ?? '';
      const testOk = testRel.length > 0 && existsSync(join(root, testRel));
      const qualified = bridgeOk && entryOk && testOk;
      return Object.freeze({
        workPackage,
        title: meta?.capability ?? workPackage,
        status: qualified ? ('QUALIFIED' as const) : ('BLOCKED' as const),
        moduleRef,
        implementationOwner: meta?.implementationOwner ?? '',
        qualificationTest: testRel,
      });
    }),
  );
}

export function shadowLabWorkPackagesQualified(rows: readonly ShadowLabWorkPackageRow[]): boolean {
  return rows.every((row) => row.status === 'QUALIFIED');
}

export function shadowLabWorkPackageBlockers(rows: readonly ShadowLabWorkPackageRow[]): readonly string[] {
  return Object.freeze(
    rows
      .filter((row) => row.status === 'BLOCKED')
      .map((row) => `${row.workPackage}:${row.moduleRef};test:${row.qualificationTest}`),
  );
}
