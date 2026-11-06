import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { CF_WORK_PACKAGES } from './taxonomy.ts';

export type CfWorkPackageRow = {
  readonly packageId: string;
  readonly title: string;
  readonly moduleRef: string;
  readonly status: 'IMPLEMENTED' | 'BLOCKED';
};

const MODULE_BY_PACKAGE: Record<string, { readonly title: string; readonly moduleRef: string }> = {
  CF01: {
    title: 'Decision ledger (taken and untaken actions)',
    moduleRef: 'packages/platform/src/helios/counterfactual-learning/cf01-decision-ledger.ts',
  },
  CF02: {
    title: 'Rejected opportunity shadow book',
    moduleRef: 'packages/platform/src/helios/counterfactual-learning/cf02-rejected-opportunity-shadow-book.ts',
  },
  CF03: {
    title: 'Behavior policy / propensity',
    moduleRef: 'packages/platform/src/helios/counterfactual-learning/overlap-assessment.ts',
  },
  CF04: {
    title: 'Outcome model (conditional expectations)',
    moduleRef: 'packages/platform/src/helios/counterfactual-learning/cf04/qualification.ts',
  },
  CF05: {
    title: 'Doubly robust off-policy evaluation',
    moduleRef: 'packages/platform/src/helios/counterfactual-learning/cf05/qualification.ts',
  },
  CF06: {
    title: 'Distributional off-policy evaluation',
    moduleRef: 'packages/platform/src/helios/counterfactual-learning/cf06-distributional-ope/qualification.ts',
  },
  CF07: {
    title: 'Sequential off-policy evaluation (FQE)',
    moduleRef: 'packages/platform/src/helios/counterfactual-learning/cf07-sequential-ope/qualification.ts',
  },
  CF08: {
    title: 'Market response twin',
    moduleRef: 'packages/platform/src/helios/execution-twin/simulation/cf08-qualification.ts',
  },
  CF09: {
    title: 'Heterogeneous effects',
    moduleRef: 'packages/platform/src/helios/counterfactual-learning/cf09/qualification.ts',
  },
  CF10: {
    title: 'Decision attribution',
    moduleRef: 'packages/platform/src/helios/counterfactual-learning/cf10-decision-attribution.ts',
  },
  CF11: {
    title: 'Conservative policy improvement',
    moduleRef: 'packages/platform/src/helios/counterfactual-learning/cf11-conservative-policy-improvement.ts',
  },
  CF12: {
    title: 'Evolution memory (EVOL)',
    moduleRef: 'packages/platform/src/helios/counterfactual-learning/cf12-evolution-memory.ts',
  },
  CF13: {
    title: 'Agent committee (counterfactual review)',
    moduleRef: 'packages/platform/src/helios/counterfactual-learning/cf13-agent-committee.ts',
  },
};

export function listCfWorkPackages(root: string): readonly CfWorkPackageRow[] {
  return Object.freeze(
    CF_WORK_PACKAGES.map((packageId) => {
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
