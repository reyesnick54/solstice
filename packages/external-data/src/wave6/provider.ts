/**
 * Wave 6 — OpportunityProvider capability interface.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import type {
  JobOpportunity,
  JobSearchQuery,
  Occupation,
  OpportunityServiceResult,
  PublicIntelligenceObservation,
  Skill,
} from './types.ts';

export type OpportunityCapability =
  | 'job_search'
  | 'skills'
  | 'occupations'
  | 'salaries'
  | 'employment_market'
  | 'public_opportunity_data'
  | 'career_opportunities';

export type OpportunityProviderHealth = {
  readonly providerId: string;
  readonly enabled: boolean;
  readonly health: 'healthy' | 'degraded' | 'unhealthy';
  readonly lastError: string | null;
};

export interface OpportunityProvider {
  readonly providerId: string;
  readonly capabilities: readonly OpportunityCapability[];
  readonly geographicScope: readonly string[];
  readonly productionAuthorized: false;
  /** Whether this adapter can reach a documented production endpoint when data mode is live. */
  readonly liveCapable: boolean;

  searchJobs(
    query: JobSearchQuery,
    nowUtc: UtcInstant,
  ): Promise<OpportunityServiceResult<readonly JobOpportunity[]>>;

  getJob?(
    providerJobId: string,
    nowUtc: UtcInstant,
  ): Promise<OpportunityServiceResult<JobOpportunity>>;

  searchSkills?(
    query: string,
    nowUtc: UtcInstant,
  ): Promise<OpportunityServiceResult<readonly Skill[]>>;

  getSkill?(
    skillId: string,
    nowUtc: UtcInstant,
  ): Promise<OpportunityServiceResult<Skill>>;

  searchOccupations?(
    query: string,
    nowUtc: UtcInstant,
  ): Promise<OpportunityServiceResult<readonly Occupation[]>>;

  getPublicIntelligence?(
    nowUtc: UtcInstant,
  ): Promise<OpportunityServiceResult<readonly PublicIntelligenceObservation[]>>;
}
