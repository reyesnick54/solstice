/**
 * BEFORE vs AFTER capability comparison for open-source integration wave 1.
 */

import type { OpenSourceWorkPackageRow } from './work-package-registry.ts';

export type CapabilityDimension =
  | 'external_data'
  | 'fundamentals'
  | 'agent_research'
  | 'strategy_creation'
  | 'simulation_realism'
  | 'venue_support'
  | 'research_automation'
  | 'execution_fidelity'
  | 'risk_observability'
  | 'reproducibility'
  | 'point_in_time_integrity';

export type CapabilityDeltaRow = {
  readonly dimension: CapabilityDimension;
  readonly label: string;
  readonly before: string;
  readonly after: string;
  readonly delta: 'unchanged' | 'expanded' | 'blocked';
  readonly workPackages: readonly string[];
};

const BASELINE_BEFORE: Record<CapabilityDimension, string> = {
  external_data:
    'Canonical HELIOS observation fabric (H08) with fixture and certified sandbox providers; no BYTEX/OpenChart symbology maps.',
  fundamentals:
    'Multi-asset market state and macro intelligence (M04/M14); no dedicated point-in-time fundamentals open-source compiler.',
  agent_research:
    'Grok research runtime (H11) and meta-allocator research-value (H20); no institutional mesh or prediction-market research modules.',
  strategy_creation:
    'Strategy Lab M09–M12 library and capsules; no Strategy Genome open-source foundation layer.',
  simulation_realism:
    'M28 forward-paper scenarios and sandbox provider fills (H23/M24); no Execution Twin or dedicated execution-simulation OSS stack.',
  venue_support:
    'Multi-venue routing (M23) with sandbox adapters; no BYTEX map or venue conformance OSS harness.',
  research_automation:
    'Manual/async research tasks; no Research Monitor DSL or triggered-research automation.',
  execution_fidelity:
    'Paper execution, settlement, reconciliation (M21–M24); twin-based fill realism not integrated.',
  risk_observability:
    'Canonical RiskEngine pre-trade (M20 portfolio controls) with resilience scenarios (H31).',
  reproducibility:
    'Evidence Vault sealing and release packaging (H34–H36); open-source provenance manifest absent.',
  point_in_time_integrity:
    'Information-time on observations (H08); AAF point-in-time feature fabric not merged on main.',
};

function wpQualified(rows: readonly OpenSourceWorkPackageRow[], ids: readonly string[]): boolean {
  const map = new Map(rows.map((row) => [row.workPackage, row.status]));
  return ids.every((id) => map.get(id as OpenSourceWorkPackageRow['workPackage']) === 'QUALIFIED');
}

