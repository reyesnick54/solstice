import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { assembleCapitalContext, type ContextSource } from '../packages/agentic-capital-mesh/src/context.ts';
import type { EvidenceReference } from '../packages/agentic-capital-mesh/src/research-mesh/index.ts';
import {
  HELIOS_VAL06_AGENTIC_VALUATION_QUALIFIED,
  VALUATION_COMMITTEE_AGENT_NAMES,
  VALUATION_COMMITTEE_ROLES,
  ValuationAgenticCommittee,
  assertValuationEvidencePackUnchanged,
  assignValuationSpecialists,
  evaluateVal06AgenticValuationQualification,
  expectedInformationValue,
  freezeValuationEvidencePack,
  specialistAgentNames,
  validateValuationInvestmentThesis,
  type CanonicalFinancialFact,
} from '../packages/agentic-capital-mesh/src/valuation-agentic-committee/index.ts';
import { buildHeliosValuationState } from '../packages/platform/src/helios/valuation-intelligence/index.ts';

const NOW = asUtcInstant('2026-11-04T07:00:00.000Z');

function evidence(overrides: Partial<EvidenceReference> = {}): EvidenceReference {
  return Object.freeze({
    evidenceId: overrides.evidenceId ?? 'ev_val06_1',
    sourceKind: overrides.sourceKind ?? 'FINANCIAL_STATEMENT_FACT',
    sourceRef: overrides.sourceRef ?? 'fundamentals/sim-equity-val',
    observedAt: overrides.observedAt ?? NOW,
    freshnessOk: overrides.freshnessOk ?? true,
    entitlementOk: overrides.entitlementOk ?? true,
    provenanceRef: overrides.provenanceRef ?? 'prov/helios-val06',
  });
}

function canonicalFacts(): readonly CanonicalFinancialFact[] {
  return Object.freeze([
    Object.freeze({
      factId: 'fact_rev',
      label: 'LTM_REVENUE',
      valueMinor: 50_000_000_000_000n,
      currency: 'USD',
      asOf: NOW,
      sourceRef: 'aaf/os10/sim',
    }),
    Object.freeze({
      factId: 'fact_ebitda',
      label: 'LTM_EBITDA',
      valueMinor: 12_000_000_000_000n,
      currency: 'USD',
      asOf: NOW,
      sourceRef: 'aaf/os10/sim',
    }),
    Object.freeze({
      factId: 'fact_shares',
      label: 'DILUTED_SHARES',
      valueMinor: 1_000_000_000n,
      currency: 'USD',
      asOf: NOW,
      sourceRef: 'aaf/os10/sim',
    }),
  ]);
}

