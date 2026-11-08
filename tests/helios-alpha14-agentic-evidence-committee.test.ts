import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { assembleCapitalContext, type ContextSource } from '../packages/agentic-capital-mesh/src/context.ts';
import type { EvidenceReference } from '../packages/agentic-capital-mesh/src/research-mesh/index.ts';
import {
  ALPHA14_COMMITTEE_ROLES,
  ALPHA14_EVIDENCE_QUESTIONS,
  AlphaEvidenceAgenticCommittee,
  alpha14RoleDisplayName,
  defaultAlpha14CommitteeRoles,
  evaluateAlpha14AgenticEvidenceQualification,
  HELIOS_ALPHA14_AGENTIC_EVIDENCE_COMMITTEE_QUALIFIED,
  validateAlpha14CommitteeArtifact,
  validateAlphaEvidenceThesis,
  type AlphaPerformanceClaimEnvelope,
} from '../packages/agentic-capital-mesh/src/alpha-evidence-agentic-committee/index.ts';

const NOW = asUtcInstant('2026-11-08T07:39:00.000Z');

function evidence(overrides: Partial<EvidenceReference> = {}): EvidenceReference {
  return Object.freeze({
    evidenceId: overrides.evidenceId ?? 'ev_alpha14_1',
    sourceKind: overrides.sourceKind ?? 'MARKET_OBSERVATION',
    sourceRef: overrides.sourceRef ?? 'obs/sim-equity-alpha14',
    observedAt: overrides.observedAt ?? NOW,
    freshnessOk: overrides.freshnessOk ?? true,
    entitlementOk: overrides.entitlementOk ?? true,
    provenanceRef: overrides.provenanceRef ?? 'prov/helios-alpha14',
  });
}

function performanceClaim(overrides: Partial<AlphaPerformanceClaimEnvelope> = {}): AlphaPerformanceClaimEnvelope {
  return Object.freeze({
    claimId: overrides.claimId ?? 'claim_alpha14_fixture',
    strategyRef: overrides.strategyRef ?? 'HELIOS_SIM_M10_MOMENTUM',
    performanceClaimSummary:
      overrides.performanceClaimSummary ?? 'Sandbox forward-paper candidate; not a live performance guarantee',
    observationWindowDays: overrides.observationWindowDays ?? 120,
    independentTrialCount: overrides.independentTrialCount ?? 12,
    benchmarkRelativeClaimed: overrides.benchmarkRelativeClaimed ?? true,
    concentrationFlag: overrides.concentrationFlag ?? false,
    dominantRegimeTag: overrides.dominantRegimeTag ?? null,
    executionAssumptionRef: overrides.executionAssumptionRef ?? 'exec-twin/sim-conservative-v1',
    costsModeled: overrides.costsModeled ?? true,
    evidenceDurationSufficientClaimed: overrides.evidenceDurationSufficientClaimed ?? true,
    scalabilityClaimed: overrides.scalabilityClaimed ?? false,
    decaySignalClaimed: overrides.decaySignalClaimed ?? false,
  });
}

