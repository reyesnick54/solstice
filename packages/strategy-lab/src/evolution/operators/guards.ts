import { err, ok, type Result } from '@solstice/domain';

import { STRATEGY_GENOME_FEATURE_MANIFEST_VERSION, STRATEGY_GENOME_NODE_CATALOG_VERSION } from '../../os05/catalog.ts';
import { STRATEGY_GENOME_SCHEMA } from '../../os05/ids.ts';
import type { StrategyGenome, StrategyGenomeFailure, StrategyNode } from '../../os05/types.ts';

function allStringsInGenome(genome: StrategyGenome): string[] {
  const out: string[] = [];
  const walk = (v: unknown): void => {
    if (typeof v === 'string') {
      out.push(v);
      return;
    }
    if (Array.isArray(v)) {
      for (const x of v) {
        walk(x);
      }
      return;
    }
    if (v && typeof v === 'object') {
      for (const x of Object.values(v)) {
        walk(x);
      }
    }
  };
  walk(genome);
  return out;
}

/** Heuristic: reject strings that imply lookahead or unsupported derivatives in research ETF/equity genomes. */
const LOOKAHEAD_SUBSTRINGS = ['lookahead', 'future bar', 'next bar', 'peek', 'forward return'] as const;
const UNSUPPORTED_INSTRUMENT_SUBSTRINGS = ['perpetual swap', 'perp-swap', 'binary option'] as const;

export function scanEvolutionSemantics(genome: StrategyGenome): Result<true, StrategyGenomeFailure> {
  const blob = allStringsInGenome(genome).join(' ').toLowerCase();
  for (const token of LOOKAHEAD_SUBSTRINGS) {
    if (blob.includes(token)) {
      return err({
        code: 'EVOLUTION_LOOKAHEAD_INTRODUCED',
        message: `genome text contains disallowed lookahead hint: ${token}`,
      });
    }
  }
  for (const token of UNSUPPORTED_INSTRUMENT_SUBSTRINGS) {
    if (blob.includes(token)) {
      return err({
        code: 'EVOLUTION_UNSUPPORTED_INSTRUMENT',
        message: `genome text references unsupported instrument class: ${token}`,
      });
    }
  }
  return ok(true);
}

export function assertSameEvolutionUniverse(
  a: StrategyGenome,
  b: StrategyGenome,
): Result<true, StrategyGenomeFailure> {
  if (a.schema !== b.schema || b.schema !== STRATEGY_GENOME_SCHEMA) {
    return err({
      code: 'EVOLUTION_INCOMPATIBLE_TYPES',
      message: 'crossover requires the same strategy genome schema',
    });
  }
  if (a.lineage.nodeCatalogVersion !== b.lineage.nodeCatalogVersion) {
    return err({
      code: 'EVOLUTION_INCOMPATIBLE_TYPES',
      message: 'crossover requires matching nodeCatalogVersion',
    });
  }
  if (a.lineage.featureManifestVersion !== b.lineage.featureManifestVersion) {
    return err({
      code: 'EVOLUTION_INCOMPATIBLE_TYPES',
      message: 'crossover requires matching featureManifestVersion',
    });
  }
  if (
    a.lineage.nodeCatalogVersion !== STRATEGY_GENOME_NODE_CATALOG_VERSION ||
    a.lineage.featureManifestVersion !== STRATEGY_GENOME_FEATURE_MANIFEST_VERSION
  ) {
    return err({
      code: 'EVOLUTION_INCOMPATIBLE_TYPES',
      message: 'genome catalog or manifest version is not current',
    });
  }
  return ok(true);
}

/** Feature lineage: FEATURE nodes must use catalog refs under `feature.*`. */
export function assertFeatureLineage(genome: StrategyGenome): Result<true, StrategyGenomeFailure> {
  for (const n of genome.nodes) {
    if (n.kind === 'FEATURE' && !n.catalogRef.startsWith('feature.')) {
      return err({
        code: 'EVOLUTION_FEATURE_LINEAGE_INVALID',
        message: `FEATURE node ${n.nodeId} has invalid catalogRef ${n.catalogRef}`,
      });
    }
  }
  return ok(true);
}

