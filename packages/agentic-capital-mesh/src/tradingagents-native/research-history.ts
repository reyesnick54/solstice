import type { UtcInstant } from '../imports.ts';
import { TradingAgentsDecisionMemoryStore } from './decision-memory.ts';
import type { PortfolioContextState } from './portfolio-context.ts';

export type ResearchRunContextPackage = {
  readonly schema: 'sunrey.agentic-capital-mesh.tradingagents-research-context.v1';
  readonly subjectId: string;
  readonly ticker: string;
  readonly tradeDate: string;
  readonly evaluationTimeUtc: UtcInstant;
  readonly portfolio: PortfolioContextState;
  readonly portfolioBlock: string | null;
  readonly decisionMemoryContext: string;
  readonly dataEvidenceRefs: readonly string[];
};

export function buildDecisionMemoryContext(
  store: TradingAgentsDecisionMemoryStore,
  input: { readonly ticker: string; readonly asOfTradeDate: string },
): string {
  return store.pastContextForBacktest(input);
}

export function packageResearchRunContext(input: {
  readonly subjectId: string;
  readonly ticker: string;
  readonly tradeDate: string;
  readonly evaluationTimeUtc: UtcInstant;
  readonly portfolio: PortfolioContextState;
  readonly portfolioBlock: string | null;
  readonly memoryStore: TradingAgentsDecisionMemoryStore;
  readonly asOfTradeDate: string;
  readonly dataEvidenceRefs: readonly string[];
}): ResearchRunContextPackage {
  return Object.freeze({
    schema: 'sunrey.agentic-capital-mesh.tradingagents-research-context.v1',
    subjectId: input.subjectId,
    ticker: input.ticker,
    tradeDate: input.tradeDate,
    evaluationTimeUtc: input.evaluationTimeUtc,
    portfolio: input.portfolio,
    portfolioBlock: input.portfolioBlock,
    decisionMemoryContext: buildDecisionMemoryContext(input.memoryStore, {
      ticker: input.ticker,
      asOfTradeDate: input.asOfTradeDate,
    }),
    dataEvidenceRefs: Object.freeze([...input.dataEvidenceRefs]),
  });
}