function sourceFor(subjectId: string): ContextSource {
  return {
    subjectId,
    bind: (requested) =>
      requested === subjectId
        ? {
            subjectId,
            mandate: {
              mandateId: 'man_alpha14',
              version: 1,
              status: 'ACTIVE',
              hardConstraintKinds: Object.freeze(['MINIMUM_CASH_RESERVE']),
              prohibitedCategories: Object.freeze([]),
              minimumLiquidMinor: 50_000n,
              compatibleWithInvestment: true,
            },
            growth: {
              planId: 'gpl_alpha14',
              version: 1,
              considersInvestment: true,
              state: 'ACTIVE',
            },
            peve: {
              snapshotId: 'peve_alpha14',
              resilienceLabel: 'moderate',
              goalProgressLabel: 'on-track',
              opportunityCapacityLabel: 'available',
              compositeOptimizationForbidden: true as const,
              humanWorthSemantics: false as const,
            },
            portfolio: {
              portfolioId: 'inv_alpha14',
              brokerageCashMinor: 500_000n,
              unsettledCashMinor: 0n,
              pendingOrderNotionalMinor: 0n,
              holdings: Object.freeze([]),
              accountRestricted: false,
            },
            riskBudget: {
              budgetId: 'rbdg_alpha14',
              version: 'risk-policy-v1',
              maximumInstrumentConcentrationUnits: 60_000_000n,
              minimumBrokerageCashMinor: 0n,
            },
            registeredModels: Object.freeze([]),
            universe: Object.freeze([
              {
                instrumentId: 'SIM-EQ-ALPHA14',
                instrumentType: 'EQUITY',
                available: true,
                fractionalSupported: true,
                incrementUnits: 1n,
                currency: 'USD',
              },
            ]),
            market: Object.freeze([
              {
                instrumentId: 'SIM-EQ-ALPHA14',
                priceMinor: 11_000n,
                currency: 'USD',
                quotedAt: NOW,
                stale: false,
              },
            ]),
            rdt: {
              state: 'RESEARCH_REQUIRED',
              legalReviewStatus: 'RESEARCH_REQUIRED',
              simulationOnly: true as const,
              regulatoryApproved: false as const,
            },
            scheduledObligationMinor: 0n,
          }
        : undefined,
  };
}

