import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  HELIOS_EVOL13_META_EVOLUTION_QUALIFIED,
  allocateResearchCompute,
  bridgeH20MarginalCostWithOperatorProductivity,
  buildOperatorCreditState,
  buildNicheOperatorPerformance,
  createInMemoryOperatorPerformanceLedger,
  defaultEvol13ResearchAllocationPolicy,
  evaluateEvol13MetaEvolutionQualification,
  maxOperatorAllocationShareBps,
} from '../packages/platform/src/helios/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const T0 = asUtcInstant('2026-11-01T12:00:00.000Z');
const T1 = asUtcInstant('2026-11-02T12:00:00.000Z');

describe('HELIOS EVOL13 meta-evolution and operator credit', () => {
  it('passes architectural HELIOS boundary lint', () => {
    const root = new URL('..', import.meta.url).pathname;
    const findings = lintHeliosBoundary(root);
    assert.equal(findings.length, 0, findings.map((f) => f.message).join('; '));
  });

  it('uses delayed outcomes and shrinkage; blocks momentum-only credit from dominating valuation niche', () => {
    const ledger = createInMemoryOperatorPerformanceLedger();
    const policy = defaultEvol13ResearchAllocationPolicy();

    ledger.append({
      runId: 'run_1',
      operatorId: 'CROSSOVER',
      nicheId: 'MOMENTUM',
      evaluatedAt: T0,
      outcomeVisibleAt: T1,
      candidateCount: 100,
      validCandidateCount: 90,
      aafPassCount: 70,
      holdoutPassCount: 40,
      falsificationPassCount: 35,
      noveltyProducedCount: 120,
      nicheCoverageAdded: Object.freeze([]),
      paperCandidateCount: 20,
      computeCostMinor: '10000',
    });
    ledger.append({
      runId: 'run_2',
      operatorId: 'LLM_PROPOSAL',
      nicheId: 'VALUATION',
      evaluatedAt: T0,
      outcomeVisibleAt: T1,
      candidateCount: 40,
      validCandidateCount: 10,
      aafPassCount: 5,
      holdoutPassCount: 2,
      falsificationPassCount: 2,
      noveltyProducedCount: 80,
      nicheCoverageAdded: Object.freeze(['VALUATION']),
      paperCandidateCount: 1,
      computeCostMinor: '5000',
    });

    const early = buildOperatorCreditState({ runs: ledger.listRuns(), policy, asOf: T0 });
    assert.equal(early.entries.CROSSOVER.runsCredited, 0);

    const credit = buildOperatorCreditState({ runs: ledger.listRuns(), policy, asOf: T1 });
    assert.equal(credit.entries.CROSSOVER.runsCredited, 1);
    assert.ok(credit.entries.CROSSOVER.posteriorValidRateBps < 10_000);

    const nichePerf = buildNicheOperatorPerformance({
      runs: ledger.listRuns(),
      policy,
      asOf: T1,
    });
    const momentum = nichePerf.find((row) => row.nicheId === 'MOMENTUM');
    const valuation = nichePerf.find((row) => row.nicheId === 'VALUATION');
    assert.ok(momentum);
    assert.ok(valuation);
    assert.ok(
      momentum!.perOperator.CROSSOVER.posteriorValidRateBps >
        valuation!.perOperator.CROSSOVER.posteriorValidRateBps,
    );
  });

  it('allocates research compute with exploration floor and per-operator cap', () => {
    const ledger = createInMemoryOperatorPerformanceLedger();
    const policy = defaultEvol13ResearchAllocationPolicy({ kind: 'UCB' });
    for (let i = 0; i < 8; i += 1) {
      ledger.append({
        runId: `run_u_${i}`,
        operatorId: 'PARAMETER_MUTATION',
        nicheId: 'MOMENTUM',
        evaluatedAt: T0,
        outcomeVisibleAt: T1,
        candidateCount: 50,
        validCandidateCount: 40,
        aafPassCount: 30,
        holdoutPassCount: 25,
        falsificationPassCount: 20,
        noveltyProducedCount: 60,
        nicheCoverageAdded: Object.freeze([]),
        paperCandidateCount: 5,
        computeCostMinor: '1000',
      });
    }
    const credit = buildOperatorCreditState({
      runs: ledger.listRuns(),
      policy,
      asOf: T1,
    });
    const alloc = allocateResearchCompute({
      totalResearchComputeMinor: '1_000_000'.replaceAll('_', ''),
      creditState: credit,
      policy,
      asOf: T1,
    });
    const maxShare = maxOperatorAllocationShareBps(alloc);
    assert.ok(maxShare <= policy.maxOperatorShareBps);
    let sum = 0n;
    for (const op of Object.keys(alloc.byOperator)) {
      sum += BigInt(alloc.byOperator[op as keyof typeof alloc.byOperator]);
    }
    assert.equal(sum, BigInt(alloc.totalResearchComputeMinor));

    const q = evaluateEvol13MetaEvolutionQualification({
      explorationBudgetBps: policy.explorationBudgetBps,
      maxOperatorShareBps: maxShare,
    });
    assert.equal(q.marker, HELIOS_EVOL13_META_EVOLUTION_QUALIFIED);
  });

  it('H20 bridge adjusts marginal research cost from operator productivity (research only)', () => {
    const policy = defaultEvol13ResearchAllocationPolicy();
    const ledger = createInMemoryOperatorPerformanceLedger();
    ledger.append({
      runId: 'run_h20',
      operatorId: 'RANDOM_EXPLORATION',
      nicheId: 'NEUTRAL',
      evaluatedAt: T0,
      outcomeVisibleAt: T1,
      candidateCount: 30,
      validCandidateCount: 5,
      aafPassCount: 2,
      holdoutPassCount: 1,
      falsificationPassCount: 1,
      noveltyProducedCount: 40,
      nicheCoverageAdded: Object.freeze([]),
      paperCandidateCount: 0,
      computeCostMinor: '2000',
    });
    const credit = buildOperatorCreditState({ runs: ledger.listRuns(), policy, asOf: T1 });
    const bridged = bridgeH20MarginalCostWithOperatorProductivity({
      marginalResearchCostMinor: '10000',
      operatorId: 'RANDOM_EXPLORATION',
      creditEntries: credit.entries,
    });
    assert.equal(bridged.ok, true);
    if (bridged.ok) {
      assert.ok(bridged.value.suggestedMarginalCostMinor >= '10000');
    }
  });
});