function minLookbackDays(nodes: readonly StrategyNode[]): number | null {
  let m: number | null = null;
  for (const n of nodes) {
    if (n.kind === 'FEATURE') {
      const lb = n.params.lookbackDays;
      if (typeof lb === 'number') {
        m = m == null ? lb : Math.min(m, lb);
      }
    }
  }
  return m;
}

/** Information-time: signal reference window must not exceed minimum feature lookback (no extra lookahead). */
export function assertNoLookaheadViolation(genome: StrategyGenome): Result<true, StrategyGenomeFailure> {
  const minLb = minLookbackDays(genome.nodes);
  for (const n of genome.nodes) {
    if (n.kind === 'SIGNAL') {
      const ref = n.params.referenceWindowBars;
      if (typeof ref === 'number' && minLb != null && ref > minLb) {
        return err({
          code: 'EVOLUTION_LOOKAHEAD_INTRODUCED',
          message: `signal ${n.nodeId} referenceWindowBars ${ref} exceeds minimum feature lookback ${minLb}`,
        });
      }
    }
  }
  return ok(true);
}

/** Node references and output refs must resolve within the genome DAG. */
export function assertExecutionReferencesSound(genome: StrategyGenome): Result<true, StrategyGenomeFailure> {
  const nodeIds = new Set(genome.nodes.map((n) => n.nodeId));
  const outputs = new Set<string>();
  for (const n of genome.nodes) {
    if (n.kind === 'FEATURE') {
      outputs.add(n.outputRef);
    }
  }
  const resolve = (ref: string): boolean => nodeIds.has(ref) || outputs.has(ref);

  for (const n of genome.nodes) {
    if (n.kind === 'CONDITION' && !resolve(n.inputRef)) {
      return err({
        code: 'EVOLUTION_INVALID_EXECUTION_SEMANTICS',
        message: `CONDITION ${n.nodeId} inputRef ${n.inputRef} unresolved`,
      });
    }
    if (n.kind === 'SIGNAL' && !resolve(n.inputRef)) {
      return err({
        code: 'EVOLUTION_INVALID_EXECUTION_SEMANTICS',
        message: `SIGNAL ${n.nodeId} inputRef ${n.inputRef} unresolved`,
      });
    }
    if (n.kind === 'SIZING') {
      if (!resolve(n.signalInputRef)) {
        return err({
          code: 'EVOLUTION_INVALID_EXECUTION_SEMANTICS',
          message: `SIZING ${n.nodeId} signalInputRef ${n.signalInputRef} unresolved`,
        });
      }
      if (!resolve(n.volFeatureRef)) {
        return err({
          code: 'EVOLUTION_INVALID_EXECUTION_SEMANTICS',
          message: `SIZING ${n.nodeId} volFeatureRef ${n.volFeatureRef} unresolved`,
        });
      }
    }
    if (n.kind === 'RISK' && !resolve(n.sizingInputRef)) {
      return err({
        code: 'EVOLUTION_INVALID_EXECUTION_SEMANTICS',
        message: `RISK ${n.nodeId} sizingInputRef ${n.sizingInputRef} unresolved`,
      });
    }
    if (n.kind === 'EXIT' && !resolve(n.signalInputRef)) {
      return err({
        code: 'EVOLUTION_INVALID_EXECUTION_SEMANTICS',
        message: `EXIT ${n.nodeId} signalInputRef ${n.signalInputRef} unresolved`,
      });
    }
  }
  return ok(true);
}

export function runEvolutionGuards(genome: StrategyGenome): Result<true, StrategyGenomeFailure> {
  const steps: Result<true, StrategyGenomeFailure>[] = [
    assertFeatureLineage(genome),
    assertNoLookaheadViolation(genome),
    assertExecutionReferencesSound(genome),
    scanEvolutionSemantics(genome),
  ];
  for (const s of steps) {
    if (!s.ok) {
      return s;
    }
  }
  return ok(true);
}
