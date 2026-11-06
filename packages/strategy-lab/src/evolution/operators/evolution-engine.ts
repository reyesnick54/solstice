import { asUtcInstant } from '@solstice/domain';
import { err, ok, type Result } from '@solstice/domain';

import { STRATEGY_GENOME_FEATURE_MANIFEST_VERSION } from '../../os05/catalog.ts';
import { attachGenomeHash, lineageWithoutGenomeHash } from '../../os05/hash.ts';
import { asStrategyGenomeId, asStrategyGenomeVersion, STRATEGY_GENOME_SCHEMA } from '../../os05/ids.ts';
import { validateStrategyGenome } from '../../os05/validate.ts';
import type {
  EvolutionOperatorKind,
  GenomeNodeParams,
  StrategyGenome,
  StrategyGenomeFailure,
  StrategyNode,
} from '../../os05/types.ts';
import {
  CANONICAL_RISK_ENGINE_CATALOG_REF,
  EVOLUTION_ENGINE_VERSION,
  HELIOS_EVOL02_GENOME_OPERATORS_BLOCKED,
  HELIOS_EVOL02_GENOME_OPERATORS_QUALIFIED,
} from './constants.ts';
import { genomeSemanticDistance } from './distance.ts';
import { assertSameEvolutionUniverse, runEvolutionGuards } from './guards.ts';
import { cloneNodes, removeNodeById } from './graph.ts';
import { mulberry32, pickInt, pickItem, seedToUint32 } from './prng.ts';

export type CrossoverMode =
  | 'SUBGRAPH_CROSSOVER'
  | 'FEATURE_BLOCK_CROSSOVER'
  | 'ENTRY_EXIT_CROSSOVER'
  | 'REGIME_POLICY_CROSSOVER'
  | 'PARAMETER_BLEND';

export type MutationFamily =
  | 'PARAMETER_MUTATION'
  | 'FEATURE_SUBSTITUTION'
  | 'FEATURE_ADDITION'
  | 'FEATURE_REMOVAL'
  | 'ENTRY_RULE_MUTATION'
  | 'EXIT_RULE_MUTATION'
  | 'REGIME_GATE_MUTATION'
  | 'TIME_HORIZON_MUTATION'
  | 'POSITION_SIZING_RESEARCH_MUTATION'
  | 'RISK_FILTER_MUTATION'
  | 'CONFIRMATION_RULE_MUTATION'
  | 'ENSEMBLE_WEIGHT_MUTATION';

type LineageWithoutHash = Omit<StrategyGenome['lineage'], 'genomeHash'>;

type GenomeDraftBody = Omit<StrategyGenome, 'lineage'> & { readonly lineage: LineageWithoutHash };

function validateEvolved(genome: StrategyGenome): Result<StrategyGenome, StrategyGenomeFailure> {
  const validated = validateStrategyGenome(genome);
  if (!validated.ok) {
    if (validated.error.code === 'GRAPH_CYCLE') {
      return err({ code: 'EVOLUTION_CIRCULAR_DEPENDENCY', message: validated.error.message });
    }
    return validated;
  }
  const guard = runEvolutionGuards(validated.value);
  if (!guard.ok) {
    return guard;
  }
  return ok(validated.value);
}

function nextGenomeId(parentId: string, suffix: string): ReturnType<typeof asStrategyGenomeId> {
  const raw = parentId.startsWith('sgnm_') ? parentId.slice('sgnm_'.length) : parentId;
  return asStrategyGenomeId(`sgnm_${raw}_evol_${suffix}`);
}

function nextVersion(parentVersion: StrategyGenome['version']): StrategyGenome['version'] {
  return asStrategyGenomeVersion(`${String(parentVersion)}.evol`);
}

function makeLineage(
  base: LineageWithoutHash,
  parentIds: readonly StrategyGenome['genomeId'][],
  operator: EvolutionOperatorKind,
  mutationReason: string,
  randomSeed: string,
): StrategyGenome['lineage'] {
  return Object.freeze({
    ...base,
    parentGenomeIds: Object.freeze([...parentIds]),
    mutationReason,
    operator,
    operatorVersion: EVOLUTION_ENGINE_VERSION,
    randomSeed,
  });
}

