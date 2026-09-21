/**
 * HELIOS Multi-Asset M17 — Dynamic Cross-Asset Correlation Engine.
 *
 * Deterministic rolling correlation across qualified multi-asset instruments.
 * Portfolio-risk and research capability only — does not approve or reject orders.
 */

import { asUtcInstant, type UtcInstant } from '@solstice/domain';
import type { CrossAssetOpportunityGraphStorePort } from '../opportunity-graph/index.ts';
import {
  alignBarPairs,
  barsKnowableAsOf,
  latestKnowableMs,
  pearsonCorrelationBps,
  tailBars,
} from './compute.ts';
import { assessDataQuality, classifyRelationshipState } from './detection.ts';
import {
  publishCorrelationArtifactToOpportunityGraph,
  publishCorrelationChangeToOpportunityGraph,
} from './opportunity-graph-bridge.ts';
import { InMemoryCorrelationEngineStore, type CorrelationEngineStorePort } from './store.ts';
import {
  CLUSTER_CORRELATION_THRESHOLD_BPS,
  CORRELATION_BREAKDOWN_DELTA_BPS,
  ELEVATED_CORRELATION_THRESHOLD_BPS,
} from './taxonomy.ts';
import type {
  CorrelationArtifact,
  CorrelationBarObservation,
  CorrelationChangeEvent,
  CorrelationCluster,
  CorrelationMatrix,
  CorrelationMatrixCell,
  CorrelationWindowHorizon,
} from './types.ts';
import { lookbackForHorizon, mergeCorrelationWindowConfig } from './windows.ts';

export type InstrumentMetadata = {
  readonly instrumentId: string;
  readonly assetClass: string;
  readonly symbol: string;
};

export type DynamicCrossAssetCorrelationEngineOptions = {
  readonly store?: CorrelationEngineStorePort;
  readonly opportunityGraph?: CrossAssetOpportunityGraphStorePort;
  readonly instrumentMetadata?: Readonly<Record<string, InstrumentMetadata>>;
};

export class DynamicCrossAssetCorrelationEngine {
  readonly #store: CorrelationEngineStorePort;
  readonly #opportunityGraph: CrossAssetOpportunityGraphStorePort | null;
  readonly #bars = new Map<string, CorrelationBarObservation[]>();
  readonly #metadata: Readonly<Record<string, InstrumentMetadata>>;

  constructor(options: DynamicCrossAssetCorrelationEngineOptions = {}) {
    this.#store = options.store ?? new InMemoryCorrelationEngineStore();
    this.#opportunityGraph = options.opportunityGraph ?? null;
    this.#metadata = options.instrumentMetadata ?? Object.freeze({});
  }

  get store(): CorrelationEngineStorePort {
    return this.#store;
  }

  ingestBar(bar: CorrelationBarObservation): void {
    const existing = this.#bars.get(bar.instrumentId) ?? [];
    const next = [...existing, bar].sort(
      (a, b) => Date.parse(a.knowableAt) - Date.parse(b.knowableAt),
    );
    this.#bars.set(bar.instrumentId, next);
  }

  ingestBars(bars: readonly CorrelationBarObservation[]): void {
    for (const bar of bars) {
      this.ingestBar(bar);
    }
  }

  barsFor(instrumentId: string, asOf: UtcInstant): readonly CorrelationBarObservation[] {
    const bars = this.#bars.get(instrumentId) ?? [];
    return barsKnowableAsOf(bars, Date.parse(asOf));
  }

