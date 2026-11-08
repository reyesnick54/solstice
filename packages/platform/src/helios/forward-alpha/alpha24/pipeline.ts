import { HELIOS_ALPHA24_RESEARCH_BOOK_SCHEMA } from './taxonomy.ts';
import { buildDailyForwardResearchBook } from './daily-book.ts';
import { buildWeeklyForwardResearchBook } from './weekly-book.ts';
import {
  buildAllCampaignDigests,
  buildAllStrategyCards,
  buildPortfolioEvidenceCard,
} from './cards.ts';
import { buildResearchSurvivorshipAudit } from './survivorship.ts';
import type { Alpha24ResearchBookBundle, ForwardResearchBookInput } from './types.ts';

export function runAlpha24ForwardResearchBookPipeline(
  input: ForwardResearchBookInput,
): Alpha24ResearchBookBundle {
  const survivorshipAudit = buildResearchSurvivorshipAudit({
    computedAt: input.operations.asOf,
    campaigns: input.campaigns,
    strategies: input.strategies,
  });
  const dailyBook = buildDailyForwardResearchBook(input);
  const weeklyBook = buildWeeklyForwardResearchBook(input);
  const campaignDigests = buildAllCampaignDigests(input);
  const strategyCards = buildAllStrategyCards(input.strategies);
  const portfolioCard = buildPortfolioEvidenceCard(input);
  return Object.freeze({
    schema: HELIOS_ALPHA24_RESEARCH_BOOK_SCHEMA,
    survivorshipAudit,
    dailyBook,
    weeklyBook,
    campaignDigests,
    strategyCards,
    portfolioCard,
  });
}