function finalizeGenome(draft: GenomeDraftBody): Result<StrategyGenome, StrategyGenomeFailure> {
  const withHash = attachGenomeHash(draft);
  return validateEvolved(withHash);
}

function featureNodes(nodes: readonly StrategyNode[]): Extract<StrategyNode, { kind: 'FEATURE' }>[] {
  return nodes.filter((n): n is Extract<StrategyNode, { kind: 'FEATURE' }> => n.kind === 'FEATURE');
}

function findRiskNode(
  nodes: readonly StrategyNode[],
): Extract<StrategyNode, { kind: 'RISK' }> | undefined {
  return nodes.find((n): n is Extract<StrategyNode, { kind: 'RISK' }> => n.kind === 'RISK');
}

function assertCanonicalRiskUnchanged(
  before: StrategyGenome,
  after: StrategyGenome,
): Result<true, StrategyGenomeFailure> {
  const b = findRiskNode(before.nodes);
  const a = findRiskNode(after.nodes);
  if (!b || !a) {
    return ok(true);
  }
  if (b.catalogRef === CANONICAL_RISK_ENGINE_CATALOG_REF) {
    if (a.catalogRef !== b.catalogRef || a.nodeId !== b.nodeId) {
      return err({
        code: 'EVOLUTION_RISK_POLICY_IMMUTABLE',
        message: 'canonical Risk Engine catalog binding must not change',
      });
    }
  }
  return ok(true);
}

function sameTopology(a: StrategyGenome, b: StrategyGenome): boolean {
  const idsA = [...new Set(a.nodes.map((n) => n.nodeId))].sort().join(',');
  const idsB = [...new Set(b.nodes.map((n) => n.nodeId))].sort().join(',');
  return idsA === idsB;
}

function replaceNode(nodes: StrategyNode[], replacement: StrategyNode): StrategyNode[] {
  const idx = nodes.findIndex((n) => n.nodeId === replacement.nodeId);
  if (idx < 0) {
    return [...nodes, replacement];
  }
  const copy = nodes.slice();
  copy[idx] = replacement;
  return copy;
}

