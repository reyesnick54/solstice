import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { interpretMandateLanguage } from '../../agent/src/interpretation.ts';
import { FrozenClock } from '../../config/src/clock.ts';
import { asCustomerId } from '../../domain/src/customer.ts';
import { asJurisdiction } from '../../domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { EvidenceVault } from '../../evidence/src/vault.ts';
import { DomainEventLog, type DomainEvent } from '../../events/src/events.ts';
import { SimulatedIdentityAdapter } from '../../identity/src/simulation.ts';
import { Money } from '../../money/src/money.ts';
import type { PersonalEconomicSnapshot } from '../../personal-economic-graph/src/snapshot.ts';
import { EconomicGraphService } from '../../personal-economic-graph/src/service.ts';
import { asGrowthActionId } from './ids.ts';
import { createSimulationKeyProvider } from '../../security/src/simulation.ts';
import { generateGrowthCandidates } from './growth/candidates.ts';
import { evaluateCandidateFeasibility, liquidForCurrency } from './growth/feasibility.ts';
import { evaluateGoalFeasibility } from './growth/goal-feasibility.ts';
import { shouldInvalidatePlan } from './growth/invalidation.ts';
import { materializeGrowthAction } from './growth/materialize.ts';
import { rankCandidates } from './growth/ranking.ts';
import { compileEconomicMandate, mandateDraftFromInterpretation } from './mandate/compiler.ts';
import { simulationPolicyPort } from './policy-port.ts';
import { GrowthOrchestrator } from './service.ts';

const NOW = asUtcInstant('2026-08-15T12:00:00.000Z');

function asSnapshot(value: object): PersonalEconomicSnapshot {
  return value as unknown as PersonalEconomicSnapshot;
}

function event(
  eventType: DomainEvent['eventType'],
  payload: Record<string, unknown>,
  eventId: string,
  occurredAt = NOW,
): DomainEvent {
  return {
    eventType,
    schemaVersion: 1,
    occurredAt,
    eventId,
    payload,
  } as DomainEvent;
}

function setupActor(actorId: string, identityId: string) {
  const clock = new FrozenClock(NOW);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const events = new DomainEventLog();
  const evidence = new EvidenceVault(clock);
  const identity = new SimulatedIdentityAdapter({ clock, keys, events, evidence });
  assert.equal(
    identity.provisionSimulatedActor({
      actorId,
      jurisdiction: asJurisdiction('US'),
      identityId,
      customerId: asCustomerId(`cust_${identityId}`),
      capabilities: [
        'VIEW_ECONOMIC_GRAPH',
        'DECLARE_ECONOMIC_FACT',
        'VIEW_GROWTH_PLAN',
        'CONFIRM_ECONOMIC_MANDATE',
      ],
    }).ok,
    true,
  );
  const actor = identity.service.resolveActorContext(actorId);
  if (!actor.ok) {
    throw new Error('actor');
  }
  return { clock, events, evidence, actor: actor.value };
}

