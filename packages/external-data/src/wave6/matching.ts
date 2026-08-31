/**
 * Wave 6 — user matching with permission boundaries.
 *
 * Only uses explicitly permitted user attributes. Never uses sensitive HIN/Vault data.
 */

import type { JobOpportunity, OpportunityRelevance, UserMatchContext } from './types.ts';
import { explainJobRelevance } from './relevance.ts';
import { isRecommendableFreshness } from './freshness.ts';

/** Sensitive attributes that must never be used for job matching. */
export const FORBIDDEN_MATCH_ATTRIBUTES = Object.freeze([
  'medical_history',
  'dna',
  'psychological_information',
  'banking_history',
  'transaction_history',
  'vault_contents',
  'private_communications',
  'health_records',
] as const);

export type PermittedMatchResult = {
  readonly jobs: readonly { readonly job: JobOpportunity; readonly relevance: OpportunityRelevance }[];
  readonly attributesUsed: readonly string[];
  readonly sensitiveDataSent: false;
};

export function matchJobsToUser(
  jobs: readonly JobOpportunity[],
  context: UserMatchContext,
): PermittedMatchResult {
  const attributesUsed: string[] = [];
  if (context.permittedSkills?.length) attributesUsed.push('permittedSkills');
  if (context.careerInterests?.length) attributesUsed.push('careerInterests');
  if (context.locationPreference) attributesUsed.push('locationPreference');
  if (context.remotePreference) attributesUsed.push('remotePreference');
  if (context.salaryTargetMinor) attributesUsed.push('salaryTarget');

  const scored = jobs
    .filter((j) => isRecommendableFreshness(j.freshness))
    .map((job) => Object.freeze({ job, relevance: explainJobRelevance(job, context) }))
    .sort((a, b) => b.relevance.score - a.relevance.score);

  return Object.freeze({
    jobs: Object.freeze(scored),
    attributesUsed: Object.freeze(attributesUsed),
    sensitiveDataSent: false,
  });
}

export function assertNoSensitiveDataInQuery(query: Record<string, unknown>): void {
  for (const forbidden of FORBIDDEN_MATCH_ATTRIBUTES) {
    if (forbidden in query) {
      throw new Error(`Sensitive attribute ${forbidden} must not be sent to opportunity providers`);
    }
  }
}
