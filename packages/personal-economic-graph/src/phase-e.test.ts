import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import { asCustomerId } from '../../domain/src/customer.ts';
import { asJurisdiction } from '../../domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { DomainEventLog, type DomainEvent } from '../../events/src/events.ts';
import { createSimulationKeyProvider } from '../../security/src/simulation.ts';
import { SimulatedIdentityAdapter } from '../../identity/src/simulation.ts';
import { materializeProvenance } from './provenance.ts';
import { applyPersonaSeed, personaSeed } from './personas.ts';
import { PegUpdatePipeline } from './pipeline.ts';
import { authorizeAgentCategories } from './privacy.ts';
import { assessSuitability } from './suitability.ts';
import { EconomicGraphService } from './service.ts';
import { InMemoryEconomicGraphStore } from './store.ts';
import { asEconomicSourceId, deterministicSourceId } from './ids.ts';

const NOW = asUtcInstant('2026-07-15T12:00:00.000Z');

function harness(
  capabilities: readonly string[] = ['VIEW_ECONOMIC_GRAPH', 'DECLARE_ECONOMIC_FACT', 'OPERATE_ECONOMIC_GRAPH'],
) {
  const clock = new FrozenClock(NOW);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const events = new DomainEventLog();
  const identity = new SimulatedIdentityAdapter({ clock, keys, events });
  const subjectId = 'id_peg_phase_e';
  const provisioned = identity.provisionSimulatedActor({
    actorId: 'actor_peg_phase_e',
    jurisdiction: asJurisdiction('US'),
    identityId: subjectId,
    customerId: asCustomerId('cust_peg_phase_e'),
    capabilities: capabilities as never,
  });
  assert.equal(provisioned.ok, true);
  const actor = identity.service.resolveActorContext('actor_peg_phase_e');
  if (!actor.ok) {
    throw new Error('actor');
  }
  const peg = new EconomicGraphService({ clock, events });
  return { clock, events, identity, subjectId, actor: actor.value, peg };
}

