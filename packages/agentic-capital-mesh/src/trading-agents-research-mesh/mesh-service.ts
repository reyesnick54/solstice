import { createHash } from 'node:crypto';

import { err, ok, type Result, type Clock } from '../imports.ts';
import type { CapitalContext } from '../types.ts';
import { loadHeliosResearchData } from '../institutional-research-mesh/data-context.ts';
import {
  buildAnalystExecutionPlan,
  runAnalystPhaseParallel,
} from './analyst-execution.ts';
import {
  shouldContinueInvestmentDebate,
  shouldContinueRiskDebate,
} from './conditional-logic.ts';
import {
  appendInvestDebateTurn,
  appendRiskDebateTurn,
  initialInvestDebateState,
  initialRiskDebateState,
} from './debate.ts';
import { TradingAgentsDecisionMemory } from './memory.ts';
import {
  runAnalystRole,
  runBearResearcher,
  runBullResearcher,
  runPortfolioManager,
  runResearchManager,
  runRiskAnalyst,
  runTraderResearcher,
} from './role-runners.ts';
import { CANONICAL_TRADING_AGENTS_STATE_GRAPH } from './state-graph.ts';
import type {
  AnalystReportBundle,
  TradingAgentsResearchArtifact,
  TradingAgentsResearchMeshFailure,
  TradingAgentsResearchMeshRun,
  TradingAgentsResearchRequest,
} from './types.ts';

function runIdFor(workOrderId: string, subjectId: string, now: string): string {
  return `tarm_${createHash('sha256').update(`${workOrderId}:${subjectId}:${now}`).digest('hex').slice(0, 20)}`;
}

export class TradingAgentsResearchMesh {
  private readonly clock: Clock;
  readonly memory: TradingAgentsDecisionMemory;

  constructor(input: { readonly clock: Clock; readonly memory?: TradingAgentsDecisionMemory }) {
    this.clock = input.clock;
    this.memory = input.memory ?? new TradingAgentsDecisionMemory();
  }

