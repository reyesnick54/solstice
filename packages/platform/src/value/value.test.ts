import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../../config/src/clock.ts';
import { asCustomerId } from '../../../domain/src/customer.ts';
import { asJurisdiction } from '../../../domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';
import { EvidenceVault } from '../../../evidence/src/vault.ts';
import { DomainEventLog } from '../../../events/src/events.ts';
import { SimulatedIdentityAdapter } from '../../../identity/src/simulation.ts';
import { EconomicGraphService } from '../../../personal-economic-graph/src/service.ts';
import { createSimulationKeyProvider } from '../../../security/src/simulation.ts';
import { FORMULA_V1, FORMULA_V2, MODEL_V1, MODEL_V2 } from './formula.ts';
import { asEconomicValueDimensionId } from './ids.ts';
import { PersonalEconomicValueEngine } from './service.ts';
import { PROTECTED_TRAIT_KEYS } from './taxonomy.ts';

const NOW = asUtcInstant('2026-08-15T12:00:00.000Z');

function setup(actorId: string, identityId: string) {
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
        'VIEW_ECONOMIC_VALUE',
        'CONFIRM_ECONOMIC_MANDATE',
      ],
    }).ok,
    true,
  );
  const actor = identity.service.resolveActorContext(actorId);
  if (!actor.ok) {
    throw new Error('actor');
  }
  const peg = new EconomicGraphService({ clock, events });
  peg.openGraph(actor.value, identityId, asCustomerId(`cust_${identityId}`));
  peg.declareIncomeSource(actor.value, identityId, {
    incomeKind: 'SALARY',
    label: 'Salary',
    estimatedAmount: { minorUnits: '500000', currency: 'USD' },
  });
  peg.declareDebt(actor.value, identityId, {
    debtKind: 'CREDIT',
    label: 'Card debt',
    estimatedBalance: { minorUnits: '200000', currency: 'USD' },
  });
  peg.declareGoal(actor.value, identityId, {
    goalKind: 'EMERGENCY_RESERVE',
    label: 'Emergency reserve',
    target: { minorUnits: '1500000', currency: 'USD' },
    priority: 1,
  });
  peg.registerAccountCurrency('acct_usd_checking', 'USD');
  peg.ingest(
    {
      eventType: 'AccountOpened',
      schemaVersion: 1,
      occurredAt: NOW,
      eventId: `evt_open_${identityId}`,
      payload: {
        accountId: 'acct_usd_checking',
        ownerId: `cust_${identityId}`,
        accountClass: 'DEMAND_DEPOSIT',
        executionAuthorityId: 'ea',
        intentId: 'I-open',
      },
    } as never,
    identityId,
  );
  peg.ingest(
    {
      eventType: 'AccountPositionChanged',
      schemaVersion: 1,
      occurredAt: NOW,
      eventId: `evt_pos_${identityId}`,
      payload: { accountId: 'acct_usd_checking', amountMinorUnits: '800000', currency: 'USD' },
    } as never,
    identityId,
  );
  const snapshot = peg.getEconomicSnapshot(actor.value, identityId);
  if (!snapshot.ok) {
    throw new Error('peg snapshot');
  }
  const peve = new PersonalEconomicValueEngine({ clock, events, evidence });
  return { actor: actor.value, peg, peve, events, evidence, snapshot: snapshot.value, subjectId: identityId };
}

