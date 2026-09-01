/**
 * Wave 6 Prompt 23 — opportunity provider coverage report.
 */

import { OPPORTUNITY_ADAPTER_IDS } from './adapters/index.ts';
import { OPPORTUNITY_CATALOG_ENTRIES } from './opportunity-catalog-entries.ts';

const JOB_PROVIDER_IDS = Object.freeze([
  'arbeitnow',
  'ai-dev-jobs',
  'artificial-intelligence-jobs',
  'freehire',
  'graphql-jobs',
]);

const SKILLS_PROVIDER_IDS = Object.freeze(['techrole-index', 'open-skills']);

const INTELLIGENCE_PROVIDER_IDS = Object.freeze(['noozra', 'datacube-ai', 'hackernews', 'bluesky-public']);

export type OpportunityCoverageReport = {
  readonly totalProviders: number;
  readonly productionEnabled: 0;
  readonly jobProviders: number;
  readonly skillsProviders: number;
  readonly intelligenceProviders: number;
  readonly geographicCoverage: readonly string[];
  readonly jobCoverageNote: string;
  readonly limitations: string;
};

export function buildOpportunityCoverageReport(): OpportunityCoverageReport {
  const geographicCoverage = new Set<string>();
  for (const entry of OPPORTUNITY_CATALOG_ENTRIES) {
    const scope = (entry.data_characteristics as { geographic_scope?: string[] } | undefined)?.geographic_scope ?? [];
    for (const region of scope) {
      geographicCoverage.add(region);
    }
  }

  return Object.freeze({
    totalProviders: OPPORTUNITY_ADAPTER_IDS.length,
    productionEnabled: 0 as const,
    jobProviders: JOB_PROVIDER_IDS.length,
    skillsProviders: SKILLS_PROVIDER_IDS.length,
    intelligenceProviders: INTELLIGENCE_PROVIDER_IDS.length,
    geographicCoverage: Object.freeze([...geographicCoverage]),
    jobCoverageNote:
      'Simulation fixtures from 11 free public opportunity providers; partial labor-market coverage only.',
    limitations:
      'Community and derived sources only. Not verified hiring facts. No auto-apply. Production remains simulation.',
  });
}