  run(input: {
    readonly request: TradingAgentsResearchRequest;
    readonly context: CapitalContext;
    readonly promptTemplateId?: string;
    readonly promptTemplateVersion?: string;
  }): Result<TradingAgentsResearchMeshRun, TradingAgentsResearchMeshFailure> {
    const now = this.clock.now();
    const maxDebateRounds = input.request.maxDebateRounds ?? 1;
    const maxRiskDiscussRounds = input.request.maxRiskDiscussRounds ?? 1;
    const promptTemplateId = input.promptTemplateId ?? 'ta_native09_bundle';
    const promptTemplateVersion = input.promptTemplateVersion ?? '1';

    const dataResult = loadHeliosResearchData({
      context: input.context,
      subjectId: input.request.subjectId,
      contextRef: input.request.contextRef,
      evidenceBundle: input.request.evidenceBundle,
    });
    if (!dataResult.ok) {
      return err({ code: dataResult.error.code, message: dataResult.error.message });
    }

    const memoryLoad = this.memory.loadPastContext(input.request.subjectId, now);
    const artifacts: TradingAgentsResearchArtifact[] = [];
    const trace = [...CANONICAL_TRADING_AGENTS_STATE_GRAPH];

    const runnerCtxBase = {
      workOrderId: input.request.workOrderId,
      subjectId: input.request.subjectId,
      objective: input.request.objective,
      informationTime: now,
      data: dataResult.value,
      analystReports: Object.freeze({
        marketReport: '',
        fundamentalReport: '',
        newsReport: '',
        sentimentReport: '',
        technicalReport: '',
      }) as AnalystReportBundle,
      investmentDebate: initialInvestDebateState(),
      riskDebate: initialRiskDebateState(),
      researchPlan: null,
      pastContext: memoryLoad.pastContext,
      promptTemplateId,
      promptTemplateVersion,
    };

    const analystPlan = buildAnalystExecutionPlan();
    const analystResults = runAnalystPhaseParallel(analystPlan, (spec) => {
      const ctx = { ...runnerCtxBase, analystReports: runnerCtxBase.analystReports };
      return runAnalystRole(ctx, spec.role, spec.reportKey);
    });

    const reportDraft: Record<string, string> = {
      marketReport: '',
      fundamentalReport: '',
      newsReport: '',
      sentimentReport: '',
      technicalReport: '',
    };
    for (let i = 0; i < analystPlan.length; i += 1) {
      reportDraft[analystPlan[i]!.reportKey] = analystResults[i]!.reportLine;
    }
    const analystReports: AnalystReportBundle = Object.freeze({
      marketReport: reportDraft.marketReport ?? '',
      fundamentalReport: reportDraft.fundamentalReport ?? '',
      newsReport: reportDraft.newsReport ?? '',
      sentimentReport: reportDraft.sentimentReport ?? '',
      technicalReport: reportDraft.technicalReport ?? '',
    });

    for (const result of analystResults) {
      artifacts.push(result.artifact);
    }

    let investmentDebate = initialInvestDebateState();
    let debateRoute = shouldContinueInvestmentDebate({ state: investmentDebate, maxDebateRounds });
    while (debateRoute !== 'RESEARCH_MANAGER') {
      const ctx = { ...runnerCtxBase, analystReports, investmentDebate, riskDebate: initialRiskDebateState() };
      if (debateRoute === 'BULL_RESEARCHER') {
        const artifact = runBullResearcher(ctx);
        artifacts.push(artifact);
        investmentDebate = appendInvestDebateTurn(investmentDebate, 'BULL_RESEARCHER', artifact.narrative);
      } else {
        const artifact = runBearResearcher(ctx);
        artifacts.push(artifact);
        investmentDebate = appendInvestDebateTurn(investmentDebate, 'BEAR_RESEARCHER', artifact.narrative);
      }
      debateRoute = shouldContinueInvestmentDebate({ state: investmentDebate, maxDebateRounds });
    }

    const managerCtx = {
      ...runnerCtxBase,
      analystReports,
      investmentDebate,
      riskDebate: initialRiskDebateState(),
    };
    const manager = runResearchManager(managerCtx);
    artifacts.push(manager.artifact);

    const traderCtx = { ...managerCtx, researchPlan: manager.plan };
    const trader = runTraderResearcher(traderCtx, manager.plan);
    artifacts.push(trader.artifact);

    let riskDebate = initialRiskDebateState();
    let riskRoute = shouldContinueRiskDebate({ state: riskDebate, maxRiskDiscussRounds });
    while (riskRoute !== 'PORTFOLIO_MANAGER') {
      const ctx = {
        ...traderCtx,
        investmentDebate,
        riskDebate,
        researchPlan: manager.plan,
      };
      const role =
        riskRoute === 'AGGRESSIVE_RISK_ANALYST'
          ? 'AGGRESSIVE_RISK_ANALYST'
          : riskRoute === 'CONSERVATIVE_RISK_ANALYST'
            ? 'CONSERVATIVE_RISK_ANALYST'
            : 'NEUTRAL_RISK_ANALYST';
      const artifact = runRiskAnalyst(ctx, role);
      artifacts.push(artifact);
      riskDebate = appendRiskDebateTurn(riskDebate, role, artifact.narrative);
      riskRoute = shouldContinueRiskDebate({ state: riskDebate, maxRiskDiscussRounds });
    }

    const portfolioCtx = { ...traderCtx, investmentDebate, riskDebate, researchPlan: manager.plan };
    const portfolio = runPortfolioManager(portfolioCtx, trader.proposal);
    artifacts.push(portfolio.artifact);

    this.memory.storeDecision({
      entryId: `tmem_${input.request.workOrderId}`,
      subjectId: input.request.subjectId,
      workOrderId: input.request.workOrderId,
      informationTime: now,
      finalRating: portfolio.decision.finalRating,
      decisionText: portfolio.decision.finalDecision,
    });

    return ok(
      Object.freeze({
        runId: runIdFor(input.request.workOrderId, input.request.subjectId, now),
        workOrderId: input.request.workOrderId,
        subjectId: input.request.subjectId,
        objective: input.request.objective,
        analystReports,
        investmentDebate,
        riskDebate,
        researchPlan: manager.plan,
        traderProposal: trader.proposal,
        portfolioDecision: portfolio.decision,
        pastContext: memoryLoad.pastContext,
        memoryNote: memoryLoad.memoryNote,
        artifacts: Object.freeze([...artifacts]),
        stateGraphTrace: Object.freeze([...trace]),
        createdAt: now,
        completedAt: now,
      }),
    );
  }
}