function seedPeg(peg: EconomicGraphService, actor: unknown, subjectId: string, customerId: string): void {
  peg.registerAccountCurrency('acct_usd_checking', 'USD');
  peg.registerAccountCurrency('acct_usd_savings', 'USD');
  peg.openGraph(actor, subjectId, asCustomerId(customerId));
  peg.registerOverlay({
    sourceEventId: 'evt_sal',
    subjectId,
    classification: 'SALARY',
    counterpart: { kind: 'EMPLOYER', ref: 'acme', label: 'Acme' },
  });
  peg.registerOverlay({
    sourceEventId: 'evt_sub_0',
    subjectId,
    classification: 'SUBSCRIPTION',
    counterpart: { kind: 'MERCHANT', ref: 'sim_stream', label: 'SimStream' },
  });
  peg.registerOverlay({
    sourceEventId: 'evt_sub',
    subjectId,
    classification: 'SUBSCRIPTION',
    counterpart: { kind: 'MERCHANT', ref: 'sim_stream', label: 'SimStream' },
  });
  peg.registerOverlay({
    sourceEventId: 'evt_sub_2',
    subjectId,
    classification: 'SUBSCRIPTION',
    counterpart: { kind: 'MERCHANT', ref: 'sim_stream', label: 'SimStream' },
  });
  peg.ingestAll(
    [
      event(
        'AccountOpened',
        {
          accountId: 'acct_usd_checking',
          ownerId: customerId,
          accountClass: 'DEMAND_DEPOSIT',
          executionAuthorityId: 'ea',
          intentId: 'I-open',
        },
        'evt_open_c',
      ),
      event(
        'AccountOpened',
        {
          accountId: 'acct_usd_savings',
          ownerId: customerId,
          accountClass: 'SAVINGS_DEPOSIT',
          executionAuthorityId: 'ea2',
          intentId: 'I-open-s',
        },
        'evt_open_s',
      ),
      event(
        'DepositPosted',
        { journalId: 'j1', accountId: 'acct_usd_checking', amountMinorUnits: '1000000', currency: 'USD' },
        'evt_sal',
      ),
      event(
        'CardTransactionSettled',
        {
          cardId: 'card_1',
          customerId,
          merchantRef: 'sim_stream',
          amountMinorUnits: '1599',
          currency: 'USD',
          transactionRef: 'stream_0',
        },
        'evt_sub_0',
        asUtcInstant('2026-06-01T18:00:00.000Z'),
      ),
      event(
        'CardTransactionSettled',
        {
          cardId: 'card_1',
          customerId,
          merchantRef: 'sim_stream',
          amountMinorUnits: '1599',
          currency: 'USD',
          transactionRef: 'stream_1',
        },
        'evt_sub',
        asUtcInstant('2026-07-01T18:00:00.000Z'),
      ),
      event(
        'CardTransactionSettled',
        {
          cardId: 'card_1',
          customerId,
          merchantRef: 'sim_stream',
          amountMinorUnits: '1599',
          currency: 'USD',
          transactionRef: 'stream_2',
        },
        'evt_sub_2',
        asUtcInstant('2026-08-01T18:00:00.000Z'),
      ),
      event(
        'AccountPositionChanged',
        { accountId: 'acct_usd_checking', amountMinorUnits: '1400000', currency: 'USD' },
        'evt_pos_c',
      ),
      event(
        'AccountPositionChanged',
        { accountId: 'acct_usd_savings', amountMinorUnits: '200000', currency: 'USD' },
        'evt_pos_s',
      ),
    ],
    subjectId,
  );
  peg.declareIncomeSource(actor, subjectId, {
    incomeKind: 'SALARY',
    label: 'Salary',
    estimatedAmount: { minorUnits: '1000000', currency: 'USD' },
  });
  peg.declareDebt(actor, subjectId, {
    debtKind: 'CREDIT',
    label: 'Expensive card debt',
    estimatedBalance: { minorUnits: '450000', currency: 'USD' },
  });
  peg.declareGoal(actor, subjectId, {
    goalKind: 'EMERGENCY_RESERVE',
    label: 'Emergency fund',
    target: { minorUnits: '2000000', currency: 'USD' },
    priority: 1,
  });
  peg.materializeRecurring(subjectId);
  peg.proposeOpportunities(subjectId);
}

