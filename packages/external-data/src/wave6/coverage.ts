/**
 * Wave 6 — coverage report for opportunity intelligence providers.
 */

import {
  OPPORTUNITY_CATALOG_PROVIDER_IDS,
  JOB_PROVIDER_IDS,
  SKILLS_PROVIDER_IDS,
  INTELLIGENCE_PROVIDER_IDS,
} from './catalog-entries.ts';

export type Wave6CoverageReport = {
  readonly totalProviders: number;
  readonly jobProviders: number;
  readonly skillsProviders: number;
  readonly intelligenceProviders: number;
  readonly productionEnabled: number;
  readonly blocked: number;
  readonly geographicCoverage: readonly string[];
  readonly jobCoverageNote: string;
  readonly limitations: string;
};

export function buildWave6CoverageReport(): Wave6CoverageReport {
  return Object.freeze({
    totalProviders: OPPORTUNITY_CATALOG_PROVIDER_IDS.length,
    jobProviders: JOB_PROVIDER_IDS.length,
    skillsProviders: SKILLS_PROVIDER_IDS.length,
    intelligenceProviders: INTELLIGENCE_PROVIDER_IDS.length,
    productionEnabled: 0,
    blocked: 0,
    geographicCoverage: Object.freeze(['GLOBAL', 'EU', 'US', 'GB']),
    jobCoverageNote:
      'Technology, AI/ML, GraphQL, and startup roles from community job boards. Not representative of entire labor market.',
    limitations:
      'Simulation-only fixture adapters. Limited provider coverage. Social content is not verified fact.',
  });
}
