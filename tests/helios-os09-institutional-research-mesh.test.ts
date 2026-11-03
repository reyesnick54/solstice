import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  INSTITUTIONAL_RESEARCH_ROLES,
  InstitutionalResearchMesh,
  TRADING_AGENTS_UPSTREAM,
  TRADING_AGENTS_ROLE_INSPIRATION,
  defaultInstitutionalRoles,
  evaluateOs09InstitutionalResearchQualification,
  HELIOS_OS09_INSTITUTIONAL_RESEARCH_MESH_QUALIFIED,
  roleDisplayName,
  validateStructuredResearchArtifact,
} from '../packages/agentic-capital-mesh/src/institutional-research-mesh/index.ts';
import type { EvidenceReference } from '../packages/agentic-capital-mesh/src/research-mesh/index.ts';
import { assembleCapitalContext, type ContextSource } from '../packages/agentic-capital-mesh/src/context.ts';

const NOW = asUtcInstant('2026-09-17T08:00:00.000Z');

function evidence(overrides: Partial<EvidenceReference> = {}): EvidenceReference {
  return Object.freeze({
    evidenceId: overrides.evidenceId ?? 'ev_os09_1',
    sourceKind: overrides.sourceKind ?? 'MARKET_OBSERVATION',
    sourceRef: overrides.sourceRef ?? 'obs/sim-equity-1',
    observedAt: overrides.observedAt ?? NOW,
    freshnessOk: overrides.freshnessOk ?? true,
    entitlementOk: overrides.entitlementOk ?? true,
    provenanceRef: overrides.provenanceRef ?? 'prov/helios-h08',
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
              mandateId: 'man_os09',
              version: 1,
              status: 'ACTIVE',
              hardConstraintKinds: Object.freeze(['MINIMUM_CASH_RESERVE']),
              prohibitedCategories: Object.freeze([]),
              minimumLiquidMinor: 50_000n,
              compatibleWithInvestment: true,
            },
            growth: {
              planId: 'gpl_os09',
              version: 1,
              considersInvestment: true,
              state: 'ACTIVE',
            },
            peve: {
              snapshotId: 'peve_os09',
              resilienceLabel: 'moderate',
              goalProgressLabel: 'on-track',
              opportunityCapacityLabel: 'available',
              compositeOptimizationForbidden: true as const,
              humanWorthSemantics: false as const,
            },
            portfolio: {
              portfolioId: 'inv_os09',
              brokerageCashMinor: 750_000n,
              unsettledCashMinor: 0n,
              pendingOrderNotionalMinor: 0n,
              holdings: Object.freeze([]),
              accountRestricted: false,
            },
            riskBudget: {
              budgetId: 'rbdg_os09',
              version: 'risk-policy-v1',
              maximumInstrumentConcentrationUnits: 60_000_000n,
              minimumBrokerageCashMinor: 0n,
            },
            registeredModels: Object.freeze([]),
            universe: Object.freeze([{ instrumentId: 'SIM-EQ-1', assetClass: 'EQUITY' }]),
            market: Object.freeze([{ instrumentId: 'SIM-EQ-1', last: 100 }]),
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

describe('HELIOS OS09 institutional multi-agent research mesh', () => {
  it('maps TradingAgents upstream roles to HELIOS institutional agents (reference only)', () => {
    assert.equal(TRADING_AGENTS_UPSTREAM.referenceSha, 'c4544913a14ed3df5f1ed7b9e8483270ce20682a');
    assert.equal(TRADING_AGENTS_UPSTREAM.license, 'Apache-2.0');
    assert.ok(Object.keys(TRADING_AGENTS_ROLE_INSPIRATION).some((path) => path.includes('fundamentals_analyst')));
    assert.ok(Object.keys(TRADING_AGENTS_ROLE_INSPIRATION).some((path) => path.includes('research_manager')));
  });

  it('registers fourteen specialist research agents with structured artifact contract', () => {
    assert.equal(INSTITUTIONAL_RESEARCH_ROLES.length, 14);
    assert.equal(defaultInstitutionalRoles().length, 14);
    const expectedNames = Object.freeze([
      'FundamentalResearchAgent',
      'EarningsResearchAgent',
      'TechnicalResearchAgent',
      'MacroResearchAgent',
      'NewsResearchAgent',
      'SentimentResearchAgent',
      'OptionsResearchAgent',
      'FlowResearchAgent',
      'CryptoOnChainResearchAgent',
      'BullResearchAgent',
      'BearResearchAgent',
      'RiskResearchAgent',
      'ExecutionResearchAgent',
      'ResearchSynthesisAgent',
    ]);
    assert.deepEqual(
      INSTITUTIONAL_RESEARCH_ROLES.map((role) => roleDisplayName(role)),
      expectedNames,
    );
  });

  it('runs institutional mesh through canonical HELIOS read tools only', () => {
    const clock = new FrozenClock(NOW);
    const mesh = new InstitutionalResearchMesh({ clock });
    const ctx = assembleCapitalContext({
      meshId: 'cmsh_os09',
      subjectId: 'cust_os09',
      now: NOW,
      source: sourceFor('cust_os09'),
    });
    assert.ok(ctx.ok);
    if (!ctx.ok) throw new Error('context');
    const result = mesh.run({
      request: {
        workOrderId: 'wo_os09',
        subjectId: 'cust_os09',
        objective: 'Institutional equity sleeve review',
        contextRef: 'ctx_os09',
        evidenceBundle: Object.freeze([evidence()]),
        instrumentHints: Object.freeze(['SIM-EQ-1']),
        regimeHints: Object.freeze(['RISK_ON_SIM']),
      },
      context: ctx.value,
    });
    assert.equal(result.ok, true, result.ok ? '' : result.error.message);
    if (!result.ok) throw new Error('mesh run');
    assert.equal(result.value.artifacts.length, 14);
    for (const artifact of result.value.artifacts) {
      assert.deepEqual(validateStructuredResearchArtifact(artifact), []);
      assert.equal(artifact.grantsFinancialAuthority, false);
      assert.equal(artifact.issuesOrders, false);
      assert.ok(artifact.sourceRefs.length > 0);
      assert.ok(artifact.thesis.length > 0);
    }
    const execution = result.value.artifacts.find((row) => row.role === 'EXECUTION_RESEARCH');
    assert.ok(execution);
    assert.ok(execution!.knownLimitations.some((line) => /never submits orders/i.test(line)));
    assert.ok(result.value.synthesisArtifactId);
  });

  it('refuses cross-subject data access', () => {
    const clock = new FrozenClock(NOW);
    const mesh = new InstitutionalResearchMesh({ clock });
    const ctx = assembleCapitalContext({
      meshId: 'cmsh_os09',
      subjectId: 'cust_os09_a',
      now: NOW,
      source: sourceFor('cust_os09_a'),
    });
    assert.ok(ctx.ok);
    if (!ctx.ok) throw new Error('context');
    const result = mesh.run({
      request: {
        workOrderId: 'wo_os09_x',
        subjectId: 'cust_os09_b',
        objective: 'Cross subject',
        contextRef: 'ctx_os09',
        evidenceBundle: Object.freeze([evidence()]),
      },
      context: ctx.value,
    });
    assert.equal(result.ok, false);
    if (result.ok) throw new Error('expected refusal');
    assert.equal(result.error.code, 'SUBJECT_MISMATCH');
  });

  it('HELIOS_OS09_INSTITUTIONAL_RESEARCH_MESH_QUALIFIED when checks pass', () => {
    const clock = new FrozenClock(NOW);
    const mesh = new InstitutionalResearchMesh({ clock });
    const ctx = assembleCapitalContext({
      meshId: 'cmsh_os09',
      subjectId: 'cust_os09_q',
      now: NOW,
      source: sourceFor('cust_os09_q'),
    });
    assert.ok(ctx.ok);
    if (!ctx.ok) throw new Error('context');
    const run = mesh.run({
      request: {
        workOrderId: 'wo_os09_q',
        subjectId: 'cust_os09_q',
        objective: 'Qualification run',
        contextRef: 'ctx_os09_q',
        evidenceBundle: Object.freeze([evidence()]),
      },
      context: ctx.value,
    });
    assert.equal(run.ok, true);
    if (!run.ok) throw new Error('run');
    const qualification = evaluateOs09InstitutionalResearchQualification({
      sampleArtifacts: run.value.artifacts,
    });
    assert.equal(qualification.marker, HELIOS_OS09_INSTITUTIONAL_RESEARCH_MESH_QUALIFIED, qualification.blockers.join('; '));
    assert.equal(qualification.qualified, true);
    assert.equal(qualification.specialistAgentNames.length, 14);
  });
});
