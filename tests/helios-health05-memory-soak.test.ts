/**
 * HELIOS HEALTH05 — memory soak and bounded observation / execution-twin retention.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import { systemClock } from '../packages/config/src/clock.ts';
import {
  HELIOS_OBSERVATION_BUFFER_MAX_PER_INSTRUMENT,
  trimObservationHistory,
} from '../packages/platform/src/helios/observation/bounded-retention.ts';
import { fabricAt, ingestQuote, marketObservation } from '../packages/platform/src/helios/resilience/scenario-helpers.ts';
import { createHeliosPredictionMarketService } from '../packages/platform/src/helios/prediction-market/service.ts';
import {
  createPredictionMarketStore,
  emptyPredictionMarketStore,
} from '../packages/platform/src/helios/prediction-market/store.ts';
import { FIXTURE_CONDITION_FED_DEC, fixtureYesNoContracts } from '../packages/platform/src/helios/prediction-market/fixtures.ts';

describe('HELIOS HEALTH05 platform memory bounds', () => {
  it('trims observation history lists to the configured per-instrument maximum', () => {
    const rows: number[] = [];
    for (let i = 0; i < HELIOS_OBSERVATION_BUFFER_MAX_PER_INSTRUMENT + 10; i += 1) {
      rows.push(i);
    }
    trimObservationHistory(rows, HELIOS_OBSERVATION_BUFFER_MAX_PER_INSTRUMENT);
    assert.equal(rows.length, HELIOS_OBSERVATION_BUFFER_MAX_PER_INSTRUMENT);
    assert.equal(rows[0], 10);
  });

  it('bounds market-observation buffers per instrument in the observation store', () => {
    const fabric = fabricAt(asUtcInstant('2026-09-18T09:00:00.000Z'));
    for (let i = 0; i < HELIOS_OBSERVATION_BUFFER_MAX_PER_INSTRUMENT + 40; i += 1) {
      const result = ingestQuote(
        fabric,
        marketObservation({
          observationId: `obs_health05_${i}`,
          priceMinor: BigInt(100 + i),
        }),
        { sequence: i + 1 },
      );
      assert.equal(result.ok, true);
    }
    const listed = fabric.store().listByInstrument('SIM-ETF-1');
    assert.equal(listed.length, HELIOS_OBSERVATION_BUFFER_MAX_PER_INSTRUMENT);
    assert.equal(fabric.store().list().length, HELIOS_OBSERVATION_BUFFER_MAX_PER_INSTRUMENT);
  });

  it('caps execution-twin order history in the prediction market service store', () => {
    const store = createPredictionMarketStore(emptyPredictionMarketStore());
    const service = createHeliosPredictionMarketService({ clock: systemClock, store });
    service.loadSandboxFixtures();
    const yesInstrument = fixtureYesNoContracts().yes.instrumentId;
    for (let i = 0; i < 600; i += 1) {
      service.submitPaperTwinOrder({
        twinOrderId: `twin_${i}`,
        contractInstrumentId: yesInstrument,
        conditionId: FIXTURE_CONDITION_FED_DEC,
        side: 'BUY',
        outcomeSide: 'YES',
        quantityContracts: 1n,
      });
    }
    assert.equal(store.snapshot().twinOrders.length, 512);
  });
});
