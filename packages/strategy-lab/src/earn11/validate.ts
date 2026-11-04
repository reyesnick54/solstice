import { err, ok, type Result } from '@solstice/domain';

import { FORBIDDEN_STRATEGY_CODE } from '../dsl.ts';
import {
  EARN11_GENOME_FEATURE_MANIFEST_VERSION,
  EARN11_GENOME_NODE_CATALOG_VERSION,
  catalogDefinitionForEarn11,
} from './catalog.ts';
import { EARN11_RESEARCH_TEMPLATE_FAMILIES, type Earn11ResearchTemplateFamily } from './taxonomy.ts';
import type { StrategyGenome, StrategyGenomeFailure, StrategyNode, StrategyNodeKind } from '../os05/types.ts';

const REQUIRED_MATERIALIZATION_KINDS: readonly Exclude<StrategyNodeKind, 'FLOW' | 'REGIME_GATE' | 'CONDITION'>[] =
  Object.freeze(['FEATURE', 'SIGNAL', 'SIZING', 'RISK', 'EXIT', 'EXECUTION']);

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

function validateNodeParams(node: Exclude<StrategyNode, { kind: 'FLOW' }>): Result<true, StrategyGenomeFailure> {
  const definition = catalogDefinitionForEarn11(node.catalogRef);
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
  return ok(true);
}

function isTemplateFamily(value: unknown): value is Earn11ResearchTemplateFamily {
  return typeof value === 'string' && (EARN11_RESEARCH_TEMPLATE_FAMILIES as readonly string[]).includes(value);
}

export function validateEarn11StrategyGenome(genome: StrategyGenome): Result<StrategyGenome, StrategyGenomeFailure> {
  const forbiddenHits: string[] = [];
  scanForbidden(genome, forbiddenHits);
  if (forbiddenHits.length > 0) {
    return err({
      code: 'ARBITRARY_CODE_FORBIDDEN',
      message: `genome contains forbidden executable tokens: ${forbiddenHits.join(', ')}`,
    });
  }

  if (genome.lineage.nodeCatalogVersion !== EARN11_GENOME_NODE_CATALOG_VERSION) {
    return err({
      code: 'INVALID_PARAMS',
      message: `nodeCatalogVersion must be ${EARN11_GENOME_NODE_CATALOG_VERSION}`,
    });
  }
  if (genome.lineage.featureManifestVersion !== EARN11_GENOME_FEATURE_MANIFEST_VERSION) {
    return err({
      code: 'INVALID_PARAMS',
      message: `featureManifestVersion must be ${EARN11_GENOME_FEATURE_MANIFEST_VERSION}`,
    });
  }

  const templateFamily = genome.parameters?.earn11TemplateFamily;
  if (!isTemplateFamily(templateFamily)) {
    return err({
      code: 'INVALID_PARAMS',
      message: 'earn11TemplateFamily parameter required on EARN11 research genome',
    });
  }
  if (genome.parameters?.researchOnly !== true) {
    return err({
      code: 'INVALID_PARAMS',
      message: 'EARN11 genomes must set parameters.researchOnly true',
    });
  }

  const execNode = genome.nodes.find((node) => node.kind === 'EXECUTION');
  if (!execNode || execNode.catalogRef !== 'execution.earnings_event_twin') {
    return err({
      code: 'INVALID_NODE_KIND',
      message: 'EARN11 genome must include execution.earnings_event_twin node',
    });
  }
  if (execNode.params.forbidCloseToCloseOnly !== true) {
    return err({
      code: 'INVALID_PARAMS',
      message: 'EARN11 execution twin must forbid close-to-close-only fantasy fills',
    });
  }

  const kindsPresent = new Set<StrategyNodeKind>();
  for (const node of genome.nodes) {
    if (node.kind === 'FLOW') {
      continue;
    }
    kindsPresent.add(node.kind);
    const paramsOk = validateNodeParams(node);
    if (!paramsOk.ok) {
      return paramsOk;
    }
  }

  for (const required of REQUIRED_MATERIALIZATION_KINDS) {
    if (!kindsPresent.has(required)) {
      return err({
        code: 'MISSING_REQUIRED_NODE',
        message: `EARN11 genome missing required node kind ${required}`,
      });
    }
  }

  if (!genome.lineage.genomeHash || genome.lineage.genomeHash.length !== 64) {
    return err({
      code: 'INVALID_PARAMS',
      message: 'genomeHash must be present (64 hex chars)',
    });
  }

  return ok(genome);
}
