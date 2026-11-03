/**
 * NATIVE01–NATIVE15 work-package evidence registry.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type { NativeAssimilationWorkPackageId } from './taxonomy.ts';

export type NativeAssimilationWorkPackageRow = {
  readonly workPackage: NativeAssimilationWorkPackageId;
  readonly title: string;
  readonly status: 'QUALIFIED' | 'BLOCKED';
  readonly evidenceRefs: readonly string[];
};

function allPresent(root: string, paths: readonly string[]): boolean {
  return paths.every((rel) => existsSync(join(root, rel)));
}

const NATIVE_EVIDENCE: Readonly<Record<Exclude<NativeAssimilationWorkPackageId, 'NATIVE15'>, readonly string[]>> =
  Object.freeze({
    NATIVE01: Object.freeze([
      'packages/platform/src/helios/execution-twin/index.ts',
      'tests/helios-os02-execution-twin.test.ts',
    ]),
    NATIVE02: Object.freeze([
      'packages/platform/src/helios/execution-twin/simulation/index.ts',
      'tests/helios-os03-execution-simulation.test.ts',
    ]),
    NATIVE03: Object.freeze([
      'packages/platform/src/helios/execution-routing/venue-conformance/index.ts',
      'tests/helios-os04-venue-adapter-conformance.test.ts',
    ]),
    NATIVE04: Object.freeze([
      'packages/strategy-lab/src/os05/index.ts',
      'tests/helios-os05-strategy-genome.test.ts',
    ]),
    NATIVE05: Object.freeze([
      'packages/platform/src/helios/research-monitor/index.ts',
      'tests/helios-os07-research-monitor-dsl.test.ts',
    ]),
    NATIVE06: Object.freeze([
      'packages/platform/src/helios/feature-fabric/index.ts',
      'tests/helios-os10-point-in-time-fundamentals.test.ts',
    ]),
    NATIVE07: Object.freeze([
      'packages/platform/src/helios/open-source-integration/os08/index.ts',
      'tests/helios-os08-triggered-agentic-research.test.ts',
    ]),
    NATIVE08: Object.freeze([
      'packages/agentic-capital-mesh/src/institutional-research-mesh/index.ts',
      'tests/helios-os09-institutional-research-mesh.test.ts',
    ]),
    NATIVE09: Object.freeze([
      'packages/platform/src/helios/open-source/os11-adversarial-research/index.ts',
      'tests/helios-os11-adversarial-research.test.ts',
    ]),
    NATIVE10: Object.freeze([
      'packages/platform/src/helios/os12-agent-permission-gateway/index.ts',
      'tests/helios-os12-agent-permission-gateway.test.ts',
    ]),
    NATIVE11: Object.freeze([
      'packages/platform/src/helios/open-source-integration/os13-ai-strategy-sandbox/index.ts',
      'packages/platform/src/helios/open-source-integration/os13-ai-strategy-sandbox/os13.test.ts',
    ]),
    NATIVE12: Object.freeze([
      'packages/strategy-lab/src/index.ts',
      'tests/helios-os05-strategy-genome.test.ts',
    ]),
    NATIVE13: Object.freeze([
      'packages/platform/src/helios/open-source/os14-prediction-market/index.ts',
      'tests/helios-os14-prediction-market-research.test.ts',
    ]),
    NATIVE14: Object.freeze([
      'docs/helios/open-source/upstream-lock.json',
      'docs/helios/native-assimilation/THIRD_PARTY_NOTICES.md',
    ]),
  });

const TITLES: Record<Exclude<NativeAssimilationWorkPackageId, 'NATIVE15'>, string> = {
  NATIVE01: 'BYTEX execution twin native port',
  NATIVE02: 'BYTEX paper matching simulation native port',
  NATIVE03: 'BYTEX venue conformance native harness',
  NATIVE04: 'Strategy genome native foundation',
  NATIVE05: 'OpenChart research monitor DSL native port',
  NATIVE06: 'OpenChart indicator/feature fabric native port',
  NATIVE07: 'TradingAgents triggered research native port',
  NATIVE08: 'TradingAgents institutional mesh native port',
  NATIVE09: 'TradingAgents adversarial research native port',
  NATIVE10: 'TradingAgents agent permission gateway native port',
  NATIVE11: 'Seris strategy sandbox native port',
  NATIVE12: 'Seris backtest workflow via Strategy Lab',
  NATIVE13: 'Polymarket research native port',
  NATIVE14: 'Attribution and provenance metadata',
};

export function buildNativeAssimilationWorkPackageRegistry(root: string): readonly NativeAssimilationWorkPackageRow[] {
  const rows: NativeAssimilationWorkPackageRow[] = [];
  for (const id of Object.keys(NATIVE_EVIDENCE) as Exclude<NativeAssimilationWorkPackageId, 'NATIVE15'>[]) {
    const evidenceRefs = NATIVE_EVIDENCE[id];
    rows.push(
      Object.freeze({
        workPackage: id,
        title: TITLES[id],
        status: allPresent(root, evidenceRefs) ? 'QUALIFIED' : 'BLOCKED',
        evidenceRefs,
      }),
    );
  }

  const native15Evidence = Object.freeze([
    'packages/platform/src/helios/native-assimilation/qualification.ts',
    'docs/helios/native-assimilation/NATIVE_CAPABILITY_PARITY_MATRIX.md',
    'tests/helios-native15-foreign-runtime-independence.test.ts',
    'scripts/helios-native15-foreign-runtime-qualify.ts',
  ]);
  rows.push(
    Object.freeze({
      workPackage: 'NATIVE15',
      title: 'Foreign runtime retirement qualification',
      status: allPresent(root, native15Evidence) ? 'QUALIFIED' : 'BLOCKED',
      evidenceRefs: native15Evidence,
    }),
  );

  return Object.freeze(rows);
}