describe('Phase E PEG productization', () => {
  it('materializes provenance fact kinds', () => {
    const fact = materializeProvenance({
      sourceId: asEconomicSourceId('peg_src_canonical_ledger_j1'),
      sourceType: 'CANONICAL_LEDGER',
      sourceRef: 'j1',
      observedAt: NOW,
      effectiveAt: NOW,
      confidence: 'VERIFIED',
      version: 1,
    });
    assert.equal(fact.source, 'CANONICAL_LEDGER');
    assert.equal(fact.sourceReference, 'j1');
    assert.equal(fact.verificationState, 'LEDGER_BACKED');
    assert.equal(fact.userDeclared, false);
    assert.equal(fact.derived, false);
    assert.equal(fact.factKind, 'FACT');
    const declared = materializeProvenance({
      sourceId: deterministicSourceId('USER_DECLARED', 'u'),
      sourceType: 'USER_DECLARED',
      sourceRef: 'u',
      observedAt: NOW,
      effectiveAt: NOW,
      confidence: 'USER_DECLARED',
      version: 1,
    });
    assert.equal(declared.factKind, 'USER_DECLARATION');
    assert.equal(declared.userDeclared, true);
  });

  it('builds a financial snapshot without summing unlike currencies', () => {
    const { peg, actor } = harness();
    applyPersonaSeed(peg, actor, personaSeed('MULTI_CURRENCY_USER'));
    const snapshot = peg.getFinancialSnapshot(actor, 'idn_peg_multi_fx');
    assert.equal(snapshot.ok, true);
    if (!snapshot.ok) {
      throw new Error('snapshot');
    }
    assert.equal(snapshot.value.crossCurrencyTotal, null);
    assert.equal(snapshot.value.authoritativeBalance, false);
    assert.equal(snapshot.value.ledgerWins, true);
    assert.equal(snapshot.value.guaranteedReturn, false);
    assert.ok(snapshot.value.cash.length >= 2);
    const currencies = new Set(snapshot.value.cash.map((row) => row.amount.currency));
    assert.ok(currencies.has('USD'));
    assert.ok(currencies.has('SAR'));
  });

  it('derives cash-flow surplus, deficit, and recurring confidence', () => {
    const { peg, actor } = harness();
    applyPersonaSeed(peg, actor, personaSeed('HIGH_SPENDER'));
    const analysis = peg.cashFlowAnalysisFor('idn_peg_spender');
    const usd = analysis.find((row) => row.currency === 'USD');
    assert.ok(usd);
    assert.equal(usd.mandatoryObligations.confidence, 'DERIVED');
    assert.ok(BigInt(usd.monthlySurplusOrDeficit.amount.minorUnits) < 0n);
  });

  it('creates, patches, and lifecycle-manages goals', () => {
    const { peg, actor, subjectId } = harness();
    peg.openGraph(actor, subjectId);
    const created = peg.declareGoal(actor, subjectId, {
      goalKind: 'WEALTH_TARGET',
      label: 'Wealth',
      target: { minorUnits: '5000000', currency: 'USD' },
      priority: 2,
      minimumLiquidity: { minorUnits: '100000', currency: 'USD' },
    });
    assert.equal(created.ok, true);
    if (!created.ok) {
      throw new Error('goal');
    }
    const patched = peg.updateGoal(actor, subjectId, created.value.nodeId, { status: 'PAUSED', name: 'Paused wealth' });
    assert.equal(patched.ok, true);
    if (!patched.ok || patched.value.attributes.kind !== 'GOAL') {
      throw new Error('patch');
    }
    assert.equal(patched.value.attributes.status, 'PAUSED');
    assert.equal(patched.value.attributes.name, 'Paused wealth');
  });

  it('assesses suitability deterministically and tightens capacity', () => {
    const profile = assessSuitability(
      {
        riskTolerance: 'VERY_HIGH',
        liquidReserveMonths: 1,
        knownNearTermNeed: true,
        investmentHorizonYears: 1,
        expectedWithdrawalYears: 1,
        investmentExperience: 'NONE',
        lossSensitivity: 'VERY_HIGH',
        jurisdiction: 'US',
      },
      NOW,
    );
    assert.equal(profile.llmFabricated, false);
    assert.equal(profile.riskCapacity, 'CONSTRAINED');
    assert.equal(profile.riskTolerance, 'LOW');
    assert.equal(profile.timeHorizon, 'NEAR_TERM');
  });

  it('emits derived insights for idle cash and goal gaps', () => {
    const { peg, actor } = harness();
    applyPersonaSeed(peg, actor, personaSeed('HIGH_IDLE_CASH'));
    const insights = peg.getInsights(actor, 'idn_peg_idle_cash');
    assert.equal(insights.ok, true);
    if (!insights.ok) {
      throw new Error('insights');
    }
    assert.ok(insights.value.some((row) => row.type === 'HIGH_IDLE_CASH'));
    assert.ok(insights.value.every((row) => row.recommendation === null));
  });

  it('refuses user override of a ledger-backed balance', () => {
    const { peg, actor, subjectId } = harness();
    const refused = peg.overrideAuthoritativeBalance(actor, subjectId, {
      accountId: 'acct_usd',
      amount: { minorUnits: '1', currency: 'USD' },
    });
    assert.equal(refused.ok, false);
    if (!refused.ok) {
      assert.equal(refused.error.code, 'AUTHORITATIVE_FACT_IMMUTABLE');
    }
  });

  it('persists user classification corrections across rebuild', () => {
    const { peg, actor, subjectId } = harness();
    peg.openGraph(actor, subjectId);
    const overlay = peg.correctActivityClassification(actor, subjectId, {
      sourceEventId: 'e_user_fix',
      classification: 'SALARY',
      counterpart: { kind: 'EMPLOYER', ref: 'acme' },
    });
    assert.equal(overlay.ok, true);
    const event = {
      eventType: 'DepositPosted',
      schemaVersion: 1,
      occurredAt: NOW,
      eventId: 'e_user_fix',
      payload: { journalId: 'j_fix', accountId: 'acct_usd', amountMinorUnits: '1000000', currency: 'USD' },
    } as DomainEvent;
    peg.registerAccountCurrency('acct_usd', 'USD');
    peg.ingest(event, subjectId);
    const rebuilt = peg.rebuildDerivedProjection(subjectId, [event]);
    assert.equal(rebuilt.ok, true);
    assert.equal(peg.store.getOverlay('e_user_fix')?.userCorrected, true);
  });

  it('rebuilds from source records without silent divergence', () => {
    const { peg, actor } = harness();
    const seed = personaSeed('HEALTHY_SAVER');
    applyPersonaSeed(peg, actor, seed);
    const before = peg.getEconomicGraph(actor, seed.subjectId);
    if (!before.ok) {
      throw new Error('before');
    }
    const rebuilt = peg.rebuildDerivedProjection(seed.subjectId, seed.events);
    assert.equal(rebuilt.ok, true);
    if (!rebuilt.ok) {
      throw new Error('rebuild');
    }
    assert.ok(rebuilt.value.nodes.some((node) => node.kind === 'GOAL' && node.survivesRebuild));
  });

  it('records historical snapshot series', () => {
    const { peg, actor } = harness();
    applyPersonaSeed(peg, actor, personaSeed('GOAL_ORIENTED_USER'));
    const history = peg.getHistory(actor, 'idn_peg_goals', 'GOAL_PROGRESS');
    assert.equal(history.ok, true);
    if (!history.ok) {
      throw new Error('history');
    }
    assert.ok(history.value.length >= 1);
  });

  it('denies agent access without a mandate', () => {
    const { peg, actor, subjectId } = harness();
    peg.openGraph(actor, subjectId);
    const denied = peg.getAgentProfile(actor, subjectId, null);
    assert.equal(denied.ok, false);
    if (!denied.ok) {
      assert.equal(denied.error.code, 'MANDATE_REQUIRED');
    }
    const scoped = authorizeAgentCategories(
      {
        mandateId: 'man_grow',
        subjectId,
        allowedCategories: ['GOAL', 'INSIGHT'],
        purpose: 'AGENT_ANALYSIS',
        expiresAt: null,
      },
      ['CASH_POSITION', 'GOAL'],
      NOW,
    );
    assert.equal(scoped.ok, true);
    if (scoped.ok) {
      assert.deepEqual([...scoped.value], ['GOAL']);
    }
  });

  it('reloads persisted overlays and suitability after restart', () => {
    const { peg, actor, clock } = harness();
    applyPersonaSeed(peg, actor, personaSeed('HIGH_CONCENTRATION_USER'));
    const state = peg.store.exportState();
    const restored = new InMemoryEconomicGraphStore();
    restored.loadState(state);
    const restarted = new EconomicGraphService({ clock, store: restored });
    const suitability = restarted.getSuitability(actor, 'idn_peg_concentrated');
    assert.equal(suitability.ok, true);
    if (!suitability.ok) {
      throw new Error('suitability');
    }
    assert.equal(suitability.value?.concentration, 'HIGHLY_CONCENTRATED');
    const insights = restarted.getInsights(actor, 'idn_peg_concentrated');
    assert.equal(insights.ok, true);
    if (insights.ok) {
      assert.ok(insights.value.some((row) => row.type === 'HIGH_CONCENTRATION'));
    }
  });

  it('updates the graph from pipeline jobs without a synchronous rebuild on enqueue', async () => {
    const { peg, actor, clock, subjectId } = harness();
    peg.openGraph(actor, subjectId);
    const pipeline = new PegUpdatePipeline({
      peg,
      now: () => clock.now(),
      nowMs: () => Date.parse(clock.now()),
    });
    await pipeline.enqueueIngest(subjectId, {
      eventType: 'AccountOpened',
      schemaVersion: 1,
      occurredAt: NOW,
      eventId: 'e_job_open',
      payload: {
        accountId: 'acct_job',
        ownerId: 'cust_peg_phase_e',
        accountClass: 'DEMAND_DEPOSIT',
        executionAuthorityId: 'ea',
        intentId: 'I-job',
      },
    } as DomainEvent);
    const before = peg.getEconomicGraph(actor, subjectId);
    if (!before.ok) {
      throw new Error('before');
    }
    assert.equal(before.value.nodes.some((node) => node.kind === 'ACCOUNT'), false);
    await pipeline.drain();
    const after = peg.getEconomicGraph(actor, subjectId);
    if (!after.ok) {
      throw new Error('after');
    }
    assert.ok(after.value.nodes.some((node) => node.kind === 'ACCOUNT'));
  });
});
