import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { EXEC_WORK_PACKAGES } from './taxonomy.ts';

export type ExecWorkPackageRow = {
  readonly packageId: string;
  readonly title: string;
  readonly moduleRef: string;
  readonly status: 'IMPLEMENTED' | 'BLOCKED';
};

const MODULE_BY_PACKAGE: Record<string, { readonly title: string; readonly moduleRef: string }> = {
  EXEC01: {
    title: 'Canonical execution domain',
    moduleRef: 'packages/platform/src/helios/execution-connectivity/exec01/index.ts',
  },
  EXEC02: {
    title: 'Normalized broker protocol',
    moduleRef: 'packages/platform/src/helios/execution-connectivity/exec02/index.ts',
  },
  EXEC03: {
    title: 'Exactly-once intent',
    moduleRef: 'packages/platform/src/helios/execution-connectivity/exec03/index.ts',
  },
  EXEC04: {
    title: 'Pre-trade firewall',
    moduleRef: 'packages/platform/src/helios/multi-asset/m18/index.ts',
  },
  EXEC05: {
    title: 'Smart routing',
    moduleRef: 'packages/platform/src/helios/execution-connectivity/exec05/index.ts',
  },
  EXEC06: {
    title: 'Execution algorithms',
    moduleRef: 'packages/platform/src/helios/execution-connectivity/exec06/index.ts',
  },
  EXEC07: {
    title: 'Transaction cost analysis',
    moduleRef: 'packages/platform/src/helios/execution-connectivity/exec07/index.ts',
  },
  EXEC08: {
    title: 'Asset and account segregation',
    moduleRef: 'packages/platform/src/helios/multi-asset/m24/types.ts',
  },
  EXEC09: {
    title: 'Settlement obligations',
    moduleRef: 'packages/platform/src/helios/multi-asset/m24/settlement-semantics.ts',
  },
  EXEC10: {
    title: 'Financing controls',
    moduleRef: 'packages/platform/src/helios/execution-connectivity/exec10/index.ts',
  },
  EXEC11: {
    title: 'Custody isolation',
    moduleRef: 'packages/custody/src/execution-connectivity/exec11/index.ts',
  },
  EXEC12: {
    title: 'Reconciliation',
    moduleRef: 'packages/platform/src/helios/execution-connectivity/exec12/index.ts',
  },
  EXEC13: {
    title: 'Resiliency and chaos harness',
    moduleRef: 'packages/platform/src/helios/execution-connectivity/exec13/index.ts',
  },
  EXEC14: {
    title: 'Provider certification and conformance',
    moduleRef: 'packages/platform/src/helios/execution-connectivity/exec14/index.ts',
  },
  EXEC15: {
    title: 'Final broker/custody/execution qualification',
    moduleRef: 'packages/platform/src/helios/execution-connectivity/exec15-qualification.ts',
  },
};

const OPTIONAL_TESTS: Record<string, string> = {
  EXEC01: 'tests/helios-exec01-connectivity-domain.test.ts',
  EXEC02: 'tests/helios-exec02-broker-protocol.test.ts',
  EXEC03: 'tests/helios-exec03-exactly-once-intent.test.ts',
  EXEC04: 'tests/helios-multi-asset-m18-portfolio-exposure-graph.test.ts',
  EXEC05: 'tests/helios-exec05-smart-routing.test.ts',
  EXEC06: 'tests/helios-exec06-execution-algos.test.ts',
  EXEC07: 'tests/helios-exec07-tca.test.ts',
  EXEC08: 'tests/helios-multi-asset-m24-execution-settlement-reconciliation.test.ts',
  EXEC09: 'tests/helios-multi-asset-m24-execution-settlement-reconciliation.test.ts',
  EXEC10: 'tests/helios-exec10-financing-controls.test.ts',
  EXEC11: 'tests/helios-exec11-custody-isolation.test.ts',
  EXEC12: 'tests/helios-exec12-reconciliation.test.ts',
  EXEC13: 'tests/helios-exec13-execution-resilience.test.ts',
  EXEC14: 'tests/helios-exec14-provider-conformance.test.ts',
  EXEC15: 'tests/helios-exec15-execution-connectivity-qualification.test.ts',
};

export function listExecWorkPackages(root: string): readonly ExecWorkPackageRow[] {
  return Object.freeze(
    EXEC_WORK_PACKAGES.map((packageId) => {
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
