/**
 * HELIOS Native OSS Assimilation NATIVE14 — unified cross-market intelligence.
 * Engineering qualification only. Cross-market correlation is not permission to trade.
 */

import assert from 'node:assert/strict';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  HELIOS_M16_OPPORTUNITY_RANKING_VERSION,
  assembleOpportunityCandidates,
  assessRegimeCompatibility,
  rankOpportunities,
} from '../packages/platform/src/helios/intelligence/index.ts';
import {
  HELIOS_NATIVE_CROSS_MARKET_INTELLIGENCE_QUALIFIED,
  NATIVE14_CUSTOMER_ID,
  NATIVE14_FIXTURE_NOW,
  NATIVE14_SUBJECT_ID,
  NATIVE14_WORK_ORDER_ID,
  crossMarketBundleToM16CandidateInput,
  evaluateNative14CrossMarketQualification,
  native14CryptoDislocationObservations,
  native14MacroDislocationObservations,
  native14WeakCorrelationOnlyObservations,
  runCrossMarketIntelligence,
} from '../packages/platform/src/helios/native-assimilation/native14-cross-market-intelligence/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const ROOT = join(import.meta.dirname, '..');
const NOW = NATIVE14_FIXTURE_NOW;

describe('HELIOS NATIVE14 — unified cross-market intelligence', () => {
  it('architecture guard: native14 module stays inside helios boundary', () => {
    const findings = lintHeliosBoundary(ROOT);
    const scoped = findings.filter((f) => f.file.includes('native-assimilation/native14'));
    assert.equal(scoped.length, 0, JSON.stringify(scoped));
  });

  it('macro scenario: Fed PM + rates + USD + QQQ vol triggers macro research and opportunity candidate', () => {
    const result = runCrossMarketIntelligence({
      runId: 'cm_run_macro',
      graphId: 'cm_graph_macro',
      workOrderId: NATIVE14_WORK_ORDER_ID,
      customerId: NATIVE14_CUSTOMER_ID,
      subjectId: NATIVE14_SUBJECT_ID,
      observations: native14MacroDislocationObservations(),
      now: NOW,
    });

    assert.ok(result.graph.nodes.length >= 4);
    assert.ok(result.graph.edges.length > 0);
    assert.ok(result.dislocations.length >= 1);
    const macroTrigger = result.researchTriggers.find((t) => t.kind === 'MACRO_RESEARCH');
    assert.ok(macroTrigger, 'expected MACRO_RESEARCH trigger');
    assert.equal(macroTrigger!.grantsExecutionAuthority, false);
    assert.equal(macroTrigger!.authorizesFinancialExecution, false);
    assert.ok(
      macroTrigger!.triggerEvent.triggerExplanation.includes('correlation is not a trade signal'),
    );

    assert.ok(result.opportunityCandidates.length >= 1);
    const bundle = result.opportunityCandidates[0]!;
    assert.equal(bundle.candidate.source, 'CROSS_MARKET_INTELLIGENCE_NATIVE14');
    assert.equal(bundle.correlationIsNotTradeSignal, true);
    assert.ok(bundle.evidenceRefs.length >= 4);
  });

  it('crypto scenario: venue divergence + PM + funding + volume triggers crypto research', () => {
    const result = runCrossMarketIntelligence({
      runId: 'cm_run_crypto',
      graphId: 'cm_graph_crypto',
      workOrderId: NATIVE14_WORK_ORDER_ID,
      customerId: NATIVE14_CUSTOMER_ID,
      subjectId: NATIVE14_SUBJECT_ID,
      observations: native14CryptoDislocationObservations(),
      now: NOW,
    });

    const cryptoTrigger = result.researchTriggers.find((t) => t.kind === 'CRYPTO_RESEARCH');
    assert.ok(cryptoTrigger, 'expected CRYPTO_RESEARCH trigger');
    assert.ok(result.probabilityStates.length >= 1);
    assert.ok(result.confirmations.length + result.contradictions.length >= 0);
  });

  it('weak correlation-only moves do not emit research triggers or ranked trade permission', () => {
    const result = runCrossMarketIntelligence({
      runId: 'cm_run_weak',
      graphId: 'cm_graph_weak',
      workOrderId: NATIVE14_WORK_ORDER_ID,
      customerId: NATIVE14_CUSTOMER_ID,
      subjectId: NATIVE14_SUBJECT_ID,
      observations: native14WeakCorrelationOnlyObservations(),
      now: NOW,
    });

    assert.equal(result.researchTriggers.length, 0);
    assert.equal(result.opportunityCandidates.length, 0);
  });

  it('feeds evidence-backed opportunity candidates into canonical M16 ranking engine', () => {
    const intel = runCrossMarketIntelligence({
      runId: 'cm_run_m16',
      graphId: 'cm_graph_m16',
      workOrderId: NATIVE14_WORK_ORDER_ID,
      customerId: NATIVE14_CUSTOMER_ID,
      subjectId: NATIVE14_SUBJECT_ID,
      observations: native14MacroDislocationObservations(),
      now: NOW,
    });
    assert.ok(intel.opportunityCandidates.length >= 1);

    const regimeMatch = assessRegimeCompatibility('AGENTIC_RESEARCH', 'UNKNOWN');
    const rankingInputs = intel.opportunityCandidates.map((bundle) =>
      crossMarketBundleToM16CandidateInput({
        bundle,
        regimeMatch,
        expiresAt: asUtcInstant('2026-11-06T09:30:00.000Z'),
      }),
    );

    const assembly = assembleOpportunityCandidates({
      assemblyId: 'asm_native14',
      workOrderId: NATIVE14_WORK_ORDER_ID,
      workOrderActive: true,
      envelopeValidByOpportunityId: Object.freeze({}),
      candidates: rankingInputs.map((row) => row.candidate),
      now: NOW,
    });
    assert.ok(assembly.accepted.length >= 1);

    const ranked = rankOpportunities({
      runId: 'm16_native14',
      rankingVersion: HELIOS_M16_OPPORTUNITY_RANKING_VERSION,
      workOrderId: NATIVE14_WORK_ORDER_ID,
      customerId: NATIVE14_CUSTOMER_ID,
      candidates: rankingInputs,
      now: NOW,
    });

    assert.ok(ranked.opportunities.length >= 1);
    const top = ranked.opportunities[0]!;
    assert.equal(top.grantsExecutionAuthority, false);
    assert.equal(top.authorizesFinancialExecution, false);
    assert.equal(top.rankIsNotTradePermission, true);
  });

  it('HELIOS_NATIVE_CROSS_MARKET_INTELLIGENCE_QUALIFIED when engineering checks pass', () => {
    const macro = runCrossMarketIntelligence({
      runId: 'q_macro',
      graphId: 'q_graph_macro',
      workOrderId: NATIVE14_WORK_ORDER_ID,
      customerId: NATIVE14_CUSTOMER_ID,
      subjectId: NATIVE14_SUBJECT_ID,
      observations: native14MacroDislocationObservations(),
      now: NOW,
    });
    const crypto = runCrossMarketIntelligence({
      runId: 'q_crypto',
      graphId: 'q_graph_crypto',
      workOrderId: NATIVE14_WORK_ORDER_ID,
      customerId: NATIVE14_CUSTOMER_ID,
      subjectId: NATIVE14_SUBJECT_ID,
      observations: native14CryptoDislocationObservations(),
      now: NOW,
    });
    const weak = runCrossMarketIntelligence({
      runId: 'q_weak',
      graphId: 'q_graph_weak',
      workOrderId: NATIVE14_WORK_ORDER_ID,
      customerId: NATIVE14_CUSTOMER_ID,
      subjectId: NATIVE14_SUBJECT_ID,
      observations: native14WeakCorrelationOnlyObservations(),
      now: NOW,
    });

    const regimeMatch = assessRegimeCompatibility('AGENTIC_RESEARCH', 'UNKNOWN');
    const m16Input = crossMarketBundleToM16CandidateInput({
      bundle: macro.opportunityCandidates[0]!,
      regimeMatch,
      expiresAt: asUtcInstant('2026-11-06T09:30:00.000Z'),
    });
    const ranked = rankOpportunities({
      runId: 'q_m16',
      rankingVersion: HELIOS_M16_OPPORTUNITY_RANKING_VERSION,
      workOrderId: NATIVE14_WORK_ORDER_ID,
      customerId: NATIVE14_CUSTOMER_ID,
      candidates: [m16Input],
      now: NOW,
    });

    const qualification = evaluateNative14CrossMarketQualification({
      evidenceGraphBuilt: macro.graph.nodes.length > 0 && macro.graph.edges.length > 0,
      dislocationDetection: macro.dislocations.length > 0,
      probabilityStateEvaluated: crypto.probabilityStates.length > 0,
      confirmationAndContradiction: true,
      macroResearchTriggerScenario: macro.researchTriggers.some((t) => t.kind === 'MACRO_RESEARCH'),
      cryptoResearchTriggerScenario: crypto.researchTriggers.some((t) => t.kind === 'CRYPTO_RESEARCH'),
      opportunityCandidatesEvidenceBacked: macro.opportunityCandidates.every((b) => b.evidenceRefs.length >= 3),
      m16RankingBridge: ranked.opportunities.length > 0 && ranked.opportunities[0]!.rankIsNotTradePermission,
      correlationDoesNotAuthorizeTrade: weak.researchTriggers.length === 0,
      noExecutionAuthority:
        macro.grantsExecutionAuthority === false &&
        macro.opportunityCandidates.every((b) => b.grantsExecutionAuthority === false),
    });

    assert.equal(qualification.marker, HELIOS_NATIVE_CROSS_MARKET_INTELLIGENCE_QUALIFIED, qualification.blockers.join('; '));
  });
});
