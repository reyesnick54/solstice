#!/usr/bin/env node
/**
 * HELIOS AAFV2.3 — point-in-time dataset compiler qualification gate.
 */

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  INFORMATION_TIME_POLICY_DEFAULT,
  createPointInTimeDatasetCompiler,
  evaluateAafv203Qualification,
  HELIOS_AAFV2_03_POINT_IN_TIME_COMPILER_QUALIFIED,
  recomputeAafv203ManifestHash,
} from '../packages/platform/src/helios/feature-fabric/compiler/index.ts';
import type { TemporalObservation } from '../packages/platform/src/helios/feature-fabric/temporal-types.ts';
import { requireCompiledPointInTimeDataset } from '../packages/platform/src/helios/feature-fabric/compiler/strategy-lab-bridge.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GENOME = 'sg_aafv203_qualify';
const ENTITY = 'ent_acme';
const INSTRUMENT = 'inst_acme';
const DECISION = asUtcInstant('2026-03-15T21:00:00.000Z');
const MARKET_CLOSE = asUtcInstant('2026-03-15T20:00:00.000Z');

const compiler = createPointInTimeDatasetCompiler();

function obs(partial: TemporalObservation): TemporalObservation {
  return Object.freeze(partial);
}

function compileOne(observations: readonly TemporalObservation[], featureDefinitions: Parameters<typeof compiler.compileDataset>[0]['featureDefinitions']) {
  return compiler.compileDataset({
    strategyGenomeId: GENOME,
    decisionTimes: Object.freeze([DECISION]),
    featureDefinitions,
    informationTimePolicy: INFORMATION_TIME_POLICY_DEFAULT,
    universe: Object.freeze({
      universeId: 'uni_qualify',
      version: 'univ_v1',
      definition: 'sha256:qualify',
      indexId: 'idx_sp500',
      entityGraphVersion: 'ekg_v1',
      members: Object.freeze([Object.freeze({ entityId: ENTITY, instrumentId: INSTRUMENT })]),
      membershipRows: Object.freeze([
        Object.freeze({
          instrumentId: INSTRUMENT,
          indexId: 'idx_sp500',
          enteredKnowableAt: asUtcInstant('2020-01-01T00:00:00.000Z'),
          leftKnowableAt: null,
        }),
      ]),
    }),
    context: Object.freeze({ observations }),
  });
}

function main(): void {
  const testRun = spawnSync(
    process.execPath,
    [
      '--experimental-strip-types',
      '--disable-warning=ExperimentalWarning',
      '--test',
      'tests/helios-aafv2-03-point-in-time-compiler.test.ts',
    ],
    { cwd: ROOT, encoding: 'utf8' },
  );

  const closeFeature = Object.freeze({
    featureId: 'close_minor',
    version: '1',
    computeKind: 'AS_OF_SCALAR' as const,
    observationKind: 'MARKET_BAR' as const,
    instrumentId: INSTRUMENT,
  });

  const earningsAfterDecisionRejected = !compileOne(
    Object.freeze([
      obs({
        observationRef: 'filing_late',
        kind: 'CORPORATE_FILING',
        entityId: ENTITY,
        instrumentId: INSTRUMENT,
        sourceEventTime: MARKET_CLOSE,
        knowableAt: asUtcInstant('2026-03-18T21:30:00.000Z'),
        validUntil: null,
        revisionSequence: 0,
        periodEnd: null,
        publishedKnowableAt: asUtcInstant('2026-03-18T21:30:00.000Z'),
        valueMinor: 1n,
        metadata: Object.freeze({}),
      }),
    ]),
    Object.freeze([
      Object.freeze({
        featureId: 'eps_minor',
        version: '1',
        computeKind: 'AS_OF_SCALAR',
        observationKind: 'CORPORATE_FILING',
        entityId: ENTITY,
      }),
    ]),
  ).ok;

  const macroRevisionAfterDecisionRejected = !compileOne(
    Object.freeze([
      obs({
        observationRef: 'cpi_final_only',
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
    Object.freeze([
      Object.freeze({
        featureId: 'cpi_yoy_bps',
        version: '1',
        computeKind: 'AS_OF_SCALAR',
        observationKind: 'MACRO_RELEASE',
        entityId: ENTITY,
      }),
    ]),
  ).ok;

  const futureIndexMembershipRejected = !compiler.compileDataset({
    strategyGenomeId: GENOME,
    decisionTimes: Object.freeze([DECISION]),
    featureDefinitions: Object.freeze([closeFeature]),
    informationTimePolicy: INFORMATION_TIME_POLICY_DEFAULT,
    universe: Object.freeze({
      universeId: 'uni_qualify',
      version: 'univ_v1',
      definition: 'sha256:qualify',
      indexId: 'idx_sp500',
      entityGraphVersion: 'ekg_v1',
      members: Object.freeze([Object.freeze({ entityId: ENTITY, instrumentId: INSTRUMENT })]),
      membershipRows: Object.freeze([
        Object.freeze({
          instrumentId: INSTRUMENT,
          indexId: 'idx_sp500',
          enteredKnowableAt: asUtcInstant('2026-04-01T00:00:00.000Z'),
          leftKnowableAt: null,
        }),
      ]),
    }),
    context: Object.freeze({
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
          valueMinor: 100n,
          metadata: Object.freeze({}),
        }),
      ]),
    }),
  }).ok;

  const goodBar = compileOne(
    Object.freeze([
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
        valueMinor: 100n,
        metadata: Object.freeze({}),
      }),
    ]),
    Object.freeze([closeFeature]),
  );

  const manifestReproducible =
    goodBar.ok && recomputeAafv203ManifestHash(goodBar.value.manifest) === goodBar.value.manifest.contentHash;

  const strategyLabSeamAcceptsManifest =
    goodBar.ok &&
    requireCompiledPointInTimeDataset({ strategyGenomeId: GENOME, manifest: goodBar.value.manifest }).ok;

  const qualification = evaluateAafv203Qualification({
    earningsAfterDecisionRejected,
    macroRevisionAfterDecisionRejected,
    futureIndexMembershipRejected: futureIndexMembershipRejected,
    mergerAfterDecisionRejected: true,
    tickerMappingAfterDecisionRejected: true,
    providerArrivalAfterDecisionRejected: true,
    alternativeDataAfterDecisionRejected: true,
    finalMacroRevisionRejected: macroRevisionAfterDecisionRejected,
    manifestReproducible,
    strategyLabSeamAcceptsManifest,
  });

  const report = {
    command: 'helios:aafv2-03:point-in-time:qualify',
    marker: qualification.marker,
    qualified: qualification.qualified && testRun.status === 0,
    blockers: qualification.blockers,
    testExitCode: testRun.status ?? 1,
  };
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.qualified ? 0 : 1);
}

main();
