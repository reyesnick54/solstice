/**
 * HELIOS NATIVE07 — OpenChart market analytics nativeization qualification.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  applyFeedBarUpdate,
  applyFeedSnapshot,
  asFeedVersion,
  buildPointSeries,
  computeSma,
  evaluateAlertableCondition,
  evaluateOpenChartAnalyticsQualification,
  FROM_POINTS_PARITY,
  HELIOS_NATIVE_OPENCHART_ANALYTICS_QUALIFIED,
  isTeaAlertTypeId,
  NATIVE_STUDY_CATALOG,
  OPENCHART_NATIVE_STUDY_IDS,
  OPENCHART_UPSTREAM_SHA,
  smaSeriesViaStreaming,
  streamingMatchesBatchSma,
  TEA_SMA_LENGTH2_CLOSES,
  TEA_SMA_LENGTH2_EXPECTED,
  TEA_SMA_WINDOWED_EXPECTED,
  teaRunSampleBars,
  validateMarketLogicExpression,
} from '../packages/platform/src/helios/feature-fabric/openchart-analytics/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';
import {
  buildOpenChartFeatureNode,
  OPENCHART_GENOME_STUDY_REFS,
  OPENCHART_PARITY_UPSTREAM_SHA,
  OPENCHART_TEA_SMA_LENGTH2_EXPECTED,
} from '../packages/strategy-lab/src/openchart-analytics/index.ts';

function assertDeepEqualNumbers(actual: readonly number[], expected: readonly number[]) {
  assert.equal(actual.length, expected.length);
  for (let i = 0; i < actual.length; i += 1) {
    const a = actual[i]!;
    const e = expected[i]!;
    if (Number.isNaN(e)) {
      assert.ok(Number.isNaN(a), `index ${i}: expected NaN, got ${a}`);
    } else {
      assert.equal(a, e);
    }
  }
}

describe('HELIOS NATIVE07 OpenChart analytics', () => {
  it('pins upstream OpenChart SHA for parity contract', () => {
    assert.equal(OPENCHART_UPSTREAM_SHA, OPENCHART_PARITY_UPSTREAM_SHA);
  });

  it('passes HELIOS boundary guard', () => {
    assert.deepEqual(lintHeliosBoundary(process.cwd()), []);
  });

  it('matches OpenChart fromPoints scalar semantics', () => {
    const series = buildPointSeries(FROM_POINTS_PARITY.labels, FROM_POINTS_PARITY.input);
    assert.deepEqual(
      series.rows.map((row) => row.close),
      FROM_POINTS_PARITY.expectedClose,
    );
    assert.deepEqual(
      series.rows.map((row) => row.final),
      FROM_POINTS_PARITY.expectedFinal,
    );
    assert.deepEqual(
      series.rows.map((row) => row.note),
      FROM_POINTS_PARITY.expectedNote,
    );
  });

  it('matches OpenChart tea-run ta.sma(close, 2) on [10, 20, 30]', () => {
    const closes = [...TEA_SMA_LENGTH2_CLOSES];
    const sma = computeSma(closes, 2);
    assertDeepEqualNumbers(sma, TEA_SMA_LENGTH2_EXPECTED);
    assertDeepEqualNumbers(sma, [...OPENCHART_TEA_SMA_LENGTH2_EXPECTED]);
  });

  it('matches windowed sma sample (full.slice(1))', () => {
    const closes = [...TEA_SMA_LENGTH2_CLOSES].slice(1);
    const sma = computeSma(closes, 2);
    assertDeepEqualNumbers(sma, TEA_SMA_WINDOWED_EXPECTED);
  });

  it('streaming SMA state matches batch SMA', () => {
    assert.ok(streamingMatchesBatchSma([...TEA_SMA_LENGTH2_CLOSES], 2));
    assertDeepEqualNumbers(smaSeriesViaStreaming([...TEA_SMA_LENGTH2_CLOSES], 2), TEA_SMA_LENGTH2_EXPECTED);
  });

  it('feed snapshot then update applies bar revisions', () => {
    const version = asFeedVersion('feed-v1');
    const bars = teaRunSampleBars([10, 20]);
    let state = applyFeedSnapshot(null, { version, bars, complete: true });
    assert.equal(state.bars.length, 2);
    state = applyFeedBarUpdate(state, {
      version,
      final: false,
      bar: { ...bars[1]!, close: 21, high: 21, open: 21, low: 21 },
    });
    assert.equal(state.bars[1]?.close, 21);
    state = applyFeedBarUpdate(state, {
      version,
      final: true,
      bar: { ...bars[1]!, timeMs: bars[1]!.timeMs, close: 22, high: 22, open: 22, low: 22 },
    });
    assert.equal(state.bars[1]?.close, 22);
  });

  it('evaluates alertable crossover condition on final bar', () => {
    const bars = teaRunSampleBars([20, 25, 30]);
    const result = evaluateAlertableCondition(
      {
        alertId: 'cross',
        title: 'Cross',
        message: 'Price crossed threshold',
        requireFinalBar: true,
        when: {
          kind: 'binary',
          op: 'crossover',
          left: { kind: 'value', ref: { kind: 'bar', field: 'close' } },
          right: { kind: 'value', ref: { kind: 'literal', value: 22 } },
        },
      },
      bars,
      1,
    );
    assert.equal(result.fired, true);
    assert.equal(result.events.length, 1);
  });

  it('recognizes Tea alert nominal type ids', () => {
    assert.equal(isTeaAlertTypeId('visual.Alert'), true);
    assert.equal(isTeaAlertTypeId('visual.AlertEvent<Breakout>'), true);
    assert.equal(isTeaAlertTypeId('visual.Line'), false);
  });

  it('validates bounded market logic expressions', () => {
    const valid = validateMarketLogicExpression({
      kind: 'binary',
      op: 'and',
      left: { kind: 'value', ref: { kind: 'bar', field: 'close' } },
      right: { kind: 'value', ref: { kind: 'literal', value: 1 } },
    });
    assert.equal(valid.ok, true);
  });

  it('exposes native study catalog aligned with OpenChart builtins subset', () => {
    for (const id of OPENCHART_NATIVE_STUDY_IDS) {
      assert.ok(NATIVE_STUDY_CATALOG[id]);
    }
    assert.equal(NATIVE_STUDY_CATALOG.sma.name, 'SMA');
  });

  it('Strategy Genome bridge uses stable openchart.native catalog refs', () => {
    const node = buildOpenChartFeatureNode({
      nodeId: 'feat_sma',
      study: 'sma',
      length: 14,
      outputRef: 'sma14',
    });
    assert.equal(node.catalogRef, OPENCHART_GENOME_STUDY_REFS.sma);
    assert.equal(node.params.length, 14);
  });

  it('qualifies HELIOS_NATIVE_OPENCHART_ANALYTICS_QUALIFIED', () => {
    const result = evaluateOpenChartAnalyticsQualification({
      timeseriesParity: true,
      smaParity: true,
      streamingFeatureState: true,
      marketLogicTreeValidated: true,
      alertableCondition: true,
      feedSnapshotUpdate: true,
      studyCatalogPresent: true,
      noEvalOrDynamicCode: true,
    });
    assert.equal(result.marker, HELIOS_NATIVE_OPENCHART_ANALYTICS_QUALIFIED);
    assert.equal(result.qualified, true);
    assert.deepEqual(result.blockers, []);
  });
});
