/**
 * NATIVE01–NATIVE14 capability parity definitions and evidence evaluation.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type {
  NativeParityQualificationStatus,
  UpstreamAssimilationProjectId,
} from './taxonomy.ts';

export type NativeCapabilityParityRow = {
  readonly id: string;
  readonly upstreamProject: UpstreamAssimilationProjectId;
  readonly upstreamFunction: string;
  readonly nativeHeliosOwner: string;
  readonly parityTest: string;
  readonly qualificationStatus: NativeParityQualificationStatus;
  readonly notes?: string;
};

export type NativeCapabilityParityMatrix = {
  readonly rows: readonly NativeCapabilityParityRow[];
  readonly allQualified: boolean;
  readonly blockers: readonly string[];
};

type ParityDefinition = {
  readonly id: string;
  readonly upstreamProject: UpstreamAssimilationProjectId;
  readonly upstreamFunction: string;
  readonly nativeHeliosOwner: string;
  readonly parityTest: string;
  readonly notes?: string;
};

/** Canonical parity map: upstream concept → native owner → regression test. */
export const NATIVE_CAPABILITY_PARITY_DEFINITIONS: readonly ParityDefinition[] = Object.freeze([
  {
    id: 'bytex.backtest.event_engine',
    upstreamProject: 'bytex',
    upstreamFunction: 'Bytex.Backtest event-driven historical simulation',
    nativeHeliosOwner: 'packages/platform/src/helios/execution-twin',
    parityTest: 'tests/helios-os02-execution-twin.test.ts',
  },
  {
    id: 'bytex.execution.paper_matching',
    upstreamProject: 'bytex',
    upstreamFunction: 'Bytex.Core sandbox/paper order-book matching',
    nativeHeliosOwner: 'packages/platform/src/helios/execution-twin/simulation',
    parityTest: 'tests/helios-os03-execution-simulation.test.ts',
  },
  {
    id: 'bytex.venue.conformance',
    upstreamProject: 'bytex',
    upstreamFunction: 'Bytex.Adapters venue adapter certification patterns',
    nativeHeliosOwner: 'packages/platform/src/helios/execution-routing/venue-conformance',
    parityTest: 'tests/helios-os04-venue-adapter-conformance.test.ts',
  },
  {
    id: 'bytex.strategy.genome',
    upstreamProject: 'bytex',
    upstreamFunction: 'Strategy parameter genome / promotion scaffolding',
    nativeHeliosOwner: 'packages/strategy-lab/src/os05',
    parityTest: 'tests/helios-os05-strategy-genome.test.ts',
  },
  {
    id: 'bytex.symbology.map',
    upstreamProject: 'bytex',
    upstreamFunction: 'Venue symbology and integration map (reference-only)',
    nativeHeliosOwner: 'docs/helios/open-source/BYTEX_HELIOS_INTEGRATION_MAP.md',
    parityTest: 'tests/helios-os15-open-source-integration-qualification.test.ts',
    notes: 'Design map; no BYTEX .NET runtime import',
  },
  {
    id: 'openchart.indicators.feature_fabric',
    upstreamProject: 'openchart',
    upstreamFunction: 'server/indicators study catalog and builtins',
    nativeHeliosOwner: 'packages/platform/src/helios/feature-fabric',
    parityTest: 'tests/helios-os10-point-in-time-fundamentals.test.ts',
  },
  {
    id: 'openchart.monitor.dsl',
    upstreamProject: 'openchart',
    upstreamFunction: 'Conditional research monitor / alert DSL',
    nativeHeliosOwner: 'packages/platform/src/helios/research-monitor',
    parityTest: 'tests/helios-os07-research-monitor-dsl.test.ts',
  },
  {
    id: 'openchart.symbology.map',
    upstreamProject: 'openchart',
    upstreamFunction: 'Monitor symbology architecture map (reference-only)',
    nativeHeliosOwner: 'docs/helios/open-source/OPENCHART_HELIOS_MONITOR_MAP.md',
    parityTest: 'tests/helios-os15-open-source-integration-qualification.test.ts',
    notes: 'No OpenChart Bun server or desktop runtime',
  },
  {
    id: 'tradingagents.triggered_research',
    upstreamProject: 'tradingagents',
    upstreamFunction: 'Event-triggered multi-agent research routing',
    nativeHeliosOwner: 'packages/platform/src/helios/open-source-integration/os08',
    parityTest: 'tests/helios-os08-triggered-agentic-research.test.ts',
  },
  {
    id: 'tradingagents.institutional_mesh',
    upstreamProject: 'tradingagents',
    upstreamFunction: 'tradingagents/graph role-specialized research mesh',
    nativeHeliosOwner: 'packages/agentic-capital-mesh/src/institutional-research-mesh',
    parityTest: 'tests/helios-os09-institutional-research-mesh.test.ts',
  },
  {
    id: 'tradingagents.adversarial_debate',
    upstreamProject: 'tradingagents',
    upstreamFunction: 'Bull/bear adversarial synthesis and consensus',
    nativeHeliosOwner: 'packages/platform/src/helios/open-source/os11-adversarial-research',
    parityTest: 'tests/helios-os11-adversarial-research.test.ts',
  },
  {
    id: 'tradingagents.agent_gateway',
    upstreamProject: 'tradingagents',
    upstreamFunction: 'LLM tool permission and model-agnostic research controls',
    nativeHeliosOwner: 'packages/platform/src/helios/os12-agent-permission-gateway',
    parityTest: 'tests/helios-os12-agent-permission-gateway.test.ts',
  },
  {
    id: 'seris.strategy_sandbox',
    upstreamProject: 'seris',
    upstreamFunction: 'apps/core strategy proposal sandbox (non-executing)',
    nativeHeliosOwner: 'packages/platform/src/helios/open-source-integration/os13-ai-strategy-sandbox',
    parityTest: 'packages/platform/src/helios/open-source-integration/os13-ai-strategy-sandbox/os13.test.ts',
  },
  {
    id: 'seris.backtest_workflow',
    upstreamProject: 'seris',
    upstreamFunction: 'User-local backtest workflow → Strategy Lab promotion path',
    nativeHeliosOwner: 'packages/strategy-lab',
    parityTest: 'tests/helios-os05-strategy-genome.test.ts',
    notes: 'No Seris Tauri desktop runtime',
  },
  {
    id: 'polymarket.clob_research',
    upstreamProject: 'polymarket-prediction-bot',
    upstreamFunction: 'polymarket_bot/core CLOB observation and microstructure',
    nativeHeliosOwner: 'packages/platform/src/helios/open-source/os14-prediction-market',
    parityTest: 'tests/helios-os14-prediction-market-research.test.ts',
  },
  {
    id: 'polymarket.probability_features',
    upstreamProject: 'polymarket-prediction-bot',
    upstreamFunction: 'Implied probability and order-book feature extraction',
    nativeHeliosOwner: 'packages/platform/src/helios/open-source/os14-prediction-market/probability.ts',
    parityTest: 'tests/helios-os14-prediction-market-research.test.ts',
    notes: 'No Python Polymarket TUI or live wallet path',
  },
]);