export function buildCapabilityDelta(rows: readonly OpenSourceWorkPackageRow[]): readonly CapabilityDeltaRow[] {
  const specs: readonly {
    dimension: CapabilityDimension;
    label: string;
    afterQualified: string;
    afterBlocked: string;
    workPackages: readonly string[];
  }[] = Object.freeze([
    {
      dimension: 'external_data',
      label: 'External data',
      afterQualified: 'BYTEX + OpenChart maps wired into observation ingest with pinned upstream SHA.',
      afterBlocked: BASELINE_BEFORE.external_data,
      workPackages: Object.freeze(['OS00', 'OS01', 'OS06']),
    },
    {
      dimension: 'fundamentals',
      label: 'Fundamentals',
      afterQualified: 'Point-in-time fundamentals compiler with revision ledger and coverage bias checks.',
      afterBlocked: BASELINE_BEFORE.fundamentals,
      workPackages: Object.freeze(['OS10']),
    },
    {
      dimension: 'agent_research',
      label: 'Agent research',
      afterQualified:
        'Institutional research mesh, adversarial bull/bear challenge, and prediction-market research adapters.',
      afterBlocked: BASELINE_BEFORE.agent_research,
      workPackages: Object.freeze(['OS09', 'OS11', 'OS14', 'OS12']),
    },
    {
      dimension: 'strategy_creation',
      label: 'Strategy creation',
      afterQualified: 'Strategy Genome proposals compiled into Strategy Lab with sandbox promotion gates.',
      afterBlocked: BASELINE_BEFORE.strategy_creation,
      workPackages: Object.freeze(['OS05', 'OS13']),
    },
    {
      dimension: 'simulation_realism',
      label: 'Simulation realism',
      afterQualified: 'Execution Twin + execution-simulation OSS modules drive realistic paper fills.',
      afterBlocked: BASELINE_BEFORE.simulation_realism,
      workPackages: Object.freeze(['OS02', 'OS03']),
    },
    {
      dimension: 'venue_support',
      label: 'Venue support',
      afterQualified: 'Venue conformance harness validates BYTEX-mapped routes before paper dispatch.',
      afterBlocked: BASELINE_BEFORE.venue_support,
      workPackages: Object.freeze(['OS04', 'OS01']),
    },
    {
      dimension: 'research_automation',
      label: 'Research automation',
      afterQualified: 'Research Monitor DSL triggers H20-gated research workflows on feature events.',
      afterBlocked: BASELINE_BEFORE.research_automation,
      workPackages: Object.freeze(['OS07', 'OS08']),
    },
    {
      dimension: 'execution_fidelity',
      label: 'Execution fidelity',
      afterQualified: 'Twin-synchronized fills, settlement simulation, and reconciliation attribution.',
      afterBlocked: BASELINE_BEFORE.execution_fidelity,
      workPackages: Object.freeze(['OS02', 'OS03', 'OS04']),
    },
    {
      dimension: 'risk_observability',
      label: 'Risk observability',
      afterQualified: 'Risk Engine consumes twin fill streams with enriched open-source venue telemetry.',
      afterBlocked: BASELINE_BEFORE.risk_observability,
      workPackages: Object.freeze(['OS03', 'OS04']),
    },
    {
      dimension: 'reproducibility',
      label: 'Reproducibility',
      afterQualified: 'OPEN_SOURCE_PROVENANCE_MANIFEST pins upstream SHAs, licenses, and copied paths.',
      afterBlocked: BASELINE_BEFORE.reproducibility,
      workPackages: Object.freeze(['OS00', 'OS15']),
    },
    {
      dimension: 'point_in_time_integrity',
      label: 'Point-in-time integrity',
      afterQualified: 'Feature Fabric + fundamentals honor knowable-at boundaries across revisions.',
      afterBlocked: BASELINE_BEFORE.point_in_time_integrity,
      workPackages: Object.freeze(['OS10', 'OS05']),
    },
  ]);

  return Object.freeze(
    specs.map((spec) => {
      const qualified = wpQualified(rows, spec.workPackages);
      return Object.freeze({
        dimension: spec.dimension,
        label: spec.label,
        before: BASELINE_BEFORE[spec.dimension],
        after: qualified ? spec.afterQualified : spec.afterBlocked,
        delta: qualified ? ('expanded' as const) : ('blocked' as const),
        workPackages: spec.workPackages,
      });
    }),
  );
}

export function renderCapabilityDeltaMarkdown(rows: readonly CapabilityDeltaRow[]): string {
  const lines: string[] = [
    '# HELIOS Open-Source Integration — Capability Delta',
    '',
    'Comparison of simulation capabilities **before** Wave 1 open-source integration versus **after** qualification at OS15.',
    '',
    '| Dimension | Before | After (current) | Delta | Work packages |',
    '| --- | --- | --- | --- | --- |',
  ];
  for (const row of rows) {
    const esc = (value: string) => value.replaceAll('|', '\\|').replaceAll('\n', ' ');
    lines.push(
      `| ${row.label} | ${esc(row.before)} | ${esc(row.after)} | ${row.delta} | ${row.workPackages.join(', ')} |`,
    );
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}
