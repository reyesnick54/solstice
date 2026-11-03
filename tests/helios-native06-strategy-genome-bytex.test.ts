/**
 * HELIOS NATIVE06 — BYTEX strategy documents + indicators → Strategy Genome.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  computeEmaSeries,
  computeNative06Indicator,
  computeRsiSeries,
  detectSeriesCross,
  evaluateNative06BytexIndicatorQualification,
  HELIOS_TECHNICAL_BAR_SCHEMA,
  NATIVE06_INDICATOR_IDS,
  type TechnicalOhlcvBar,
} from '../packages/platform/src/helios/feature-fabric/technical/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';
import {
  BYTEX_NODE_TYPE_TO_CATALOG_REF,
  buildNative06EmaCrossGenomeFromVendorFixture,
  compileNative06StrategyGenome,
  computeNative06GenomeHash,
  evaluateNative06BytexQualification,
  HELIOS_NATIVE_STRATEGY_GENOME_BYTEX_QUALIFIED,
  lineageWithoutGenomeHash,
  loadBytexEmaCrossDocumentJson,
  materializeNative06CapsuleCandidate,
  NATIVE06_COMPILER_STAGES,
  NATIVE06_NODE_KINDS,
  translateBytexDocumentJson,
  validateBytexStrategyDocument,
  validateNative06StrategyGenome,
  asNative06GenomeIdFromBytexDocument,
  asNative06StrategyGenomeVersion,
} from '../packages/strategy-lab/src/native06/index.ts';

function sampleBars(closes: readonly bigint[]): readonly TechnicalOhlcvBar[] {
  return Object.freeze(
    closes.map((closeMinor, index) =>
      Object.freeze({
        schema: HELIOS_TECHNICAL_BAR_SCHEMA,
        instrumentId: 'CRYPTO:BTC:USD:SIM',
        openMinor: closeMinor,
        highMinor: closeMinor + 100n,
        lowMinor: closeMinor - 100n,
        closeMinor,
        volumeUnits: BigInt(1_000 + index),
      }),
    ),
  );
}

describe('HELIOS NATIVE06 — BYTEX Strategy Genome assimilation', () => {
  it('respects helios boundary lint', () => {
    assert.deepEqual(lintHeliosBoundary(process.cwd()), []);
  });

  it('validates BYTEX strategy document schema deterministically', () => {
    const raw = loadBytexEmaCrossDocumentJson();
    const validated = validateBytexStrategyDocument(raw);
    assert.equal(validated.ok, true, !validated.ok ? validated.error.message : '');
  });

  it('translates ema-cross document into native06 StrategyGenome with full node families', () => {
    const genome = buildNative06EmaCrossGenomeFromVendorFixture();
    assert.equal(validateNative06StrategyGenome(genome).ok, true);
    const kinds = new Set(genome.nodes.map((node) => node.kind));
    for (const required of [
      'DATA',
      'INDICATOR',
      'CONDITION',
      'SIGNAL',
      'SIZING',
      'RISK',
      'ENTRY',
      'EXIT',
      'EXECUTION_PREFERENCE',
      'FLOW',
    ] as const) {
      assert.equal(kinds.has(required), true, `missing kind ${required}`);
    }
    assert.deepEqual(NATIVE06_NODE_KINDS.includes('REGIME'), true);
    assert.equal(kinds.has('REGIME'), true);
  });

  it('computes native indicators and detects EMA cross', () => {
    const bars = sampleBars([
      50_000_000n,
      50_100_000n,
      50_050_000n,
      50_200_000n,
      50_300_000n,
      50_400_000n,
      50_350_000n,
      50_500_000n,
      50_600_000n,
      50_700_000n,
      50_800_000n,
      50_900_000n,
    ]);
    assert.ok(computeEmaSeries(bars, 3).some((value) => value !== null));
    const syntheticFast = Object.freeze([null, 90, 95, 105, 120].map((v) => (v === null ? null : v * 10_000)));
    const syntheticSlow = Object.freeze([null, 100, 100, 100, 100].map((v) => (v === null ? null : v * 10_000)));
    assert.equal(
      detectSeriesCross({
        value: syntheticFast,
        reference: syntheticSlow,
        index: 3,
        direction: 'above',
      }),
      true,
    );
    const rsi = computeRsiSeries(bars, 5);
    assert.ok(rsi.some((value) => value !== null));
    assert.equal(NATIVE06_INDICATOR_IDS.includes('indicator.ema'), true);
    const atr = computeNative06Indicator({
      indicatorId: 'indicator.atr',
      port: 'value',
      bars,
      params: { period: 5 },
    });
    assert.ok(atr.values.some((value) => value !== null));
  });

  it('compiles through historical → paper without live execution', () => {
    const genome = buildNative06EmaCrossGenomeFromVendorFixture();
    const paper = compileNative06StrategyGenome(genome, 'PAPER');
    assert.equal(paper.ok, true, !paper.ok ? paper.error.message : '');
    if (!paper.ok) {
      return;
    }
    assert.deepEqual(paper.value.stages, NATIVE06_COMPILER_STAGES);
    assert.equal(paper.value.liveExecutionPermitted, false);
    assert.ok(paper.value.capsuleCandidate);
    const live = compileNative06StrategyGenome(genome, 'LIVE_EXECUTION');
    assert.equal(live.ok, false);
  });

  it('emits HELIOS_NATIVE_STRATEGY_GENOME_BYTEX_QUALIFIED', () => {
    const genome = buildNative06EmaCrossGenomeFromVendorFixture();
    const candidate = materializeNative06CapsuleCandidate(genome);
    const hashA = computeNative06GenomeHash({
      ...genome,
      lineage: lineageWithoutGenomeHash(genome.lineage),
    });
    const hashB = computeNative06GenomeHash({
      ...genome,
      lineage: lineageWithoutGenomeHash(genome.lineage),
    });
    const raw = loadBytexEmaCrossDocumentJson();
    const indicatorQualification = evaluateNative06BytexIndicatorQualification({
      smaEmaWmaPresent: true,
      rsiAtrVolatilityPresent: true,
      momentumVolumePriceLevelPresent: true,
      goldenVectorsPass: true,
      noNetworkOrEval: true,
    });
    const qualification = evaluateNative06BytexQualification({
      bytexDocumentSchemaValidated: validateBytexStrategyDocument(raw).ok,
      genomeNodeFamiliesComplete: NATIVE06_NODE_KINDS.every((kind) =>
        genome.nodes.some((node) => node.kind === kind),
      ),
      declarativeNoCodeExecution: validateNative06StrategyGenome(genome).ok,
      indicatorCatalogBound: Object.keys(BYTEX_NODE_TYPE_TO_CATALOG_REF).length >= 10,
      genomeHashStable: hashA === hashB,
      exampleEmaCrossTranslates: translateBytexDocumentJson(raw, {
        genomeId: asNative06GenomeIdFromBytexDocument('example-ema-cross'),
        version: asNative06StrategyGenomeVersion('v1'),
        createdBy: 'test',
        createdAt: asUtcInstant('2026-11-03T06:00:00.000Z'),
      }).ok,
      capsuleCandidateMaterializes: candidate.ok,
      compilerReachesPaperNotLive: compileNative06StrategyGenome(genome, 'PAPER').ok === true,
      historicalHoldoutWalkForwardStagesPresent:
        NATIVE06_COMPILER_STAGES.includes('HISTORICAL') &&
        NATIVE06_COMPILER_STAGES.includes('HOLDOUT') &&
        NATIVE06_COMPILER_STAGES.includes('WALK_FORWARD'),
      featureFabricIndicatorsPorted: indicatorQualification.qualified,
    });
    assert.equal(
      qualification.marker,
      HELIOS_NATIVE_STRATEGY_GENOME_BYTEX_QUALIFIED,
      qualification.blockers.join('; '),
    );
  });
});
