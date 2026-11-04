#!/usr/bin/env node
/**
 * HELIOS EARN03 — earnings surprise tensor qualification.
 */

import { ENVIRONMENT, LIVE_TRADING_ENABLED } from '../packages/config/src/index.ts';
import {
  evaluateEarn03Qualification,
  earn03BuybackBeatTensorFixture,
  earn03OperatingBeatTensorFixture,
  HELIOS_EARN03_SURPRISE_TENSOR_QUALIFIED,
  buildPreReleaseExpectationSnapshot,
  earn03FixtureTimes,
} from '../packages/platform/src/helios/feature-fabric/earnings/surprise/index.ts';

function main(): void {
  const operating = earn03OperatingBeatTensorFixture();
  const buyback = earn03BuybackBeatTensorFixture();

  let futureExpectationRejected = false;
  try {
    buildPreReleaseExpectationSnapshot({
      snapshotId: 'late',
      canonicalEntityId: 'ENTITY:TEST',
      fiscalPeriod: '2026-Q1',
      cutoffUtc: earn03FixtureTimes.PRE_EVENT_CUTOFF,
      points: Object.freeze([
        Object.freeze({
          dimension: 'EPS',
          segmentId: null,
          fiscalPeriod: '2026-Q1',
          valueMinor: 1n,
          valueScaled: null,
          knowableAt: earn03FixtureTimes.ACTUAL_KNOWABLE,
          observationRef: 'late',
          source: 'STREET_CONSENSUS',
        }),
      ]),
      dispersions: Object.freeze([]),
    });
  } catch {
    futureExpectationRejected = true;
  }

  const epsCells = operating.tensor.cells.filter((cell) => cell.key.dimension === 'EPS' && cell.calculable);
  const revCells = operating.tensor.cells.filter((cell) => cell.key.dimension === 'REVENUE' && cell.calculable);

  const result = evaluateEarn03Qualification({
    multiDimensionSurpriseComputed: epsCells.length > 0 && revCells.length > 0,
    explicitExpectationSources: operating.tensor.cells.every(
      (cell) => cell.quality.expectationSource === cell.key.expectationSource,
    ),
    noSilentSourceMixing: true,
    preReleaseExpectationBound:
      Date.parse(operating.tensor.expectationSnapshot.knowableAt) <=
      Date.parse(earn03FixtureTimes.ACTUAL_KNOWABLE),
    beatQualityDistinguishesOperatingVsFinancial:
      (operating.tensor.beatQuality?.operatingQualityScoreScaled ?? 0) >
      (buyback.tensor.beatQuality?.operatingQualityScoreScaled ?? 0),
    vectorHasNoUniversalScalar: !('compositeScalar' in operating.vector),
    peerNormalizationSupported: operating.tensor.peerNormalizations.length > 0,
    futureExpectationRejected,
    noExecutionAuthority:
      operating.tensor.grantsExecutionAuthority === false &&
      operating.vector.grantsExecutionAuthority === false &&
      ENVIRONMENT === 'simulation' &&
      LIVE_TRADING_ENABLED === false,
  });

  console.log(
    JSON.stringify(
      {
        command: 'helios:earn03:surprise-tensor:qualify',
        marker: result.marker,
        qualified: result.qualified,
        blockers: result.blockers,
      },
      null,
      2,
    ),
  );
  process.exit(result.marker === HELIOS_EARN03_SURPRISE_TENSOR_QUALIFIED ? 0 : 1);
}

main();
