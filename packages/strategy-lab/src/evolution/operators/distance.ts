import type { StrategyGenome, StrategyNode } from '../../os05/types.ts';

export type GenomeSemanticDistance = {
  readonly total: number;
  readonly nodeKindOverlap: number;
  readonly featureFamilyDistance: number;
  readonly parameterDistance: number;
  readonly decisionLogicDistance: number;
  readonly regimeGateDistance: number;
  readonly holdingHorizonDistance: number;
};

function kindHistogram(nodes: readonly StrategyNode[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const n of nodes) {
    m.set(n.kind, (m.get(n.kind) ?? 0) + 1);
  }
  return m;
}

function featureFamilies(nodes: readonly StrategyNode[]): Set<string> {
  const s = new Set<string>();
  for (const n of nodes) {
    if (n.kind === 'FEATURE') {
      s.add(n.catalogRef.split('.')[0] ?? n.catalogRef);
    }
  }
  return s;
}

function symmetricSetDistance(a: Set<string>, b: Set<string>): number {
  let d = 0;
  for (const x of a) {
    if (!b.has(x)) {
      d += 1;
    }
  }
  for (const x of b) {
    if (!a.has(x)) {
      d += 1;
    }
  }
  return d;
}

function numericParamDistance(
  a: Readonly<Record<string, string | number | boolean>>,
  b: Readonly<Record<string, string | number | boolean>>,
): number {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let sum = 0;
  for (const k of keys) {
    const va = a[k];
    const vb = b[k];
    if (typeof va === 'number' && typeof vb === 'number') {
      sum += Math.abs(va - vb);
    } else if (va !== vb) {
      sum += 1;
    }
  }
  return sum;
}

function decisionTags(genome: StrategyGenome): string[] {
  const tags: string[] = [];
  for (const n of genome.nodes) {
    if (n.kind === 'CONDITION') {
      tags.push(`COND:${n.comparator}:${n.thresholdParam}`);
    }
    if (n.kind === 'SIGNAL') {
      tags.push(`SIG:${n.comparator}:${n.thresholdParam}:${n.direction}`);
    }
  }
  return tags.sort();
}

function regimeVector(genome: StrategyGenome): { permitted: Set<string>; prohibited: Set<string> } {
  const gate = genome.nodes.find((n) => n.kind === 'REGIME_GATE');
  if (!gate || gate.kind !== 'REGIME_GATE') {
    return { permitted: new Set(), prohibited: new Set() };
  }
  return {
    permitted: new Set(gate.permittedRegimes),
    prohibited: new Set(gate.prohibitedRegimes),
  };
}

function primaryLookbackDays(genome: StrategyGenome): number | null {
  const feat = genome.nodes.find((n) => n.kind === 'FEATURE');
  if (!feat || feat.kind !== 'FEATURE') {
    return null;
  }
  const lb = feat.params.lookbackDays;
  return typeof lb === 'number' ? lb : null;
}

/**
 * Semantic distance between two genomes (non-negative; larger = more different).
 * Weights are chosen for diversity telemetry; they are not normalized to [0,1].
 */
export function genomeSemanticDistance(a: StrategyGenome, b: StrategyGenome): GenomeSemanticDistance {
  const ka = kindHistogram(a.nodes);
  const kb = kindHistogram(b.nodes);
  let nodeKindOverlap = 0;
  for (const [k, va] of ka) {
    const vb = kb.get(k) ?? 0;
    nodeKindOverlap += Math.abs(va - vb);
  }
  for (const [k, vb] of kb) {
    if (!ka.has(k)) {
      nodeKindOverlap += vb;
    }
  }

  const fa = featureFamilies(a.nodes);
  const fb = featureFamilies(b.nodes);
  const featureFamilyDistance = symmetricSetDistance(fa, fb);

  const parameterDistance =
    numericParamDistance(a.parameters, b.parameters) +
    a.nodes.reduce((acc, n) => {
      if (n.kind === 'FLOW') {
        return acc;
      }
      const other = b.nodes.find((m) => m.nodeId === n.nodeId && m.kind === n.kind);
      if (!other || other.kind === 'FLOW') {
        return acc;
      }
      return acc + numericParamDistance(n.params, other.params);
    }, 0);

  const da = decisionTags(a).join('|');
  const db = decisionTags(b).join('|');
  const decisionLogicDistance = da === db ? 0 : 1;

  const ra = regimeVector(a);
  const rb = regimeVector(b);
  const regimeGateDistance =
    symmetricSetDistance(ra.permitted, rb.permitted) + symmetricSetDistance(ra.prohibited, rb.prohibited);

  const la = primaryLookbackDays(a);
  const lb = primaryLookbackDays(b);
  const holdingHorizonDistance =
    la != null && lb != null ? Math.abs(la - lb) : la == null && lb == null ? 0 : 5;

  const total =
    nodeKindOverlap * 2 +
    featureFamilyDistance * 3 +
    parameterDistance +
    decisionLogicDistance * 4 +
    regimeGateDistance * 2 +
    holdingHorizonDistance;

  return {
    total,
    nodeKindOverlap,
    featureFamilyDistance,
    parameterDistance,
    decisionLogicDistance,
    regimeGateDistance,
    holdingHorizonDistance,
  };
}
