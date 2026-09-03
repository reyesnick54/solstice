// @ts-nocheck
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import { asJurisdiction } from '../../domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { EvidenceVault } from '../../evidence/src/vault.ts';
import { DomainEventLog } from '../../events/src/events.ts';
import { SimulatedIdentityAdapter } from '../../identity/src/simulation.ts';
import { ComplianceKernel } from '../../kernel/src/kernel.ts';
import { AuthorityIssuer } from '../../permissions/src/execution-authority.ts';
import { createSimulationKeyProvider } from '../../security/src/simulation.ts';
import {
  asCapacityPoolId,
  asCapacityResourceId,
  availableUnits,
  CapacityReservationEngine,
  DEFAULT_CONFIRMATION_TTL_MS,
  DEFAULT_HOLD_TTL_MS,
  InMemoryCapacitySource,
  InMemorySettlementIntentPort,
  PermissiveSimulationPolicy,
} from './index.ts';

const NOW = asUtcInstant('2026-08-29T10:00:00.000Z');
const MUSTANG_POOL = asCapacityPoolId('pool_mustang_mon_fri');
const MUSTANG_RESOURCE = asCapacityResourceId('resource:mustang');

function harness(policy = new PermissiveSimulationPolicy()) {
  const clock = new FrozenClock(NOW);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const events = new DomainEventLog();
  const evidence = new EvidenceVault(clock);
  const issuer = new AuthorityIssuer('access-fabric-test');
  const kernel = new ComplianceKernel(issuer, evidence, clock);
  const identity = new SimulatedIdentityAdapter({ clock, keys, events });
  identity.provisionSimulatedActor({
    actorId: 'actor-1',
    jurisdiction: 'GB' as never,
    identityId: 'identity-1',
    customerId: 'customer-1',
    capabilities: ['EXCHANGE_VIEW', 'EXCHANGE_OPERATE_REQUEST'] as never,
  });
  const capacitySource = new InMemoryCapacitySource();
  const settlement = new InMemorySettlementIntentPort();
  capacitySource.put({
    poolId: MUSTANG_POOL,
    resourceId: MUSTANG_RESOURCE,
    resourceLabel: 'Ford Mustang',
    windowStart: asUtcInstant('2026-08-31T00:00:00.000Z'),
    windowEnd: asUtcInstant('2026-09-05T00:00:00.000Z'),
    totalUnits: 1,
    reservedUnits: 0,
    heldUnits: 0,
    partialAllowed: false,
    epoch: 0,
    updatedAt: NOW,
  });
  const engine = new CapacityReservationEngine({
    kernel,
    issuer,
    evidence,
    events,
    clock,
    identity: identity.service,
    capacitySource,
    policy,
    settlement,
    holdTtlMs: DEFAULT_HOLD_TTL_MS,
    confirmationTtlMs: DEFAULT_CONFIRMATION_TTL_MS,
  });
  return { clock, evidence, engine, capacitySource, settlement, policy, identity, issuer, kernel };
}

const GB = asJurisdiction('GB');

async function requestAndHold(
  engine: CapacityReservationEngine,
  idempotencyKey: string,
  actorId = 'actor-1',
) {
  const requested = engine.requestReservation({
    poolId: MUSTANG_POOL as string,
    requestedUnits: 1,
    actorId,
    accountId: 'acct-1',
    jurisdiction: GB as string,
    idempotencyKey,
  });
  assert.equal(requested.outcome, 'OK');
  const held = await engine.placeHold({
    reservationId: requested.value!.reservationId as string,
    actorId,
  });
  assert.equal(held.outcome, 'OK');
  return held.value!;
}

