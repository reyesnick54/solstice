import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { assembleCapitalContext, type ContextSource } from '../packages/agentic-capital-mesh/src/context.ts';
import type { EvidenceReference } from '../packages/agentic-capital-mesh/src/research-mesh/index.ts';
import {
  EARNINGS_COMMITTEE_AGENT_NAMES,
  EARNINGS_COMMITTEE_ROLES,
  EarningsAgenticCommittee,
  assertEarningsEvidencePackUnchanged,
  assignEarningsSpecialists,
  evaluateEarn10AgenticCommitteeQualification,
  expectedInformationValue,
  freezeEarningsEvidencePack,
  HELIOS_EARN10_AGENTIC_COMMITTEE_QUALIFIED,
  specialistAgentNames,
  validateEarningsInvestmentThesis,
} from '../packages/agentic-capital-mesh/src/earnings-agentic-committee/index.ts';

const NOW = asUtcInstant('2026-11-04T07:00:00.000Z');

function evidence(overrides: Partial<EvidenceReference> = {}): EvidenceReference {
  return Object.freeze({
    evidenceId: overrides.evidenceId ?? 'ev_earn10_1',
    sourceKind: overrides.sourceKind ?? 'MARKET_OBSERVATION',
    sourceRef: overrides.sourceRef ?? 'obs/sim-equity-earn',
    observedAt: overrides.observedAt ?? NOW,
    freshnessOk: overrides.freshnessOk ?? true,
    entitlementOk: overrides.entitlementOk ?? true,
    provenanceRef: overrides.provenanceRef ?? 'prov/helios-earn10',
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
              mandateId: 'man_earn10',
              version: 1,
              status: 'ACTIVE',
              hardConstraintKinds: Object.freeze(['MINIMUM_CASH_RESERVE']),
              prohibitedCategories: Object.freeze([]),
              minimumLiquidMinor: 50_000n,
              compatibleWithInvestment: true,
            },
            growth: {
              planId: 'gpl_earn10',
              version: 1,
              considersInvestment: true,
              state: 'ACTIVE',
            },
            peve: {
              snapshotId: 'peve_earn10',
              resilienceLabel: 'moderate',
              goalProgressLabel: 'on-track',
              opportunityCapacityLabel: 'available',
              compositeOptimizationForbidden: true as const,
              humanWorthSemantics: false as const,
            },
            portfolio: {
              portfolioId: 'inv_earn10',
              brokerageCashMinor: 500_000n,
              unsettledCashMinor: 0n,
              pendingOrderNotionalMinor: 0n,
              holdings: Object.freeze([]),
              accountRestricted: false,
            },
            riskBudget: {
              budgetId: 'rbdg_earn10',
              version: 'risk-policy-v1',
              maximumInstrumentConcentrationUnits: 60_000_000n,
              minimumBrokerageCashMinor: 0n,
            },
            registeredModels: Object.freeze([]),
            universe: Object.freeze([
              {
                instrumentId: 'SIM-EQ-EARN',
                instrumentType: 'EQUITY',
                available: true,
                fractionalSupported: true,
                incrementUnits: 1n,
                currency: 'USD',
              },
            ]),
            market: Object.freeze([
              {
                instrumentId: 'SIM-EQ-EARN',
                priceMinor: 12_500n,
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

describe('HELIOS EARN10 agentic earnings investment committee', () => {
  it('exports qualification marker HELIOS_EARN10_AGENTIC_COMMITTEE_QUALIFIED', () => {
    assert.equal(
      HELIOS_EARN10_AGENTIC_COMMITTEE_QUALIFIED,
      'HELIOS_EARN10_AGENTIC_COMMITTEE_QUALIFIED',
    );
  });

  it('registers twelve named specialist agents', () => {
    const names = specialistAgentNames();
    assert.equal(names.length, 12);
    assert.equal(EARNINGS_COMMITTEE_ROLES.length, 12);
    assert.equal(EARNINGS_COMMITTEE_AGENT_NAMES.HARD_FINANCIALS, 'HardFinancialsAgent');
    assert.equal(EARNINGS_COMMITTEE_AGENT_NAMES.EARNINGS_SYNTHESIS, 'EarningsSynthesisAgent');
  });

  it('1. freezes evidence pack and rejects post-freeze mutation', () => {
    const pack = freezeEarningsEvidencePack({
      packId: 'pack_earn10',
      evidence: Object.freeze([evidence()]),
      frozenAt: NOW,
    });
    assert.ok(pack.contentHash.length > 0);
    assertEarningsEvidencePackUnchanged(pack, Object.freeze([evidence()]));
    assert.throws(() =>
      assertEarningsEvidencePackUnchanged(pack, Object.freeze([evidence({ freshnessOk: false })])),
    );
  });

  it('2. H20 gates expensive specialists when uncertainty and importance are low', () => {
    const eiv = expectedInformationValue({
      baseline: 0.55,
      currentUncertainty: 0.1,
      decisionImportance: 0.2,
    });
    assert.ok(eiv < 0.9);
    const decisions = assignEarningsSpecialists({
      currentUncertainty: 0.1,
      decisionImportance: 0.2,
    });
    const transcript = decisions.find((row) => row.role === 'TRANSCRIPT_INTELLIGENCE');
    assert.ok(transcript);
    assert.equal(transcript!.assigned, false);
    const hard = decisions.find((row) => row.role === 'HARD_FINANCIALS');
    assert.equal(hard!.assigned, true);
  });

  it('3. runs full committee pipeline and produces EarningsInvestmentThesis', () => {
    const subjectId = 'cust_earn10';
    const ctx = assembleCapitalContext({
      meshId: 'cmsh_earn10',
      subjectId,
      now: NOW,
      source: sourceFor(subjectId),
    });
    assert.ok(ctx.ok);
    const committee = new EarningsAgenticCommittee({ clock: new FrozenClock(NOW) });
    const result = committee.run({
      context: ctx.value,
      request: Object.freeze({
        workOrderId: 'wo_earn10',
        subjectId,
        entity: 'SIMCORP',
        event: 'Q3-2026-EARNINGS',
        objective: 'Pre-earnings intelligence for SIMCORP Q3 print',
        contextRef: 'ctx_earn10',
        evidenceBundle: Object.freeze([evidence(), evidence({ evidenceId: 'ev_earn10_2' })]),
        timeHorizon: 'EARNINGS_WINDOW',
        decisionImportance: 0.75,
        forceAllSpecialists: true,
      }),
    });
    assert.ok(result.ok, result.ok ? '' : result.error.message);
    const run = result.value;
    assert.equal(run.thesis.entity, 'SIMCORP');
    assert.equal(run.thesis.event, 'Q3-2026-EARNINGS');
    assert.equal(run.thesis.grantsFinancialAuthority, false);
    assert.equal(run.thesis.issuesOrders, false);
    assert.ok(run.thesis.beatProbabilities.length >= 3);
    assert.ok(run.thesis.bullCase.summary.length > 0);
    assert.ok(run.thesis.bearCase.summary.length > 0);
    assert.ok(run.thesis.baseCase.summary.length > 0);
    assert.ok(run.probabilisticState.stateId.startsWith('pes_'));
    assert.ok(run.h20Assignments.length >= 12);
    const thesisErrors = validateEarningsInvestmentThesis(run.thesis);
    assert.deepEqual(thesisErrors, []);

    const qualification = evaluateEarn10AgenticCommitteeQualification({
      sampleArtifacts: run.artifacts,
      sampleThesis: run.thesis,
    });
    assert.equal(qualification.marker, HELIOS_EARN10_AGENTIC_COMMITTEE_QUALIFIED);
    assert.equal(qualification.qualified, true);
  });
});