describe('Growth Orchestrator demo path', () => {
  it('compiles, confirms, plans, rejects floor violations, and never executes', () => {
    const { clock, events, evidence, actor } = setupActor('actor_growth_1', 'id_growth_1');
    const peg = new EconomicGraphService({ clock, events });
    seedPeg(peg, actor, actor.subjectId, `cust_${actor.subjectId}`);
    const orchestrator = new GrowthOrchestrator({ clock, events, peg, evidence });
    const compiled = orchestrator.interpretAndCompile(actor, {
      subjectId: actor.subjectId,
      sourceText:
        'Keep at least $8,000 liquid. Build my emergency fund to $20,000. Reduce expensive debt. Do not make high-risk investments. Ask me before any movement over $1,000.',
    });
    if (!compiled.ok) {
      throw new Error('expected ok');
    }
    const active = orchestrator.confirmAndActivate(actor, actor.subjectId);
    if (!active.ok) {
      throw new Error('expected ok');
    }
    assert.equal(active.value.state, 'ACTIVE');
    const planned = orchestrator.plan(actor, actor.subjectId);
    if (!planned.ok) {
      throw new Error('expected ok');
    }
    assert.ok(planned.value.plan.rejectedCandidates.length >= 1);
    assert.ok(
      planned.value.plan.rejectedCandidates.some(
        (item) => item.reasons.includes('LIQUIDITY_FLOOR') || item.candidate.source === 'SYNTHETIC_GUARD',
      ),
    );
    assert.ok(planned.value.plan.orderedProposedActions.some((item) => item.action === 'REVIEW_SUBSCRIPTION'));
    const proposedKinds = planned.value.plan.orderedProposedActions.map((item) => item.action);
    assert.ok(
      proposedKinds.slice(0, 3).includes('REVIEW_SUBSCRIPTION'),
      `subscription should rank highly, got ${proposedKinds.join(',')}`,
    );
    assert.ok(planned.value.plan.candidateActions.some((item) => item.action === 'REDUCE_DEBT'));
    const reserve = planned.value.plan.orderedProposedActions.find(
      (item) => item.action === 'ALLOCATE_TO_EMERGENCY_RESERVE',
    );
    assert.ok(reserve);
    assert.equal(reserve?.userConfirmationRequired, true);
    const investment = planned.value.plan.candidateActions.find(
      (item) => item.action === 'REVIEW_INVESTMENT_OPPORTUNITY_FUTURE',
    );
    assert.ok(
      investment?.executionCapability === 'DEPENDENCY_NOT_IMPLEMENTED' ||
        investment?.executionCapability === 'PROPOSAL_ONLY',
    );
    const blocked = orchestrator.materializeApprovedAction(
      actor,
      actor.subjectId,
      investment?.actionId ?? 'gac_none',
      true,
    );
    assert.equal(blocked.ok, false);
    const stale = orchestrator.ingestPlanningEvent(
      actor.subjectId,
      event('EconomicGraphFactUpdated', { graphId: 'g', key: 'income' }, 'evt_stale'),
    );
    assert.equal(stale?.state, 'STALE');
    assert.equal(shouldInvalidatePlan({ plan: planned.value.plan, event: { eventType: 'DepositPosted' } }), true);
    const again = orchestrator.plan(actor, actor.subjectId);
    if (!again.ok) {
      throw new Error('expected ok');
    }
    assert.equal(again.value.plan.state, 'CURRENT');
    assert.ok(evidence.list().some((item) => item.kind === 'MANDATE_CONFIRMED'));
    assert.ok(evidence.list().some((item) => item.kind === 'GROWTH_PLAN_GENERATED'));
  });
});

