import { err, ok, type Result } from '@solstice/domain';
import { asUtcInstant, type UtcInstant } from '@solstice/domain';
import {
  NATIVE06_FEATURE_MANIFEST_VERSION,
  NATIVE06_NODE_CATALOG_VERSION,
  catalogRefForBytexNodeType,
} from './catalog.ts';
import { attachNative06GenomeHash } from './hash.ts';
import { asNative06StrategyGenomeId, asNative06StrategyGenomeVersion, NATIVE06_STRATEGY_GENOME_SCHEMA } from './ids.ts';
import { validateBytexStrategyDocument } from './schema.ts';
import type {
  BytexStrategyDocument,
  Native06GenomeFailure,
  Native06NodeParams,
  Native06StrategyGenome,
  Native06StrategyNode,
} from './types.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function resolveParamRef(value: unknown, parameters: Native06NodeParams): number | string | boolean | undefined {
  if (!isRecord(value) || !('$param' in value)) {
    return undefined;
  }
  const key = value.$param;
  if (typeof key !== 'string') {
    return undefined;
  }
  return parameters[key];
}

function documentParameters(document: BytexStrategyDocument): Native06NodeParams {
  const params: Record<string, string | number | boolean> = {};
  for (const row of document.parameters ?? []) {
    if (row.type === 'int') {
      params[row.name] = Number.parseInt(row.value, 10);
    } else if (row.type === 'decimal') {
      params[row.name] = Number.parseFloat(row.value);
    } else if (row.type === 'bool') {
      params[row.name] = row.value === 'true';
    } else {
      params[row.name] = row.value;
    }
  }
  return Object.freeze(params);
}

function parseEdgeEndpoints(edge: { readonly from: string; readonly to: string }): {
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly fromPort?: string;
  readonly toPort?: string;
} {
  const [fromNodeId, fromPort] = edge.from.split(':');
  const [toNodeId, toPort] = edge.to.split(':');
  if (!fromNodeId || !toNodeId) {
    throw new Error('invalid edge endpoint');
  }
  return Object.freeze({
    fromNodeId,
    toNodeId,
    ...(fromPort ? { fromPort } : {}),
    ...(toPort ? { toPort } : {}),
  });
}