export function mutateStrategyGenome(input: {
  readonly genome: StrategyGenome;
  readonly family: MutationFamily;
  readonly randomSeed: string;
  readonly createdAt: string;
  readonly createdBy?: string;
}): Result<StrategyGenome, StrategyGenomeFailure> {
  const rng = mulberry32(seedToUint32(`${input.randomSeed}:${input.family}:${EVOLUTION_ENGINE_VERSION}`));
  const baseLineage = lineageWithoutGenomeHash(input.genome.lineage);
  const createdBy = input.createdBy ?? 'helios_evolution';

  let nodes = cloneNodes(input.genome.nodes);
  let parameters: GenomeNodeParams = { ...input.genome.parameters };

  const features = featureNodes(nodes);
  const primaryFeature = features[0];
  const secondaryFeature = features[1];

  switch (input.family) {
    case 'PARAMETER_MUTATION': {
      const keys = Object.keys(parameters);
      if (keys.length === 0) {
        return err({ code: 'EVOLUTION_REJECTED', message: 'no parameters to mutate' });
      }
      const k = pickItem(rng, keys);
      const cur = parameters[k];
      if (typeof cur === 'number') {
        const delta = pickInt(rng, -200, 200);
        parameters = { ...parameters, [k]: cur + delta };
      } else if (typeof cur === 'boolean') {
        parameters = { ...parameters, [k]: !cur };
      } else {
        parameters = { ...parameters, [k]: cur === 'LIMIT_PASSIVE' ? 'LIMIT_AGGRESSIVE' : 'LIMIT_PASSIVE' };
      }
      break;
    }
    case 'FEATURE_SUBSTITUTION': {
      if (!primaryFeature) {
        return err({ code: 'EVOLUTION_REJECTED', message: 'no FEATURE node' });
      }
      const alt =
        primaryFeature.catalogRef === 'feature.realized_volatility'
          ? 'feature.realized_volatility_alt'
          : 'feature.realized_volatility';
      const sub: Extract<StrategyNode, { kind: 'FEATURE' }> = {
        ...primaryFeature,
        catalogRef: alt,
      };
      nodes = replaceNode(nodes, sub);
      break;
    }
    case 'FEATURE_ADDITION': {
      if (secondaryFeature) {
        return err({ code: 'EVOLUTION_REJECTED', message: 'secondary FEATURE already present' });
      }
      if (!primaryFeature) {
        return err({ code: 'EVOLUTION_REJECTED', message: 'no primary FEATURE' });
      }
      const auxId = `${primaryFeature.nodeId}_aux`;
      const aux: Extract<StrategyNode, { kind: 'FEATURE' }> = {
        nodeId: auxId,
        kind: 'FEATURE',
        catalogRef: 'feature.realized_volatility_alt',
        outputRef: `${primaryFeature.outputRef}_aux`,
        params: { ...primaryFeature.params },
      };
      nodes = [...nodes, aux];
      break;
    }
    case 'FEATURE_REMOVAL': {
      if (!secondaryFeature) {
        return err({ code: 'EVOLUTION_REJECTED', message: 'no auxiliary FEATURE to remove' });
      }
      nodes = removeNodeById(nodes, secondaryFeature.nodeId);
      break;
    }
    case 'ENTRY_RULE_MUTATION': {
      const sig = nodes.find((n): n is Extract<StrategyNode, { kind: 'SIGNAL' }> => n.kind === 'SIGNAL');
      if (!sig) {
        return err({ code: 'EVOLUTION_REJECTED', message: 'no SIGNAL node' });
      }
      const comparators = ['LT', 'LTE', 'GT', 'GTE', 'EQ'] as const;
      const nextComp = pickItem(rng, comparators.filter((c) => c !== sig.comparator));
      const nextSig = { ...sig, comparator: nextComp };
      nodes = replaceNode(nodes, nextSig);
      break;
    }
    case 'EXIT_RULE_MUTATION': {
      const exit = nodes.find((n): n is Extract<StrategyNode, { kind: 'EXIT' }> => n.kind === 'EXIT');
      if (!exit) {
        return err({ code: 'EVOLUTION_REJECTED', message: 'no EXIT node' });
      }
      const nz = typeof exit.params.normalizeZThreshold === 'number' ? exit.params.normalizeZThreshold : 0;
      const sz = typeof exit.params.stopLossBps === 'number' ? exit.params.stopLossBps : 100;
      const next: Extract<StrategyNode, { kind: 'EXIT' }> = {
        ...exit,
        params: {
          ...exit.params,
          normalizeZThreshold: nz + pickInt(rng, -1, 1) * 0.1,
          stopLossBps: sz + pickInt(rng, -25, 25),
        },
      };
      nodes = replaceNode(nodes, next);
      break;
    }
    case 'REGIME_GATE_MUTATION': {
      const existing = nodes.find((n): n is Extract<StrategyNode, { kind: 'REGIME_GATE' }> => n.kind === 'REGIME_GATE');
      if (!existing) {
        const gate: Extract<StrategyNode, { kind: 'REGIME_GATE' }> = {
          nodeId: 'regime_gate_ev',
          kind: 'REGIME_GATE',
          catalogRef: 'regime_gate.permitted_market_regime',
          permittedRegimes: Object.freeze(['RISK_ON', 'NEUTRAL']),
          prohibitedRegimes: Object.freeze([]),
          params: Object.freeze({}),
        };
        nodes = [...nodes, gate];
      } else {
        const flip =
          existing.permittedRegimes.length > 0
            ? Object.freeze(existing.permittedRegimes.slice(1))
            : Object.freeze(['RISK_ON']);
        const g2: Extract<StrategyNode, { kind: 'REGIME_GATE' }> = {
          ...existing,
          permittedRegimes: flip,
        };
        nodes = replaceNode(nodes, g2);
      }
      break;
    }
    case 'TIME_HORIZON_MUTATION': {
      if (!primaryFeature || primaryFeature.kind !== 'FEATURE') {
        return err({ code: 'EVOLUTION_REJECTED', message: 'no FEATURE' });
      }
      const lb0 =
        typeof primaryFeature.params.lookbackDays === 'number' ? primaryFeature.params.lookbackDays : 20;
      const lb = Math.max(5, lb0 + pickInt(rng, -5, 5));
      const f2: Extract<StrategyNode, { kind: 'FEATURE' }> = {
        ...primaryFeature,
        params: { ...primaryFeature.params, lookbackDays: lb },
      };
      nodes = replaceNode(nodes, f2);
      const sig = nodes.find((n): n is Extract<StrategyNode, { kind: 'SIGNAL' }> => n.kind === 'SIGNAL');
      if (sig) {
        const s2: Extract<StrategyNode, { kind: 'SIGNAL' }> = {
          ...sig,
          params: { ...sig.params, referenceWindowBars: lb },
        };
        nodes = replaceNode(nodes, s2);
      }
      break;
    }
    case 'POSITION_SIZING_RESEARCH_MUTATION': {
      const sizing = nodes.find((n): n is Extract<StrategyNode, { kind: 'SIZING' }> => n.kind === 'SIZING');
      if (!sizing) {
        return err({ code: 'EVOLUTION_REJECTED', message: 'no SIZING node' });
      }
      const tv =
        typeof sizing.params.targetVolBps === 'number' ? sizing.params.targetVolBps : 500;
      const mx =
        typeof sizing.params.maxGrossExposureBps === 'number' ? sizing.params.maxGrossExposureBps : 4_000;
      const s2: Extract<StrategyNode, { kind: 'SIZING' }> = {
        ...sizing,
        params: {
          ...sizing.params,
          targetVolBps: Math.max(50, tv + pickInt(rng, -100, 100)),
          maxGrossExposureBps: Math.max(200, mx + pickInt(rng, -300, 300)),
        },
      };
      nodes = replaceNode(nodes, s2);
      break;
    }
    case 'RISK_FILTER_MUTATION': {
      const risk = findRiskNode(nodes);
      if (!risk) {
        return err({ code: 'EVOLUTION_REJECTED', message: 'no RISK node' });
      }
      if (risk.catalogRef !== CANONICAL_RISK_ENGINE_CATALOG_REF) {
        return err({ code: 'EVOLUTION_RISK_POLICY_IMMUTABLE', message: 'only param tuning allowed on canonical risk node' });
      }
      const cur =
        typeof risk.params.maxContributionVarBps === 'number' ? risk.params.maxContributionVarBps : 150;
      const r2: Extract<StrategyNode, { kind: 'RISK' }> = {
        ...risk,
        params: {
          ...risk.params,
          maxContributionVarBps: Math.max(10, cur + pickInt(rng, -30, 30)),
        },
      };
      nodes = replaceNode(nodes, r2);
      break;
    }
    case 'CONFIRMATION_RULE_MUTATION': {
      const cond = nodes.find((n): n is Extract<StrategyNode, { kind: 'CONDITION' }> => n.kind === 'CONDITION');
      if (!cond) {
        return err({ code: 'EVOLUTION_REJECTED', message: 'no CONDITION node' });
      }
      const nextComp = cond.comparator === 'LT' ? ('LTE' as const) : ('LT' as const);
      const c2: Extract<StrategyNode, { kind: 'CONDITION' }> = { ...cond, comparator: nextComp };
      nodes = replaceNode(nodes, c2);
      break;
    }
    case 'ENSEMBLE_WEIGHT_MUTATION': {
      const numericKeys = Object.keys(parameters).filter((k) => typeof parameters[k] === 'number');
      if (numericKeys.length < 2) {
        return err({ code: 'EVOLUTION_REJECTED', message: 'need two numeric parameters to blend' });
      }
      const [ka, kb] = [pickItem(rng, numericKeys), pickItem(rng, numericKeys)];
      const va = parameters[ka] as number;
      const vb = parameters[kb] as number;
      const alpha = rng();
      parameters = {
        ...parameters,
        [ka]: Math.round(va * alpha + vb * (1 - alpha)),
      };
      break;
    }
    default: {
      const _exhaust: never = input.family;
      return err({ code: 'EVOLUTION_REJECTED', message: `unknown family ${_exhaust}` });
    }
  }

  const draft: GenomeDraftBody = {
    schema: STRATEGY_GENOME_SCHEMA,
    genomeId: nextGenomeId(String(input.genome.genomeId), `m_${input.family}`),
    version: nextVersion(input.genome.version),
    name: `${input.genome.name} (${input.family})`,
    hypothesis: input.genome.hypothesis,
    nodes: Object.freeze(nodes),
    parameters: Object.freeze(parameters),
    lineage: makeLineage(
      {
        ...baseLineage,
        createdBy,
        createdAt: asUtcInstant(input.createdAt),
        featureManifestVersion: STRATEGY_GENOME_FEATURE_MANIFEST_VERSION,
        nodeCatalogVersion: input.genome.lineage.nodeCatalogVersion,
      },
      [input.genome.genomeId],
      input.family,
      `mutation:${input.family}`,
      input.randomSeed,
    ),
  };

  const out = finalizeGenome(draft);
  if (!out.ok) {
    return out;
  }
  const imm = assertCanonicalRiskUnchanged(input.genome, out.value);
  if (!imm.ok) {
    return imm;
  }
  return out;
}

