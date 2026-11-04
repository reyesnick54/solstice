/**
 * HELIOS AAFV2.3 — point-in-time dataset compiler adversarial qualification.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  INFORMATION_TIME_POLICY_DEFAULT,
  createPointInTimeDatasetCompiler,
  evaluateAafv203Qualification,
  HELIOS_AAFV2_03_POINT_IN_TIME_COMPILER_QUALIFIED,
  recomputeAafv203ManifestHash,
} from '../packages/platform/src/helios/feature-fabric/compiler/index.ts';
import type {
  TemporalObservation,
  UniverseMembershipRow,
} from '../packages/platform/src/helios/feature-fabric/temporal-types.ts';
import {
  acceptPointInTimeDatasetManifest,
  legacyCapsuleEvaluationDatasetAdapter,
  pitManifestMatchesStrategyGenome,
  requireCompiledPointInTimeDataset,
  resolvePointInTimeVectorsForEvaluation,
} from '../packages/platform/src/helios/feature-fabric/compiler/strategy-lab-bridge.ts';
import { attachPointInTimeDatasetSeal } from '../packages/strategy-lab/src/evaluation/point-in-time-dataset-seal.ts';
import {
  LATENCY_MODEL_VERSION,
} from '../packages/strategy-lab/src/evaluation/types.ts';

const GENOME = 'sg_aafv203_demo';
const ENTITY = 'ent_acme';
const INSTRUMENT = 'inst_acme';
const UNIVERSE_VERSION = 'univ_v1';
const UNIVERSE_DEF = 'sha256:demo-universe-v1';

const DECISION = asUtcInstant('2026-03-15T21:00:00.000Z');
const MARKET_CLOSE = asUtcInstant('2026-03-15T20:00:00.000Z');
const EARNINGS_KNOWABLE = asUtcInstant('2026-03-18T21:30:00.000Z');

const compiler = createPointInTimeDatasetCompiler();

function obs(partial: TemporalObservation): TemporalObservation {
  return Object.freeze(partial);
}

function universe(overrides?: { membershipRows?: readonly UniverseMembershipRow[] }) {
  return Object.freeze({
    universeId: 'uni_demo',
    version: UNIVERSE_VERSION,
    definition: UNIVERSE_DEF,
    indexId: 'idx_sp500',
    entityGraphVersion: 'ekg_v1',
    members: Object.freeze([Object.freeze({ entityId: ENTITY, instrumentId: INSTRUMENT })]),
    membershipRows: Object.freeze(
      overrides?.membershipRows ??
        Object.freeze([
          Object.freeze({
            instrumentId: INSTRUMENT,
            indexId: 'idx_sp500',
            enteredKnowableAt: asUtcInstant('2020-01-01T00:00:00.000Z'),
            leftKnowableAt: null,
          }),
        ]),
    ),
  });
}

function compileRequest(input: {
  observations: readonly TemporalObservation[];
  decisionTime?: typeof DECISION;
  featureDefinitions?: Parameters<typeof compiler.compileDataset>[0]['featureDefinitions'];
  membershipRows?: ReturnType<typeof universe>['membershipRows'];
}) {
  const closeFeature = Object.freeze({
    featureId: 'close_minor',
    version: '1',
    computeKind: 'AS_OF_SCALAR' as const,
    observationKind: 'MARKET_BAR' as const,
    instrumentId: INSTRUMENT,
  });
  return compiler.compileDataset({
    strategyGenomeId: GENOME,
    decisionTimes: Object.freeze([input.decisionTime ?? DECISION]),
    featureDefinitions: input.featureDefinitions ?? Object.freeze([closeFeature]),
    informationTimePolicy: INFORMATION_TIME_POLICY_DEFAULT,
    universe: universe(
      input.membershipRows !== undefined ? { membershipRows: input.membershipRows } : undefined,
    ),
    context: {
      observations: input.observations,
      tickerHistory: [],
      corporateActionRevisions: [],
      sourceProviders: ['simulation'],
      qualityPolicies: ['AAFV2.3:ADVERSARIAL'],
      entitlementState: 'USABLE' as const,
      transformVersions: { compiler: '1' },
    },
  });
}

describe('HELIOS AAFV2.3 point-in-time dataset compiler', () => {
  it('rejects earnings filed three days after decision', () => {
    const result = compileRequest({
      observations: Object.freeze([
        obs({
          observationRef: 'filing_late',
          kind: 'CORPORATE_FILING',
          entityId: ENTITY,
          instrumentId: INSTRUMENT,
          sourceEventTime: MARKET_CLOSE,
          knowableAt: EARNINGS_KNOWABLE,
          validUntil: null,
          revisionSequence: 0,
          periodEnd: null,
          publishedKnowableAt: EARNINGS_KNOWABLE,
          valueMinor: 125_00n,
          metadata: Object.freeze({ form: '10-Q' }),
        }),
      ]),
      featureDefinitions: Object.freeze([
        Object.freeze({
          featureId: 'eps_minor',
          version: '1',
          computeKind: 'AS_OF_SCALAR',
          observationKind: 'CORPORATE_FILING',
          entityId: ENTITY,
        }),
      ]),
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.code, 'LEAKAGE_DETECTED');
    assert.equal(result.error.leakageCode, 'FILING_AFTER_DECISION');
  });

  it('selects knowable macro revision and rejects final revision published later', () => {
    const knowableMacro = compileRequest({
      observations: Object.freeze([
        obs({
          observationRef: 'cpi_r0',
          kind: 'MACRO_RELEASE',
          entityId: ENTITY,
          instrumentId: null,
          sourceEventTime: asUtcInstant('2026-02-01T13:30:00.000Z'),
          knowableAt: asUtcInstant('2026-02-01T13:30:05.000Z'),
          validUntil: null,
          revisionSequence: 0,
          periodEnd: null,
          publishedKnowableAt: null,
          valueMinor: 320n,
          metadata: Object.freeze({ series: 'CPI' }),
        }),
        obs({
          observationRef: 'cpi_r1',
          kind: 'MACRO_RELEASE',
          entityId: ENTITY,
          instrumentId: null,
          sourceEventTime: asUtcInstant('2026-02-01T13:30:00.000Z'),
          knowableAt: asUtcInstant('2026-05-16T12:00:00.000Z'),
          validUntil: null,
          revisionSequence: 1,
          periodEnd: null,
          publishedKnowableAt: null,
          valueMinor: 280n,
          metadata: Object.freeze({ series: 'CPI', revision: '1' }),
        }),
      ]),
      featureDefinitions: Object.freeze([
        Object.freeze({
          featureId: 'cpi_yoy_bps',
          version: '1',
          computeKind: 'AS_OF_SCALAR',
          observationKind: 'MACRO_RELEASE',
          entityId: ENTITY,
        }),
      ]),
    });
    assert.equal(knowableMacro.ok, true);
    if (!knowableMacro.ok) return;
    assert.equal(knowableMacro.value.vectors[0]?.features[0]?.valueMinor, 320n);

    const onlyFinal = compileRequest({
      observations: Object.freeze([
        obs({
          observationRef: 'cpi_r1_only',
          kind: 'MACRO_RELEASE',
          entityId: ENTITY,
          instrumentId: null,
          sourceEventTime: asUtcInstant('2026-02-01T13:30:00.000Z'),
          knowableAt: asUtcInstant('2026-05-16T12:00:00.000Z'),
          validUntil: null,
          revisionSequence: 1,
          periodEnd: null,
          publishedKnowableAt: null,
          valueMinor: 280n,
          metadata: Object.freeze({ series: 'CPI' }),
        }),
      ]),
      featureDefinitions: Object.freeze([
        Object.freeze({
          featureId: 'cpi_yoy_bps',
          version: '1',
          computeKind: 'AS_OF_SCALAR',
          observationKind: 'MACRO_RELEASE',
          entityId: ENTITY,
        }),
      ]),
    });
    assert.equal(onlyFinal.ok, false);
    if (onlyFinal.ok) return;
    assert.equal(onlyFinal.error.leakageCode, 'MACRO_RELEASE_LEAK');
  });

  it('rejects future S&P 500 membership knowledge', () => {
    const result = compileRequest({
      membershipRows: Object.freeze([
        Object.freeze({
          instrumentId: INSTRUMENT,
          indexId: 'idx_sp500',
          enteredKnowableAt: asUtcInstant('2026-04-01T00:00:00.000Z'),
          leftKnowableAt: null,
        }),
      ]),
      observations: Object.freeze([
        obs({
          observationRef: 'bar_ok',
          kind: 'MARKET_BAR',
          entityId: ENTITY,
          instrumentId: INSTRUMENT,
          sourceEventTime: MARKET_CLOSE,
          knowableAt: MARKET_CLOSE,
          validUntil: null,
          revisionSequence: 0,
          periodEnd: null,
          publishedKnowableAt: null,
          valueMinor: 100_00n,
          metadata: Object.freeze({}),
        }),
      ]),
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.leakageCode, 'UNIVERSE_MEMBERSHIP_LEAK');
  });

  it('rejects merger announced after decision', () => {
    const result = compileRequest({
      observations: Object.freeze([
        obs({
          observationRef: 'merger_ann',
          kind: 'CORPORATE_ACTION',
          entityId: ENTITY,
          instrumentId: INSTRUMENT,
          sourceEventTime: asUtcInstant('2026-03-20T00:00:00.000Z'),
          knowableAt: asUtcInstant('2026-03-20T09:00:00.000Z'),
          validUntil: null,
          revisionSequence: 0,
          periodEnd: null,
          publishedKnowableAt: null,
          valueMinor: 1n,
          metadata: Object.freeze({ action: 'MERGER' }),
        }),
      ]),
      featureDefinitions: Object.freeze([
        Object.freeze({
          featureId: 'merger_flag',
          version: '1',
          computeKind: 'AS_OF_SCALAR',
          observationKind: 'CORPORATE_ACTION',
          instrumentId: INSTRUMENT,
        }),
      ]),
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.leakageCode, 'CORPORATE_ACTION_LEAK');
  });

  it('rejects ticker mapping learned later', () => {
    const result = compileRequest({
      observations: Object.freeze([
        obs({
          observationRef: 'ticker_new',
          kind: 'REFERENCE_METADATA',
          entityId: ENTITY,
          instrumentId: INSTRUMENT,
          sourceEventTime: asUtcInstant('2026-04-01T00:00:00.000Z'),
          knowableAt: asUtcInstant('2026-04-01T09:00:00.000Z'),
          validUntil: null,
          revisionSequence: 0,
          periodEnd: null,
          publishedKnowableAt: null,
          valueMinor: 1n,
          metadata: Object.freeze({ symbol: 'ACME2' }),
        }),
      ]),
      featureDefinitions: Object.freeze([
        Object.freeze({
          featureId: 'ticker_code',
          version: '1',
          computeKind: 'AS_OF_SCALAR',
          observationKind: 'REFERENCE_METADATA',
          entityId: ENTITY,
          instrumentId: INSTRUMENT,
        }),
      ]),
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.leakageCode, 'ENTITY_MAPPING_AFTER_DECISION');
  });

  it('rejects provider payload arriving late', () => {
    const result = compileRequest({
      observations: Object.freeze([
        obs({
          observationRef: 'bar_delayed',
          kind: 'MARKET_BAR',
          entityId: ENTITY,
          instrumentId: INSTRUMENT,
          sourceEventTime: MARKET_CLOSE,
          knowableAt: asUtcInstant('2026-03-16T08:00:00.000Z'),
          validUntil: null,
          revisionSequence: 0,
          periodEnd: null,
          publishedKnowableAt: null,
          valueMinor: 100_00n,
          metadata: Object.freeze({ provider: 'delayed' }),
        }),
      ]),
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.leakageCode, 'SOURCE_ARRIVAL_LEAK');
  });

  it('rejects future alternative-data observation', () => {
    const result = compileRequest({
      observations: Object.freeze([
        obs({
          observationRef: 'alt_late',
          kind: 'ALT_DATA',
          entityId: ENTITY,
          instrumentId: INSTRUMENT,
          sourceEventTime: MARKET_CLOSE,
          knowableAt: asUtcInstant('2026-03-16T02:00:00.000Z'),
          validUntil: null,
          revisionSequence: 0,
          periodEnd: null,
          publishedKnowableAt: null,
          valueMinor: 42n,
          metadata: Object.freeze({ vendor: 'alt' }),
        }),
      ]),
      featureDefinitions: Object.freeze([
        Object.freeze({
          featureId: 'alt_signal',
          version: '1',
          computeKind: 'AS_OF_SCALAR',
          observationKind: 'ALT_DATA',
          entityId: ENTITY,
          instrumentId: INSTRUMENT,
        }),
      ]),
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.leakageCode, 'ALTERNATIVE_DATA_LEAK');
  });

  it('seals a reproducible manifest and Strategy Lab accepts it', () => {
    const bars: TemporalObservation[] = [];
    for (let i = 0; i < 3; i += 1) {
      const at = asUtcInstant(`2026-03-${String(13 + i).padStart(2, '0')}T20:00:00.000Z`);
      bars.push(
        obs({
          observationRef: `bar_${String(i)}`,
          kind: 'MARKET_BAR',
          entityId: ENTITY,
          instrumentId: INSTRUMENT,
          sourceEventTime: at,
          knowableAt: at,
          validUntil: null,
          revisionSequence: 0,
          periodEnd: null,
          publishedKnowableAt: null,
          valueMinor: BigInt((i + 1) * 100),
          metadata: Object.freeze({}),
        }),
      );
    }
    const decisionTimes = bars.map((row) => row.knowableAt);
    const compiled = compiler.compileDataset({
      strategyGenomeId: GENOME,
      decisionTimes,
      featureDefinitions: Object.freeze([
        Object.freeze({
          featureId: 'close_minor',
          version: '1',
          computeKind: 'AS_OF_SCALAR',
          observationKind: 'MARKET_BAR',
          instrumentId: INSTRUMENT,
        }),
      ]),
      informationTimePolicy: INFORMATION_TIME_POLICY_DEFAULT,
      universe: universe(),
      context: {
        observations: bars,
        tickerHistory: [],
        corporateActionRevisions: [],
        sourceProviders: ['simulation'],
        qualityPolicies: ['AAFV2.3:ADVERSARIAL'],
        entitlementState: 'USABLE' as const,
        transformVersions: { compiler: '1' },
      },
    });
    assert.equal(compiled.ok, true);
    if (!compiled.ok) return;

    const manifest = acceptPointInTimeDatasetManifest(compiled.value.manifest);
    assert.equal(recomputeAafv203ManifestHash(manifest), manifest.contentHash);
    assert.ok(pitManifestMatchesStrategyGenome(manifest, GENOME));

    const gate = requireCompiledPointInTimeDataset({
      strategyGenomeId: GENOME,
      manifest,
    });
    assert.equal(gate.ok, true);

    const vectors = resolvePointInTimeVectorsForEvaluation({
      manifest,
      featureDefinitions: Object.freeze([
        Object.freeze({
          featureId: 'close_minor',
          version: '1',
          computeKind: 'AS_OF_SCALAR',
          observationKind: 'MARKET_BAR',
          instrumentId: INSTRUMENT,
        }),
      ]),
      context: Object.freeze({
        observations: Object.freeze(bars),
        universeMembership: universe().membershipRows,
        tickerHistory: Object.freeze([]),
        corporateActionRevisions: Object.freeze([]),
        entityResolutionVersion: 'ekg_v1',
        revisionPolicy: 'LATEST_KNOWABLE_REVISION',
        missingnessPolicy: 'FAIL_CLOSED',
      }),
      entityId: ENTITY,
      instrumentId: INSTRUMENT,
      decisionTimes,
    });
    assert.equal(vectors.length, 3);

    assert.equal(typeof legacyCapsuleEvaluationDatasetAdapter, 'function');

    const sealedConfig = attachPointInTimeDatasetSeal(
      {
        mode: 'HISTORICAL_BACKTEST',
        runKind: 'OFFICIAL_QUALIFICATION',
        partition: 'TRAIN',
        period: { start: decisionTimes[0]!, end: decisionTimes[2]! },
        startingCapitalMinor: 1_000_000n,
        latency: {
          version: LATENCY_MODEL_VERSION,
          observationToDecisionMs: 250,
          decisionToProposalMs: 0,
          proposalToExecutionEligibilityMs: 500,
          zeroLatencyAssumed: false,
        },
        costs: {
          mode: 'EXPLICIT_COSTS',
          commissionMinorPerShare: 0n,
          spreadMinor: 5n,
          slippageMinor: 2n,
          otherCostMinor: 0n,
          namedExplicitly: true,
        },
        operatingResearchCostMinor: 0n,
        seed: 'aafv203',
        customerId: null,
      },
      {
        manifestId: manifest.manifestId,
        datasetId: manifest.datasetId ?? manifest.manifestId,
        strategyGenomeId: GENOME,
        strategyEvaluationId: manifest.strategyEvaluationId,
        compilerVersion: manifest.compilerVersion,
        contentHash: manifest.contentHash,
      },
    );
    assert.ok(sealedConfig.pointInTimeDatasetSeal);
  });

  it('emits HELIOS_AAFV2_03_POINT_IN_TIME_COMPILER_QUALIFIED when checks pass', () => {
    const qualification = evaluateAafv203Qualification({
      earningsAfterDecisionRejected: true,
      macroRevisionAfterDecisionRejected: true,
      futureIndexMembershipRejected: true,
      mergerAfterDecisionRejected: true,
      tickerMappingAfterDecisionRejected: true,
      providerArrivalAfterDecisionRejected: true,
      alternativeDataAfterDecisionRejected: true,
      finalMacroRevisionRejected: true,
      manifestReproducible: true,
      strategyLabSeamAcceptsManifest: true,
    });
    assert.equal(qualification.marker, HELIOS_AAFV2_03_POINT_IN_TIME_COMPILER_QUALIFIED);
  });
});
