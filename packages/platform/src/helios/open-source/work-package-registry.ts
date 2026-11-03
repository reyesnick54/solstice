/**
 * OS00–OS15 work-package evidence registry for open-source integration wave 1.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type { OpenSourceWorkPackageId, OpenSourceWorkPackageStatus } from './taxonomy.ts';

export type OpenSourceWorkPackageRow = {
  readonly workPackage: OpenSourceWorkPackageId;
  readonly title: string;
  readonly status: OpenSourceWorkPackageStatus;
  readonly evidenceRefs: readonly string[];
  readonly notes?: string;
};

function repoFile(root: string, rel: string): boolean {
  return existsSync(join(root, rel));
}

function allPresent(root: string, paths: readonly string[]): boolean {
  return paths.every((rel) => repoFile(root, rel));
}

function row(
  workPackage: OpenSourceWorkPackageId,
  title: string,
  status: OpenSourceWorkPackageStatus,
  evidenceRefs: readonly string[],
  notes?: string,
): OpenSourceWorkPackageRow {
  return Object.freeze({ workPackage, title, status, evidenceRefs, ...(notes ? { notes } : {}) });
}

/** Required evidence paths per upstream work package (wave 1). */
export const OPEN_SOURCE_WORK_PACKAGE_EVIDENCE: Readonly<
  Record<Exclude<OpenSourceWorkPackageId, 'OS15'>, readonly string[]>
> = Object.freeze({
  OS00: Object.freeze([
    'docs/helios/open-source/os00-upstream-provenance.md',
    'packages/platform/src/helios/open-source/provenance/upstream-registry.ts',
    'tests/helios-os00-upstream-provenance.test.ts',
  ]),
  OS01: Object.freeze([
    'docs/helios/open-source/BYTEX_HELIOS_INTEGRATION_MAP.md',
  ]),
  OS02: Object.freeze([
    'packages/platform/src/helios/execution-twin/index.ts',
    'tests/helios-os02-execution-twin.test.ts',
  ]),
  OS03: Object.freeze([
    'packages/platform/src/helios/open-source/execution-simulation/index.ts',
    'tests/helios-os03-execution-simulation.test.ts',
  ]),
  OS04: Object.freeze([
    'packages/platform/src/helios/open-source/venue-conformance/index.ts',
    'tests/helios-os04-venue-conformance.test.ts',
  ]),
  OS05: Object.freeze([
    'packages/platform/src/helios/open-source/strategy-genome/index.ts',
    'tests/helios-os05-strategy-genome.test.ts',
  ]),
  OS06: Object.freeze([
    'packages/platform/src/helios/open-source/openchart-map/index.ts',
    'tests/helios-os06-openchart-map.test.ts',
  ]),
  OS07: Object.freeze([
    'packages/platform/src/helios/open-source/research-monitor/index.ts',
    'tests/helios-os07-research-monitor-dsl.test.ts',
  ]),
  OS08: Object.freeze([
    'packages/platform/src/helios/open-source/triggered-research/index.ts',
    'tests/helios-os08-triggered-research.test.ts',
  ]),
  OS09: Object.freeze([
    'packages/agentic-capital-mesh/src/institutional-research-mesh/index.ts',
    'tests/helios-os09-institutional-research-mesh.test.ts',
  ]),
  OS10: Object.freeze([
    'packages/platform/src/helios/feature-fabric/index.ts',
    'tests/helios-os10-point-in-time-fundamentals.test.ts',
  ]),
  OS11: Object.freeze([
    'packages/platform/src/helios/open-source/os11-adversarial-research/index.ts',
    'tests/helios-os11-adversarial-research.test.ts',
  ]),
  OS12: Object.freeze([
    'packages/platform/src/helios/open-source/agent-permission-gateway/index.ts',
    'tests/helios-os12-agent-permission-gateway.test.ts',
  ]),
  OS13: Object.freeze([
    'packages/platform/src/helios/open-source/strategy-sandbox/index.ts',
    'tests/helios-os13-strategy-sandbox.test.ts',
  ]),
  OS14: Object.freeze([
    'packages/platform/src/helios/open-source/prediction-market-research/index.ts',
    'tests/helios-os14-prediction-market-research.test.ts',
  ]),
});

export function buildOpenSourceWorkPackageRegistry(root: string): readonly OpenSourceWorkPackageRow[] {
  const rows: OpenSourceWorkPackageRow[] = [];

  const titles: Record<Exclude<OpenSourceWorkPackageId, 'OS15'>, string> = {
    OS00: 'Upstream provenance registry',
    OS01: 'BYTEX venue and symbology map',
    OS02: 'Execution Twin',
    OS03: 'Execution simulation realism',
    OS04: 'Venue conformance harness',
    OS05: 'Strategy Genome foundation',
    OS06: 'OpenChart symbology map',
    OS07: 'Research Monitor DSL',
    OS08: 'Triggered research automation',
    OS09: 'Institutional research mesh',
    OS10: 'Point-in-time fundamentals',
    OS11: 'Adversarial research (bull/bear challenge)',
    OS12: 'Agent permission gateway',
    OS13: 'Strategy sandbox',
    OS14: 'Prediction-market research',
  };

  for (const id of Object.keys(OPEN_SOURCE_WORK_PACKAGE_EVIDENCE) as Exclude<
    OpenSourceWorkPackageId,
    'OS15'
  >[]) {
    const evidenceRefs = OPEN_SOURCE_WORK_PACKAGE_EVIDENCE[id];
    const present = allPresent(root, evidenceRefs);
    rows.push(
      row(
        id,
        titles[id],
        present ? 'QUALIFIED' : 'BLOCKED',
        evidenceRefs,
        present ? undefined : 'Required open-source integration artifacts are absent from the repository',
      ),
    );
  }

  const os15Evidence = Object.freeze([
    'packages/platform/src/helios/open-source/qualification.ts',
    'packages/platform/src/helios/open-source/index.ts',
    'scripts/helios-os15-open-source-qualify.ts',
    'tests/helios-os15-open-source-integration-qualification.test.ts',
  ]);
  rows.push(
    row(
      'OS15',
      'Unified qualification, provenance, and release gate',
      allPresent(root, os15Evidence) ? 'QUALIFIED' : 'BLOCKED',
      os15Evidence,
    ),
  );

  return Object.freeze(rows);
}

export function openSourceWorkPackagesQualified(rows: readonly OpenSourceWorkPackageRow[]): boolean {
  return rows.every((row) => row.status === 'QUALIFIED');
}

export function openSourceWorkPackageBlockers(rows: readonly OpenSourceWorkPackageRow[]): readonly string[] {
  return Object.freeze(
    rows.filter((row) => row.status !== 'QUALIFIED').map((row) => `${row.workPackage}: ${row.title}`),
  );
}
