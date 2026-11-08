import { createHash } from 'node:crypto';

import { HELIOS_ALPHA24_RESEARCH_BOOK_SCHEMA } from './taxonomy.ts';
import { isLoserStrategy, isRetiredStrategy, isSurvivingStrategy } from './stats.ts';
import type {
  CampaignEvidenceDigest,
  ForwardCampaignRecord,
  ForwardResearchBookInput,
  ForwardStrategyResearchRecord,
  PortfolioEvidenceCard,
  StrategyEvidenceCard,
} from './types.ts';

export function buildCampaignEvidenceDigest(
  campaign: ForwardCampaignRecord,
  strategies: readonly ForwardStrategyResearchRecord[],
): CampaignEvidenceDigest {
  const inCampaign = strategies.filter((s) => s.campaignId === campaign.campaignId);
  const loserStrategyIds = Object.freeze(inCampaign.filter(isLoserStrategy).map((s) => s.strategyId));
  const winnerStrategyIds = Object.freeze(
    inCampaign.filter((s) => !isLoserStrategy(s)).map((s) => s.strategyId),
  );
  const material = `campaign:${campaign.campaignId}:${inCampaign.length}`;
  const digestId = `alpha24-cmp:${createHash('sha256').update(material).digest('hex').slice(0, 16)}`;
  return Object.freeze({
    schema: HELIOS_ALPHA24_RESEARCH_BOOK_SCHEMA,
    kind: 'CAMPAIGN_EVIDENCE_DIGEST',
    digestId,
    campaignId: campaign.campaignId,
    startedAt: campaign.startedAt,
    terminatedAt: campaign.terminatedAt,
    state: campaign.state,
    opportunityCount: campaign.opportunityCount,
    strategiesTested: inCampaign.length,
    strategiesSurviving: inCampaign.filter(isSurvivingStrategy).length,
    strategiesRetired: inCampaign.filter(isRetiredStrategy).length,
    loserStrategyIds,
    winnerStrategyIds,
  });
}

export function buildStrategyEvidenceCard(strategy: ForwardStrategyResearchRecord): StrategyEvidenceCard {
  const material = `strategy:${strategy.strategyId}:${strategy.lifecycle}`;
  const cardId = `alpha24-str:${createHash('sha256').update(material).digest('hex').slice(0, 16)}`;
  return Object.freeze({
    schema: HELIOS_ALPHA24_RESEARCH_BOOK_SCHEMA,
    kind: 'STRATEGY_EVIDENCE_CARD',
    cardId,
    strategy,
    isLoser: isLoserStrategy(strategy),
    includedInCumulativeHistory: true,
  });
}

export function buildPortfolioEvidenceCard(input: ForwardResearchBookInput): PortfolioEvidenceCard {
  const active = input.strategies.filter((s) => s.lifecycle === 'ACTIVE' || s.lifecycle === 'CHALLENGER');
  const retired = input.strategies.filter(isRetiredStrategy);
  const losers = input.strategies.filter(isLoserStrategy);
  const material = `portfolio:${input.operations.asOf}:${input.strategies.length}`;
  const cardId = `alpha24-pf:${createHash('sha256').update(material).digest('hex').slice(0, 16)}`;
  return Object.freeze({
    schema: HELIOS_ALPHA24_RESEARCH_BOOK_SCHEMA,
    kind: 'PORTFOLIO_EVIDENCE_CARD',
    cardId,
    asOf: input.operations.asOf,
    activeStrategyCount: active.length,
    cumulativeHistoryStrategyCount: input.strategies.length,
    portfolioPnLMinor: input.operations.portfolioCumulativePnLMinor,
    portfolioBenchmarkRelativeBps: input.operations.portfolioBenchmarkRelativeBps,
    portfolioMaxDrawdownBps: input.operations.portfolioMaxDrawdownBps,
    loserStrategyIds: Object.freeze(losers.map((s) => s.strategyId)),
    retiredStrategyIds: Object.freeze(retired.map((s) => s.strategyId)),
  });
}

export function buildAllCampaignDigests(input: ForwardResearchBookInput): readonly CampaignEvidenceDigest[] {
  return Object.freeze(input.campaigns.map((c) => buildCampaignEvidenceDigest(c, input.strategies)));
}

export function buildAllStrategyCards(
  strategies: readonly ForwardStrategyResearchRecord[],
): readonly StrategyEvidenceCard[] {
  return Object.freeze(strategies.map(buildStrategyEvidenceCard));
}