describe('guaranteed-return prohibition', () => {
  it('preserves the aggressive goal, computes the required change, and does not promise it', () => {
    const interpretation = interpretMandateLanguage({
      subjectId: 'id_aggressive',
      sourceText: 'I want $1,000 to become $1,300 next week.',
      now: NOW,
    });
    if (!interpretation.ok) {
      throw new Error('expected ok');
    }
    const draft = mandateDraftFromInterpretation(interpretation.value, NOW);
    const compiled = compileEconomicMandate({ draft, now: NOW });
    if (!compiled.ok) {
      throw new Error('expected ok');
    }
    const goal = compiled.value.goals.find((item) => item.kind === 'AGGRESSIVE_SHORT_HORIZON_GROWTH');
    assert.ok(goal);
    assert.equal(goal?.baseline?.minorUnits, '100000');
    assert.equal(goal?.target?.minorUnits, '130000');
    const required = Money.fromMinorUnitsString('130000', 'USD').minus(
      Money.fromMinorUnitsString('100000', 'USD'),
    );
    assert.equal(required.minorUnits, 30000n);
    const snapshot = {
      snapshotId: 'pegs_x',
      graphId: 'pegg_x',
      subjectId: 'id_aggressive',
      generatedAt: NOW,
      liquidAssetsByCurrency: Object.freeze([
        {
          amount: { minorUnits: '100000', currency: 'USD' },
          sourceRefs: Object.freeze(['acct']),
          confidence: 'DERIVED' as const,
        },
      ]),
      income: Object.freeze([]),
      knownRecurringObligations: Object.freeze([]),
      debt: Object.freeze([]),
      investments: Object.freeze([]),
      monthlyCashFlow: Object.freeze([]),
      goals: Object.freeze([]),
      economicOpportunities: Object.freeze([]),
      valuationContext: null,
      authoritativeBalance: false,
      ledgerWins: true,
      crossCurrencyTotal: null,
    };
    const feasibility = evaluateGoalFeasibility(compiled.value, asSnapshot(snapshot));
    const scored = feasibility.find((item) => item.goalId === goal?.goalId);
    assert.equal(scored?.state, 'INFEASIBLE_WITH_CURRENT_FACTS');
    assert.equal(scored?.requiredChange?.minorUnits, '30000');
    assert.equal(scored?.achievementPromised, false);
    assert.equal(scored?.investmentExecutionAvailable, false);
    const candidates = generateGrowthCandidates({
      mandate: compiled.value,
      snapshot: asSnapshot(snapshot),
      ideas: Object.freeze([]),
      policy: simulationPolicyPort,
      planning: { investmentExecutionImplemented: false },
    });
    const invest = candidates.find((item) => item.action === 'REVIEW_INVESTMENT_OPPORTUNITY_FUTURE');
    assert.equal(invest?.expectedEffect.kind, 'UNCERTAIN_MARKET_OUTCOME');
    if (invest?.expectedEffect.kind === 'UNCERTAIN_MARKET_OUTCOME') {
      assert.equal(invest.expectedEffect.achievementPromised, false);
    }
    assert.equal(
      JSON.stringify(invest).includes('guaranteed') || JSON.stringify(scored).includes('guaranteedReturn'),
      false,
    );
  });
});

