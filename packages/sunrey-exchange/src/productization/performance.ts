/**
 * Non-production Phase G performance / load baseline.
 * Records methodology. Does not invent a production SLA.
 */

import { asUtcInstant } from '../../../domain/src/time.ts';
import { DigitalAssetLifecycle } from './lifecycle.ts';

export type PerformanceSample = {
  readonly name: string;
  readonly iterations: number;
  readonly elapsedMs: number;
  readonly perOpMs: number;
};

export type PerformanceBaseline = {
  readonly schema: 'sunrey.phase-g.performance.v1';
  readonly environment: 'simulation';
  readonly productionSlaInvented: false;
  readonly productionSlaClaimed: false;
  readonly methodology: string;
  readonly samples: readonly PerformanceSample[];
};

const PHASE_G_PERF_NOW = asUtcInstant('2026-08-23T12:00:00.000Z');

export function measurePhaseGPerformance(): PerformanceBaseline {
  const world = new DigitalAssetLifecycle({ now: PHASE_G_PERF_NOW, participantId: 'perf_phase_g' });
  world.fundQuote();
  world.fundBase(20n);
  const created = world.createProposal({ side: 'BUY', quantity: 1n, notionalUsdMinor: '50000' });
  if ('ok' in created) {
    throw new Error(created.reason);
  }
  world.approveProposal({ proposalId: created.proposalId, actor: 'HUMAN', stepUpSatisfied: true });
  const samples = [
    measure('market_list', 40, () => {
      world.markets();
    }),
    measure('ticker', 40, () => {
      world.ticker();
    }),
    measure('order_book', 40, () => {
      world.orderBook();
    }),
    measure('order_preview', 20, () => {
      world.preview({ side: 'BUY', quantity: 1n });
    }),
    measure('order_submission_matching_settlement', 1, () => {
      world.submitOrder(created.proposalId, 'perf-buy-1');
    }),
    measure('wallet_read', 40, () => {
      world.wallet();
    }),
    measure('chain_rpc_and_explorer', 20, () => {
      world.sunreyCoin();
      world.engine.explorerPublicView(world.engine.getConsumerMarket(PHASE_G_PERF_NOW));
    }),
    measure('transaction_submission', 1, () => {
      world.simulateDeposit(2n);
    }),
    loadRead('market_stream_connections', 8, () => {
      world.stream();
    }),
    loadRead('rpc_reads', 16, () => {
      world.transactions();
    }),
  ];
  return Object.freeze({
    schema: 'sunrey.phase-g.performance.v1',
    environment: 'simulation',
    productionSlaInvented: false,
    productionSlaClaimed: false,
    methodology:
      'In-process DigitalAssetLifecycle on a single sandbox participant. Each named sample times sequential local calls. No external provider, no invented production SLA.',
    samples: Object.freeze(samples),
  });
}

export function measure(name: string, iterations: number, fn: () => void): PerformanceSample {
  const start = performance.now();
  for (let i = 0; i < iterations; i += 1) {
    fn();
  }
  const elapsedMs = performance.now() - start;
  return Object.freeze({
    name,
    iterations,
    elapsedMs,
    perOpMs: elapsedMs / iterations,
  });
}

export function loadRead(name: string, connections: number, fn: () => void): PerformanceSample {
  return measure(`${name}:${connections}`, connections, fn);
}