export function translateBytexDocumentToNative06Genome(input: {
  readonly document: BytexStrategyDocument;
  readonly genomeId: Native06StrategyGenome['genomeId'];
  readonly version: Native06StrategyGenome['version'];
  readonly createdBy: string;
  readonly createdAt: UtcInstant;
}): Result<Native06StrategyGenome, Native06GenomeFailure> {
  const validated = validateBytexStrategyDocument(input.document);
  if (!validated.ok) {
    return validated;
  }
  const document = validated.value;
  const parameters = documentParameters(document);
  const nodes: Native06StrategyNode[] = [];
  const outputRefByNodeId = new Map<string, string>();

  for (const bytexNode of document.nodes) {
    const catalogRef = catalogRefForBytexNodeType(bytexNode.type);
    if (!catalogRef) {
      return err({
        code: 'UNSUPPORTED_BYTEX_NODE',
        message: `unsupported BYTEX node type ${bytexNode.type}`,
      });
    }
    const nodeId = bytexNode.id;
    const paramsRaw = bytexNode.params ?? {};
    switch (bytexNode.type) {
      case 'data.bars': {
        const candleSeries =
          typeof paramsRaw.candleSeries === 'string' ? paramsRaw.candleSeries : 'main';
        const outputRef = `${nodeId}_bars`;
        outputRefByNodeId.set(nodeId, outputRef);
        nodes.push(
          Object.freeze({
            nodeId,
            kind: 'DATA',
            catalogRef,
            sourceBytexType: bytexNode.type,
            outputRef,
            params: Object.freeze({ candleSeriesRef: candleSeries }),
          }),
        );
        break;
      }
      case 'ind.ema':
      case 'ind.sma':
      case 'ind.wma':
      case 'ind.rsi':
      case 'ind.roc':
      case 'ind.atr':
      case 'ind.obv':
      case 'ind.macd':
      case 'ind.bbands': {
        let period = 20;
        const periodParam = paramsRaw.period;
        if (isRecord(periodParam)) {
          const resolved = resolveParamRef(periodParam, parameters);
          if (typeof resolved === 'number') {
            period = resolved;
          }
        } else if (typeof periodParam === 'number') {
          period = periodParam;
        }
        const outputRef = `${nodeId}_value`;
        outputRefByNodeId.set(nodeId, outputRef);
        nodes.push(
          Object.freeze({
            nodeId,
            kind: 'INDICATOR',
            catalogRef,
            sourceBytexType: bytexNode.type,
            inputRef: 'bars_stream',
            outputRef,
            params: Object.freeze({ period }),
          }),
        );
        break;
      }
      case 'cond.cross': {
        const direction =
          typeof paramsRaw.direction === 'string' && (paramsRaw.direction === 'above' || paramsRaw.direction === 'below')
            ? paramsRaw.direction
            : 'above';
        nodes.push(
          Object.freeze({
            nodeId,
            kind: 'CONDITION',
            catalogRef,
            sourceBytexType: bytexNode.type,
            inputRef: `${nodeId}_value`,
            referenceRef: `${nodeId}_reference`,
            params: Object.freeze({ direction }),
          }),
        );
        break;
      }
      case 'act.order': {
        const side = typeof paramsRaw.side === 'string' ? paramsRaw.side : 'buy';
        const orderType = typeof paramsRaw.orderType === 'string' ? paramsRaw.orderType : 'market';
        const onlyWhenFlat = paramsRaw.onlyWhenFlat === true;
        nodes.push(
          Object.freeze({
            nodeId,
            kind: 'ENTRY',
            catalogRef,
            sourceBytexType: bytexNode.type,
            triggerInputRef: `${nodeId}_trigger`,
            params: Object.freeze({ side, orderType, onlyWhenFlat }),
          }),
        );
        break;
      }
      case 'act.close':
        nodes.push(
          Object.freeze({
            nodeId,
            kind: 'EXIT',
            catalogRef,
            sourceBytexType: bytexNode.type,
            signalInputRef: `${nodeId}_trigger`,
            params: Object.freeze({}),
          }),
        );
        break;
      default:
        return err({
          code: 'UNSUPPORTED_BYTEX_NODE',
          message: `unsupported BYTEX node type ${bytexNode.type}`,
        });
    }
  }

  for (const edge of document.edges) {
    const parsed = parseEdgeEndpoints(edge);
    nodes.push(
      Object.freeze({
        nodeId: `flow_${parsed.fromNodeId}_${parsed.toNodeId}_${parsed.toPort ?? 'default'}`,
        kind: 'FLOW' as const,
        fromNodeId: parsed.fromNodeId,
        toNodeId: parsed.toNodeId,
        ...(parsed.toPort ? { port: parsed.toPort } : {}),
      }),
    );
  }

  const hasData = nodes.some((node) => node.kind === 'DATA');
  const indicatorCount = nodes.filter((node) => node.kind === 'INDICATOR').length;
  if (!hasData || indicatorCount === 0) {
    return err({
      code: 'MISSING_REQUIRED_NODE',
      message: 'translated genome requires DATA and at least one INDICATOR node',
    });
  }

  nodes.push(
    Object.freeze({
      nodeId: 'feat_rv20',
      kind: 'FEATURE',
      catalogRef: 'feature.realized_volatility',
      outputRef: 'realized_volatility_20d',
      params: Object.freeze({ lookbackDays: 20 }),
    }),
    Object.freeze({
      nodeId: 'sig_cross',
      kind: 'SIGNAL',
      catalogRef: 'signal.trend_follow_cross',
      inputRef: 'crossUp_out',
      comparator: 'GT',
      thresholdParam: 'crossSignalThreshold',
      direction: 'LONG',
      params: Object.freeze({ direction: 'above' }),
    }),
    Object.freeze({
      nodeId: 'size_fixed',
      kind: 'SIZING',
      catalogRef: 'sizing.fixed_notional',
      signalInputRef: 'sig_cross',
      volFeatureRef: 'realized_volatility_20d',
      params: Object.freeze({ sizeParam: 'size' }),
    }),
    Object.freeze({
      nodeId: 'risk_exposure',
      kind: 'RISK',
      catalogRef: 'risk.max_gross_exposure_bps',
      sizingInputRef: 'size_fixed',
      params: Object.freeze({ maxGrossExposureBps: 10_000 }),
    }),
    Object.freeze({
      nodeId: 'exec_pref',
      kind: 'EXECUTION_PREFERENCE',
      catalogRef: 'execution.market_with_slippage_cap',
      params: Object.freeze({ preferredOrderType: 'MARKET', maxSlippageToleranceBps: 25 }),
    }),
    Object.freeze({
      nodeId: 'regime_trend',
      kind: 'REGIME',
      catalogRef: 'regime.permitted_market_regime',
      permittedRegimes: Object.freeze(['TRENDING', 'SIMULATION']),
      prohibitedRegimes: Object.freeze(['HALTED']),
      params: Object.freeze({}),
    }),
  );

  const genomeParams: Native06NodeParams = Object.freeze({
    ...parameters,
    crossSignalThreshold: 0,
    maxGrossExposureBps: 10_000,
  });

  return ok(
    attachNative06GenomeHash(
      Object.freeze({
        schema: NATIVE06_STRATEGY_GENOME_SCHEMA,
        genomeId: input.genomeId,
        version: input.version,
        name: document.name,
        hypothesis: document.description ?? `Assimilated BYTEX document ${document.id}`,
        nodes: Object.freeze(nodes),
        parameters: genomeParams,
        lineage: Object.freeze({
          parentGenomeIds: Object.freeze([]),
          mutationReason: null,
          createdBy: input.createdBy,
          createdAt: input.createdAt,
          featureManifestVersion: NATIVE06_FEATURE_MANIFEST_VERSION,
          nodeCatalogVersion: NATIVE06_NODE_CATALOG_VERSION,
          genomeHash: '',
          assimilationSource: 'BYTEX_STRATEGY_DOCUMENT',
          upstreamDocumentId: document.id,
        }),
      }),
    ),
  );
}

export function translateBytexDocumentJson(
  raw: unknown,
  input: {
    readonly genomeId: Native06StrategyGenome['genomeId'];
    readonly version: Native06StrategyGenome['version'];
    readonly createdBy: string;
    readonly createdAt?: UtcInstant;
  },
): Result<Native06StrategyGenome, Native06GenomeFailure> {
  const validated = validateBytexStrategyDocument(raw);
  if (!validated.ok) {
    return validated;
  }
  return translateBytexDocumentToNative06Genome({
    document: validated.value,
    genomeId: input.genomeId,
    version: input.version,
    createdBy: input.createdBy,
    createdAt: input.createdAt ?? asUtcInstant('2026-11-03T06:00:00.000Z'),
  });
}

export function asNative06GenomeIdFromBytexDocument(documentId: string): Native06StrategyGenome['genomeId'] {
  const slug = documentId.replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase();
  return asNative06StrategyGenomeId(`sgnm_bytex_${slug}`);
}