export function crossoverStrategyGenomes(input: {
  readonly parentA: StrategyGenome;
  readonly parentB: StrategyGenome;
  readonly mode: CrossoverMode;
  readonly randomSeed: string;
  readonly createdAt: string;
  readonly createdBy?: string;
}): Result<StrategyGenome, StrategyGenomeFailure> {
  const uni = assertSameEvolutionUniverse(input.parentA, input.parentB);
  if (!uni.ok) {
    return uni;
  }
  if (!sameTopology(input.parentA, input.parentB)) {
    return err({
      code: 'EVOLUTION_INCOMPATIBLE_TYPES',
      message: 'crossover requires identical node id sets (same template)',
    });
  }

  const rng = mulberry32(seedToUint32(`${input.randomSeed}:${input.mode}:${EVOLUTION_ENGINE_VERSION}`));
  const createdBy = input.createdBy ?? 'helios_evolution';
  const lineageBase = lineageWithoutGenomeHash(input.parentA.lineage);

  const nodeById = (g: StrategyGenome): Map<string, StrategyNode> =>
    new Map(g.nodes.map((n) => [n.nodeId, n]));

  const mapA = nodeById(input.parentA);
  const mapB = nodeById(input.parentB);

  let nodes: StrategyNode[] = [];

  const mergePreserveIds = (preferAForKinds: Set<StrategyNode['kind']>): void => {
    const ids = [...mapA.keys()].sort();
    nodes = ids.map((id) => {
      const na = mapA.get(id)!;
      const nb = mapB.get(id)!;
      if (na.kind !== nb.kind) {
        return na;
      }
      return preferAForKinds.has(na.kind) ? structuredClone(na) : structuredClone(nb);
    });
  };

  const operatorKind: EvolutionOperatorKind = input.mode;

  switch (input.mode) {
    case 'SUBGRAPH_CROSSOVER': {
      mergePreserveIds(
        new Set(['FEATURE', 'CONDITION', 'SIGNAL', 'FLOW', 'REGIME_GATE']),
      );
      break;
    }
    case 'FEATURE_BLOCK_CROSSOVER': {
      mergePreserveIds(new Set(['FEATURE']));
      break;
    }
    case 'ENTRY_EXIT_CROSSOVER': {
      mergePreserveIds(new Set(['CONDITION', 'SIGNAL', 'EXIT']));
      break;
    }
    case 'REGIME_POLICY_CROSSOVER': {
      mergePreserveIds(new Set(['REGIME_GATE']));
      break;
    }
    case 'PARAMETER_BLEND': {
      mergePreserveIds(new Set()); // all from A structurally
      const keys = [
        ...new Set([...Object.keys(input.parentA.parameters), ...Object.keys(input.parentB.parameters)]),
      ].sort();
      const blended: GenomeNodeParams = {};
      for (const k of keys) {
        const va = input.parentA.parameters[k];
        const vb = input.parentB.parameters[k];
        if (typeof va === 'number' && typeof vb === 'number') {
          const alpha = rng();
          blended[k] = Math.round(va * alpha + vb * (1 - alpha));
        } else if (va !== undefined && vb !== undefined && va === vb) {
          blended[k] = va;
        } else if (va !== undefined) {
          blended[k] = va;
        } else if (vb !== undefined) {
          blended[k] = vb;
        }
      }
      nodes = cloneNodes(input.parentA.nodes);
      const draft: GenomeDraftBody = {
          schema: STRATEGY_GENOME_SCHEMA,
          genomeId: nextGenomeId(String(input.parentA.genomeId), `x_${input.mode}`),
          version: nextVersion(input.parentA.version),
          name: `${input.parentA.name} × ${input.parentB.name} (${input.mode})`,
          hypothesis: `${input.parentA.hypothesis} | blend`,
          nodes: Object.freeze(nodes),
          parameters: Object.freeze(blended),
          lineage: makeLineage(
            {
              ...lineageBase,
              createdBy,
              createdAt: asUtcInstant(input.createdAt),
              featureManifestVersion: STRATEGY_GENOME_FEATURE_MANIFEST_VERSION,
              nodeCatalogVersion: input.parentA.lineage.nodeCatalogVersion,
            },
            [input.parentA.genomeId, input.parentB.genomeId],
            operatorKind,
            `crossover:${input.mode}`,
            input.randomSeed,
          ),
        };
      const out = finalizeGenome(draft);
      if (!out.ok) {
        return out;
      }
      const imm = assertCanonicalRiskUnchanged(input.parentA, out.value);
      if (!imm.ok) {
        return imm;
      }
      return out;
    }
    default: {
      const _e: never = input.mode;
      return err({ code: 'EVOLUTION_REJECTED', message: `unknown crossover ${_e}` });
    }
  }

  const draft: GenomeDraftBody = {
    schema: STRATEGY_GENOME_SCHEMA,
    genomeId: nextGenomeId(String(input.parentA.genomeId), `x_${input.mode}`),
    version: nextVersion(input.parentA.version),
    name: `${input.parentA.name} × ${input.parentB.name} (${input.mode})`,
    hypothesis: `${input.parentA.hypothesis} | ${input.parentB.hypothesis}`,
    nodes: Object.freeze(nodes),
    parameters: Object.freeze({ ...input.parentA.parameters }),
    lineage: makeLineage(
      {
        ...lineageBase,
        createdBy,
        createdAt: asUtcInstant(input.createdAt),
        featureManifestVersion: STRATEGY_GENOME_FEATURE_MANIFEST_VERSION,
        nodeCatalogVersion: input.parentA.lineage.nodeCatalogVersion,
      },
      [input.parentA.genomeId, input.parentB.genomeId],
      operatorKind,
      `crossover:${input.mode}`,
      input.randomSeed,
    ),
  };

  const out = finalizeGenome(draft);
  if (!out.ok) {
    return out;
  }
  const imm = assertCanonicalRiskUnchanged(input.parentA, out.value);
  if (!imm.ok) {
    return imm;
  }
  const immB = assertCanonicalRiskUnchanged(input.parentB, out.value);
  if (!immB.ok) {
    return immB;
  }
  return out;
}

export { genomeSemanticDistance };

export function evaluateEvolutionOperatorsQualification(checks: {
  readonly mutationValidates: boolean;
  readonly crossoverValidates: boolean;
  readonly deterministicChild: boolean;
  readonly catalogFeatureSubstitutionPresent: boolean;
}): { readonly qualified: boolean; readonly marker: string; readonly blockers: string[] } {
  const blockers: string[] = [];
  if (!checks.mutationValidates) {
    blockers.push('mutation pipeline must validate');
  }
  if (!checks.crossoverValidates) {
    blockers.push('crossover pipeline must validate');
  }
  if (!checks.deterministicChild) {
    blockers.push('same parents + seed + operator version must yield identical child');
  }
  if (!checks.catalogFeatureSubstitutionPresent) {
    blockers.push('catalog must include alternate feature for substitution');
  }
  return {
    qualified: blockers.length === 0,
    marker: blockers.length === 0 ? HELIOS_EVOL02_GENOME_OPERATORS_QUALIFIED : HELIOS_EVOL02_GENOME_OPERATORS_BLOCKED,
    blockers,
  };
}