describe('feasibility and ranking', () => {
  it('rejects a candidate that breaches the liquidity floor', () => {
    const interpretation = interpretMandateLanguage({
      subjectId: 'id_floor',
      sourceText: 'Keep at least $8,000 liquid and reduce expensive debt.',
      now: NOW,
    });
    if (!interpretation.ok) {
      throw new Error('expected ok');
    }
    const draft = mandateDraftFromInterpretation(interpretation.value, NOW);
    const compiled = compileEconomicMandate({ draft, now: NOW });
    if (!compiled.ok) {
      throw new Error('expected ok');
    }
    const snapshot = {
      snapshotId: 'pegs_f',
      graphId: 'pegg_f',
      subjectId: 'id_floor',
      generatedAt: NOW,
      liquidAssetsByCurrency: Object.freeze([
        {
          amount: { minorUnits: '900000', currency: 'USD' },
          sourceRefs: Object.freeze(['acct_usd_checking']),
          confidence: 'DERIVED' as const,
        },
      ]),
      income: Object.freeze([{ nodeId: 'n', label: 'Salary', incomeKind: 'SALARY', confidence: 'USER_DECLARED' as const, sourceRefs: Object.freeze([]) }]),
      knownRecurringObligations: Object.freeze([]),
      debt: Object.freeze([]),
      investments: Object.freeze([]),
      monthlyCashFlow: Object.freeze([]),
      goals: Object.freeze([]),
      economicOpportunities: Object.freeze([]),
      valuationContext: null,
      authoritativeBalance: false,
      ledgerWins: true,
      crossCurrencyTotal: null,
    };
    const liquid = liquidForCurrency(asSnapshot(snapshot), 'USD');
    assert.equal(liquid.minorUnits, 900000n);
    const candidates = generateGrowthCandidates({
      mandate: compiled.value,
      snapshot: asSnapshot(snapshot),
      ideas: Object.freeze([]),
      policy: simulationPolicyPort,
      planning: { investmentExecutionImplemented: false },
    });
    const guard = candidates.find((item) => item.source === 'SYNTHETIC_GUARD');
    assert.ok(guard);
    const result = evaluateCandidateFeasibility({
      candidate: guard!,
      mandate: compiled.value,
      snapshot: asSnapshot(snapshot),
      policy: simulationPolicyPort,
      planning: { investmentExecutionImplemented: false },
    });
    assert.equal(result.accepted, false);
    assert.ok(result.reasons.includes('LIQUIDITY_FLOOR') || result.reasons.includes('USER_MANDATE'));
  });

  it('ranks subscription review ahead of investment placeholders', () => {
    const interpretation = interpretMandateLanguage({
      subjectId: 'id_rank',
      sourceText: 'Keep at least $8,000 liquid. Reduce unnecessary fees. Reduce expensive debt.',
      now: NOW,
    });
    if (!interpretation.ok) {
      throw new Error('expected ok');
    }
    const draft = mandateDraftFromInterpretation(interpretation.value, NOW);
    const compiled = compileEconomicMandate({ draft, now: NOW });
    if (!compiled.ok) {
      throw new Error('expected ok');
    }
    const snapshot = {
      snapshotId: 'pegs_r',
      graphId: 'pegg_r',
      subjectId: 'id_rank',
      generatedAt: NOW,
      liquidAssetsByCurrency: Object.freeze([
        {
          amount: { minorUnits: '1600000', currency: 'USD' },
          sourceRefs: Object.freeze(['acct_usd_checking']),
          confidence: 'DERIVED' as const,
        },
      ]),
      income: Object.freeze([]),
      knownRecurringObligations: Object.freeze([
        {
          nodeId: 'sub1',
          kind: 'SUBSCRIPTION',
          label: 'SimStream',
          estimatedAmount: { minorUnits: '1599', currency: 'USD' },
          confidence: 'DERIVED' as const,
          sourceRefs: Object.freeze(['evt_sub']),
        },
      ]),
      debt: Object.freeze([
        { nodeId: 'd1', label: 'Card', holdingKind: 'USER_DECLARED', confidence: 'USER_DECLARED' as const },
      ]),
      investments: Object.freeze([]),
      monthlyCashFlow: Object.freeze([]),
      goals: Object.freeze([]),
      economicOpportunities: Object.freeze([]),
      valuationContext: null,
      authoritativeBalance: false,
      ledgerWins: true,
      crossCurrencyTotal: null,
    };
    const candidates = generateGrowthCandidates({
      mandate: compiled.value,
      snapshot: asSnapshot(snapshot),
      ideas: Object.freeze([]),
      policy: simulationPolicyPort,
      planning: { investmentExecutionImplemented: false },
    });
    const accepted = candidates.filter((item) => item.source !== 'SYNTHETIC_GUARD');
    const ranked = rankCandidates(accepted, compiled.value);
    assert.equal(ranked[0]?.action, 'REVIEW_SUBSCRIPTION');
  });
});

