import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type { EarnWorkPackageRow } from './types.ts';
import { EARN_WORK_PACKAGES } from './taxonomy.ts';

const MODULE_BY_PACKAGE: Record<string, { readonly title: string; readonly moduleRef: string }> = {
  EARN01: {
    title: 'Earnings domain model',
    moduleRef: 'packages/platform/src/helios/earnings-intelligence/earn01-domain.ts',
  },
  EARN02: {
    title: 'Earnings event graph',
    moduleRef: 'packages/platform/src/helios/earnings-intelligence/earn02-event-graph.ts',
  },
  EARN03: {
    title: 'Surprise tensor',
    moduleRef: 'packages/platform/src/helios/earnings-intelligence/earn03-surprise-tensor.ts',
  },
  EARN04: {
    title: 'Analyst expectations',
    moduleRef: 'packages/platform/src/helios/earnings-intelligence/earn04-analyst-expectations.ts',
  },
  EARN05: {
    title: 'Transcript intelligence',
    moduleRef: 'packages/platform/src/helios/earnings-intelligence/transcript/service.ts',
  },
  EARN06: {
    title: 'Earnings quality',
    moduleRef: 'packages/platform/src/helios/earnings-intelligence/earn06-earnings-quality.ts',
  },
  EARN07: {
    title: 'Options intelligence',
    moduleRef: 'packages/platform/src/helios/earnings-intelligence/earn07-options-intelligence.ts',
  },
  EARN08: {
    title: 'Peer attention PEAD',
    moduleRef: 'packages/platform/src/helios/earnings-intelligence/earn08-peer-attention-pead.ts',
  },
  EARN09: {
    title: 'Probabilistic state estimator',
    moduleRef: 'packages/platform/src/helios/earnings-intelligence/state-estimator/index.ts',
  },
  EARN10: {
    title: 'Agent committee',
    moduleRef: 'packages/platform/src/helios/earnings-intelligence/earn10-agent-committee.ts',
  },
  EARN11: {
    title: 'Strategy Genome research bridge',
    moduleRef: 'packages/platform/src/helios/earnings-intelligence/earn11-strategy-genome.ts',
  },
  EARN12: {
    title: 'Final qualification and anti-overfitting gate',
    moduleRef: 'packages/platform/src/helios/earnings-intelligence/qualification.ts',
  },
};

export function buildEarnWorkPackageRegistry(root: string): readonly EarnWorkPackageRow[] {
  return Object.freeze(
    EARN_WORK_PACKAGES.map((workPackage) => {
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

export function earnWorkPackagesQualified(rows: readonly EarnWorkPackageRow[]): boolean {
  return rows.every((row) => row.status === 'QUALIFIED');
}

export function earnWorkPackageBlockers(rows: readonly EarnWorkPackageRow[]): readonly string[] {
  return Object.freeze(rows.filter((row) => row.status === 'BLOCKED').map((row) => `${row.workPackage}:${row.moduleRef}`));
}