describe('Personal Economic Value Engine', () => {
  it('produces a multi-dimensional explainable snapshot without a human-worth score', () => {
    const { actor, peve, snapshot, subjectId } = setup('actor_peve_1', 'id_peve_1');
    const generated = peve.generateSnapshot(actor, { subjectId, peg: snapshot });
    if (!generated.ok) {
      return;
    }
    assert.equal(generated.value.vector.dimensions.length, 12);
    assert.equal(generated.value.vector.decomposable, true);
    assert.equal(generated.value.composite.notHumanWorth, true);
    assert.equal(generated.value.composite.notCreditScore, true);
    assert.equal(generated.value.composite.notRegulatoryEligibility, true);
    assert.equal(generated.value.composite.weightDenominator, 10000);
    assert.equal(generated.value.valuationContext.notExecutionAuthority, true);
    const liquidity = generated.value.vector.dimensions.find((item) => item.kind === 'LIQUIDITY_RESILIENCE');
    assert.ok(liquidity);
    assert.equal(liquidity?.measure.kind, 'INDEX');
    assert.equal(liquidity?.measure.isMoney, false);
    assert.ok(generated.value.reserveCoverage[0]);
    assert.ok(generated.value.cashFlowCapacity[0]);
    assert.ok(generated.value.debtBurden[0]?.notCreditScore);
    assert.ok(generated.value.goalProgress.length > 0);
    assert.equal(generated.value.goalProgress[0]?.unrealizedMarketCounted, false);
    assert.equal(generated.value.opportunityCapacity[0]?.mayExecute, false);
    assert.ok(['SUFFICIENT', 'PARTIAL', 'SPARSE', 'CONFLICTED'].includes(generated.value.completeness));
  });

  it('separates realized and projected attribution and rejects double counting', () => {
    const { actor, peve, snapshot, subjectId } = setup('actor_peve_2', 'id_peve_2');
    const baseline = peve.recordBaseline(actor, {
      baselineId: peve.newBaselineId('FEE', 'card_fee'),
      subjectId,
      kind: 'CURRENT_FEE_VS_ALTERNATIVE',
      assumptions: Object.freeze(['Current card fee schedule remains unchanged without the action.']),
      comparisonPeriod: { from: NOW, to: NOW },
      sourceFacts: Object.freeze([{ ref: 'evt_fee_1', confidence: 'VERIFIED', key: 'fee' }]),
      confidence: 'VERIFIED',
      method: 'observed_fee_minus_alternative_fee',
      formulaVersion: FORMULA_V1,
      guaranteed: false,
      survivesRebuild: true,
    });
    if (!baseline.ok) {
      return;
    }
    const realized = peve.recordAttribution(actor, {
      subjectId,
      sourceEventId: 'evt_fee_1',
      observedResult: 'card fee reduced by 1500 minor units',
      amount: { minorUnits: '1500', currency: 'USD' },
      attributionType: 'FEE_AVOIDED',
      realization: 'REALIZED',
      calculationMethod: 'baseline_fee_minus_observed_fee',
      confidence: 'VERIFIED',
      formulaVersion: FORMULA_V1,
      recordedAt: NOW,
      baselineId: baseline.value.baselineId,
      contributions: Object.freeze([
        { system: 'GROWTH_ORCHESTRATOR', shareNumerator: 1, shareDenominator: 3, causalCertainty: 'IDENTIFIED' },
        { system: 'TREASURY', shareNumerator: 1, shareDenominator: 3, causalCertainty: 'CONTRIBUTED' },
        { system: 'PAYMENTS', shareNumerator: 1, shareDenominator: 3, causalCertainty: 'EXECUTED' },
      ]),
    });
    assert.equal(realized.ok, true);
    const projected = peve.recordAttribution(actor, {
      subjectId,
      sourceEventId: 'evt_fee_1_year',
      sourceKey: 'evt_fee_1_annualized',
      observedResult: 'estimated twelve months of the same fee reduction',
      amount: { minorUnits: '18000', currency: 'USD' },
      attributionType: 'FEE_AVOIDED',
      realization: 'PROJECTED',
      calculationMethod: 'realized_month * 12',
      confidence: 'INFERRED',
      formulaVersion: FORMULA_V1,
      recordedAt: NOW,
    });
    assert.equal(projected.ok, true);
    assert.equal(peve.attribution.realizedTotal(subjectId, 'USD').minorUnits, '1500');
    assert.equal(peve.attribution.projectedTotal(subjectId, 'USD').minorUnits, '18000');
    const duplicate = peve.recordAttribution(actor, {
      subjectId,
      sourceEventId: 'evt_fee_1',
      observedResult: 'same fee as routing savings',
      amount: { minorUnits: '1500', currency: 'USD' },
      attributionType: 'PAYMENT_FEE_REDUCED',
      realization: 'REALIZED',
      calculationMethod: 'same_benefit_relabeled',
      confidence: 'VERIFIED',
      formulaVersion: FORMULA_V1,
      recordedAt: NOW,
    });
    assert.equal(duplicate.ok, false);
    if (!duplicate.ok) {
      assert.equal(duplicate.error.code, 'DOUBLE_COUNT');
    }
    const generated = peve.generateSnapshot(actor, { subjectId, peg: snapshot });
    if (!generated.ok) {
      return;
    }
    const created = generated.value.vector.dimensions.find((item) => item.kind === 'ATTRIBUTED_VALUE_CREATED');
    assert.equal(created?.moneyCompanion?.amount.minorUnits, '1500');
    assert.equal(created?.measure.kind, 'INDEX');
    assert.match(created?.limitations.join(' ') ?? '', /18000 is excluded/);
  });

  it('keeps historical snapshots reproducible after a formula change', () => {
    const { actor, peve, snapshot, subjectId } = setup('actor_peve_3', 'id_peve_3');
    const first = peve.generateSnapshot(actor, { subjectId, peg: snapshot });
    if (!first.ok) {
      return;
    }
    const activated = peve.activateModel(actor, subjectId, FORMULA_V2, MODEL_V2);
    assert.equal(activated.ok, true);
    const second = peve.generateSnapshot(actor, { subjectId, peg: snapshot });
    if (!second.ok) {
      return;
    }
    assert.equal(first.value.formulaVersion, FORMULA_V1);
    assert.equal(second.value.formulaVersion, FORMULA_V2);
    const reread = peve.getEconomicValueSnapshot(actor, subjectId, first.value.snapshotId);
    if (!reread.ok) {
      return;
    }
    assert.equal(reread.value.composite.measure.points, first.value.composite.measure.points);
    assert.equal(reread.value.formulaVersion, FORMULA_V1);
    const compared = peve.compareModels(
      actor,
      subjectId,
      { formulaVersion: FORMULA_V1, modelVersion: MODEL_V1 },
      { formulaVersion: FORMULA_V2, modelVersion: MODEL_V2 },
      snapshot,
    );
    if (!compared.ok) {
      return;
    }
    assert.equal(compared.value.formulaChanged, true);
    assert.ok((compared.value.weightsChanged.length ?? 0) > 0);
    assert.ok(compared.value.outputDifference);
  });

  it('rejects protected-trait inputs and is invariant to irrelevant identity labels', () => {
    const left = setup('actor_peve_4a', 'id_peve_4a');
    const right = setup('actor_peve_4b', 'id_peve_4b');
    const a = left.peve.generateSnapshot(left.actor, { subjectId: left.subjectId, peg: left.snapshot });
    const b = right.peve.generateSnapshot(right.actor, { subjectId: right.subjectId, peg: right.snapshot });
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    if (!a.ok || !b.ok) {
      return;
    }
    assert.equal(a.value.composite.measure.points, b.value.composite.measure.points);
    const poisoned = left.peve.generateSnapshot(left.actor, {
      subjectId: left.subjectId,
      peg: left.snapshot,
      extraFacts: { race: 'ignored' },
    });
    assert.equal(poisoned.ok, false);
    if (!poisoned.ok) {
      assert.equal(poisoned.error.code, 'PROTECTED_TRAIT_INPUT');
    }
    assert.ok(PROTECTED_TRAIT_KEYS.includes('race'));
  });

  it('refuses cross-currency aggregation without FX context and missing data reduces confidence', () => {
    const { actor, peve, snapshot, subjectId, peg } = setup('actor_peve_5', 'id_peve_5');
    peg.declareIncomeSource(actor, subjectId, {
      incomeKind: 'FREELANCE',
      label: 'SAR income',
      estimatedAmount: { minorUnits: '100000', currency: 'SAR' },
    });
    const mixed = peg.getEconomicSnapshot(actor, subjectId);
    if (!mixed.ok) {
      return;
    }
    const refused = peve.generateSnapshot(actor, { subjectId, peg: mixed.value });
    assert.equal(refused.ok, false);
    if (!refused.ok) {
      assert.equal(refused.error.code, 'CROSS_CURRENCY_WITHOUT_FX');
    }
    const emptyPeg = setup('actor_peve_5b', 'id_peve_5b');
    const sparse = emptyPeg.peve.generateSnapshot(emptyPeg.actor, {
      subjectId: emptyPeg.subjectId,
      peg: {
        ...emptyPeg.snapshot,
        liquidAssetsByCurrency: Object.freeze([]),
        income: Object.freeze([]),
        knownRecurringObligations: Object.freeze([]),
        debt: Object.freeze([]),
        monthlyCashFlow: Object.freeze([]),
        goals: Object.freeze([]),
      },
    });
    if (!sparse.ok) {
      return;
    }
    assert.equal(sparse.value.completeness, 'SPARSE');
    assert.ok(sparse.value.warnings.some((item) => item.includes('sparse') || item.includes('PARTIAL') || item.includes('human')));
    const dimension = peve.getEconomicValueDimension(
      actor,
      subjectId,
      asEconomicValueDimensionId('evd_missing'),
    );
    assert.equal(dimension.ok, false);
    const generated = peve.generateSnapshot(actor, { subjectId, peg: snapshot });
    if (!generated.ok) {
      return;
    }
    const found = peve.getEconomicValueDimension(actor, subjectId, generated.value.vector.dimensions[0]!.dimensionId);
    assert.equal(found.ok, true);
  });

  it('does not let the agent set scores and rejects guaranteed data-contribution compensation', () => {
    const { actor, peve, snapshot, subjectId } = setup('actor_peve_6', 'id_peve_6');
    const generated = peve.generateSnapshot(actor, { subjectId, peg: snapshot });
    assert.equal(generated.ok, true);
    const ai = peve.refuseAiScore(actor, '9000');
    assert.equal(ai.ok, false);
    if (!ai.ok) {
      assert.equal(ai.error.code, 'AI_CANNOT_SET_SCORE');
    }
    const explained = peve.explainWithAgent(actor, subjectId);
    assert.equal(explained.ok, true);
    if (explained.ok) {
      assert.equal(explained.value.executable, false);
      assert.equal(explained.value.kind, 'VALUE_EXPLANATION');
    }
    const bad = peve.recordDataContribution(actor, {
      subjectId,
      purpose: 'authorized usage analytics',
      estimatedValue: { minorUnits: '500', currency: 'USD' },
      estimatedLabeled: true,
      provenance: 'INFERRED',
      guaranteedCompensation: true,
    });
    assert.equal(bad.ok, false);
    const okContribution = peve.recordDataContribution(actor, {
      subjectId,
      purpose: 'authorized usage analytics',
      estimatedValue: { minorUnits: '500', currency: 'USD' },
      estimatedLabeled: true,
      provenance: 'INFERRED',
    });
    assert.equal(okContribution.ok, true);
    if (okContribution.ok) {
      assert.equal(okContribution.value.guaranteedCompensation, false);
      assert.equal(okContribution.value.tokenValuation, false);
    }
    peve.attribution.skipPrincipalMovement('PRINCIPAL_DEPOSIT_IS_NOT_ECONOMIC_IMPROVEMENT');
    assert.equal(peve.planningSignals(subjectId).mayExecute, false);
  });

  it('exposes read-only attribution and change explanations', () => {
    const { actor, peve, snapshot, subjectId, events, evidence } = setup('actor_peve_7', 'id_peve_7');
    peve.recordAttribution(actor, {
      subjectId,
      sourceEventId: 'evt_save',
      observedResult: 'subscription month avoided',
      amount: { minorUnits: '2000', currency: 'USD' },
      attributionType: 'SUBSCRIPTION_ELIMINATED',
      realization: 'REALIZED',
      calculationMethod: 'canceled_price_for_elapsed_month',
      confidence: 'VERIFIED',
      formulaVersion: FORMULA_V1,
      recordedAt: NOW,
    });
    const first = peve.generateSnapshot(actor, { subjectId, peg: snapshot });
    assert.equal(first.ok, true);
    const listed = peve.getGrowthAttribution(actor, subjectId);
    assert.equal(listed.ok, true);
    if (listed.ok) {
      assert.equal(listed.value.length, 1);
    }
    const explanation = peve.getValueChangeExplanation(actor, subjectId);
    assert.equal(explanation.ok, true);
    if (explanation.ok) {
      assert.equal(explanation.value.length, 12);
      assert.ok(explanation.value.every((item) => item.formulaVersion === FORMULA_V1));
    }
    const types = events.list().map((item) => item.eventType);
    assert.ok(types.includes('EconomicValueSnapshotCreated'));
    assert.ok(types.includes('EconomicValueAttributionRecorded'));
    const sealed = evidence.verifyChain();
    assert.equal(sealed.ok, true);
  });
});
