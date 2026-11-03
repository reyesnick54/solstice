/**
 * Assert single canonical owners for HELIOS-relevant platform functions.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

export type CanonicalAuthorityAssertion = {
  readonly component: string;
  readonly canonicalOwnerPath: string;
  readonly present: boolean;
  readonly competingPaths: readonly string[];
  readonly competingPresent: readonly string[];
};

const CANONICAL_COMPONENTS: readonly {
  readonly component: string;
  readonly canonicalOwnerPath: string;
  readonly competingPaths: readonly string[];
}[] = Object.freeze([
  {
    component: 'Risk Engine',
    canonicalOwnerPath: 'packages/risk',
    competingPaths: Object.freeze(['packages/risk-engine', 'packages/helios-risk']),
  },
  {
    component: 'Compliance Kernel',
    canonicalOwnerPath: 'packages/kernel',
    competingPaths: Object.freeze(['packages/compliance-kernel', 'packages/helios-kernel']),
  },
  {
    component: 'Execution Authority',
    canonicalOwnerPath: 'packages/permissions',
    competingPaths: Object.freeze(['packages/execution-authority', 'packages/helios-authority']),
  },
  {
    component: 'Ledger',
    canonicalOwnerPath: 'packages/ledger',
    competingPaths: Object.freeze(['packages/helios-ledger', 'packages/access-ledger']),
  },
  {
    component: 'Exchange',
    canonicalOwnerPath: 'packages/sunrey-exchange',
    competingPaths: Object.freeze(['packages/exchange', 'packages/capacity-exchange']),
  },
  {
    component: 'Observation Fabric',
    canonicalOwnerPath: 'packages/platform/src/helios/observation',
    competingPaths: Object.freeze(['packages/observation-fabric', 'packages/helios-observation']),
  },
  {
    component: 'Feature Fabric',
    canonicalOwnerPath: 'packages/platform/src/helios/open-source/feature-fabric',
    competingPaths: Object.freeze(['packages/feature-fabric', 'packages/helios-feature-fabric']),
  },
  {
    component: 'Strategy Lab',
    canonicalOwnerPath: 'packages/strategy-lab',
    competingPaths: Object.freeze(['packages/strategy-lab-v2', 'packages/helios-strategy-lab']),
  },
  {
    component: 'Meta Allocator',
    canonicalOwnerPath: 'packages/platform/src/helios/meta-allocator',
    competingPaths: Object.freeze(['packages/meta-allocator', 'packages/helios-meta-allocator']),
  },
  {
    component: 'Evidence Vault',
    canonicalOwnerPath: 'packages/evidence',
    competingPaths: Object.freeze(['packages/evidence-vault-v2', 'packages/helios-evidence']),
  },
]);

export function evaluateCanonicalAuthorityAssertions(root: string): {
  readonly assertions: readonly CanonicalAuthorityAssertion[];
  readonly pass: boolean;
  readonly blockers: readonly string[];
} {
  const assertions: CanonicalAuthorityAssertion[] = [];
  const blockers: string[] = [];

  for (const spec of CANONICAL_COMPONENTS) {
    const present = existsSync(join(root, spec.canonicalOwnerPath));
    const competingPresent = spec.competingPaths.filter((rel) => existsSync(join(root, rel)));
    assertions.push(
      Object.freeze({
        component: spec.component,
        canonicalOwnerPath: spec.canonicalOwnerPath,
        present,
        competingPaths: spec.competingPaths,
        competingPresent: Object.freeze(competingPresent),
      }),
    );
    if (competingPresent.length > 0) {
      blockers.push(
        `${spec.component}: competing owner path(s) present: ${competingPresent.join(', ')}`,
      );
    }
    if (!present && spec.component !== 'Feature Fabric') {
      blockers.push(`${spec.component}: canonical owner missing at ${spec.canonicalOwnerPath}`);
    }
  }

  return Object.freeze({
    assertions: Object.freeze(assertions),
    pass: blockers.length === 0,
    blockers: Object.freeze(blockers),
  });
}
