import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import { asCustomerId, type Customer } from '../../domain/src/customer.ts';
import { asJurisdiction, asResidency } from '../../domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { EvidenceVault } from '../../evidence/src/vault.ts';
import { DomainEventLog } from '../../events/src/events.ts';
import { SimulatedIdentityAdapter } from '../../identity/src/simulation.ts';
import { ComplianceKernel } from '../../kernel/src/kernel.ts';
import { AuthorityIssuer } from '../../permissions/src/execution-authority.ts';
import { createSimulationKeyProvider } from '../../security/src/simulation.ts';
import { SIMULATION_DIGITAL_CUSTODY_GB, SIMULATION_SOLSTICE_UK } from '../../sunrey-coin/src/simulation-catalog.ts';
import { InMemoryCoinPort, InMemoryFiatPort } from './adapters.ts';
import { SUNREY_COIN_USD_MARKET_ID } from './ids.ts';
import { SunReyExchangeService } from './service.ts';

const NOW = asUtcInstant('2026-08-16T08:30:00.000Z');
const GB = asJurisdiction('GB');

function customer(id: string): Customer {
  return Object.freeze({
    id: asCustomerId(id),
    legalEntityId: SIMULATION_SOLSTICE_UK.id,
    jurisdiction: GB,
    residency: asResidency('GB'),
    status: 'ACTIVE',
    verification: {
      kycState: 'VERIFIED' as const,
      kycRecordVersion: 1,
      refreshBy: asUtcInstant('2027-08-16T08:30:00.000Z'),
    },
    createdAt: NOW,
    version: 1,
  });
}

function harness() {
  const clock = new FrozenClock(NOW);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const events = new DomainEventLog();
  const evidence = new EvidenceVault(clock);
  const issuer = new AuthorityIssuer('exchange-controls-test');
  const kernel = new ComplianceKernel(issuer, evidence, clock);
  const identity = new SimulatedIdentityAdapter({ clock, keys, events });
  const customers = new Map<string, Customer>();
  const exchange = new SunReyExchangeService({
    kernel,
    issuer,
    evidence,
    events,
    clock,
    identity: identity.service,
    catalog: {
      customers: { get: (id) => customers.get(id) },
      products: {
        get: (id) => (id === SIMULATION_DIGITAL_CUSTODY_GB.id ? SIMULATION_DIGITAL_CUSTODY_GB : undefined),
      },
      legalEntities: { get: (id) => (id === SIMULATION_SOLSTICE_UK.id ? SIMULATION_SOLSTICE_UK : undefined) },
    },
    coin: new InMemoryCoinPort(),
    fiat: new InMemoryFiatPort(),
  });
  return { identity, customers, exchange };
}

describe('exchange listing governance and kill switches', () => {
  it('versions listing decisions, refuses AI approval, and forbids LIVE_APPROVED', () => {
    const h = harness();
    const cust = customer('cust_list');
    h.customers.set(cust.id, cust);
    const actor = h.identity.provisionSimulatedActor({
      actorId: 'actor_list',
      jurisdiction: GB,
      identityId: 'id_list',
      customerId: cust.id,
      capabilities: ['EXCHANGE_OPERATE_REQUEST', 'EXCHANGE_VIEW'] as never,
    });
    if (!actor.ok) {
      throw new Error(actor.error.message);
    }
    const ai = h.exchange.decideListing({
      actorId: actor.value.actorId,
      customerId: cust.id,
      listingId: 'listing:sunrey-coin',
      status: 'SUSPENDED',
      actorKind: 'AI',
    });
    assert.equal(ai.outcome, 'REJECTED');
    const live = h.exchange.decideListing({
      actorId: actor.value.actorId,
      customerId: cust.id,
      listingId: 'listing:sunrey-coin',
      status: 'LIVE_APPROVED' as never,
      actorKind: 'HUMAN_OPERATOR',
    });
    assert.equal(live.outcome, 'REJECTED');
    const decided = h.exchange.decideListing({
      actorId: actor.value.actorId,
      customerId: cust.id,
      listingId: 'listing:sunrey-coin',
      status: 'SIMULATION_LISTED',
      actorKind: 'HUMAN_OPERATOR',
    });
    if (decided.outcome !== 'OK') {
      throw new Error('listing');
    }
    assert.equal(decided.value.listingVersion, 2);
    assert.equal(decided.value.liveApproved, false);
    assert.equal(decided.value.rdtDisposition, 'RESEARCH_REQUIRED');
    assert.equal(decided.value.legalReviewState, 'RESEARCH_REQUIRED');
  });

  it('lets a human set independent kill switches and refuses AI disable', () => {
    const h = harness();
    const cust = customer('cust_sw');
    h.customers.set(cust.id, cust);
    const actor = h.identity.provisionSimulatedActor({
      actorId: 'actor_sw',
      jurisdiction: GB,
      identityId: 'id_sw',
      customerId: cust.id,
      capabilities: ['EXCHANGE_OPERATE_REQUEST', 'EXCHANGE_VIEW'] as never,
    });
    if (!actor.ok) {
      throw new Error(actor.error.message);
    }
    const ai = h.exchange.setExchangeControl({
      actorId: actor.value.actorId,
      customerId: cust.id,
      scope: 'NEW_ORDERS',
      targetId: 'GLOBAL',
      reason: 'ai',
      actorKind: 'AI',
      active: true,
    });
    assert.equal(ai.outcome, 'REJECTED');
    for (const scope of [
      'GLOBAL',
      'MARKET',
      'ASSET',
      'NEW_ORDERS',
      'CANCEL_ONLY',
      'WITHDRAWAL_HALT',
      'DEPOSIT_CREDIT_HALT',
    ] as const) {
      const set = h.exchange.setExchangeControl({
        actorId: actor.value.actorId,
        customerId: cust.id,
        scope,
        targetId: scope === 'MARKET' ? SUNREY_COIN_USD_MARKET_ID : 'GLOBAL',
        reason: 'human control',
        actorKind: 'HUMAN_OPERATOR',
        active: true,
      });
      assert.equal(set.outcome, 'OK', scope);
    }
    assert.equal(h.exchange.activeControls().length >= 7, true);
  });
});
