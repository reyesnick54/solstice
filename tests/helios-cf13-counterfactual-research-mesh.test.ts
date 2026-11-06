import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  COUNTERFACTUAL_CF13_QUESTIONS,
  COUNTERFACTUAL_CF13_ROLES,
  CounterfactualResearchCf13Mesh,
  defaultCounterfactualCf13Roles,
  evaluateCf13CounterfactualQualification,
  HELIOS_CF13_AGENTIC_COUNTERFACTUAL_QUALIFIED,
  counterfactualCf13RoleDisplayName,
  thesisPassesLanguageGuard,
  validateCounterfactualCf13Artifact,
} from '../packages/agentic-capital-mesh/src/counterfactual-research-cf13/index.ts';
import type { EvidenceReference } from '../packages/agentic-capital-mesh/src/research-mesh/index.ts';
import { assembleCapitalContext, type ContextSource } from '../packages/agentic-capital-mesh/src/context.ts';

const NOW = asUtcInstant('2026-09-17T08:00:00.000Z');

function evidence(overrides: Partial<EvidenceReference> = {}): EvidenceReference {
  return Object.freeze({
    evidenceId: overrides.evidenceId ?? 'ev_cf13_1',
    sourceKind: overrides.sourceKind ?? 'MARKET_OBSERVATION',
    sourceRef: overrides.sourceRef ?? 'obs/sim-equity-cf13',
    observedAt: overrides.observedAt ?? NOW,
    freshnessOk: overrides.freshnessOk ?? true,
    entitlementOk: overrides.entitlementOk ?? true,
    provenanceRef: overrides.provenanceRef ?? 'prov/helios-cf13',
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
              mandateId: 'man_cf13',
              version: 1,
              status: 'ACTIVE',
              hardConstraintKinds: Object.freeze(['MINIMUM_CASH_RESERVE']),
              prohibitedCategories: Object.freeze([]),
              minimumLiquidMinor: 50_000n,
              compatibleWithInvestment: true,
            },
            growth: {
              planId: 'gpl_cf13',
              version: 1,
              considersInvestment: true,
              state: 'ACTIVE',
            },
            peve: {
              snapshotId: 'peve_cf13',
              resilienceLabel: 'moderate',
              goalProgressLabel: 'on-track',
              opportunityCapacityLabel: 'available',
              compositeOptimizationForbidden: true as const,
              humanWorthSemantics: false as const,
            },
            portfolio: {
              portfolioId: 'inv_cf13',
              brokerageCashMinor: 750_000n,
              unsettledCashMinor: 0n,
              pendingOrderNotionalMinor: 0n,
              holdings: Object.freeze([]),
              accountRestricted: false,
            },
            riskBudget: {
              budgetId: 'rbdg_cf13',
              version: 'risk-policy-v1',
              maximumInstrumentConcentrationUnits: 60_000_000n,
              minimumBrokerageCashMinor: 0n,
            },
            registeredModels: Object.freeze([]),
            universe: Object.freeze([
              {
                instrumentId: 'SIM-EQ-CF13',
                instrumentType: 'EQUITY',
                available: true,
                fractionalSupported: true,
                incrementUnits: 1n,
                currency: 'USD',
              },
            ]),
            market: Object.freeze([
              {
                instrumentId: 'SIM-EQ-CF13',
                priceMinor: 10_000n,
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

describe('HELIOS CF13 agentic counterfactual research mesh', () => {
  it('registers nine specialist agents mapped to CounterfactualPolicy … CounterfactualSynthesis', () => {
    assert.equal(COUNTERFACTUAL_CF13_ROLES.length, 9);
    assert.equal(defaultCounterfactualCf13Roles().length, 9);
    const expectedNames = Object.freeze([
      'CounterfactualPolicyAgent',
      'OutcomeModelAgent',
      'PropensitySupportAgent',
      'ExecutionRealityAgent',
      'CausalInferenceAgent',
      'PortfolioPathAgent',
      'RiskCounterfactualAgent',
      'SkepticAgent',
      'CounterfactualSynthesisAgent',
    ]);
    assert.deepEqual(
      COUNTERFACTUAL_CF13_ROLES.map((role) => counterfactualCf13RoleDisplayName(role)),
      expectedNames,
    );
  });

  it('covers the six standard counterfactual questions', () => {
    assert.equal(COUNTERFACTUAL_CF13_QUESTIONS.length, 6);
    assert.ok(COUNTERFACTUAL_CF13_QUESTIONS.some((q) => /entered/i.test(q)));
    assert.ok(COUNTERFACTUAL_CF13_QUESTIONS.some((q) => /wait/i.test(q)));
  });

  it('runs CF13 mesh through canonical HELIOS read tools only', () => {
    const clock = new FrozenClock(NOW);
    const mesh = new CounterfactualResearchCf13Mesh({ clock });
    const ctx = assembleCapitalContext({
      meshId: 'cmsh_cf13',
      subjectId: 'cust_cf13',
      now: NOW,
      source: sourceFor('cust_cf13'),
    });
    assert.ok(ctx.ok);
    if (!ctx.ok) throw new Error('context');
    const result = mesh.run({
      request: {
        workOrderId: 'wo_cf13',
        subjectId: 'cust_cf13',
        objective: 'HELIOS counterfactual policy review',
        contextRef: 'ctx_cf13',
        evidenceBundle: Object.freeze([evidence(), evidence({ evidenceId: 'ev_cf13_2', sourceRef: 'obs/sim-2' })]),
        factualPolicyHint: 'no_entry_baseline',
      },
      context: ctx.value,
    });
    assert.equal(result.ok, true, result.ok ? '' : result.error.message);
    if (!result.ok) throw new Error('mesh run');
    assert.equal(result.value.artifacts.length, 9);
    for (const artifact of result.value.artifacts) {
      assert.deepEqual(validateCounterfactualCf13Artifact(artifact), []);
      assert.equal(artifact.grantsFinancialAuthority, false);
      assert.equal(artifact.issuesOrders, false);
      assert.ok(thesisPassesLanguageGuard(artifact.thesis));
      if (artifact.role === 'SKEPTIC') {
        assert.ok(artifact.skepticAttacksConsidered.length >= 8);
      }
    }
    assert.ok(result.value.thesis.candidateAlternatives.length >= 6);
    assert.ok(result.value.thesis.estimatorResults.length >= 6);
    assert.ok(result.value.thesis.distributionalResults.length >= 6);
    assert.ok(result.value.thesis.executionResults.length >= 6);
    assert.ok(result.value.thesis.supportDiagnostics.length > 0);
    assert.ok(thesisPassesLanguageGuard(result.value.thesis.conclusion));
    assert.equal(result.value.thesis.languageGuard.forbidsDefiniteCounterfactualEarnings, true);
  });

  it('refuses cross-subject data access', () => {
    const clock = new FrozenClock(NOW);
    const mesh = new CounterfactualResearchCf13Mesh({ clock });
    const ctx = assembleCapitalContext({
      meshId: 'cmsh_cf13',
      subjectId: 'cust_cf13_a',
      now: NOW,
      source: sourceFor('cust_cf13_a'),
    });
    assert.ok(ctx.ok);
    if (!ctx.ok) throw new Error('context');
    const result = mesh.run({
      request: {
        workOrderId: 'wo_cf13_x',
        subjectId: 'cust_cf13_b',
        objective: 'Cross subject',
        contextRef: 'ctx_cf13',
        evidenceBundle: Object.freeze([evidence()]),
      },
      context: ctx.value,
    });
    assert.equal(result.ok, false);
    if (result.ok) throw new Error('expected refusal');
    assert.equal(result.error.code, 'SUBJECT_MISMATCH');
  });

  it('HELIOS_CF13_AGENTIC_COUNTERFACTUAL_QUALIFIED when checks pass', () => {
    const clock = new FrozenClock(NOW);
    const mesh = new CounterfactualResearchCf13Mesh({ clock });
    const ctx = assembleCapitalContext({
      meshId: 'cmsh_cf13',
      subjectId: 'cust_cf13_q',
      now: NOW,
      source: sourceFor('cust_cf13_q'),
    });
    assert.ok(ctx.ok);
    if (!ctx.ok) throw new Error('context');
    const run = mesh.run({
      request: {
        workOrderId: 'wo_cf13_q',
        subjectId: 'cust_cf13_q',
        objective: 'Qualification run',
        contextRef: 'ctx_cf13_q',
        evidenceBundle: Object.freeze([evidence(), evidence({ evidenceId: 'ev_cf13_q2' })]),
      },
      context: ctx.value,
    });
    assert.equal(run.ok, true);
    if (!run.ok) throw new Error('run');
    const qualification = evaluateCf13CounterfactualQualification({
      sampleArtifacts: run.value.artifacts,
    });
    assert.equal(qualification.marker, HELIOS_CF13_AGENTIC_COUNTERFACTUAL_QUALIFIED, qualification.blockers.join('; '));
    assert.equal(qualification.qualified, true);
    assert.equal(qualification.specialistAgentNames.length, 9);
  });
});
