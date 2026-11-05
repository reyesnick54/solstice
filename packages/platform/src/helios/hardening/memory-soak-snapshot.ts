/**
 * HELIOS HEALTH07 — optional integrated memory counters for sunrey-bench soak.
 * Simulation-only fixture store; not loaded during soak unless wired by the bench script.
 */

import { systemClock } from '../../../../config/src/clock.ts';
import { asUtcInstant } from '../../../../domain/src/time.ts';
import { fabricAt, ingestQuote, marketObservation } from '../resilience/scenario-helpers.ts';
import { createHeliosPredictionMarketService } from '../prediction-market/service.ts';
import {
  createPredictionMarketStore,
  emptyPredictionMarketStore,
} from '../prediction-market/store.ts';
import { FIXTURE_CONDITION_FED_DEC, fixtureYesNoContracts } from '../prediction-market/fixtures.ts';

export type HeliosIntegratedMemoryCounts = {
  readonly heliosObservations: number;
  readonly heliosTwinOrders: number;
  readonly heliosAgentSessions: number;
  readonly heliosResearchMonitors: number;
  readonly heliosEvidenceStagingBytes: number;
  readonly heliosStrategyEvaluations: number;
  readonly providerReconnectCycles: number;
};

export type HeliosIntegratedMemoryHarness = {
  readonly tick: (iteration: number) => void;
  readonly snapshot: () => HeliosIntegratedMemoryCounts;
};

export function createHeliosIntegratedMemoryHarness(): HeliosIntegratedMemoryHarness {
  const fabric = fabricAt(asUtcInstant('2026-09-18T09:00:00.000Z'));
  const store = createPredictionMarketStore(emptyPredictionMarketStore());
  const service = createHeliosPredictionMarketService({ clock: systemClock, store });
  service.loadSandboxFixtures();
  const yesInstrument = fixtureYesNoContracts().yes.instrumentId;
  let reconnectCycles = 0;
  let strategyEvaluations = 0;

  return Object.freeze({
    tick(iteration: number) {
      if (iteration % 11 !== 0) {
        return;
      }
      if (iteration % 550 === 0) {
        reconnectCycles += 1;
      }
      ingestQuote(
        fabric,
        marketObservation({
          observationId: `soak_obs_${iteration % 256}`,
          priceMinor: BigInt(100 + (iteration % 1000)),
        }),
        { sequence: iteration + 1 },
      );
      if (iteration % 33 === 0) {
        service.submitPaperTwinOrder({
          twinOrderId: `soak_twin_${Math.floor(iteration / 33) % 512}`,
          contractInstrumentId: yesInstrument,
          conditionId: FIXTURE_CONDITION_FED_DEC,
          side: 'BUY',
          outcomeSide: 'YES',
          quantityContracts: 1n,
        });
      }
      strategyEvaluations = (strategyEvaluations + 1) % 512;
    },
    snapshot(): HeliosIntegratedMemoryCounts {
      const snap = store.snapshot();
      return Object.freeze({
        heliosObservations: fabric.store().list().length,
        heliosTwinOrders: snap.twinOrders.length,
        heliosAgentSessions: 0,
        heliosResearchMonitors: 0,
        heliosEvidenceStagingBytes: 0,
        heliosStrategyEvaluations: strategyEvaluations,
        providerReconnectCycles: reconnectCycles,
      });
    },
  });
}