  computePair(input: {
    readonly instrumentA: string;
    readonly instrumentB: string;
    readonly asOf: UtcInstant;
    readonly horizon: CorrelationWindowHorizon;
  }): CorrelationArtifact {
    const priorArtifact = this.#store.latestPairArtifact({
      instrumentA: input.instrumentA,
      instrumentB: input.instrumentB,
      horizon: input.horizon,
      asOf: input.asOf,
    });

    const shortHorizonBps =
      input.horizon === 'SHORT'
        ? null
        : this.#computePairCore({ ...input, horizon: 'SHORT' }).correlationBps;
    const mediumHorizonBps =
      input.horizon === 'MEDIUM'
        ? null
        : this.#computePairCore({ ...input, horizon: 'MEDIUM' }).correlationBps;

    const core = this.#computePairCore(input);
    const relationshipState = classifyRelationshipState({
      correlationBps: core.correlationBps,
      sampleSize: core.sampleSize,
      minSampleSize: core.windowConfig.minSampleSize,
      stale: core.stale,
      priorCorrelationBps: priorArtifact?.correlationBps ?? null,
      shortHorizonCorrelationBps: shortHorizonBps,
      mediumHorizonCorrelationBps: mediumHorizonBps,
    });

    const asOfMs = Date.parse(input.asOf);
    const validUntil = asUtcInstant(
      new Date(asOfMs + core.windowConfig.validForMs).toISOString(),
    );
    const artifactId = `corr_${input.instrumentA}_${input.instrumentB}_${input.horizon}_${input.asOf}`;

    const artifact = Object.freeze({
      artifactId,
      instrumentA: input.instrumentA,
      instrumentB: input.instrumentB,
      methodology: 'PEARSON_SIMPLE_RETURN_BPS' as const,
      returnInterval: core.windowConfig.returnInterval,
      lookback: core.lookback,
      windowHorizon: input.horizon,
      sampleSize: core.sampleSize,
      correlationBps: core.correlationBps,
      dataQuality: core.dataQuality,
      relationshipState,
      calculationTimestamp: input.asOf,
      validUntil,
      sourceBars: core.sourceBars,
    });

    this.#store.putArtifact(artifact);

    if (this.#opportunityGraph) {
      publishCorrelationArtifactToOpportunityGraph({
        graph: this.#opportunityGraph,
        artifact,
        instrumentAAssetClass: core.metaA.assetClass,
        instrumentASymbol: core.metaA.symbol,
        instrumentBAssetClass: core.metaB.assetClass,
        instrumentBSymbol: core.metaB.symbol,
      });
    }

    this.#detectAndRecordChange({
      artifact,
      priorArtifact,
      asOf: input.asOf,
      validUntil,
    });

    return artifact;
  }

  #computePairCore(input: {
    readonly instrumentA: string;
    readonly instrumentB: string;
    readonly asOf: UtcInstant;
    readonly horizon: CorrelationWindowHorizon;
  }): {
    readonly metaA: InstrumentMetadata;
    readonly metaB: InstrumentMetadata;
    readonly windowConfig: ReturnType<typeof mergeCorrelationWindowConfig>;
    readonly lookback: number;
    readonly sampleSize: number;
    readonly correlationBps: number | null;
    readonly dataQuality: CorrelationArtifact['dataQuality'];
    readonly stale: boolean;
    readonly sourceBars: CorrelationArtifact['sourceBars'];
  } {
    const metaA = this.#metadata[input.instrumentA] ?? {
      instrumentId: input.instrumentA,
      assetClass: 'other',
      symbol: input.instrumentA,
    };
    const metaB = this.#metadata[input.instrumentB] ?? {
      instrumentId: input.instrumentB,
      assetClass: 'other',
      symbol: input.instrumentB,
    };
    const windowConfig = mergeCorrelationWindowConfig(metaA.assetClass, metaB.assetClass);
    const lookback = lookbackForHorizon(windowConfig, input.horizon);
    const asOfMs = Date.parse(input.asOf);

    const rawA = this.barsFor(input.instrumentA, input.asOf);
    const rawB = this.barsFor(input.instrumentB, input.asOf);
    const barsA = tailBars(rawA, lookback + 1);
    const barsB = tailBars(rawB, lookback + 1);

    const latestMs = Math.min(latestKnowableMs(barsA) ?? 0, latestKnowableMs(barsB) ?? 0);
    const stale = latestMs === 0 || asOfMs - latestMs > windowConfig.staleAfterMs;

    const pairs = alignBarPairs(barsA, barsB);
    const usedPairs = pairs.slice(Math.max(0, pairs.length - lookback));
    const correlationBps = pearsonCorrelationBps(usedPairs);
    const sampleSize = usedPairs.length;

    const dataQuality = assessDataQuality({
      sampleSize,
      minSampleSize: windowConfig.minSampleSize,
      stale,
      alignedPairs: usedPairs.length,
    });

    const sourceBars = Object.freeze(usedPairs.flatMap((pair) => [pair.barA, pair.barB]));

    return Object.freeze({
      metaA,
      metaB,
      windowConfig,
      lookback,
      sampleSize,
      correlationBps,
      dataQuality,
      stale,
      sourceBars,
    });
  }

  computeMatrix(input: {
    readonly instrumentIds: readonly string[];
    readonly asOf: UtcInstant;
    readonly horizon: CorrelationWindowHorizon;
  }): CorrelationMatrix {
    const cells: CorrelationMatrixCell[] = [];
    for (let i = 0; i < input.instrumentIds.length; i += 1) {
      for (let j = i; j < input.instrumentIds.length; j += 1) {
        const instrumentA = input.instrumentIds[i]!;
        const instrumentB = input.instrumentIds[j]!;
        if (instrumentA === instrumentB) {
          cells.push(
            Object.freeze({
              instrumentA,
              instrumentB,
              correlationBps: 10_000,
              relationshipState: 'NORMAL' as const,
              artifactId: null,
            }),
          );
          continue;
        }
        const artifact = this.computePair({
          instrumentA,
          instrumentB,
          asOf: input.asOf,
          horizon: input.horizon,
        });
        cells.push(
          Object.freeze({
            instrumentA,
            instrumentB,
            correlationBps: artifact.correlationBps,
            relationshipState: artifact.relationshipState,
            artifactId: artifact.artifactId,
          }),
        );
      }
    }
    return Object.freeze({
      instrumentIds: Object.freeze([...input.instrumentIds]),
      horizon: input.horizon,
      asOf: input.asOf,
      cells: Object.freeze(cells),
    });
  }

  computeClusters(input: {
    readonly instrumentIds: readonly string[];
    readonly asOf: UtcInstant;
    readonly horizon: CorrelationWindowHorizon;
  }): readonly CorrelationCluster[] {
    const matrix = this.computeMatrix(input);
    const parent = new Map<string, string>();
    for (const id of input.instrumentIds) {
      parent.set(id, id);
    }

    function find(x: string): string {
      const current = parent.get(x) ?? x;
      if (current !== x) {
        parent.set(x, find(current));
      }
      return parent.get(x) ?? x;
    }

    function union(a: string, b: string): void {
      parent.set(find(a), find(b));
    }

    for (const cell of matrix.cells) {
      if (cell.instrumentA === cell.instrumentB) {
        continue;
      }
      if (cell.correlationBps === null) {
        continue;
      }
      if (Math.abs(cell.correlationBps) >= CLUSTER_CORRELATION_THRESHOLD_BPS) {
        union(cell.instrumentA, cell.instrumentB);
      }
    }

    const groups = new Map<string, string[]>();
    for (const id of input.instrumentIds) {
      const root = find(id);
      const group = groups.get(root) ?? [];
      group.push(id);
      groups.set(root, group);
    }

    const clusters: CorrelationCluster[] = [];
    for (const [root, members] of groups) {
      if (members.length < 2) {
        continue;
      }
      const cluster = Object.freeze({
        clusterId: `cluster_${input.horizon}_${root}_${input.asOf}`,
        instrumentIds: Object.freeze([...members].sort()),
        horizon: input.horizon,
        minInternalCorrelationBps: CLUSTER_CORRELATION_THRESHOLD_BPS,
        capturedAt: input.asOf,
      });
      this.#store.putCluster(cluster);
      clusters.push(cluster);

      if (this.#opportunityGraph) {
        for (let i = 0; i < members.length; i += 1) {
          for (let j = i + 1; j < members.length; j += 1) {
            this.#opportunityGraph.upsertEdgeEvidence({
              kind: 'CORRELATION',
              instrumentA: members[i]!,
              instrumentB: members[j]!,
              updatedAt: input.asOf,
              evidence: Object.freeze({
                evidenceId: cluster.clusterId,
                kind: 'CORRELATION_CLUSTER',
                artifactRef: cluster.clusterId,
                summary: `cluster size=${members.length}`,
                correlationBps: null,
                relationshipState: 'ELEVATED_CORRELATION',
                capturedAt: input.asOf,
                validUntil: asUtcInstant(
                  new Date(Date.parse(input.asOf) + 3_600_000).toISOString(),
                ),
              }),
            });
          }
        }
      }
    }

    return Object.freeze(clusters);
  }

  #detectAndRecordChange(input: {
    readonly artifact: CorrelationArtifact;
    readonly priorArtifact: CorrelationArtifact | null;
    readonly asOf: UtcInstant;
    readonly validUntil: UtcInstant;
  }): void {
    const prior = input.priorArtifact?.correlationBps ?? null;
    const current = input.artifact.correlationBps;
    if (prior === null || current === null) {
      return;
    }

    let kind: CorrelationChangeEvent['kind'] | null = null;
    const priorAbs = Math.abs(prior);
    const currentAbs = Math.abs(current);
    const deltaBps = current - prior;

    if (
      priorAbs < ELEVATED_CORRELATION_THRESHOLD_BPS &&
      currentAbs >= ELEVATED_CORRELATION_THRESHOLD_BPS
    ) {
      kind = 'ELEVATION';
    } else if (
      priorAbs >= ELEVATED_CORRELATION_THRESHOLD_BPS &&
      priorAbs - currentAbs >= CORRELATION_BREAKDOWN_DELTA_BPS
    ) {
      kind = 'BREAKDOWN';
    } else if (Math.sign(prior) !== Math.sign(current) && prior !== 0 && current !== 0) {
      kind = 'SIGN_FLIP';
    } else if (Math.abs(deltaBps) >= 3_500) {
      kind = 'INSTABILITY';
    }

    if (!kind) {
      return;
    }

    const change = Object.freeze({
      changeId: `chg_${input.artifact.artifactId}_${kind}`,
      instrumentA: input.artifact.instrumentA,
      instrumentB: input.artifact.instrumentB,
      kind,
      priorCorrelationBps: prior,
      currentCorrelationBps: current,
      deltaBps,
      detectedAt: input.asOf,
    });
    this.#store.putChange(change);

    if (this.#opportunityGraph) {
      publishCorrelationChangeToOpportunityGraph({
        graph: this.#opportunityGraph,
        change,
        validUntil: input.validUntil,
      });
    }
  }
}
