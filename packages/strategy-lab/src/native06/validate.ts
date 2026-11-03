import { err, ok, type Result } from '@solstice/domain';
import { FORBIDDEN_STRATEGY_CODE } from '../dsl.ts';
import {
  NATIVE06_FEATURE_MANIFEST_VERSION,
  NATIVE06_NODE_CATALOG_VERSION,
  native06CatalogDefinitionFor,
} from './catalog.ts';
import type { Native06GenomeFailure, Native06StrategyGenome, Native06StrategyNode, Native06NodeKind } from './types.ts';

const REQUIRED_MATERIALIZATION_KINDS: readonly Exclude<
  Native06NodeKind,
  'FLOW' | 'REGIME' | 'FEATURE'
>[] = Object.freeze([
  'DATA',
  'INDICATOR',
  'CONDITION',
  'SIGNAL',
  'SIZING',
  'RISK',
  'ENTRY',
  'EXIT',
  'EXECUTION_PREFERENCE',
]);

function scanForbidden(value: unknown, out: string[]): void {
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    for (const token of FORBIDDEN_STRATEGY_CODE) {
      if (lower.includes(token.toLowerCase())) {
        out.push(token);
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      scanForbidden(item, out);
    }
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      scanForbidden(key, out);
      scanForbidden(item, out);
    }
  }
}

function paramTypeMatches(value: unknown): value is string | number | boolean {
  const t = typeof value;
  return t === 'string' || t === 'number' || t === 'boolean';
}

function validateNodeParams(
  node: Exclude<Native06StrategyNode, { kind: 'FLOW' }>,
): Result<true, Native06GenomeFailure> {
  const definition = native06CatalogDefinitionFor(node.catalogRef);
  if (!definition) {
    return err({
      code: 'UNKNOWN_CATALOG_REF',
      message: `node ${node.nodeId} references unknown catalogRef ${node.catalogRef}`,
    });
  }
  if (definition.kind !== node.kind) {
    return err({
      code: 'INVALID_NODE_KIND',
      message: `catalogRef ${node.catalogRef} is kind ${definition.kind} but node ${node.nodeId} is ${node.kind}`,
    });
  }
  for (const spec of definition.params) {
    const value = node.params[spec.key];
    if (value === undefined) {
      if (spec.required) {
        return err({
          code: 'INVALID_PARAMS',
          message: `node ${node.nodeId} missing required param ${spec.key}`,
        });
      }
      continue;
    }
    if (typeof value !== spec.valueType) {
      return err({
        code: 'INVALID_PARAMS',
        message: `node ${node.nodeId} param ${spec.key} must be ${spec.valueType}`,
      });
    }
  }
  for (const key of Object.keys(node.params)) {
    if (!definition.params.some((spec) => spec.key === key)) {
      return err({
        code: 'INVALID_PARAMS',
        message: `node ${node.nodeId} param ${key} is not declared in catalog ${node.catalogRef}`,
      });
    }
  }
  return ok(true);
}

function validateFlowGraph(nodes: readonly Native06StrategyNode[]): Result<true, Native06GenomeFailure> {
  const nodeIds = new Set(nodes.map((node) => node.nodeId));
  if (nodeIds.size !== nodes.length) {
    return err({ code: 'DUPLICATE_NODE_ID', message: 'genome contains duplicate nodeId values' });
  }
  const flowNodes = nodes.filter((node): node is Extract<Native06StrategyNode, { kind: 'FLOW' }> => node.kind === 'FLOW');
  const adjacency = new Map<string, string[]>();
  for (const flow of flowNodes) {
    if (!nodeIds.has(flow.fromNodeId) || !nodeIds.has(flow.toNodeId)) {
      return err({
        code: 'FLOW_REFERENCE_UNKNOWN',
        message: `flow ${flow.nodeId} references unknown endpoint`,
      });
    }
    const edges = adjacency.get(flow.fromNodeId) ?? [];
    edges.push(flow.toNodeId);
    adjacency.set(flow.fromNodeId, edges);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  function dfs(nodeId: string): boolean {
    if (visiting.has(nodeId)) {
      return true;
    }
    if (visited.has(nodeId)) {
      return false;
    }
    visiting.add(nodeId);
    for (const next of adjacency.get(nodeId) ?? []) {
      if (dfs(next)) {
        return true;
      }
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
    return false;
  }
  for (const nodeId of nodeIds) {
    if (dfs(nodeId)) {
      return err({ code: 'GRAPH_CYCLE', message: 'genome flow graph contains a cycle' });
    }
  }
  return ok(true);
}

function validateRequiredKinds(nodes: readonly Native06StrategyNode[]): Result<true, Native06GenomeFailure> {
  const present = new Set(nodes.map((node) => node.kind));
  for (const kind of REQUIRED_MATERIALIZATION_KINDS) {
    if (!present.has(kind)) {
      return err({
        code: 'MISSING_REQUIRED_NODE',
        message: `genome missing required ${kind} node for capsule materialization`,
      });
    }
  }
  return ok(true);
}

export function validateNative06StrategyGenome(
  genome: Native06StrategyGenome,
): Result<Native06StrategyGenome, Native06GenomeFailure> {
  const forbidden: string[] = [];
  scanForbidden(genome, forbidden);
  if (forbidden.length > 0) {
    return err({
      code: 'ARBITRARY_CODE_FORBIDDEN',
      message: `strategy genome forbids executable or networked tokens: ${forbidden.join(', ')}`,
    });
  }
  if (genome.lineage.nodeCatalogVersion !== NATIVE06_NODE_CATALOG_VERSION) {
    return err({
      code: 'INVALID_PARAMS',
      message: `nodeCatalogVersion must be ${NATIVE06_NODE_CATALOG_VERSION}`,
    });
  }
  if (genome.lineage.featureManifestVersion !== NATIVE06_FEATURE_MANIFEST_VERSION) {
    return err({
      code: 'INVALID_PARAMS',
      message: `featureManifestVersion must be ${NATIVE06_FEATURE_MANIFEST_VERSION}`,
    });
  }
  for (const [key, value] of Object.entries(genome.parameters)) {
    if (!paramTypeMatches(value)) {
      return err({
        code: 'INVALID_PARAMS',
        message: `genome parameter ${key} must be string, number, or boolean`,
      });
    }
  }
  for (const node of genome.nodes) {
    if (node.kind === 'FLOW') {
      continue;
    }
    const paramsOk = validateNodeParams(node);
    if (!paramsOk.ok) {
      return paramsOk;
    }
  }
  const flowOk = validateFlowGraph(genome.nodes);
  if (!flowOk.ok) {
    return flowOk;
  }
  const kindsOk = validateRequiredKinds(genome.nodes);
  if (!kindsOk.ok) {
    return kindsOk;
  }
  return ok(Object.freeze(genome));
}