describe('HELIOS ALPHA14 agentic alpha evidence committee', () => {
  it('registers eleven specialist agents for forward-alpha evidence review', () => {
    assert.equal(ALPHA14_COMMITTEE_ROLES.length, 11);
    assert.equal(defaultAlpha14CommitteeRoles().length, 11);
    assert.equal(ALPHA14_EVIDENCE_QUESTIONS.length, 10);
    const expectedNames = Object.freeze([
      'ForwardPerformanceAnalyst',
      'BenchmarkAnalyst',
      'StatisticalSkepticAgent',
      'MultipleTestingAuditor',
      'ExecutionRealityAgent',
      'RegimeRobustnessAgent',
      'CapacityAgent',
      'DataIntegrityAgent',
      'AlphaDecayAgent',
      'CounterfactualSkepticAgent',
      'AlphaEvidenceSynthesisAgent',
    ]);
    assert.deepEqual(ALPHA14_COMMITTEE_ROLES.map((role) => alpha14RoleDisplayName(role)), expectedNames);
  });

  it('runs ALPHA14 committee and produces AlphaEvidenceThesis without capital authority', () => {
    const clock = new FrozenClock(NOW);
    const committee = new AlphaEvidenceAgenticCommittee({ clock });
    const ctx = assembleCapitalContext({
      meshId: 'cmsh_alpha14',
      subjectId: 'cust_alpha14',
      now: NOW,
      source: sourceFor('cust_alpha14'),
    });
    assert.ok(ctx.ok);
    if (!ctx.ok) throw new Error('context');

    const result = committee.run({
      request: {
        workOrderId: 'wo_alpha14',
        subjectId: 'cust_alpha14',
        strategyRef: 'HELIOS_SIM_M10_MOMENTUM',
        objective: 'Attack forward performance claim before evidence upgrade',
        contextRef: 'ctx_alpha14',
        evidenceBundle: Object.freeze([evidence(), evidence({ evidenceId: 'ev_alpha14_2' })]),
        performanceClaim: performanceClaim(),
      },
      context: ctx.value,
    });
    assert.equal(result.ok, true, result.ok ? '' : result.error.message);
    if (!result.ok) throw new Error('committee run');

    assert.equal(result.value.artifacts.length, 11);
    for (const artifact of result.value.artifacts) {
      assert.deepEqual(validateAlpha14CommitteeArtifact(artifact), []);
      assert.equal(artifact.grantsFinancialAuthority, false);
      assert.equal(artifact.issuesOrders, false);
      assert.equal(artifact.activatesCapital, false);
      if (artifact.role === 'STATISTICAL_SKEPTIC' || artifact.role === 'COUNTERFACTUAL_SKEPTIC') {
        assert.equal(artifact.seeksRejection, true);
        assert.ok(artifact.contradictingEvidence.length > 0);
        assert.ok(artifact.skepticAttacksConsidered.length >= 4);
      }
    }

    const thesis = result.value.thesis;
    assert.deepEqual(validateAlphaEvidenceThesis(thesis), []);
    assert.ok(thesis.supportedClaims.length > 0 || thesis.unsupportedClaims.length > 0);
    assert.ok(thesis.statisticalEvidence.summary.length > 0);
    assert.ok(thesis.implementationEvidence.summary.length > 0);
    assert.ok(thesis.regimeEvidence.summary.length > 0);
    assert.ok(thesis.capacityEvidence.summary.length > 0);
    assert.ok(thesis.recommendedNextEvidence.length >= 3);
    assert.equal(thesis.activatesCapital, false);
    assert.equal(thesis.simulationOnly, true);
    assert.ok(thesis.questionsAddressed.length >= 8);
  });

  it('refuses cross-subject data access', () => {
    const clock = new FrozenClock(NOW);
    const committee = new AlphaEvidenceAgenticCommittee({ clock });
    const ctx = assembleCapitalContext({
      meshId: 'cmsh_alpha14',
      subjectId: 'cust_alpha14_a',
      now: NOW,
      source: sourceFor('cust_alpha14_a'),
    });
    assert.ok(ctx.ok);
    if (!ctx.ok) throw new Error('context');
    const result = committee.run({
      request: {
        workOrderId: 'wo_alpha14_x',
        subjectId: 'cust_alpha14_b',
        strategyRef: 'HELIOS_SIM_M10_MOMENTUM',
        objective: 'Cross subject',
        contextRef: 'ctx_alpha14',
        evidenceBundle: Object.freeze([evidence()]),
        performanceClaim: performanceClaim(),
      },
      context: ctx.value,
    });
    assert.equal(result.ok, false);
    if (result.ok) throw new Error('expected refusal');
    assert.equal(result.error.code, 'SUBJECT_MISMATCH');
  });

  it('HELIOS_ALPHA14_AGENTIC_EVIDENCE_COMMITTEE_QUALIFIED when checks pass', () => {
    const clock = new FrozenClock(NOW);
    const committee = new AlphaEvidenceAgenticCommittee({ clock });
    const ctx = assembleCapitalContext({
      meshId: 'cmsh_alpha14',
      subjectId: 'cust_alpha14_q',
      now: NOW,
      source: sourceFor('cust_alpha14_q'),
    });
    assert.ok(ctx.ok);
    if (!ctx.ok) throw new Error('context');
    const run = committee.run({
      request: {
        workOrderId: 'wo_alpha14_q',
        subjectId: 'cust_alpha14_q',
        strategyRef: 'HELIOS_SIM_M10_MOMENTUM',
        objective: 'Qualification run',
        contextRef: 'ctx_alpha14_q',
        evidenceBundle: Object.freeze([evidence(), evidence({ evidenceId: 'ev_alpha14_q2' })]),
        performanceClaim: performanceClaim(),
      },
      context: ctx.value,
    });
    assert.equal(run.ok, true);
    if (!run.ok) throw new Error('run');
    const qualification = evaluateAlpha14AgenticEvidenceQualification({
      sampleArtifacts: run.value.artifacts,
      sampleThesis: run.value.thesis,
    });
    assert.equal(
      qualification.marker,
      HELIOS_ALPHA14_AGENTIC_EVIDENCE_COMMITTEE_QUALIFIED,
      qualification.blockers.join('; '),
    );
    assert.equal(qualification.qualified, true);
    assert.equal(qualification.specialistAgentNames.length, 11);
  });
});
