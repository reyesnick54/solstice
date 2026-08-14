import type { Actor, CustomerId, UtcInstant } from '@solstice/domain';
import { asCustomerId, asUtcInstant } from '@solstice/domain';
import { MatchingEngine } from './matching.ts';
import { mintClearedOrder } from './cleared-order.ts';
import type { KernelAuthorization } from '@solstice/kernel';
import { runAllDetectors, type SurveillanceAlert } from './surveillance.ts';
import type { Order, OrderSide } from './types.ts';
import { PYR_USD } from './types.ts';

export type ReplayScenarioName = 'WASH_TRADE' | 'SPOOFING' | 'LAYERING' | 'COORDINATED';

export type ReplayResult = {
  readonly scenario: ReplayScenarioName;
  readonly alerts: readonly SurveillanceAlert[];
  readonly detected: boolean;
  readonly expectedType: SurveillanceAlert['type'];
};

const NOW = asUtcInstant('2026-08-14T12:00:00.000Z');

function fakeAuth(): KernelAuthorization {
  return {
    intentId: 'int_replay' as KernelAuthorization['intentId'],
    kind: 'PLACE_ORDER',
    posture: 'CLEAR',
    permitHash: 'a'.repeat(64),
    issuedAt: NOW,
    evidenceId: 'ev_replay',
    __kernelBrand: 'KernelAuthorization',
  };
}

function order(input: {
  readonly id: string;
  readonly customerId: CustomerId;
  readonly side: OrderSide;
  readonly quantity: bigint;
  readonly price?: bigint;
  readonly type?: Order['type'];
  readonly state?: Order['state'];
  readonly sequence: number;
  readonly group?: string;
}): Order {
  return Object.freeze({
    id: input.id,
    customerId: input.customerId,
    customerName: String(input.customerId),
    jurisdiction: 'GB',
    pair: PYR_USD,
    side: input.side,
    type: input.type ?? 'LIMIT',
    quantity: input.quantity,
    remaining: input.quantity,
    price: input.price,
    timeInForce: 'GTC',
    state: input.state ?? 'NEW',
    createdAt: NOW,
    updatedAt: NOW,
    sequence: input.sequence,
    ...(input.group === undefined ? {} : { coordinationGroup: input.group }),
  });
}

function submit(engine: MatchingEngine, draft: Order): void {
  const cleared = mintClearedOrder(draft, {
    clearanceId: `clr_${draft.id}`,
    evidenceId: 'ev_replay',
    authorization: fakeAuth(),
    checks: Object.freeze(['replay_harness']),
  });
  engine.accept(cleared);
}

/**
 * Scripted manipulation replay. Identical input produces identical alerts.
 * Uses the matching engine for live sequences; detectors are deterministic.
 */
export function runManipulationReplay(seed = 'phase9-replay-v1'): readonly ReplayResult[] {
  return Object.freeze([
    runWash(seed),
    runSpoof(seed),
    runLayer(seed),
    runCoordinated(seed),
  ]);
}

function runWash(seed: string): ReplayResult {
  const engine = new MatchingEngine(`${seed}:wash`);
  const a = asCustomerId('cust_wash_a');
  const b = asCustomerId('cust_wash_b');
  submit(engine, order({ id: 'w1', customerId: a, side: 'SELL', quantity: 100n, price: 20000n, sequence: 1 }));
  submit(engine, order({ id: 'w2', customerId: b, side: 'BUY', quantity: 100n, price: 20000n, sequence: 2 }));
  submit(engine, order({ id: 'w3', customerId: b, side: 'SELL', quantity: 100n, price: 20000n, sequence: 3 }));
  submit(engine, order({ id: 'w4', customerId: a, side: 'BUY', quantity: 100n, price: 20000n, sequence: 4 }));
  const alerts = runAllDetectors(
    [...engine.listResting(), ...['w1', 'w2', 'w3', 'w4'].map((id) => engine.getOrder(id)!).filter(Boolean)],
    engine.listFills(),
    { [a]: 'wash-ring', [b]: 'wash-ring' },
  );
  const hits = alerts.filter((alert) => alert.type === 'WASH_TRADING' || alert.type === 'COORDINATED_ACCOUNTS');
  return Object.freeze({
    scenario: 'WASH_TRADE',
    alerts: hits,
    detected: hits.length > 0,
    expectedType: 'WASH_TRADING',
  });
}

