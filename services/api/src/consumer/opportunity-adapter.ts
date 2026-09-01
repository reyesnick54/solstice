/**
 * Consumer BFF adapter for Wave 6 opportunity intelligence.
 *
 * Vendor-independent. No credentials. No provider secrets exposed.
 */

import {
  buildAgentOpportunityEvidence,
  buildGrowOpportunityContext,
  buildPegOpportunityContext,
  buildWorldOpportunitySnapshot,
  createOpportunityService,
  defaultOpportunityNow,
  type OpportunityService,
} from '../../../../packages/external-data/src/wave6/index.ts';
import type { JobSearchQuery, UserMatchContext } from '../../../../packages/external-data/src/wave6/types.ts';
import { buildOpportunityCoverageReport } from '../../../../packages/external-data/src/wave6/opportunity-coverage.ts';

export type OpportunityIntelligenceBff = {
  readonly searchJobs: (query?: JobSearchQuery) => ReturnType<OpportunityService['searchJobs']>;
  readonly getJob: (opportunityId: string) => ReturnType<OpportunityService['getJob']>;
  readonly searchSkills: (query: string) => ReturnType<OpportunityService['searchSkills']>;
  readonly searchOccupations: (query: string) => ReturnType<OpportunityService['searchOccupations']>;
  readonly getPublicIntelligence: () => ReturnType<OpportunityService['getPublicIntelligence']>;
  readonly worldSnapshot: () => ReturnType<typeof buildWorldOpportunitySnapshot>;
  readonly growContext: (context: UserMatchContext) => ReturnType<typeof buildGrowOpportunityContext>;
  readonly agentEvidence: (context: UserMatchContext) => ReturnType<typeof buildAgentOpportunityEvidence>;
  readonly pegContext: (context: UserMatchContext) => ReturnType<typeof buildPegOpportunityContext>;
  readonly coverage: () => ReturnType<typeof buildOpportunityCoverageReport>;
};

export function createOpportunityIntelligenceBff(
  service: OpportunityService = createOpportunityService(),
  nowUtc = defaultOpportunityNow(),
): OpportunityIntelligenceBff {
  return Object.freeze({
    searchJobs: (query = {}) => service.searchJobs(query, nowUtc),
    getJob: (opportunityId) => service.getJob(opportunityId, nowUtc),
    searchSkills: (query) => service.searchSkills(query, nowUtc),
    searchOccupations: (query) => service.searchOccupations(query, nowUtc),
    getPublicIntelligence: () => service.getPublicIntelligence(nowUtc),
    worldSnapshot: () => buildWorldOpportunitySnapshot(service, nowUtc),
    growContext: (context) => buildGrowOpportunityContext(service, context, nowUtc),
    agentEvidence: (context) => buildAgentOpportunityEvidence(service, context, undefined, nowUtc),
    pegContext: (context) => buildPegOpportunityContext(service, context, nowUtc),
    coverage: () => buildOpportunityCoverageReport(),
  });
}