describe('ActionIntent bridge', () => {
  it('materializes only an approved supported internal transfer and never auto-submits', () => {
    const supported = materializeGrowthAction({
      candidate: {
        actionId: asGrowthActionId('gac_move_idle_demo'),
        action: 'MOVE_IDLE_CASH_BETWEEN_EXISTING_ELIGIBLE_ACCOUNTS',
        source: 'PEG',
        title: 'Move idle cash',
        expectedEffect: {
          kind: 'DETERMINISTIC_EFFECT',
          amount: { minorUnits: '5000', currency: 'USD' },
          description: 'reallocation',
        },
        confidenceScore: 60,
        assumptions: Object.freeze([]),
        liquidityImpact: { minorUnits: '0', currency: 'USD' },
        riskClass: 'LOW',
        mandateEvaluation: { satisfied: true, violatedConstraintKinds: Object.freeze([]), notes: Object.freeze([]) },
        userConfirmationRequired: false,
        policyRequirement: 'none',
        complianceRequirement: 'none',
        executionCapability: 'KERNEL_AUTHORIZATION_REQUIRED',
        sourceAccountId: 'acct_usd_checking',
        destinationAccountId: 'acct_usd_savings',
        proposedAmount: { minorUnits: '5000', currency: 'USD' },
        supportingFactRefs: Object.freeze([]),
        supportingGoalIds: Object.freeze([]),
        agentProposalIds: Object.freeze([]),
        pegOpportunityIds: Object.freeze([]),
      },
      approved: true,
      actorId: 'actor',
      requestedAt: NOW,
    });
    if (!supported.ok) {
      throw new Error('expected ok');
    }
    assert.equal(supported.value.actionType, 'INTERNAL_TRANSFER');
    const unsupported = materializeGrowthAction({
      candidate: {
        actionId: asGrowthActionId('gac_review_investment_future'),
        action: 'REVIEW_INVESTMENT_OPPORTUNITY_FUTURE',
        source: 'AGENT_PROPOSAL',
        title: 'Invest',
        expectedEffect: {
          kind: 'UNCERTAIN_MARKET_OUTCOME',
          scenario: 'none',
          low: { minorUnits: '0', currency: 'USD' },
          high: { minorUnits: '0', currency: 'USD' },
          assumptions: Object.freeze([]),
          confidenceScore: 0,
          horizonDays: 0,
          riskClass: 'UNCERTAIN_MARKET',
          achievementPromised: false,
        },
        confidenceScore: 0,
        assumptions: Object.freeze([]),
        liquidityImpact: { minorUnits: '0', currency: 'USD' },
        riskClass: 'UNCERTAIN_MARKET',
        mandateEvaluation: { satisfied: true, violatedConstraintKinds: Object.freeze([]), notes: Object.freeze([]) },
        userConfirmationRequired: true,
        policyRequirement: 'none',
        complianceRequirement: 'none',
        executionCapability: 'DEPENDENCY_NOT_IMPLEMENTED',
        supportingFactRefs: Object.freeze([]),
        supportingGoalIds: Object.freeze([]),
        agentProposalIds: Object.freeze([]),
        pegOpportunityIds: Object.freeze([]),
      },
      approved: true,
      actorId: 'actor',
      requestedAt: NOW,
    });
    assert.equal(unsupported.ok, false);
  });
});

describe('pre-trade risk annotations', () => {
  it('rejects a Growth candidate that Risk marked incompatible', () => {
    const interpretation = interpretMandateLanguage({
      subjectId: 'id_risk_limit',
      sourceText: 'Keep at least $8,000 liquid.',
      now: NOW,
    });
    if (!interpretation.ok) {
      throw new Error('expected ok');
    }
    const draft = mandateDraftFromInterpretation(interpretation.value, NOW);
    const compiled = compileEconomicMandate({ draft, now: NOW });
    if (!compiled.ok) {
      throw new Error('expected ok');
    }
    const candidate = {
      actionId: asGrowthActionId('gac_risk_block'),
      action: 'REVIEW_INVESTMENT_OPPORTUNITY_FUTURE' as const,
      source: 'AGENT_PROPOSAL' as const,
      title: 'Buy more of one ETF',
      expectedEffect: {
        kind: 'UNCERTAIN_MARKET_OUTCOME' as const,
        scenario: 'none',
        low: { minorUnits: '0', currency: 'USD' },
        high: { minorUnits: '0', currency: 'USD' },
        assumptions: Object.freeze([] as const),
        confidenceScore: 0,
        horizonDays: 0,
        riskClass: 'UNCERTAIN_MARKET' as const,
        achievementPromised: false as const,
      },
      confidenceScore: 0,
      assumptions: Object.freeze([] as const),
      liquidityImpact: { minorUnits: '0', currency: 'USD' },
      riskClass: 'UNCERTAIN_MARKET' as const,
      mandateEvaluation: { satisfied: true, violatedConstraintKinds: Object.freeze([] as const), notes: Object.freeze([] as const) },
      userConfirmationRequired: true,
      policyRequirement: 'none',
      complianceRequirement: 'none',
      executionCapability: 'PROPOSAL_ONLY' as const,
      supportingFactRefs: Object.freeze([] as const),
      supportingGoalIds: Object.freeze([] as const),
      agentProposalIds: Object.freeze([] as const),
      pegOpportunityIds: Object.freeze([] as const),
    };
    const result = evaluateCandidateFeasibility({
      candidate,
      mandate: compiled.value,
      snapshot: asSnapshot({
        snapshotId: 'pegs_risk',
        graphId: 'pegg_risk',
        subjectId: 'id_risk_limit',
        generatedAt: NOW,
        liquidAssetsByCurrency: Object.freeze([
          {
            amount: { minorUnits: '2000000', currency: 'USD' },
            sourceRefs: Object.freeze(['acct_usd_checking']),
            confidence: 'DERIVED' as const,
          },
        ]),
        income: Object.freeze([]),
        knownRecurringObligations: Object.freeze([]),
        debt: Object.freeze([]),
        investments: Object.freeze([]),
        monthlyCashFlow: Object.freeze([]),
        goals: Object.freeze([]),
        economicOpportunities: Object.freeze([]),
        valuationContext: null,
        authoritativeBalance: false,
        ledgerWins: true,
        crossCurrencyTotal: null,
      }),
      policy: simulationPolicyPort,
      planning: {
        investmentExecutionImplemented: false,
        riskAnnotations: Object.freeze([
          {
            candidateRef: 'gac_risk_block',
            compatible: false,
            outcome: 'BLOCK',
            reason: 'violates concentration',
          },
        ]),
      },
    });
    assert.equal(result.accepted, false);
    assert.equal(result.reasons.includes('RISK_LIMIT'), true);
  });
});