describe('ACCESS-07 capacity reservation engine', () => {
  it('quotes available capacity without reserving', () => {
    const { engine } = harness();
    const quote = engine.quote({
      poolId: MUSTANG_POOL as string,
      requestedUnits: 1,
      actorId: 'actor-1',
      accountId: 'acct-1',
    jurisdiction: GB as string,
    });
    assert.equal(quote.outcome, 'OK');
    if (quote.outcome === 'OK') {
      assert.equal(quote.value.availableUnits, 1);
      assert.equal(quote.value.quotableUnits, 1);
    }
  });

  it('walks REQUESTED -> HELD -> CONFIRMED -> ACTIVE -> COMPLETED', async () => {
    const { engine } = harness();
    const held = await requestAndHold(engine, 'life-1');
    assert.equal(held.state, 'HELD');
    const intent = engine.buildConfirmIntent({
      reservation: held,
      actorId: 'actor-1',
      idempotencyKey: 'confirm-life-1',
    });
    const confirmed = await engine.confirmReservation({
      reservationId: held.reservationId as string,
      actorId: 'actor-1',
      intent,
    });
    assert.equal(confirmed.outcome, 'OK');
    if (confirmed.outcome !== 'OK') return;
    assert.equal(confirmed.value.state, 'CONFIRMED');
    assert.ok(confirmed.value.authorityId);
    const activated = await engine.activateReservation({
      reservationId: held.reservationId as string,
      actorId: 'actor-1',
    });
    assert.equal(activated.outcome, 'OK');
    if (activated.outcome !== 'OK') return;
    assert.equal(activated.value.state, 'ACTIVE');
    const completed = await engine.completeReservation({
      reservationId: held.reservationId as string,
    });
    assert.equal(completed.outcome, 'OK');
    if (completed.outcome !== 'OK') return;
    assert.equal(completed.value.state, 'COMPLETED');
    const pool = engine.store.getPool(MUSTANG_POOL)!;
    assert.equal(pool.reservedUnits, 0);
    assert.equal(pool.heldUnits, 0);
  });

  it('prevents overselling when two concurrent confirmations race for one Mustang', async () => {
    const { engine } = harness();
    const first = await requestAndHold(engine, 'race-a');
    const secondRequested = engine.requestReservation({
      poolId: MUSTANG_POOL as string,
      requestedUnits: 1,
      actorId: 'actor-1',
      accountId: 'acct-1',
    jurisdiction: GB as string,
      idempotencyKey: 'race-b',
    });
    assert.equal(secondRequested.outcome, 'OK');
    const secondHold = await engine.placeHold({
      reservationId: secondRequested.value!.reservationId as string,
      actorId: 'actor-1',
    });
    assert.equal(secondHold.outcome, 'REJECTED');
    if (secondHold.outcome === 'REJECTED') {
      assert.equal(secondHold.code, 'POOL_CAPACITY_EXCEEDED');
    }
    const intentA = engine.buildConfirmIntent({
      reservation: first,
      actorId: 'actor-1',
      idempotencyKey: 'confirm-race-a',
    });
    const confirmA = await engine.confirmReservation({
      reservationId: first.reservationId as string,
      actorId: 'actor-1',
      intent: intentA,
    });
    assert.equal(confirmA.outcome, 'OK');
    const pool = engine.store.getPool(MUSTANG_POOL)!;
    assert.equal(pool.reservedUnits, 1);
    assert.equal(availableUnits(pool), 0);
  });

  it('replays duplicate requests by idempotency key', async () => {
    const { engine } = harness();
    const first = engine.requestReservation({
      poolId: MUSTANG_POOL as string,
      requestedUnits: 1,
      actorId: 'actor-1',
      accountId: 'acct-1',
    jurisdiction: GB as string,
      idempotencyKey: 'dup-1',
    });
    const second = engine.requestReservation({
      poolId: MUSTANG_POOL as string,
      requestedUnits: 1,
      actorId: 'actor-1',
      accountId: 'acct-1',
    jurisdiction: GB as string,
      idempotencyKey: 'dup-1',
    });
    assert.equal(first.outcome, 'OK');
    assert.equal(second.outcome, 'OK');
    if (first.outcome !== 'OK' || second.outcome !== 'OK') return;
    assert.equal(second.replay, true);
    assert.equal(first.value.reservationId, second.value.reservationId);
  });

  it('expires soft holds and releases capacity', async () => {
    const { engine, clock } = harness();
    const held = await requestAndHold(engine, 'expire-1');
    clock.advanceMs(DEFAULT_HOLD_TTL_MS + 1n);
    const expired = await engine.expireHold(held.reservationId as string);
    assert.equal(expired.outcome, 'OK');
    if (expired.outcome !== 'OK') return;
    assert.equal(expired.value.state, 'EXPIRED');
    const pool = engine.store.getPool(MUSTANG_POOL)!;
    assert.equal(pool.heldUnits, 0);
    assert.equal(availableUnits(pool), 1);
  });

  it('cancels a held reservation and releases capacity', async () => {
    const { engine } = harness();
    const held = await requestAndHold(engine, 'cancel-1');
    const cancelled = await engine.cancelReservation({
      reservationId: held.reservationId as string,
      actorId: 'actor-1',
    });
    assert.equal(cancelled.outcome, 'OK');
    if (cancelled.outcome !== 'OK') return;
    assert.equal(cancelled.value.state, 'CANCELLED');
    assert.equal(availableUnits(engine.store.getPool(MUSTANG_POOL)!), 1);
  });

  it('compensates and fails when confirmation cannot convert hold', async () => {
    const { engine, capacitySource } = harness();
    const held = await requestAndHold(engine, 'fail-confirm');
    capacitySource.remove(MUSTANG_POOL);
    const intent = engine.buildConfirmIntent({
      reservation: held,
      actorId: 'actor-1',
      idempotencyKey: 'confirm-fail',
    });
    const confirmed = await engine.confirmReservation({
      reservationId: held.reservationId as string,
      actorId: 'actor-1',
      intent,
    });
    assert.equal(confirmed.outcome, 'REJECTED');
    if (confirmed.outcome !== 'REJECTED') return;
    assert.equal(confirmed.code, 'CAPACITY_SOURCE_GONE');
    const row = engine.store.getReservation(held.reservationId as string)!;
    assert.equal(row.state, 'FAILED');
  });

  it('rejects stale confirmation authority after TTL', async () => {
    const { engine, clock } = harness();
    const held = await requestAndHold(engine, 'stale-auth');
    const intent = engine.buildConfirmIntent({
      reservation: held,
      actorId: 'actor-1',
      idempotencyKey: 'confirm-stale',
    });
    const confirmed = await engine.confirmReservation({
      reservationId: held.reservationId as string,
      actorId: 'actor-1',
      intent,
    });
    assert.equal(confirmed.outcome, 'OK');
    clock.advanceMs(DEFAULT_CONFIRMATION_TTL_MS + 1n);
    const activated = await engine.activateReservation({
      reservationId: held.reservationId as string,
      actorId: 'actor-1',
    });
    assert.equal(activated.outcome, 'REJECTED');
    if (activated.outcome === 'REJECTED') {
      assert.equal(activated.code, 'AUTHORITY_STALE');
    }
  });

  it('rejects confirmation when policy changes during hold', async () => {
    const policy = new PermissiveSimulationPolicy('policy-v1');
    const { engine, policy: livePolicy } = harness(policy);
    const held = await requestAndHold(engine, 'policy-change');
    livePolicy.setVersion('policy-v2');
    const intent = engine.buildConfirmIntent({
      reservation: held,
      actorId: 'actor-1',
      idempotencyKey: 'confirm-policy',
    });
    const confirmed = await engine.confirmReservation({
      reservationId: held.reservationId as string,
      actorId: 'actor-1',
      intent,
    });
    assert.equal(confirmed.outcome, 'REJECTED');
    if (confirmed.outcome === 'REJECTED') {
      assert.equal(confirmed.code, 'POLICY_STALE');
    }
  });

  it('waitlists when capacity is unavailable', async () => {
    const { engine } = harness();
    await requestAndHold(engine, 'wait-a');
    const requested = engine.requestReservation({
      poolId: MUSTANG_POOL as string,
      requestedUnits: 1,
      actorId: 'actor-1',
      accountId: 'acct-1',
    jurisdiction: GB as string,
      idempotencyKey: 'wait-b',
    });
    assert.equal(requested.outcome, 'OK');
    const held = await engine.placeHold({
      reservationId: requested.value!.reservationId as string,
      actorId: 'actor-1',
    });
    assert.equal(held.outcome, 'REJECTED');
    assert.equal(engine.waitlist.listForPool(MUSTANG_POOL).length, 1);
  });

  it('supports partial capacity when allowed', async () => {
    const { engine, capacitySource } = harness();
    const partialPool = asCapacityPoolId('pool_partial');
    capacitySource.put({
      poolId: partialPool,
      resourceId: MUSTANG_RESOURCE,
      resourceLabel: 'Partial Mustang',
      windowStart: asUtcInstant('2026-08-31T00:00:00.000Z'),
      windowEnd: asUtcInstant('2026-09-05T00:00:00.000Z'),
      totalUnits: 1,
      reservedUnits: 0,
      heldUnits: 0,
      partialAllowed: true,
      epoch: 0,
      updatedAt: NOW,
    });
    engine.syncPoolsFromSource();
    const requested = engine.requestReservation({
      poolId: partialPool as string,
      requestedUnits: 2,
      actorId: 'actor-1',
      accountId: 'acct-1',
    jurisdiction: GB as string,
      idempotencyKey: 'partial-1',
    });
    assert.equal(requested.outcome, 'OK');
    const held = await engine.placeHold({
      reservationId: requested.value!.reservationId as string,
      actorId: 'actor-1',
    });
    assert.equal(held.outcome, 'OK');
    if (held.outcome === 'OK') {
      assert.equal(held.value.heldUnits, 1);
    }
  });

  it('seals evidence on every consequential transition', async () => {
    const { engine, evidence } = harness();
    const held = await requestAndHold(engine, 'evidence-1');
    assert.ok(held.evidenceRefs.length >= 2);
    const intent = engine.buildConfirmIntent({
      reservation: held,
      actorId: 'actor-1',
      idempotencyKey: 'confirm-evidence',
    });
    const confirmed = await engine.confirmReservation({
      reservationId: held.reservationId as string,
      actorId: 'actor-1',
      intent,
    });
    assert.equal(confirmed.outcome, 'OK');
    if (confirmed.outcome !== 'OK') return;
    assert.ok(confirmed.value.evidenceRefs.length >= 3);
    assert.ok(evidence.list().length >= 3);
  });

  it('emits settlement intents without moving money', async () => {
    const { engine, settlement } = harness();
    const held = await requestAndHold(engine, 'settle-intent');
    const intent = engine.buildConfirmIntent({
      reservation: held,
      actorId: 'actor-1',
      idempotencyKey: 'confirm-settle',
    });
    await engine.confirmReservation({
      reservationId: held.reservationId as string,
      actorId: 'actor-1',
      intent,
    });
    assert.equal(settlement.listAll().length, 1);
    assert.equal(settlement.listAll()[0]!.kind, 'RESERVATION_CONFIRMED');
  });

  it('rejects confirmation on expired hold', async () => {
    const { engine, clock } = harness();
    const held = await requestAndHold(engine, 'expired-confirm');
    clock.advanceMs(DEFAULT_HOLD_TTL_MS + 1n);
    const intent = engine.buildConfirmIntent({
      reservation: held,
      actorId: 'actor-1',
      idempotencyKey: 'confirm-expired',
    });
    const confirmed = await engine.confirmReservation({
      reservationId: held.reservationId as string,
      actorId: 'actor-1',
      intent,
    });
    assert.equal(confirmed.outcome, 'REJECTED');
    if (confirmed.outcome === 'REJECTED') {
      assert.equal(confirmed.code, 'HOLD_EXPIRED');
    }
  });

  it('expireDueHolds sweeps expired soft holds', async () => {
    const { engine, clock } = harness();
    await requestAndHold(engine, 'sweep-1');
    clock.advanceMs(DEFAULT_HOLD_TTL_MS + 1n);
    const swept = engine.expireDueHolds();
    assert.equal(swept.length, 1);
    assert.equal(swept[0]!.state, 'EXPIRED');
  });
});
