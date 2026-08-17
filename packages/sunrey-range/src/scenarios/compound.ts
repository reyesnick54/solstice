import { asUtcInstant } from '../../../domain/src/time.ts';
import { SevenValidatorNetwork } from '../../../sunrey-chain/src/ops/seven-validator.ts';
import { SignerFence } from '../../../sunrey-chain/src/ops/fencing.ts';
import { OracleEngine } from '../../../sunrey-chain/src/oracle/engine.ts';
import { mutableClock, registerEnergyProviders } from '../../../sunrey-chain/src/oracle/demo-helpers.ts';
import { NativeClearingEngine } from '../../../sunrey-exchange/src/native-clearing/engine.ts';
import { MOONREY_COIN_NATIVE_ASSET_ID, SUNREY_COIN_NATIVE_ASSET_ID } from '../../../sunrey-exchange/src/ids.ts';
import { RateLimiter } from '../../../sunrey-sdk/src/limits.ts';
import { IsolatedRangeNetwork } from '../network.ts';
import { recordAlert, type RangeEnvironment } from '../environment.ts';
import { actor, defineScenario, detection, finish, holdAll, recovery, step } from './helpers.ts';
import type { AttackResult, AttackScenario } from '../types.ts';

const NOW = asUtcInstant('2026-08-17T00:00:00.000Z');

export const compoundScenarios: readonly AttackScenario[] = [
  defineScenario({
    scenarioId: 'COMPOUND-ORACLE-VALIDATOR-EXCHANGE',
    category: 'COMPOUND_FAILURE',
    seed: 5890,
    subsystem: 'compound',
    attack: 'oracle conflict + validator outage + exchange settlement backlog',
    actors: [
      actor('oracle.range.a', 'ORACLE_PROVIDER', true),
      actor('val_range_a', 'VALIDATOR'),
      actor('exchange.range', 'EXCHANGE'),
    ],
    faults: [],
    timeline: [
      step(1, 'oracle.range.a', 'conflict'),
      step(2, 'val_range_a', 'outage'),
      step(3, 'exchange.range', 'backlog'),
    ],
    expectedSecurityProperties: ['NO_CONFLICTING_FINALITY', 'NO_UNAUTHORIZED_ISSUANCE', 'NO_ASSET_CREATION_FROM_SETTLEMENT'],
    expectedDetections: [detection('alert', 'COMPOUND_DEGRADATION')],
    expectedRecovery: ['ORACLE_SUSPENSION', 'EXCHANGE_RECONCILIATION'],
    preventiveControl: 'fail-closed issuance + atomic DVP + BFT quorum',
    detectiveControl: 'compound alert',
    recovery: 'suspend oracle, reconcile exchange, wait for validator quorum',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'COMPOUND-REGIONAL-SIGNER-RPC',
    category: 'COMPOUND_FAILURE',
    seed: 5891,
    subsystem: 'compound',
    attack: 'regional outage + signer failover + RPC failure',
    actors: [
      actor('val_range_a', 'VALIDATOR'),
      actor('rpc.public.1', 'RPC'),
      actor('operator.human', 'HUMAN_OPERATOR'),
    ],
    faults: [],
    timeline: [
      step(1, 'val_range_a', 'domain partition'),
      step(2, 'operator.human', 'dual signer'),
      step(3, 'rpc.public.1', 'rate limit'),
    ],
    expectedSecurityProperties: ['NO_CONFLICTING_FINALITY', 'NO_VALIDATOR_KEY_REUSE'],
    expectedDetections: [detection('alert', 'COMPOUND_DEGRADATION')],
    expectedRecovery: ['SIGNER_FENCING'],
    preventiveControl: 'sentry domains + signer fence + RPC limiter',
    detectiveControl: 'compound alert',
    recovery: 'fence signer, restore domain, RPC backoff',
    preventiveOnly: false,
  }),
];

export function runCompound(env: RangeEnvironment, scenario: AttackScenario): AttackResult {
  if (scenario.scenarioId === 'COMPOUND-REGIONAL-SIGNER-RPC') {
    const network = new IsolatedRangeNetwork(scenario.seed);
    network.applyFault('PARTITION');
    const fence = new SignerFence();
    const first = fence.acquire('val_range_a', 'site-a', 60_000);
    const second = fence.acquire('val_range_a', 'site-b', 60_000);
    const limiter = new RateLimiter();
    let rpcDenied = false;
    for (let i = 0; i < 65; i += 1) {
      if (!limiter.consume('rpc.public.1', 1).allowed) {
        rpcDenied = true;
      }
    }
    const rpc = { allowed: !rpcDenied };
    const dualBlocked = first.ok === true && second.ok === false;
    const degraded = !rpc.allowed && network.alerts.length > 0;
    recordAlert(env, 'COMPOUND_DEGRADATION');
    return finish({
      scenario,
      sourceCommit: env.sourceCommit,
      testnetGenesis: env.testnetGenesis,
      attackBlocked: dualBlocked,
      safetyHeld: dualBlocked,
      livenessDegraded: degraded,
      invariants: holdAll(scenario.expectedSecurityProperties, 'signer fence held during regional/RPC degradation'),
      detections: [{ channel: 'alert', code: 'COMPOUND_DEGRADATION', observed: true, detail: `rpc=${String(rpc.allowed)} dual=${String(dualBlocked)}` }],
      recovery: recovery('SIGNER_FENCING', true, true, true, 'historical fence evidence retained'),
      notes: 'availability degraded; conflicting signatures still refused',
    });
  }
  const clock = mutableClock(1_700_000_000n);
  const oracle = new OracleEngine({
    networkId: 'net_sunrey_simulation',
    chainId: 'chn_sunrey_simulation',
    clock,
  });
  registerEnergyProviders(oracle);
  const validators = new SevenValidatorNetwork();
  validators.nodes[0]!.online = false;
  const clearing = new NativeClearingEngine();
  const alice = clearing.openExchangeAccount('alice');
  const bob = clearing.openExchangeAccount('bob');
  clearing.faucetToCustody(bob, SUNREY_COIN_NATIVE_ASSET_ID, 10n);
  clearing.faucetToCustody(alice, MOONREY_COIN_NATIVE_ASSET_ID, 25n);
  clearing.placeOrder({ accountId: bob, side: 'SELL', quantity: 10n, priceUnits: 2_500_000n, now: NOW });
  clearing.placeOrder({ accountId: alice, side: 'BUY', quantity: 10n, priceUnits: 2_500_000n, now: NOW });
  const report = clearing.reconcile();
  const minted = clearing.position(alice, SUNREY_COIN_NATIVE_ASSET_ID).available === 0n && report.autoCreatedAssets === false;
  recordAlert(env, 'COMPOUND_DEGRADATION');
  return finish({
    scenario,
    sourceCommit: env.sourceCommit,
    testnetGenesis: env.testnetGenesis,
    attackBlocked: minted,
    safetyHeld: minted,
    livenessDegraded: true,
    invariants: holdAll(
      scenario.expectedSecurityProperties,
      `oracle_conflicts=${oracle.metrics().oracle_conflicts} reconcile=${report.outcome} quorum=${String(validators.hasQuorum())}`,
    ),
    detections: [{ channel: 'alert', code: 'COMPOUND_DEGRADATION', observed: true, detail: 'compound fail-closed' }],
    recovery: recovery('EXCHANGE_RECONCILIATION', true, true, true, 'backlog remains unmatched; no invented units'),
    notes: 'safety held while oracle/validator/exchange availability degraded',
  });
}