describe('investment review opportunities', () => {
  it('surfaces rebalance, diversify, and deploy-cash as proposal-only', () => {
    const { clock, events, evidence, actor } = setupActor('actor_growth_invest', 'id_growth_invest');
    const peg = new EconomicGraphService({ clock, events });
    seedPeg(peg, actor, actor.subjectId, `cust_${actor.subjectId}`);
    const orchestrator = new GrowthOrchestrator({ clock, events, peg, evidence });
    const compiled = orchestrator.interpretAndCompile(actor, {
      subjectId: actor.subjectId,
      sourceText: 'Keep at least $8,000 liquid. Invest surplus later. Ask me before any movement over $1,000.',
    });
    if (!compiled.ok) {
      throw new Error('expected ok');
    }
    const active = orchestrator.confirmAndActivate(actor, actor.subjectId);
    if (!active.ok) {
      throw new Error('expected ok');
    }
    const planned = orchestrator.plan(actor, actor.subjectId, {
      investmentReview: {
        portfolioId: 'pf_inv_growth',
        opportunities: Object.freeze([
          {
            kind: 'REBALANCE_PORTFOLIO_PROPOSAL',
            title: 'Rebalance toward the target allocation',
            detail: '1 candidate trade. User confirmation and Kernel are required.',
          },
          {
            kind: 'DIVERSIFY_CONCENTRATION_PROPOSAL',
            title: 'Review concentrated holding',
            detail: 'Largest instrument weight is 8000 bps.',
          },
          {
            kind: 'DEPLOY_INVESTMENT_CASH_PROPOSAL',
            title: 'Deploy available investment cash',
            detail: 'Idle brokerage cash is above the cash sleeve.',
            amountMinorUnits: '5000',
          },
        ]),
      },
    });
    if (!planned.ok) {
      throw new Error('expected investment review plan');
    }
    const kinds = planned.value.plan.candidateActions.map((item) => item.action);
    assert.ok(kinds.includes('REBALANCE_PORTFOLIO_PROPOSAL'));
    assert.ok(kinds.includes('DIVERSIFY_CONCENTRATION_PROPOSAL'));
    assert.ok(kinds.includes('DEPLOY_INVESTMENT_CASH_PROPOSAL'));
    const rebalance = planned.value.plan.candidateActions.find(
      (item) => item.action === 'REBALANCE_PORTFOLIO_PROPOSAL',
    );
    assert.equal(rebalance?.executionCapability, 'PROPOSAL_ONLY');
    const explained = planned.value.plan.orderedProposedActions.find(
      (item) => item.action === 'REBALANCE_PORTFOLIO_PROPOSAL',
    );
    assert.ok(explained);
    const blocked = orchestrator.materializeApprovedAction(
      actor,
      actor.subjectId,
      rebalance?.actionId ?? 'gac_none',
      true,
    );
    assert.equal(blocked.ok, false);
  });
});
