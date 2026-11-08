import { createHash } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';

import { HELIOS_ALPHA24_RESEARCH_BOOK_SCHEMA } from './taxonomy.ts';
import { isLoserStrategy, isRetiredStrategy, isSurvivingStrategy } from './stats.ts';
import type { ForwardCampaignRecord, ForwardStrategyResearchRecord, ResearchSurvivorshipAudit } from './types.ts';

export type BuildResearchSurvivorshipAuditInput = {
  readonly computedAt: UtcInstant;
  readonly campaigns: readonly ForwardCampaignRecord[];
  readonly strategies: readonly ForwardStrategyResearchRecord[];
};

export function buildResearchSurvivorshipAudit(input: BuildResearchSurvivorshipAuditInput): ResearchSurvivorshipAudit {
  const campaignsStarted = Object.freeze(input.campaigns.map((c) => c.campaignId));
  const campaignsTerminated = Object.freeze(
    input.campaigns.filter((c) => c.state === 'TERMINATED' || c.state === 'COMPLETE' || c.terminatedAt !== null)
      .map((c) => c.campaignId),
  );
  const strategiesTested = Object.freeze(input.strategies.map((s) => s.strategyId));
  const strategiesSurviving = Object.freeze(
    input.strategies.filter(isSurvivingStrategy).map((s) => s.strategyId),
  );
  const strategiesRetired = Object.freeze(
    input.strategies.filter(isRetiredStrategy).map((s) => s.strategyId),
  );
  const losersInUniverse = Object.freeze(input.strategies.filter(isLoserStrategy).map((s) => s.strategyId));
  const material = `${campaignsStarted.join(',')}:${strategiesTested.join(',')}:${input.computedAt}`;
  const auditId = `alpha24-surv:${createHash('sha256').update(material).digest('hex').slice(0, 16)}`;
  return Object.freeze({
    schema: HELIOS_ALPHA24_RESEARCH_BOOK_SCHEMA,
    kind: 'RESEARCH_SURVIVORSHIP_AUDIT',
    auditId,
    computedAt: input.computedAt,
    campaignsStarted,
    campaignsTerminated,
    strategiesTested,
    strategiesSurviving,
    strategiesRetired,
    losersInUniverse,
  });
}