function repoPathPresent(root: string, rel: string): boolean {
  return existsSync(join(root, rel));
}

function evaluateRow(root: string, def: ParityDefinition): NativeCapabilityParityRow {
  const ownerPresent = repoPathPresent(root, def.nativeHeliosOwner);
  const testPresent = repoPathPresent(root, def.parityTest);
  let qualificationStatus: NativeParityQualificationStatus = 'QUALIFIED';
  if (!ownerPresent || !testPresent) {
    qualificationStatus = 'BLOCKED';
  }
  return Object.freeze({
    id: def.id,
    upstreamProject: def.upstreamProject,
    upstreamFunction: def.upstreamFunction,
    nativeHeliosOwner: def.nativeHeliosOwner,
    parityTest: def.parityTest,
    qualificationStatus,
    ...(def.notes ? { notes: def.notes } : {}),
  });
}

export function buildNativeCapabilityParityMatrix(root: string): NativeCapabilityParityMatrix {
  const rows = NATIVE_CAPABILITY_PARITY_DEFINITIONS.map((def) => evaluateRow(root, def));
  const blockers = rows
    .filter((row) => row.qualificationStatus !== 'QUALIFIED')
    .map(
      (row) =>
        `${row.id}: missing ${!existsSync(join(root, row.nativeHeliosOwner)) ? 'native owner' : 'parity test'}`,
    );
  return Object.freeze({
    rows: Object.freeze(rows),
    allQualified: blockers.length === 0,
    blockers: Object.freeze(blockers),
  });
}

export function renderNativeCapabilityParityMarkdown(matrix: NativeCapabilityParityMatrix): string {
  const lines: string[] = [
    '# HELIOS Native Capability Parity Matrix (NATIVE15)',
    '',
    'Maps each assimilated **upstream function** to a **native HELIOS owner**, **parity test**, and **qualification status**.',
    '',
    'Runtime rule: HELIOS must not import or execute code from `vendor/assimilation/` or foreign application runtimes listed in OS00.',
    '',
    '| ID | Upstream | Upstream function | Native HELIOS owner | Parity test | Status | Notes |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const row of matrix.rows) {
    lines.push(
      `| \`${row.id}\` | ${row.upstreamProject} | ${row.upstreamFunction} | \`${row.nativeHeliosOwner}\` | \`${row.parityTest}\` | **${row.qualificationStatus}** | ${row.notes ?? ''} |`,
    );
  }
  lines.push('');
  lines.push(
    matrix.allQualified
      ? '**Matrix:** all rows **QUALIFIED** — native parity evidence present in-tree.'
      : `**Matrix:** **BLOCKED** — ${matrix.blockers.length} row(s) missing native owner or parity test.`,
  );
  lines.push('');
  return `${lines.join('\n')}\n`;
}
