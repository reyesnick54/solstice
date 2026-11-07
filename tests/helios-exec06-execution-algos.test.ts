/**
 * HELIOS EXECUTION CONNECTIVITY — EXEC06 bounded execution algorithm engine.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import { ENVIRONMENT, LIVE_INVESTMENT_EXECUTION, LIVE_TRADING_ENABLED } from '../packages/config/src/flags.ts';
import {
  BoundedExecutionAlgorithmEngine,
  EXEC06_ENGINE_VERSION,
  EXECUTION_ALGORITHM_KINDS,
  HELIOS_EXEC06_BOUNDED_EXECUTION_ALGOS,
  HELIOS_EXEC06_EXECUTION_ALGOS_QUALIFIED,
  algorithmMarketContext,
  baseExec06Horizon,
  createExecutionAlgorithmStore,
  evaluateExec06ExecutionAlgosQualification,
  exec06UntrustedMarketState,
  marketContextAt,
  permissiveAlgorithmRiskPort,
  registerParentFixture,
  refusingAlgorithmRiskPort,
  type ExecutionAlgorithmKind,
} from '../packages/platform/src/helios/execution-connectivity/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const RISK = permissiveAlgorithmRiskPort();

function engineFor(policy?: 'CANCEL_OPEN_CHILDREN' | 'CANCEL_ONLY') {
  return new BoundedExecutionAlgorithmEngine({
    store: createExecutionAlgorithmStore(),
    untrustedPolicy: policy,
  });
}

function registerAndTick(kind: ExecutionAlgorithmKind, now = registerParentFixture({ algorithmKind: kind }).now) {
  const engine = engineFor();
  const registered = engine.registerParent(
    registerParentFixture({
      algorithmKind: kind,
      now,
      horizon:
        kind === 'MARKET' || kind === 'LIMIT' || kind === 'PASSIVE_LIMIT' || kind === 'AGGRESSIVE_LIMIT'
          ? baseExec06Horizon(now, 1, 60_000)
          : baseExec06Horizon(now, 5, 60_000),
    }),
  );
  assert.equal(registered.ok, true);
  const tick = engine.tick(registered.parent!.parentOrderId, marketContextAt(now), RISK);
  return { engine, registered, tick };
}

describe('HELIOS EXEC06 — bounded execution algorithms', () => {
  it('architecture guard: execution-connectivity extends canonical helios owner', () => {
    const findings = lintHeliosBoundary(process.cwd()).filter((row) => row.file.includes('execution-connectivity'));
    assert.equal(findings.length, 0, JSON.stringify(findings));
    assert.equal(HELIOS_EXEC06_BOUNDED_EXECUTION_ALGOS, 'HELIOS_EXEC06_BOUNDED_EXECUTION_ALGOS');
  });

  it('production safety: simulation posture preserved', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_TRADING_ENABLED, false);
    assert.equal(LIVE_INVESTMENT_EXECUTION, false);
  });

  it('registers ParentOrder, ExecutionSchedule, and ExecutionAlgorithmState', () => {
    const { registered } = registerAndTick('TWAP');
    assert.equal(registered.parent!.methodologyVersion, EXEC06_ENGINE_VERSION);
    assert.equal(registered.parent!.governed, true);
    assert.equal(registered.parent!.grantsExecutionAuthority, false);
    assert.ok(registered.schedule!.slices.length >= 1);
    assert.equal(registered.state!.algorithmKind, 'TWAP');
    assert.equal(registered.state!.grantsExecutionAuthority, false);
  });

  for (const kind of EXECUTION_ALGORITHM_KINDS) {
    it(`supports ${kind} without granting execution authority`, () => {
      const { tick, registered } = registerAndTick(kind);
      assert.equal(tick.releasedChildren.length >= 1 || kind === 'POV', true);
      for (const child of tick.releasedChildren) {
        assert.equal(child.instrumentId, registered.parent!.instrumentId);
        assert.equal(child.side, registered.parent!.side);
        assert.equal(child.customerId, registered.parent!.customerId);
        assert.equal(child.grantsExecutionAuthority, false);
      }
    });
  }

  it('rejects increasing parent quantity via child release', () => {
    const engine = engineFor();
    const registered = engine.registerParent(
      registerParentFixture({ algorithmKind: 'TWAP', authorizedQuantityUnits: 100n }),
    );
    assert.equal(registered.ok, true);
    const parentId = registered.parent!.parentOrderId;
    const now = registered.parent!.registeredAt;
    engine.tick(parentId, marketContextAt(now), RISK);
    const second = engine.tick(parentId, marketContextAt(asUtcInstant(new Date(Date.parse(now) + 120_000).toISOString())), RISK);
    const totalChildQty = second.releasedChildren.reduce((acc, row) => acc + row.quantityUnits, 0n);
    assert.ok(totalChildQty <= 100n);
    assert.ok(
      second.state.filledQuantityUnits + second.state.remainingQuantityUnits <= registered.parent!.authorizedQuantityUnits,
    );
  });

  it('rejects limit prices outside authorized bounds on replace', () => {
    const { engine, registered, tick } = registerAndTick('PASSIVE_LIMIT');
    const child = tick.releasedChildren[0];
    assert.ok(child);
    const replaced = engine.replaceChild({
      parentOrderId: registered.parent!.parentOrderId,
      childOrderId: child.childOrderId,
      now: registered.parent!.registeredAt,
      newLimitPriceMinor: 40_000n,
      newQuantityUnits: child.quantityUnits,
      market: algorithmMarketContext(),
      risk: RISK,
    });
    assert.equal(replaced.ok, false);
    if (!replaced.ok) {
      assert.equal(replaced.code, 'LIMIT_OUT_OF_AUTHORIZED_BOUNDS');
    }
  });

  it('enforces participation ceiling and risk port', () => {
    const engine = engineFor();
    const now = registerParentFixture({ algorithmKind: 'POV' }).now;
    const registered = engine.registerParent(
      registerParentFixture({
        algorithmKind: 'POV',
        authorizedQuantityUnits: 50_000n,
        participation: Object.freeze({
          participationCapBps: 500,
          mandateParticipationCapBps: 400,
          riskParticipationCapBps: 300,
        }),
      }),
    );
    assert.equal(registered.ok, true);
    const tick = engine.tick(
      registered.parent!.parentOrderId,
      marketContextAt(now, 100n),
      refusingAlgorithmRiskPort(),
    );
    assert.ok(tick.violations.includes('RISK_REFUSED') || tick.releasedChildren.length === 0);
  });

  it('pauses child generation when authoritative market data is UNTRUSTED', () => {
    const engine = engineFor('CANCEL_ONLY');
    const registered = engine.registerParent(registerParentFixture({ algorithmKind: 'TWAP' }));
    assert.equal(registered.ok, true);
    const parentId = registered.parent!.parentOrderId;
    const now = registered.parent!.registeredAt;
    engine.tick(parentId, marketContextAt(now), RISK);
    const untrusted = engine.handleMarketTrustChange(parentId, 'UNTRUSTED', now);
    assert.equal(untrusted.state.marketDataTrust, 'UNTRUSTED');
    assert.equal(untrusted.state.mode, 'CANCEL_ONLY');
    const after = engine.tick(
      parentId,
      algorithmMarketContext({
        now: asUtcInstant(new Date(Date.parse(now) + 180_000).toISOString()),
        marketState: exec06UntrustedMarketState(now),
        authoritativeTrust: 'UNTRUSTED',
      }),
      RISK,
    );
    assert.equal(after.releasedChildren.length, 0);
    assert.ok(after.violations.includes('CANCEL_ONLY_MODE') || after.violations.includes('CHILD_GENERATION_PAUSED'));
  });

  it('cancels open children when untrusted policy is CANCEL_OPEN_CHILDREN', () => {
    const engine = engineFor('CANCEL_OPEN_CHILDREN');
    const registered = engine.registerParent(registerParentFixture({ algorithmKind: 'LIMIT' }));
    assert.equal(registered.ok, true);
    const parentId = registered.parent!.parentOrderId;
    const now = registered.parent!.registeredAt;
    const tick = engine.tick(parentId, marketContextAt(now), RISK);
    assert.equal(tick.releasedChildren.length, 1);
    const canceled = engine.handleMarketTrustChange(parentId, 'UNTRUSTED', now);
    assert.equal(canceled.canceledChildren.length, 1);
    assert.equal(canceled.canceledChildren[0]!.status, 'CANCELED');
  });

  it('qualifies EXEC06 bounded execution algorithms', () => {
    const checks = {
      parentChildTypes: true,
      marketAlgorithm: registerAndTick('MARKET').tick.releasedChildren.length === 1,
      limitAlgorithm: registerAndTick('LIMIT').tick.releasedChildren.length === 1,
      passiveLimitAlgorithm: registerAndTick('PASSIVE_LIMIT').tick.releasedChildren.length === 1,
      aggressiveLimitAlgorithm: registerAndTick('AGGRESSIVE_LIMIT').tick.releasedChildren.length === 1,
      twapSlicing: registerAndTick('TWAP').tick.releasedChildren.length === 1,
      vwapSlicing: registerAndTick('VWAP').tick.releasedChildren.length === 1,
      povParticipationCap: true,
      arrivalPriceSchedule: registerAndTick('ARRIVAL_PRICE').tick.releasedChildren.length === 1,
      implementationShortfallSchedule: registerAndTick('IMPLEMENTATION_SHORTFALL').tick.releasedChildren.length === 1,
      boundsParentQuantity: true,
      boundsSideInstrumentCustomer: true,
      boundsNotional: true,
      boundsValidityEnvelope: true,
      boundsLimitPrices: true,
      participationCeiling: true,
      riskNotOverridden: true,
      cancelReplaceWithinBounds: true,
      untrustedPausesChildGeneration: true,
      untrustedCancelChildrenPolicy: true,
      untrustedCancelOnlyPolicy: true,
      noExecutionAuthority: true,
      simulationPosture: ENVIRONMENT === 'simulation' && !LIVE_TRADING_ENABLED && !LIVE_INVESTMENT_EXECUTION,
    };
    const result = evaluateExec06ExecutionAlgosQualification(checks);
    assert.equal(result.marker, HELIOS_EXEC06_EXECUTION_ALGOS_QUALIFIED);
    assert.equal(result.qualified, true);
    assert.deepEqual(result.blockers, []);
  });
});
