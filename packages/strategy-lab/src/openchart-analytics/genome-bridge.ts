/**
 * Strategy Genome bridge for native OpenChart study catalog (no platform import).
 * Catalog refs align with `packages/platform/.../openchart-analytics/indicators/study-catalog.ts`.
 */

import type { FeatureNode, ConditionNode } from '../os05/types.ts';

export const OPENCHART_GENOME_CATALOG_PREFIX = 'openchart.native' as const;

export const OPENCHART_GENOME_STUDY_REFS = Object.freeze({
  sma: `${OPENCHART_GENOME_CATALOG_PREFIX}.sma`,
  ema: `${OPENCHART_GENOME_CATALOG_PREFIX}.ema`,
  rsi: `${OPENCHART_GENOME_CATALOG_PREFIX}.rsi`,
  atr: `${OPENCHART_GENOME_CATALOG_PREFIX}.atr`,
  macd: `${OPENCHART_GENOME_CATALOG_PREFIX}.macd`,
  bollingerBands: `${OPENCHART_GENOME_CATALOG_PREFIX}.bollinger-bands`,
} as const);

export function buildOpenChartFeatureNode(input: {
  readonly nodeId: string;
  readonly study: keyof typeof OPENCHART_GENOME_STUDY_REFS;
  readonly length: number;
  readonly outputRef: string;
  readonly instrumentParam?: string;
}): FeatureNode {
  return Object.freeze({
    nodeId: input.nodeId,
    kind: 'FEATURE',
    catalogRef: OPENCHART_GENOME_STUDY_REFS[input.study],
    outputRef: input.outputRef,
    params: Object.freeze({
      length: input.length,
      ...(input.instrumentParam !== undefined ? { instrumentId: input.instrumentParam } : {}),
    }),
  });
}

export function buildOpenChartThresholdCondition(input: {
  readonly nodeId: string;
  readonly inputRef: string;
  readonly comparator: ConditionNode['comparator'];
  readonly thresholdParam: string;
}): ConditionNode {
  return Object.freeze({
    nodeId: input.nodeId,
    kind: 'CONDITION',
    catalogRef: `${OPENCHART_GENOME_CATALOG_PREFIX}.threshold`,
    inputRef: input.inputRef,
    comparator: input.comparator,
    thresholdParam: input.thresholdParam,
    params: Object.freeze({}),
  });
}