function runSpoof(seed: string): ReplayResult {
  const engine = new MatchingEngine(`${seed}:spoof`);
  const spoof = asCustomerId('cust_spoof');
  const other = asCustomerId('cust_spoof_other');
  submit(engine, order({ id: 's1', customerId: spoof, side: 'SELL', quantity: 800n, price: 21000n, sequence: 1 }));
  submit(engine, order({ id: 's1', customerId: spoof, side: 'SELL', quantity: 800n, price: 21000n, type: 'CANCEL', sequence: 2 }));
  submit(engine, order({ id: 's2', customerId: other, side: 'SELL', quantity: 50n, price: 20000n, sequence: 3 }));
  submit(engine, order({ id: 's3', customerId: spoof, side: 'BUY', quantity: 50n, price: 20000n, sequence: 4 }));
  const orders = ['s1', 's2', 's3'].map((id) => engine.getOrder(id)).filter((row): row is Order => row !== undefined);
  const alerts = runAllDetectors(orders, engine.listFills());
  const hits = alerts.filter((alert) => alert.type === 'SPOOFING');
  return Object.freeze({
    scenario: 'SPOOFING',
    alerts: hits,
    detected: hits.length > 0,
    expectedType: 'SPOOFING',
  });
}

function runLayer(seed: string): ReplayResult {
  const engine = new MatchingEngine(`${seed}:layer`);
  const layer = asCustomerId('cust_layer');
  const other = asCustomerId('cust_layer_other');
  submit(engine, order({ id: 'l1', customerId: layer, side: 'BUY', quantity: 40n, price: 19900n, sequence: 1 }));
  submit(engine, order({ id: 'l2', customerId: layer, side: 'BUY', quantity: 40n, price: 19800n, sequence: 2 }));
  submit(engine, order({ id: 'l3', customerId: layer, side: 'BUY', quantity: 40n, price: 19700n, sequence: 3 }));
  submit(engine, order({ id: 'l1', customerId: layer, side: 'BUY', quantity: 40n, type: 'CANCEL', sequence: 4 }));
  submit(engine, order({ id: 'l2', customerId: layer, side: 'BUY', quantity: 40n, type: 'CANCEL', sequence: 5 }));
  submit(engine, order({ id: 'l3', customerId: layer, side: 'BUY', quantity: 40n, type: 'CANCEL', sequence: 6 }));
  submit(engine, order({ id: 'l4', customerId: other, side: 'BUY', quantity: 20n, price: 20100n, sequence: 7 }));
  submit(engine, order({ id: 'l5', customerId: layer, side: 'SELL', quantity: 20n, price: 20100n, sequence: 8 }));
  const orders = ['l1', 'l2', 'l3', 'l4', 'l5']
    .map((id) => engine.getOrder(id))
    .filter((row): row is Order => row !== undefined);
  const alerts = runAllDetectors(orders, engine.listFills());
  const hits = alerts.filter((alert) => alert.type === 'LAYERING');
  return Object.freeze({
    scenario: 'LAYERING',
    alerts: hits,
    detected: hits.length > 0,
    expectedType: 'LAYERING',
  });
}

function runCoordinated(seed: string): ReplayResult {
  const engine = new MatchingEngine(`${seed}:coord`);
  const a = asCustomerId('cust_coord_a');
  const b = asCustomerId('cust_coord_b');
  submit(engine, order({ id: 'c1', customerId: a, side: 'SELL', quantity: 75n, price: 20500n, sequence: 1, group: 'ring-7' }));
  submit(engine, order({ id: 'c2', customerId: b, side: 'BUY', quantity: 75n, price: 20500n, sequence: 2, group: 'ring-7' }));
  const alerts = runAllDetectors(
    ['c1', 'c2'].map((id) => engine.getOrder(id)!),
    engine.listFills(),
    { [a]: 'ring-7', [b]: 'ring-7' },
  );
  const hits = alerts.filter((alert) => alert.type === 'COORDINATED_ACCOUNTS');
  return Object.freeze({
    scenario: 'COORDINATED',
    alerts: hits,
    detected: hits.length > 0,
    expectedType: 'COORDINATED_ACCOUNTS',
  });
}

export function assertReplayDetectsAll(results: readonly ReplayResult[] = runManipulationReplay()): void {
  for (const result of results) {
    if (!result.detected) {
      throw new Error(`Replay scenario ${result.scenario} was not detected`);
    }
  }
}

export type { Actor, UtcInstant };
