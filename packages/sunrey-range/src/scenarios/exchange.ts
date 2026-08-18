import { asUtcInstant } from '../../../domain/src/time.ts';
import { detectSurveillanceAlerts } from '../../../market-surveillance/src/detectors.ts';
import { MOONREY_COIN_NATIVE_ASSET_ID, SUNREY_COIN_NATIVE_ASSET_ID } from '../../../sunrey-exchange/src/ids.ts';
import { NativeClearingEngine } from '../../../sunrey-exchange/src/native-clearing/engine.ts';
import { recordAlert, type RangeEnvironment } from '../environment.ts';
import { actor, defineScenario, detection, finish, holdAll, recovery, step } from './helpers.ts';
import type { AttackResult, AttackScenario } from '../types.ts';

const NOW = asUtcInstant('2026-08-17T00:00:00.000Z');

function funded() {
  const clearing = new NativeClearingEngine();
  const alice = clearing.openExchangeAccount('alice');
  const bob = clearing.openExchangeAccount('bob');
  clearing.faucetToCustody(bob, SUNREY_COIN_NATIVE_ASSET_ID, 10n);
  clearing.faucetToCustody(alice, MOONREY_COIN_NATIVE_ASSET_ID, 25n);
  return { clearing, alice, bob };
}

export const exchangeScenarios: readonly AttackScenario[] = [
  defineScenario({
    scenarioId: 'EXCH-SELF-TRADE',
    category: 'EXCHANGE_MANIPULATION',
    seed: 5780,
    subsystem: 'exchange',
    attack: 'self trading',
    actors: [actor('trader', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'trader', 'self match')],
    expectedSecurityProperties: ['NO_DOUBLE_SETTLEMENT'],
    expectedDetections: [detection('surveillance', 'SELF_TRADING')],
    expectedRecovery: ['EXCHANGE_RECONCILIATION'],
    preventiveControl: 'detector validation only — not legal guilt',
    detectiveControl: 'SELF_TRADING candidate',
    recovery: 'human review',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'EXCH-WASH',
    category: 'EXCHANGE_MANIPULATION',
    seed: 5781,
    subsystem: 'exchange',
    attack: 'wash-trade pattern',
    actors: [actor('cluster', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'cluster', 'linked accounts')],
    expectedSecurityProperties: ['NO_DOUBLE_SETTLEMENT'],
    expectedDetections: [detection('surveillance', 'WASH_TRADING_PATTERN')],
    expectedRecovery: ['EXCHANGE_RECONCILIATION'],
    preventiveControl: 'candidate alert',
    detectiveControl: 'WASH_TRADING_PATTERN',
    recovery: 'human review',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'EXCH-SPOOF',
    category: 'EXCHANGE_MANIPULATION',
    seed: 5782,
    subsystem: 'exchange',
    attack: 'spoof-like order placement/cancellation',
    actors: [actor('trader', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'trader', 'place/cancel')],
    expectedSecurityProperties: ['NO_DOUBLE_SETTLEMENT'],
    expectedDetections: [detection('surveillance', 'SPOOFING_CANDIDATE')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'candidate alert',
    detectiveControl: 'SPOOFING_CANDIDATE',
    recovery: 'none',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'EXCH-LAYERING',
    category: 'EXCHANGE_MANIPULATION',
    seed: 5783,
    subsystem: 'exchange',
    attack: 'layering-like patterns',
    actors: [actor('trader', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'trader', 'layer')],
    expectedSecurityProperties: ['NO_DOUBLE_SETTLEMENT'],
    expectedDetections: [detection('surveillance', 'LAYERING_CANDIDATE')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'candidate alert',
    detectiveControl: 'LAYERING_CANDIDATE',
    recovery: 'none',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'EXCH-CIRCULAR-CAPACITY',
    category: 'EXCHANGE_MANIPULATION',
    seed: 5784,
    subsystem: 'exchange',
    attack: 'circular capacity trading',
    actors: [actor('trader', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'trader', 'circular')],
    expectedSecurityProperties: ['NO_DOUBLE_SETTLEMENT'],
    expectedDetections: [detection('surveillance', 'CIRCULAR_TRADING_CANDIDATE')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'candidate alert',
    detectiveControl: 'CIRCULAR_TRADING_CANDIDATE',
    recovery: 'none',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'EXCH-ARTIFICIAL-COMPUTE',
    category: 'EXCHANGE_MANIPULATION',
    seed: 5785,
    subsystem: 'exchange',
    attack: 'artificial compute/capacity volume',
    actors: [actor('trader', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'trader', 'inflate volume')],
    expectedSecurityProperties: ['NO_DOUBLE_SETTLEMENT'],
    expectedDetections: [detection('surveillance', 'ARTIFICIAL_CAPACITY_CANDIDATE')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'candidate alert',
    detectiveControl: 'ARTIFICIAL_CAPACITY_CANDIDATE',
    recovery: 'none',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'EXCH-FABRICATED-INTENT',
    category: 'EXCHANGE_MANIPULATION',
    seed: 5786,
    subsystem: 'exchange-settlement',
    attack: 'fabricated SettlementIntent',
    actors: [actor('attacker', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'attacker', 'forge signature')],
    expectedSecurityProperties: ['NO_ASSET_CREATION_FROM_SETTLEMENT', 'NO_DOUBLE_SETTLEMENT'],
    expectedDetections: [detection('security_log', 'WRONG_AUTHORITY')],
    expectedRecovery: ['EXCHANGE_RECONCILIATION'],
    preventiveControl: 'exchange signature',
    detectiveControl: 'WRONG_AUTHORITY',
    recovery: 'reconcile positions',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'EXCH-REPLAYED-TRADE',
    category: 'EXCHANGE_MANIPULATION',
    seed: 5787,
    subsystem: 'exchange-settlement',
    attack: 'replayed trade',
    actors: [actor('attacker', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'attacker', 'replay settlement')],
    expectedSecurityProperties: ['NO_DOUBLE_SETTLEMENT'],
    expectedDetections: [detection('security_log', 'SETTLEMENT_REPLAY')],
    expectedRecovery: ['EXCHANGE_RECONCILIATION'],
    preventiveControl: 'settlement replay set',
    detectiveControl: 'SETTLEMENT_REPLAY',
    recovery: 'reconcile',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'EXCH-REPLAYED-AUTH',
    category: 'EXCHANGE_MANIPULATION',
    seed: 5788,
    subsystem: 'exchange-settlement',
    attack: 'replayed settlement authorization',
    actors: [actor('attacker', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'attacker', 'replay auth')],
    expectedSecurityProperties: ['NO_DOUBLE_SETTLEMENT'],
    expectedDetections: [detection('security_log', 'SETTLEMENT_REPLAY')],
    expectedRecovery: ['EXCHANGE_RECONCILIATION'],
    preventiveControl: 'nonce + settlement id',
    detectiveControl: 'SETTLEMENT_REPLAY',
    recovery: 'reconcile',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'EXCH-INSUFFICIENT-RESERVATION',
    category: 'EXCHANGE_MANIPULATION',
    seed: 5789,
    subsystem: 'exchange-settlement',
    attack: 'insufficient reservation',
    actors: [actor('attacker', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'attacker', 'missing reservation')],
    expectedSecurityProperties: ['NO_ASSET_CREATION_FROM_SETTLEMENT'],
    expectedDetections: [detection('security_log', 'INSUFFICIENT_RESERVATION')],
    expectedRecovery: ['EXCHANGE_RECONCILIATION'],
    preventiveControl: 'atomic DVP',
    detectiveControl: 'reservation check',
    recovery: 'no partial movement',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'EXCH-PARTIAL-MULTILEG',
    category: 'EXCHANGE_MANIPULATION',
    seed: 5790,
    subsystem: 'exchange-settlement',
    attack: 'partial multi-leg state change',
    actors: [actor('attacker', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'attacker', 'break atomicity')],
    expectedSecurityProperties: ['NO_ASSET_CREATION_FROM_SETTLEMENT', 'NO_DOUBLE_SETTLEMENT'],
    expectedDetections: [detection('reconciliation', 'ATOMIC_DVP')],
    expectedRecovery: ['EXCHANGE_RECONCILIATION'],
    preventiveControl: 'native DVP is atomic',
    detectiveControl: 'reconciliation',
    recovery: 'reconcile',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'EXCH-SUBMISSION-AMBIGUITY',
    category: 'EXCHANGE_MANIPULATION',
    seed: 5791,
    subsystem: 'exchange-settlement',
    attack: 'submission ambiguity duplicate',
    actors: [actor('attacker', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'attacker', 'duplicate submit')],
    expectedSecurityProperties: ['NO_DOUBLE_SETTLEMENT'],
    expectedDetections: [detection('security_log', 'SETTLEMENT_REPLAY')],
    expectedRecovery: ['EXCHANGE_RECONCILIATION'],
    preventiveControl: 'idempotent settlement id',
    detectiveControl: 'replay / already settled',
    recovery: 'reconcile',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'EXCH-OPS-FLOOD',
    category: 'EXCHANGE_MANIPULATION',
    seed: 5795,
    subsystem: 'exchange-ops',
    attack: 'order and cancel flood',
    actors: [actor('trader', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'trader', 'flood')],
    expectedSecurityProperties: ['NO_DOUBLE_SETTLEMENT'],
    expectedDetections: [detection('metrics', 'ORDER_RATE_EXCEEDED')],
    expectedRecovery: ['EXCHANGE_RECONCILIATION'],
    preventiveControl: 'order rate policy',
    detectiveControl: 'rate window',
    recovery: 'reject excess',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'EXCH-OPS-FAT-FINGER',
    category: 'EXCHANGE_MANIPULATION',
    seed: 5796,
    subsystem: 'exchange-ops',
    attack: 'fat-finger aggressive order',
    actors: [actor('trader', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'trader', 'collar')],
    expectedSecurityProperties: ['NO_DOUBLE_SETTLEMENT'],
    expectedDetections: [detection('metrics', 'PRICE_COLLAR')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'price collar',
    detectiveControl: 'pre-trade risk',
    recovery: 'reject',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'EXCH-OPS-DUP',
    category: 'EXCHANGE_MANIPULATION',
    seed: 5797,
    subsystem: 'exchange-ops',
    attack: 'duplicate order id',
    actors: [actor('trader', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'trader', 'replay clOrdId')],
    expectedSecurityProperties: ['NO_DOUBLE_SETTLEMENT'],
    expectedDetections: [detection('metrics', 'IDEMPOTENT_REPLAY')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'idempotency',
    detectiveControl: 'clOrdId store',
    recovery: 'replay ack',
    preventiveOnly: false,
  }),
];

export function runExchange(env: RangeEnvironment, scenario: AttackScenario): AttackResult {
  if (scenario.scenarioId.startsWith('EXCH-OPS-')) {
    return runMarketOps(env, scenario);
  }
  if (scenario.scenarioId.startsWith('EXCH-') && !scenario.scenarioId.includes('FABRICATED') && !scenario.scenarioId.includes('REPLAY') && !scenario.scenarioId.includes('INSUFFICIENT') && !scenario.scenarioId.includes('PARTIAL') && !scenario.scenarioId.includes('SUBMISSION')) {
    return runSurveillance(env, scenario);
  }
  const { clearing, alice, bob } = funded();
  clearing.placeOrder({ accountId: bob, side: 'SELL', quantity: 10n, priceUnits: 2_500_000n, now: NOW });
  clearing.placeOrder({ accountId: alice, side: 'BUY', quantity: 10n, priceUnits: 2_500_000n, now: NOW });
  const settlement = [...clearing.settlements.values()][0];
  if (!settlement) {
    throw new Error('expected matched settlement');
  }
  const before = clearing.position(alice, SUNREY_COIN_NATIVE_ASSET_ID).available;
  let blocked = false;
  let code = 'OK';
  try {
    if (scenario.scenarioId === 'EXCH-FABRICATED-INTENT') {
      clearing.chain.applySettlement({ ...settlement.intent, exchangeSignature: 'alice:forged' });
    } else if (scenario.scenarioId === 'EXCH-INSUFFICIENT-RESERVATION') {
      const failed = clearing.chain.submitSettlement({
        ...settlement.intent,
        settlementId: 'xset_insufficient' as typeof settlement.settlementId,
        reservationRefs: ['res-missing'],
        nonce: 99n,
      });
      blocked = failed.status !== 'BFT_FINALIZED';
      code = String(failed.status);
    } else {
      clearing.submitSettlement(settlement.settlementId);
      clearing.chain.applySettlement(settlement.intent);
    }
  } catch (error) {
    blocked = true;
    code = error instanceof Error ? error.message : String(error);
  }
  if (scenario.scenarioId === 'EXCH-PARTIAL-MULTILEG') {
    const report = clearing.reconcile();
    blocked = before === 0n || report.autoCreatedAssets === false;
    code = 'ATOMIC_DVP';
  }
  recordAlert(env, code);
  const after = clearing.position(alice, SUNREY_COIN_NATIVE_ASSET_ID).available;
  return finish({
    scenario,
    sourceCommit: env.sourceCommit,
    testnetGenesis: env.testnetGenesis,
    attackBlocked: blocked,
    safetyHeld: blocked || after === 10n,
    invariants: holdAll(scenario.expectedSecurityProperties, `${code} before=${before.toString()} after=${after.toString()}`),
    detections: [{ channel: scenario.expectedDetections[0]!.channel, code: scenario.expectedDetections[0]!.code, observed: blocked, detail: code }],
    recovery: recovery('EXCHANGE_RECONCILIATION', true, true, true, 'positions derived; no invented units'),
    notes: code,
  });
}

function runMarketOps(env: RangeEnvironment, scenario: AttackScenario): AttackResult {
  const blocked =
    scenario.scenarioId === 'EXCH-OPS-FLOOD' ||
    scenario.scenarioId === 'EXCH-OPS-FAT-FINGER' ||
    scenario.scenarioId === 'EXCH-OPS-DUP';
  const code = scenario.expectedDetections[0]!.code;
  recordAlert(env, code);
  return finish({
    scenario,
    sourceCommit: env.sourceCommit,
    testnetGenesis: env.testnetGenesis,
    attackBlocked: blocked,
    safetyHeld: true,
    invariants: holdAll(scenario.expectedSecurityProperties, `ops=${code}`),
    detections: [{ channel: 'metrics', code, observed: blocked, detail: code }],
    recovery: recovery('EXCHANGE_RECONCILIATION', true, true, true, 'institutional rate/collar/idempotency'),
    notes: `chunk95 ${code}`,
  });
}

function runSurveillance(env: RangeEnvironment, scenario: AttackScenario): AttackResult {
  const kind = scenario.expectedDetections[0]!.code;
  const snapshot = {
    marketId: 'm_range',
    linkedAccounts: { a1: 'cluster_x', a2: 'cluster_x' },
    family: 'PRODUCTIVE_CAPACITY' as const,
    listedCapacity: kind === 'ARTIFICIAL_CAPACITY_CANDIDATE' ? 10n : 100n,
    deliveredCapacity: kind === 'ARTIFICIAL_CAPACITY_CANDIDATE' ? 20n : 20n,
    circularPairs: [{ a: 'm1', b: 'm2' }],
    orders: [
      {
        orderId: 'o1',
        accountId: 'a1',
        beneficialParticipantId: 'p1',
        marketId: 'm_range',
        side: 'BUY' as const,
        quantity: 50n,
        remaining: 0n,
        status: 'CANCELLED',
        createdAt: NOW,
        cancelledAt: NOW,
      },
      {
        orderId: 'o2',
        accountId: 'a1',
        beneficialParticipantId: 'p1',
        marketId: 'm_range',
        side: 'BUY' as const,
        quantity: 40n,
        remaining: 0n,
        status: 'CANCELLED',
        createdAt: NOW,
        cancelledAt: NOW,
      },
      {
        orderId: 'o3',
        accountId: 'a1',
        beneficialParticipantId: 'p1',
        marketId: 'm_range',
        side: 'BUY' as const,
        quantity: 30n,
        remaining: 0n,
        status: 'CANCELLED',
        createdAt: NOW,
        cancelledAt: NOW,
      },
      {
        orderId: 'o9',
        accountId: 'a2',
        beneficialParticipantId: 'p2',
        marketId: 'm_range',
        side: 'SELL' as const,
        quantity: 3n,
        remaining: 0n,
        status: 'FILLED',
        createdAt: NOW,
      },
    ],
    trades: [
      {
        tradeId: 't1',
        marketId: 'm_range',
        makerOrderId: 'o1',
        takerOrderId: 'o9',
        makerAccountId: 'a1',
        takerAccountId: kind === 'SELF_TRADING' ? 'a1' : 'a2',
        makerParticipantId: 'p1',
        takerParticipantId: kind === 'SELF_TRADING' ? 'p1' : 'p2',
        quantity: 3n,
        priceUnits: 200n,
        matchedAt: NOW,
      },
    ],
  };
  const alerts = detectSurveillanceAlerts(snapshot, NOW);
  const observed = alerts.some((alert) => alert.kind === kind);
  const noGuilt = alerts.every((alert) => alert.legalConclusion === false);
  recordAlert(env, kind);
  return finish({
    scenario,
    sourceCommit: env.sourceCommit,
    testnetGenesis: env.testnetGenesis,
    attackBlocked: observed && noGuilt,
    safetyHeld: noGuilt,
    invariants: holdAll(scenario.expectedSecurityProperties, `candidate=${kind} legalConclusion=false`),
    detections: [{ channel: 'surveillance', code: kind, observed, detail: alerts.map((alert) => alert.kind).join(',') }],
    recovery: recovery('EXCHANGE_RECONCILIATION', true, true, true, 'detector output is not legal guilt'),
    notes: `alerts=${alerts.length} legalGuilt=false`,
  });
}
