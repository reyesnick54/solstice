import type { StrategyGenome, StrategyNode } from '../os05/types.ts';

import { multisetJaccardDistance } from './math.ts';
import { HELIOS_EVOL07_SEMANTIC_FINGERPRINT_SCHEMA_VERSION } from './taxonomy.ts';
import type { StrategySemanticFingerprint } from './types.ts';

export function computeStrategySemanticFingerprint(genome: StrategyGenome): StrategySemanticFingerprint {
  const sortedNodes = [...genome.nodes].sort((a, b) => a.nodeId.localeCompare(b.nodeId));
  const edges: string[] = [];
  const featureFamilies: string[] = [];
  const decisionRules: string[] = [];

  for (const n of sortedNodes) {
    if (n.kind === 'FLOW') {
      edges.push(`${n.fromNodeId}|${n.toNodeId}|${n.port ?? ''}`);
    }
    if (n.kind === 'FEATURE') {
      featureFamilies.push(featureFamilyKey(n.catalogRef));
    }
    appendDecisionRule(n, decisionRules);
  }

  const genomeParams = stableParamPairs(genome.parameters);
  for (const [k, v] of genomeParams) {
    decisionRules.push(`global_param|${k}|${String(v)}`);
  }

  decisionRules.sort((a, b) => a.localeCompare(b));
  const edgeSigs = [...edges].sort((a, b) => a.localeCompare(b));
  const famSorted = [...featureFamilies].sort((a, b) => a.localeCompare(b));

  return Object.freeze({
    schemaVersion: HELIOS_EVOL07_SEMANTIC_FINGERPRINT_SCHEMA_VERSION,
    topologyEdgeSignatures: Object.freeze(edgeSigs),
    featureFamilies: Object.freeze(famSorted),
    decisionRuleSignatures: Object.freeze(decisionRules),
  });
}

function featureFamilyKey(catalogRef: string): string {
  const parts = catalogRef.split(/[:/]/);
  return parts[0] ?? catalogRef;
}

function appendDecisionRule(n: StrategyNode, out: string[]): void {
  switch (n.kind) {
    case 'CONDITION':
      out.push(`condition|${n.catalogRef}|${n.comparator}|${n.thresholdParam}`);
      return;
    case 'SIGNAL':
      out.push(`signal|${n.catalogRef}|${n.comparator}|${n.thresholdParam}|${n.direction}`);
      return;
    case 'REGIME_GATE': {
      const perm = [...n.permittedRegimes].sort().join(',');
      const proh = [...n.prohibitedRegimes].sort().join(',');
      out.push(`regime|${n.catalogRef}|${perm}|${proh}`);
      return;
    }
    default:
      return;
  }
}

function stableParamPairs(params: Readonly<Record<string, string | number | boolean>>): [string, string | number | boolean][] {
  return Object.keys(params)
    .sort((a, b) => a.localeCompare(b))
    .map((k) => [k, params[k]!] as [string, string | number | boolean]);
}

export function structuralDistance(a: StrategySemanticFingerprint, b: StrategySemanticFingerprint): number {
  const edgeD = multisetJaccardDistance(a.topologyEdgeSignatures, b.topologyEdgeSignatures);
  const famD = multisetJaccardDistance(a.featureFamilies, b.featureFamilies);
  const ruleD = multisetJaccardDistance(a.decisionRuleSignatures, b.decisionRuleSignatures);
  return (edgeD + famD + ruleD) / 3;
}