function sourceFor(subjectId: string): ContextSource {
  return {
    subjectId,
    bind: (requested) =>
      requested === subjectId
        ? {
            subjectId,
            mandate: {
              mandateId: 'man_val06',
              version: 1,
              status: 'ACTIVE',
              hardConstraintKinds: Object.freeze(['MINIMUM_CASH_RESERVE']),
              prohibitedCategories: Object.freeze([]),
              minimumLiquidMinor: 50_000n,
              compatibleWithInvestment: true,
            },
            growth: {
              planId: 'gpl_val06',
              version: 1,
              considersInvestment: true,
              state: 'ACTIVE',
            },
            peve: {
              snapshotId: 'peve_val06',
              resilienceLabel: 'moderate',
              goalProgressLabel: 'on-track',
              opportunityCapacityLabel: 'available',
              compositeOptimizationForbidden: true as const,
              humanWorthSemantics: false as const,
            },
            portfolio: {
              portfolioId: 'inv_val06',
              brokerageCashMinor: 500_000n,
              unsettledCashMinor: 0n,
              pendingOrderNotionalMinor: 0n,
              holdings: Object.freeze([]),
              accountRestricted: false,
            },
            riskBudget: {
              budgetId: 'rbdg_val06',
              version: 'risk-policy-v1',
              maximumInstrumentConcentrationUnits: 60_000_000n,
              minimumBrokerageCashMinor: 0n,
            },
            registeredModels: Object.freeze([]),
            universe: Object.freeze([
              {
                instrumentId: 'SIM-EQ-VAL',
                instrumentType: 'EQUITY',
                available: true,
                fractionalSupported: true,
                incrementUnits: 1n,
                currency: 'USD',
              },
            ]),
            market: Object.freeze([
              {
                instrumentId: 'SIM-EQ-VAL',
                priceMinor: 15_000n,
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

describe('HELIOS VAL06 agentic valuation investment committee', () => {
  it('exports qualification marker HELIOS_VAL06_AGENTIC_VALUATION_QUALIFIED', () => {
    assert.equal(
      HELIOS_VAL06_AGENTIC_VALUATION_QUALIFIED,
      'HELIOS_VAL06_AGENTIC_VALUATION_QUALIFIED',
    );
  });

  it('registers twelve named valuation specialist agents', () => {
    const names = specialistAgentNames();
    assert.equal(names.length, 12);
    assert.equal(VALUATION_COMMITTEE_ROLES.length, 12);
    assert.equal(VALUATION_COMMITTEE_AGENT_NAMES.REVENUE_FORECAST, 'RevenueForecastAgent');
    assert.equal(VALUATION_COMMITTEE_AGENT_NAMES.RESIDUAL_INCOME, 'ResidualIncomeAgent');
    assert.equal(VALUATION_COMMITTEE_AGENT_NAMES.VALUATION_RISK, 'ModelRiskAgent');
    assert.equal(VALUATION_COMMITTEE_AGENT_NAMES.VALUATION_SYNTHESIS, 'SynthesisAgent');
  });

  it('1. freezes evidence pack and canonical facts; rejects post-freeze mutation', () => {
    const facts = canonicalFacts();
    const pack = freezeValuationEvidencePack({
      packId: 'pack_val06',
      evidence: Object.freeze([evidence()]),
      canonicalFinancialFacts: facts,
      frozenAt: NOW,
    });
    assert.ok(pack.contentHash.length > 0);
    assert.ok(pack.factsHash.length > 0);
    assertValuationEvidencePackUnchanged(pack, Object.freeze([evidence()]), facts);
    assert.throws(() =>
      assertValuationEvidencePackUnchanged(
        pack,
        Object.freeze([evidence({ freshnessOk: false })]),
        facts,
      ),
    );
    assert.throws(() =>
      assertValuationEvidencePackUnchanged(pack, Object.freeze([evidence()]), [
        ...facts,
        Object.freeze({
          ...facts[0]!,
          valueMinor: facts[0]!.valueMinor + 1n,
        }),
      ]),
    );
  });

  it('2. H20 gates expensive specialists when uncertainty and importance are low', () => {
    const eiv = expectedInformationValue({
      baseline: 0.55,
      currentUncertainty: 0.1,
      decisionImportance: 0.2,
    });
    assert.ok(eiv < 0.9);
    const decisions = assignValuationSpecialists({
      currentUncertainty: 0.1,
      decisionImportance: 0.2,
    });
    const sotp = decisions.find((row) => row.role === 'SOTP');
    assert.ok(sotp);
    assert.equal(sotp!.assigned, false);
    const revenue = decisions.find((row) => row.role === 'REVENUE_FORECAST');
    assert.equal(revenue!.assigned, true);
  });

  it('3. runs full committee pipeline and produces ValuationInvestmentThesis', () => {
    const subjectId = 'cust_val06';
    const ctx = assembleCapitalContext({
      meshId: 'cmsh_val06',
      subjectId,
      now: NOW,
      source: sourceFor(subjectId),
    });
    assert.ok(ctx.ok);
    const committee = new ValuationAgenticCommittee({ clock: new FrozenClock(NOW) });
    const valuationState = buildHeliosValuationState({});
    const result = committee.run({
      context: ctx.value,
      request: Object.freeze({
        workOrderId: 'wo_val06',
        subjectId,
        entity: 'SIMCORP',
        instrumentId: 'SIM-EQ-VAL',
        objective: 'Intrinsic vs market valuation intelligence for SIMCORP',
        contextRef: 'ctx_val06',
        evidenceBundle: Object.freeze([evidence(), evidence({ evidenceId: 'ev_val06_2' })]),
        canonicalFinancialFacts: canonicalFacts(),
        extendedModelEvidence: valuationState.extendedModelEvidence,
        timeHorizon: 'MEDIUM_TERM',
        decisionImportance: 0.75,
        forceAllSpecialists: true,
      }),
    });
    assert.ok(result.ok, result.ok ? '' : result.error.message);
    const run = result.value;
    assert.equal(run.thesis.entity, 'SIMCORP');
    assert.equal(run.thesis.instrumentId, 'SIM-EQ-VAL');
    assert.equal(run.thesis.grantsFinancialAuthority, false);
    assert.equal(run.thesis.issuesOrders, false);
    assert.ok(run.thesis.intrinsicValueDistribution.length >= 3);
    assert.ok(run.thesis.marketImpliedExpectations.length >= 1);
    assert.ok(run.thesis.expectationGaps.length >= 1);
    assert.ok(run.thesis.bullCase.summary.length > 0);
    assert.ok(run.thesis.bearCase.summary.length > 0);
    assert.ok(run.thesis.baseCase.summary.length > 0);
    assert.ok(run.thesis.keyAssumptions.length >= 1);
    assert.ok(run.thesis.fragileAssumptions.length >= 1);
    assert.ok(run.assumptionChallengeState.stateId.startsWith('vas_'));
    assert.ok(run.h20Assignments.length >= 12);
    const thesisErrors = validateValuationInvestmentThesis(run.thesis);
    assert.deepEqual(thesisErrors, []);

    const qualification = evaluateVal06AgenticValuationQualification({
      sampleArtifacts: run.artifacts,
      sampleThesis: run.thesis,
    });
    assert.equal(qualification.marker, HELIOS_VAL06_AGENTIC_VALUATION_QUALIFIED);
    assert.equal(qualification.qualified, true);
  });
});
