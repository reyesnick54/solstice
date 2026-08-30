/**
 * ACCESS-17 — Canonical access redemption runtime E2E qualification.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { SimulatedIdentityAdapter } from '../packages/identity/src/simulation.ts';
import { DomainEventLog } from '../packages/events/src/events.ts';
import { createSimulationKeyProvider } from '../packages/security/src/simulation.ts';
import { PersonalEconomyAgent } from '../packages/agent/src/service.ts';
import { freezeAgentPorts } from '../packages/agent/src/ports.ts';
import { AccessDemandEngine } from '../packages/sunrey-agent/src/access/demand-engine.ts';
import {
  CANONICAL_REDEMPTION_PIPELINE,
  createCanonicalAccessRedemptionOrchestrator,
} from '../packages/human-access-economy/src/canonical-redemption-orchestrator.ts';
import { createSandboxWorld, sandboxToken } from '../services/api/src/consumer/fixtures.ts';
import { handleConsumerBff, type ConsumerBffRuntime } from '../services/api/src/consumer/handler.ts';

const NOW = asUtcInstant('2026-08-23T12:00:00.000Z');

function bffCall(
  world: ReturnType<typeof createSandboxWorld>,
  method: string,
  path: string,
  persona: Parameters<typeof sandboxToken>[0],
  body?: Record<string, unknown>,
) {
  const runtime: ConsumerBffRuntime = {
    bff: world.bff,
    sessions: world.sessions,
    identity: world.runtime.identity.service,
    access: world.access,
  };
  return handleConsumerBff(runtime, {
    method,
    path,
    query: {},
    body: body ?? {},
    authorization: `Bearer ${sandboxToken(persona)}`,
    requestId: `req_access17_${method}_${path.replace(/\//g, '_')}`,
  });
}

function graphSlice() {
  return {
    mandateId: 'mandate_access17',
    purpose: 'AGENT_ANALYSIS' as const,
    authorizedCategories: Object.freeze(['GOAL'] as const),
    categoryLabels: Object.freeze({ GOAL: Object.freeze(['Travel goals']) }),
    consentRefs: Object.freeze(['consent_access17']),
  };
}

describe('ACCESS-17 canonical access runtime', () => {
  it('defines the canonical redemption pipeline order', () => {
    assert.deepEqual([...CANONICAL_REDEMPTION_PIPELINE], [
      'QUOTE',
      'ELIGIBILITY',
      'ENTITLEMENT_HOLD',
      'CAPACITY_HOLD',
      'FINANCIAL_HOLD',
      'HUMAN_CONFIRMATION',
      'EXECUTION_AUTHORITY',
      'PROVIDER_RESERVATION',
      'CLEARING_COMMITMENT',
      'CHAIN_COMMITMENT',
      'FULFILLMENT',
      'DELIVERY_PROOF',
      'SETTLEMENT_CAPTURE',
      'ENTITLEMENT_CONSUMPTION',
      'COMPLETION',
    ]);
  });

  it('maps agent proposal to domain intent at ProposalGate without execution authority', () => {
    const clock = new FrozenClock(NOW);
    const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
    const identity = new SimulatedIdentityAdapter({ clock, keys, events: new DomainEventLog() });
    identity.provisionSimulatedActor({
      actorId: 'actor_access17',
      jurisdiction: 'GB' as never,
      identityId: 'cust_access17',
      capabilities: ['VIEW_GROWTH_PLAN'] as never,
    });
    const actor = identity.service.resolveActorContext('actor_access17');
    assert.equal(actor.ok, true);
    if (!actor.ok) {
      return;
    }
    const engine = new AccessDemandEngine(new PersonalEconomyAgent({ clock }));
    const result = engine.propose({
      actor: actor.value,
      ports: freezeAgentPorts({
        context: {
          subjectId: 'cust_access17',
          generatedAt: NOW,
          writePath: false,
          liquidMinorUnitsByCurrency: {},
          incomeLabels: [],
          obligationLabels: [],
          debtLabels: [],
          goalLabels: ['Travel goals'],
          opportunityLabels: [],
        },
        claims: {
          actorId: 'actor_access17',
          subjectId: 'cust_access17',
          authorizedCapabilities: ['CREATE_ACCESS_PROPOSAL'],
          mayProposeOnly: true,
          mayExecute: false,
        },
        mandates: [],
      }),
      subjectId: 'cust_access17',
      sourceText: 'I want a Mustang convertible in Miami for two weeks.',
      graphSlice: graphSlice(),
      actorId: 'actor_access17',
    });
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.match(result.domainIntentId, /^ai_/);
    assert.equal(result.actionIntent.actionType, 'PROPOSE_ACCESS_INTENT');
    assert.equal(result.intent.executable, false);
    assert.equal(engine.confirmReservation().ok, false);
    assert.equal(engine.issueExecutionAuthority().ok, false);
  });

  it('runs Mustang redemption through canonical orchestrator with full pipeline trace', () => {
    const orchestrator = createCanonicalAccessRedemptionOrchestrator();
    const gateway = orchestrator.gateway;
    const search = gateway.search({
      requestId: 'access17_search',
      category: 'VEHICLE_HOURS',
      query: 'Mustang Miami',
      location: 'Miami, FL',
      limit: 5,
    });
    assert.equal(search.ok, true);
    if (!search.ok) {
      return;
    }
    const quote = gateway.quote({
      requestId: 'access17_quote',
      providerId: 'turo',
      catalogItemId: search.value.items[0]!.catalogItemId,
      quantity: 4n,
      startsAt: '2026-08-29T10:00:00.000Z',
      endsAt: '2026-09-02T10:00:00.000Z',
      location: 'Miami, FL',
      idempotencyKey: 'access17_quote',
    });
    assert.equal(quote.ok, true);
    if (!quote.ok) {
      return;
    }
    orchestrator.entitlements.seed('ent_access17', 'cust_access17', 4n);
    const started = orchestrator.start(
      {
        redemptionId: 'red_access17',
        subjectRef: 'cust_access17',
        intentId: 'intent_access17',
        category: 'MOBILITY',
        providerId: 'turo',
        providerQuote: quote.value,
        entitlement: {
          entitlementId: 'ent_access17',
          entitlementClass: 'MOBILITY_STANDARD',
          availableUnits: 4n,
          canonicalUnit: 'VEHICLE_DAY',
        },
        requestedQuantity: 4n,
        jurisdiction: 'SIMULATION',
        maxUserContributionMinorUnits: 0n,
        policyContext: {
          benefitSource: 'SIMULATION',
          geographicZone: 'Miami, FL',
          serviceLevel: 'STANDARD',
        },
      },
      'access17_start',
    );
    assert.equal(started.ok, true);
    const confirmed = orchestrator.confirm('red_access17', { userApproved: true, idempotencyKey: 'access17_confirm' });
    assert.equal(confirmed.ok, true);
    if (!confirmed.ok) {
      return;
    }
    assert.equal(confirmed.value.status, 'REDEEMED');
    assert.ok(confirmed.value.accessRightRef);
    const trace = orchestrator.traceFor('red_access17');
    assert.ok(trace);
    assert.ok(trace!.completedSteps.includes('EXECUTION_AUTHORITY'));
    assert.ok(trace!.completedSteps.includes('FULFILLMENT'));
    assert.ok(trace!.completedSteps.includes('COMPLETION'));
    const replay = orchestrator.confirm('red_access17', { userApproved: true, idempotencyKey: 'access17_confirm' });
    assert.equal(replay.ok, true);
    if (replay.ok) {
      assert.equal(replay.value.status, 'REDEEMED');
    }
  });

  it('runs Japan bundle with multi-provider ALL_OR_NOTHING compensation on failure', () => {
    const orchestrator = createCanonicalAccessRedemptionOrchestrator();
    const gateway = orchestrator.gateway;

    const successfulComponents: {
      componentId: string;
      providerId: 'expedia' | 'turo';
      category: string;
      quote: import('../packages/access-economy/src/providers/types.ts').ProviderQuote;
    }[] = [];
    for (const [componentId, providerId, category, query, location] of [
      ['stay', 'expedia', 'HOUSING_ROOM_NIGHTS', 'Rome hotel', 'Rome, IT'],
      ['mobility', 'turo', 'VEHICLE_HOURS', 'Mustang Miami', 'Miami, FL'],
    ] as const) {
      const search = gateway.search({
        requestId: `access17_ok_${componentId}`,
        category: category as never,
        query,
        location,
        limit: 3,
      });
      assert.equal(search.ok, true);
      if (!search.ok) {
        return;
      }
      const quote = gateway.quote({
        requestId: `access17_ok_quote_${componentId}`,
        providerId,
        catalogItemId: search.value.items[0]!.catalogItemId,
        quantity: componentId === 'mobility' ? 4n : 1n,
        startsAt: '2026-09-01T00:00:00.000Z',
        endsAt: '2026-09-15T00:00:00.000Z',
        location,
        idempotencyKey: `access17_ok_${componentId}`,
      });
      assert.equal(quote.ok, true);
      if (quote.ok) {
        successfulComponents.push({ componentId, providerId, category, quote: quote.value });
      }
    }
    assert.equal(successfulComponents.length, 2);
    const bundle = orchestrator.orchestrateBundle({
      bundleId: 'bundle_japan_access17',
      subjectRef: 'cust_japan',
      failurePolicy: 'ALL_OR_NOTHING',
      components: successfulComponents,
    });
    assert.equal(bundle.status, 'READY_FOR_APPROVAL');
    const confirmed = orchestrator.confirmBundle({
      bundleId: 'bundle_japan_access17',
      failurePolicy: 'ALL_OR_NOTHING',
      userApproved: true,
    });
    assert.equal(confirmed.ok, true);
    if (!confirmed.ok) {
      return;
    }
    assert.equal(confirmed.value.status, 'REDEEMED');
    assert.ok(confirmed.value.components.every((row) => row.status === 'REDEEMED'));

    const compensationComponents: {
      componentId: string;
      providerId: 'turo' | 'doordash';
      category: string;
      quote: import('../packages/access-economy/src/providers/types.ts').ProviderQuote;
    }[] = [];
    const mobilitySearch = gateway.search({
      requestId: 'access17_comp_mobility',
      category: 'VEHICLE_HOURS',
      query: 'Mustang Miami',
      location: 'Miami, FL',
      limit: 3,
    });
    const foodSearch = gateway.search({
      requestId: 'access17_comp_food',
      category: 'FOOD',
      query: 'meal delivery',
      location: 'Miami, FL',
      limit: 3,
    });
    assert.equal(mobilitySearch.ok, true);
    assert.equal(foodSearch.ok, true);
    if (!mobilitySearch.ok || !foodSearch.ok) {
      return;
    }
    const mobilityQuote = gateway.quote({
      requestId: 'access17_comp_mq',
      providerId: 'turo',
      catalogItemId: mobilitySearch.value.items[0]!.catalogItemId,
      quantity: 4n,
      startsAt: '2026-09-01T00:00:00.000Z',
      endsAt: '2026-09-15T00:00:00.000Z',
      location: 'Miami, FL',
      idempotencyKey: 'access17_comp_m',
    });
    const foodQuote = gateway.quote({
      requestId: 'access17_comp_fq',
      providerId: 'doordash',
      catalogItemId: foodSearch.value.items[0]!.catalogItemId,
      quantity: 1n,
      startsAt: '2026-09-01T00:00:00.000Z',
      endsAt: '2026-09-15T00:00:00.000Z',
      location: 'Miami, FL',
      idempotencyKey: 'access17_comp_f',
    });
    assert.equal(mobilityQuote.ok, true);
    assert.equal(foodQuote.ok, true);
    if (!mobilityQuote.ok || !foodQuote.ok) {
      return;
    }
    compensationComponents.push(
      { componentId: 'mobility', providerId: 'turo', category: 'VEHICLE_HOURS', quote: mobilityQuote.value },
      { componentId: 'food', providerId: 'doordash', category: 'FOOD', quote: foodQuote.value },
    );
    orchestrator.orchestrateBundle({
      bundleId: 'bundle_japan_comp',
      subjectRef: 'cust_japan_comp',
      failurePolicy: 'ALL_OR_NOTHING',
      components: compensationComponents,
    });
    const compensated = orchestrator.confirmBundle({
      bundleId: 'bundle_japan_comp',
      failurePolicy: 'ALL_OR_NOTHING',
      userApproved: true,
    });
    assert.equal(compensated.ok, true);
    if (!compensated.ok) {
      return;
    }
    assert.equal(compensated.value.status, 'FAILED');
    const mobilityRecord = orchestrator.get('bundle_japan_comp_mobility');
    assert.ok(mobilityRecord);
    assert.equal(mobilityRecord!.status, 'CANCELLED');
    assert.equal(mobilityRecord!.entitlementHoldState, 'RELEASED');
  });

  it('BFF Mustang path uses canonical provider orchestration behind stable routes', () => {
    const world = createSandboxWorld();
    const entitlements = bffCall(world, 'GET', '/api/v1/access/entitlements', 'basic_verified');
    const mobility = (entitlements.body as { items: { entitlementId: string; category: string }[] }).items.find(
      (row) => row.category === 'MOBILITY',
    );
    assert.ok(mobility);
    const search = bffCall(world, 'POST', '/api/v1/access/search', 'basic_verified', {
      category: 'MOBILITY',
      query: 'Mustang Miami',
      location: 'Miami, FL',
      providerId: 'turo',
    });
    assert.equal(search.status, 200);
    const quote = bffCall(world, 'POST', '/api/v1/access/quotes', 'basic_verified', {
      providerId: 'turo',
      catalogItemId: (search.body as { items: { catalogItemId: string }[] }).items[0]!.catalogItemId,
      quantity: 4,
      startsAt: '2026-08-29T10:00:00.000Z',
      endsAt: '2026-09-02T10:00:00.000Z',
      location: 'Miami, FL',
      idempotencyKey: 'access17_bff_quote',
    });
    assert.equal(quote.status, 201);
    const started = bffCall(world, 'POST', '/api/v1/access/redemptions', 'basic_verified', {
      category: 'MOBILITY',
      providerId: 'turo',
      quoteId: (quote.body as { quoteId: string }).quoteId,
      entitlementId: mobility!.entitlementId,
      entitlementClass: 'MOBILITY_STANDARD',
      requestedQuantity: 4,
      maxUserContributionMinorUnits: '0',
      idempotencyKey: 'access17_bff_redemption',
    });
    assert.equal(started.status, 201);
    const redemptionId = (started.body as { redemptionId: string }).redemptionId;
    const confirmed = bffCall(
      world,
      'POST',
      `/api/v1/access/redemptions/${redemptionId}/confirm`,
      'basic_verified',
      {},
    );
    assert.equal(confirmed.status, 200);
    assert.equal((confirmed.body as { status: string }).status, 'REDEEMED');
  });
});
