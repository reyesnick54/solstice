/**
 * Wave 6 — explainable opportunity relevance scoring.
 */

import type { JobOpportunity, OpportunityRelevance, UserMatchContext } from './types.ts';
import { isRecommendableFreshness } from './freshness.ts';

export function explainJobRelevance(
  job: JobOpportunity,
  context: UserMatchContext,
): OpportunityRelevance {
  const explanations: OpportunityRelevance['explanations'][number][] = [];
  let score = 0;

  if (context.permittedSkills && context.permittedSkills.length > 0) {
    const userSkills = new Set(context.permittedSkills.map((s) => s.toLowerCase()));
    const overlap = job.skills.filter((s) => userSkills.has(s.toLowerCase()));
    const matched = overlap.length > 0;
    explanations.push(
      Object.freeze({
        factor: 'skills_overlap',
        matched,
        detail: matched
          ? `${overlap.length} skill(s) overlap: ${overlap.join(', ')}`
          : 'No skill overlap with permitted user skills',
      }),
    );
    if (matched) score += overlap.length * 10;
  }

  if (context.careerInterests && context.careerInterests.length > 0) {
    const titleLower = job.title.toLowerCase();
    const interestMatch = context.careerInterests.some((i) => titleLower.includes(i.toLowerCase()));
    explanations.push(
      Object.freeze({
        factor: 'career_interest',
        matched: interestMatch,
        detail: interestMatch
          ? 'Job title matches a career interest'
          : 'Job title does not match career interests',
      }),
    );
    if (interestMatch) score += 15;
  }

  if (context.locationPreference) {
    const locMatch =
      job.location?.toLowerCase().includes(context.locationPreference.toLowerCase()) ?? false;
    explanations.push(
      Object.freeze({
        factor: 'location',
        matched: locMatch || job.remoteStatus === 'REMOTE',
        detail: locMatch
          ? 'Location matches preference'
          : job.remoteStatus === 'REMOTE'
            ? 'Remote role matches location flexibility'
            : 'Location does not match preference',
      }),
    );
    if (locMatch) score += 10;
    if (job.remoteStatus === 'REMOTE') score += 5;
  }

  if (context.remotePreference && context.remotePreference !== 'UNKNOWN') {
    const remoteMatch = job.remoteStatus === context.remotePreference || job.remoteStatus === 'REMOTE';
    explanations.push(
      Object.freeze({
        factor: 'remote_preference',
        matched: remoteMatch,
        detail: remoteMatch
          ? `Remote status ${job.remoteStatus} aligns with preference`
          : `Remote status ${job.remoteStatus} does not match preference ${context.remotePreference}`,
      }),
    );
    if (remoteMatch) score += 10;
  }

  if (context.salaryTargetMinor && job.salary?.maximum) {
    const meetsTarget = job.salary.maximum >= context.salaryTargetMinor;
    explanations.push(
      Object.freeze({
        factor: 'salary',
        matched: meetsTarget,
        detail: meetsTarget
          ? 'Salary maximum meets or exceeds target'
          : 'Salary maximum below target',
      }),
    );
    if (meetsTarget) score += 20;
  }

  const fresh = isRecommendableFreshness(job.freshness);
  explanations.push(
    Object.freeze({
      factor: 'freshness',
      matched: fresh,
      detail: fresh ? `Listing is ${job.freshness}` : `Listing is ${job.freshness} — not recommended`,
    }),
  );
  if (fresh) score += 5;

  return Object.freeze({ score, explanations: Object.freeze(explanations) });
}
