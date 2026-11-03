import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  TRADING_AGENTS_MESH_ROLES,
  TRADING_AGENTS_ASSIMILATION,
  TRADING_AGENTS_NATIVE_ROLE_MAP,
  TradingAgentsResearchMesh,
  CANONICAL_TRADING_AGENTS_STATE_GRAPH,
  evaluateNative09TradingAgentsResearchQualification,
  HELIOS_NATIVE_INSTITUTIONAL_AGENT_MESH_QUALIFIED,
  roleDisplayLabel,
} from '../packages/agentic-capital-mesh/src/trading-agents-research-mesh/index.ts';
import type { EvidenceReference } from '../packages/agentic-capital-mesh/src/research-mesh/index.ts';
import { assembleCapitalContext, type ContextSource } from '../packages/agentic-capital-mesh/src/context.ts';
import {
  seedTradingAgentsPromptTemplates,
  validatePortfolioManagerResearchDecision,
  validateResearchManagerPlan,
  validateTraderResearchProposal,
} from '../packages/ai-runtime/src/trading-agents-research/index.ts';

const NOW = asUtcInstant('2026-09-17T09:00:00.000Z');

function evidence(overrides: Partial<EvidenceReference> = {}): EvidenceReference {
  return Object.freeze({
    evidenceId: overrides.evidenceId ?? 'ev_native09_1',
    sourceKind: overrides.sourceKind ?? 'MARKET_OBSERVATION',
    sourceRef: overrides.sourceRef ?? 'obs/sim-equity-native09',
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
              mandateId: 'man_native09',
              version: 1,
              status: 'ACTIVE',
              hardConstraintKinds: Object.freeze(['MINIMUM_CASH_RESERVE']),
              prohibitedCategories: Object.freeze([]),
              minimumLiquidMinor: 50_000n,
              compatibleWithInvestment: true,
            },
            growth: {
              planId: 'gpl_native09',
              version: 1,
              considersInvestment: true,
              state: 'ACTIVE',
            },
            peve: {
              snapshotId: 'peve_native09',
              resilienceLabel: 'moderate',
              goalProgressLabel: 'on-track',
              opportunityCapacityLabel: 'available',
              compositeOptimizationForbidden: true as const,
              humanWorthSemantics: false as const,
            },
            portfolio: {
              portfolioId: 'inv_native09',
              brokerageCashMinor: 900_000n,
              unsettledCashMinor: 0n,
              pendingOrderNotionalMinor: 0n,
              holdings: Object.freeze([]),
              accountRestricted: false,
            },
            riskBudget: {
              budgetId: 'rbdg_native09',
              version: 'risk-policy-v1',
              maximumInstrumentConcentrationUnits: 60_000_000n,
              minimumBrokerageCashMinor: 0n,
            },
            registeredModels: Object.freeze([]),
            universe: Object.freeze([
              {
                instrumentId: 'SIM-EQ-N09',
                instrumentType: 'EQUITY',
                available: true,
                fractionalSupported: true,
                incrementUnits: 1n,
                currency: 'USD',
              },
            ]),
            market: Object.freeze([
              {
                instrumentId: 'SIM-EQ-N09',
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

describe('HELIOS NATIVE09 TradingAgents research mesh assimilation', () => {
  it('pins assimilation reference and maps upstream graph roles', () => {
    assert.equal(TRADING_AGENTS_ASSIMILATION.referenceSha, 'c4544913a14ed3df5f1ed7b9e8483270ce20682a');
    assert.ok(TRADING_AGENTS_ASSIMILATION.assimilationPath.includes('vendor/assimilation/tradingagents'));
    assert.ok(Object.keys(TRADING_AGENTS_NATIVE_ROLE_MAP).some((path) => path.includes('bull_researcher')));
    assert.ok(Object.keys(TRADING_AGENTS_NATIVE_ROLE_MAP).some((path) => path.includes('portfolio_manager')));
  });

  it('registers thirteen TradingAgents-native research roles with ai-runtime prompts', () => {
    assert.equal(TRADING_AGENTS_MESH_ROLES.length, 13);
    const prompts = seedTradingAgentsPromptTemplates(NOW);
    assert.equal(prompts.length, 13);
    assert.deepEqual(
      TRADING_AGENTS_MESH_ROLES.map((role) => roleDisplayLabel(role)),
      Object.freeze([
        'Market Analyst',
        'Fundamentals Analyst',
        'News Analyst',
        'Sentiment Analyst',
        'Technical Analyst',
        'Bull Researcher',
        'Bear Researcher',
        'Trader Researcher',
        'Aggressive Analyst',
        'Conservative Analyst',
        'Neutral Analyst',
        'Research Manager',
        'Portfolio Manager',
      ]),
    );
  });

  it('runs parallel analysts, investment debate, risk debate, and synthesis without execution authority', () => {
    const clock = new FrozenClock(NOW);
    const mesh = new TradingAgentsResearchMesh({ clock });
    const ctx = assembleCapitalContext({
      meshId: 'cmsh_native09',
      subjectId: 'cust_native09',
      now: NOW,
      source: sourceFor('cust_native09'),
    });
    assert.ok(ctx.ok);
    if (!ctx.ok) throw new Error('context');
    const result = mesh.run({
      request: {
        workOrderId: 'wo_native09',
        subjectId: 'cust_native09',
        objective: 'Native09 equity sleeve research',
        contextRef: 'ctx_native09',
        evidenceBundle: Object.freeze([evidence()]),
      },
      context: ctx.value,
    });
    assert.equal(result.ok, true, result.ok ? '' : result.error.message);
    if (!result.ok) throw new Error('mesh run');

    assert.ok(result.value.analystReports.marketReport.length > 0);
    assert.ok(result.value.investmentDebate.count >= 2);
    assert.ok(result.value.riskDebate.count >= 3);
    assert.ok(result.value.stateGraphTrace.length >= CANONICAL_TRADING_AGENTS_STATE_GRAPH.length);
    assert.equal(new Set(result.value.artifacts.map((row) => row.role)).size, 13);

    for (const artifact of result.value.artifacts) {
      assert.equal(artifact.grantsFinancialAuthority, false);
      assert.equal(artifact.issuesOrders, false);
    }

    assert.ok(result.value.researchPlan);
    assert.ok(result.value.traderProposal);
    assert.ok(result.value.portfolioDecision);
    assert.equal(validateResearchManagerPlan(result.value.researchPlan).ok, true);
    assert.equal(validateTraderResearchProposal(result.value.traderProposal).ok, true);
    assert.equal(validatePortfolioManagerResearchDecision(result.value.portfolioDecision).ok, true);

    const traderArtifact = result.value.artifacts.find((row) => row.role === 'TRADER_RESEARCHER');
    assert.ok(traderArtifact?.narrative.includes('research proposal'));
    assert.equal(mesh.memory.snapshot().length, 1);
  });

  it('HELIOS_NATIVE_INSTITUTIONAL_AGENT_MESH_QUALIFIED when checks pass', () => {
    const clock = new FrozenClock(NOW);
    const mesh = new TradingAgentsResearchMesh({ clock });
    const ctx = assembleCapitalContext({
      meshId: 'cmsh_native09_q',
      subjectId: 'cust_native09_q',
      now: NOW,
      source: sourceFor('cust_native09_q'),
    });
    assert.ok(ctx.ok);
    if (!ctx.ok) throw new Error('context');
    const run = mesh.run({
      request: {
        workOrderId: 'wo_native09_q',
        subjectId: 'cust_native09_q',
        objective: 'Qualification run',
        contextRef: 'ctx_native09_q',
        evidenceBundle: Object.freeze([evidence({ evidenceId: 'ev_q' })]),
      },
      context: ctx.value,
    });
    assert.equal(run.ok, true);
    if (!run.ok) throw new Error('run');
    const qualification = evaluateNative09TradingAgentsResearchQualification({
      sampleArtifacts: run.value.artifacts,
    });
    assert.equal(
      qualification.marker,
      HELIOS_NATIVE_INSTITUTIONAL_AGENT_MESH_QUALIFIED,
      qualification.blockers.join('; '),
    );
    assert.equal(qualification.qualified, true);
    assert.equal(qualification.roleLabels.length, 13);
  });
});
