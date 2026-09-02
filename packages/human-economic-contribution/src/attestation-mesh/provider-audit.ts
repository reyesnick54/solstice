/**
 * Audit of configured human-economy provider catalogs and adapters.
 *
 * Inventory reflects the current repository — not invented providers.
 * Providers awaiting master-list inclusion are tracked separately.
 */

export type HumanProviderDomain =
  | 'research'
  | 'education'
  | 'skills'
  | 'employment'
  | 'government'
  | 'health_research'
  | 'credentials'
  | 'publications'
  | 'computation'
  | 'hin_reference'
  | 'other';

export type HumanProviderIntegrationState =
  | 'implemented_fixture'
  | 'catalog_only'
  | 'awaiting_master_list'
  | 'blocked';

export type HumanProviderAuditEntry = {
  readonly providerId: string;
  readonly name: string;
  readonly domain: HumanProviderDomain;
  readonly integrationState: HumanProviderIntegrationState;
  readonly catalogPath: string | null;
  readonly adapterPath: string | null;
  readonly attestationRole: string;
  readonly notes: string | null;
};

export const HUMAN_PROVIDER_CATALOG_AUDIT: readonly HumanProviderAuditEntry[] = Object.freeze([
  // Health / research reference — Wave 6 Prompt 22
  entry('clinicaltrials-gov', 'ClinicalTrials.gov', 'health_research', 'implemented_fixture', 'config/providers/wave6-health-hin-catalog-entries.yaml', 'packages/sunrey-chain/src/health-reference/adapters/fixture-adapters.ts', 'RESEARCH_REGISTRY', 'NLM clinical trial registry fixture'),
  entry('openfda', 'openFDA', 'health_research', 'implemented_fixture', 'config/providers/wave6-health-hin-catalog-entries.yaml', 'packages/sunrey-chain/src/health-reference/adapters/fixture-adapters.ts', 'GOVERNMENT', 'U.S. FDA reference data'),
  entry('nppes', 'NPPES', 'health_research', 'implemented_fixture', 'config/providers/wave6-health-hin-catalog-entries.yaml', 'packages/sunrey-chain/src/health-reference/adapters/fixture-adapters.ts', 'GOVERNMENT', 'Provider registry reference'),
  entry('medlineplus-genetics', 'MedlinePlus Genetics', 'health_research', 'implemented_fixture', 'config/providers/wave6-health-hin-catalog-entries.yaml', 'packages/sunrey-chain/src/health-reference/adapters/fixture-adapters.ts', 'RESEARCH_REFERENCE', 'NLM genetics reference'),
  entry('usda-fooddata-central', 'USDA FoodData Central', 'health_research', 'catalog_only', 'config/providers/wave6-health-hin-catalog-entries.yaml', 'packages/sunrey-chain/src/health-reference/adapters/fixture-adapters.ts', 'GOVERNMENT', 'Nutrition reference'),
  entry('open-food-facts', 'Open Food Facts', 'hin_reference', 'implemented_fixture', 'config/providers/wave6-health-hin-catalog-entries.yaml', 'packages/sunrey-chain/src/health-reference/adapters/fixture-adapters.ts', 'AUTHORIZED_DATA_PROVIDER', 'Community food reference'),
  entry('hdx-health', 'HDX Health', 'health_research', 'implemented_fixture', 'config/providers/wave6-health-hin-catalog-entries.yaml', 'packages/sunrey-chain/src/health-reference/adapters/fixture-adapters.ts', 'AUTHORIZED_DATA_PROVIDER', 'Humanitarian health reference'),
  entry('nhs-scotland-open-data', 'NHS Scotland Open Data', 'health_research', 'implemented_fixture', 'config/providers/wave6-health-hin-catalog-entries.yaml', 'packages/sunrey-chain/src/health-reference/adapters/fixture-adapters.ts', 'GOVERNMENT', 'Public health reference'),
  entry('longevity-world-cup', 'Longevity World Cup', 'health_research', 'implemented_fixture', 'config/providers/wave6-health-hin-catalog-entries.yaml', 'packages/sunrey-chain/src/health-reference/adapters/fixture-adapters.ts', 'OTHER_GOVERNANCE_APPROVED', 'Reference competition data'),

  // Employment / skills — Wave 6 Prompt 23
  entry('arbeitnow', 'Arbeitnow', 'employment', 'implemented_fixture', 'config/providers/wave6-opportunity-skills-catalog-entries.yaml', 'packages/external-data/src/wave6/adapters/index.ts', 'EMPLOYER', 'Job board listings'),
  entry('remoteok', 'Remote OK', 'employment', 'implemented_fixture', 'config/providers/wave6-opportunity-skills-catalog-entries.yaml', 'packages/external-data/src/wave6/adapters/index.ts', 'EMPLOYER', 'Remote job listings'),
  entry('remotive', 'Remotive', 'employment', 'implemented_fixture', 'config/providers/wave6-opportunity-skills-catalog-entries.yaml', 'packages/external-data/src/wave6/adapters/index.ts', 'EMPLOYER', 'Remote job listings'),
  entry('jobicy', 'Jobicy', 'employment', 'implemented_fixture', 'config/providers/wave6-opportunity-skills-catalog-entries.yaml', 'packages/external-data/src/wave6/adapters/index.ts', 'EMPLOYER', 'Remote job listings'),
  entry('open-skills', 'Open Skills', 'skills', 'implemented_fixture', 'config/providers/wave6-opportunity-skills-catalog-entries.yaml', 'packages/external-data/src/wave6/adapters/index.ts', 'CREDENTIAL_ISSUER', 'Skill taxonomy reference'),
  entry('techrole-index', 'TechRole Index', 'skills', 'implemented_fixture', 'config/providers/wave6-opportunity-skills-catalog-entries.yaml', 'packages/external-data/src/wave6/adapters/index.ts', 'CREDENTIAL_ISSUER', 'Occupation/skill reference'),
  entry('hackernews', 'Hacker News', 'employment', 'implemented_fixture', 'config/providers/wave6-opportunity-skills-catalog-entries.yaml', 'packages/external-data/src/wave6/adapters/index.ts', 'PEER_ATTESTATION', 'Community opportunity signal'),
  entry('graphql-jobs', 'GraphQL Jobs', 'employment', 'implemented_fixture', 'config/providers/wave6-opportunity-skills-catalog-entries.yaml', 'packages/external-data/src/wave6/adapters/index.ts', 'EMPLOYER', 'Specialized job listings'),
  entry('ai-dev-jobs', 'AI Dev Jobs', 'employment', 'implemented_fixture', 'config/providers/wave6-opportunity-skills-catalog-entries.yaml', 'packages/external-data/src/wave6/adapters/index.ts', 'EMPLOYER', 'AI role listings'),
  entry('bluesky-public', 'Bluesky Public', 'other', 'implemented_fixture', 'config/providers/wave6-opportunity-skills-catalog-entries.yaml', 'packages/external-data/src/wave6/adapters/index.ts', 'PEER_ATTESTATION', 'Public social signal'),

  // Research / government / publications — Wave 6 Prompt 24
  entry('sec-edgar', 'SEC EDGAR', 'publications', 'implemented_fixture', 'packages/external-data/src/wave6/catalog-entries.ts', 'packages/external-data/src/wave6/adapters.ts', 'GOVERNMENT', 'Corporate filings for research intelligence'),
  entry('federal-register', 'Federal Register', 'government', 'implemented_fixture', 'packages/external-data/src/wave6/catalog-entries.ts', 'packages/external-data/src/wave6/adapters.ts', 'GOVERNMENT', 'Regulatory publications'),
  entry('indian-mandi-prices', 'Indian Mandi Prices', 'government', 'implemented_fixture', 'packages/external-data/src/wave6/catalog-entries.ts', 'packages/external-data/src/wave6/adapters.ts', 'GOVERNMENT', 'Agricultural market reference'),

  // Awaiting master list — documented, not invented
  entry('openalex', 'OpenAlex', 'publications', 'awaiting_master_list', null, null, 'RESEARCH_PUBLISHER', 'Publication graph — awaiting Wave 0 master list'),
  entry('arxiv', 'arXiv', 'publications', 'awaiting_master_list', null, null, 'RESEARCH_PUBLISHER', 'Preprint repository — awaiting master list'),
  entry('pubmed-ncbi', 'PubMed/NCBI', 'publications', 'awaiting_master_list', null, null, 'RESEARCH_PUBLISHER', 'Referenced in economic-proof tests; not yet in Wave 6 catalog'),
  entry('europe-pmc', 'Europe PMC', 'publications', 'awaiting_master_list', null, null, 'RESEARCH_PUBLISHER', 'Publication database — awaiting master list'),
  entry('onet', 'O*NET', 'skills', 'awaiting_master_list', null, null, 'GOVERNMENT', 'Occupation taxonomy — awaiting master list'),
  entry('usajobs', 'USAJOBS', 'employment', 'awaiting_master_list', null, null, 'GOVERNMENT', 'Federal employment — awaiting master list'),
  entry('college-scorecard', 'College Scorecard', 'education', 'awaiting_master_list', null, null, 'GOVERNMENT', 'Education outcomes — awaiting master list'),
  entry('ipeds', 'IPEDS', 'education', 'awaiting_master_list', null, null, 'GOVERNMENT', 'Institutional education data — awaiting master list'),
  entry('careeronestop', 'CareerOneStop', 'employment', 'awaiting_master_list', null, null, 'GOVERNMENT', 'Career guidance — awaiting master list'),
  entry('osf', 'OSF', 'research', 'awaiting_master_list', null, null, 'RESEARCH_REGISTRY', 'Open research registry — awaiting master list'),
  entry('share', 'SHARE', 'research', 'awaiting_master_list', null, null, 'RESEARCH_REGISTRY', 'Research activity registry — awaiting master list'),
  entry('patentsview', 'PatentsView', 'publications', 'awaiting_master_list', null, null, 'GOVERNMENT', 'Patent metadata — awaiting master list'),

  // HIN / computation paths
  entry('human-information-network', 'Human Information Network', 'hin_reference', 'implemented_fixture', 'packages/information-market/src/network/contribution/contract.ts', 'packages/information-market/src/network/contribution/registry.ts', 'AUTHORIZED_DATA_PROVIDER', 'Chunk 107 HIN contribution evidence'),
  entry('approved-computation-receipt', 'Approved Computation Receipt', 'computation', 'implemented_fixture', 'packages/human-economic-contribution/src/verification/information-right.ts', null, 'SIGNED_COMPUTATION_RECEIPT', 'Signed computation/job receipt for information-right contributions'),
]);

function entry(
  providerId: string,
  name: string,
  domain: HumanProviderDomain,
  integrationState: HumanProviderIntegrationState,
  catalogPath: string | null,
  adapterPath: string | null,
  attestationRole: string,
  notes: string | null,
): HumanProviderAuditEntry {
  return Object.freeze({
    providerId,
    name,
    domain,
    integrationState,
    catalogPath,
    adapterPath,
    attestationRole,
    notes,
  });
}

export function providersByDomain(domain: HumanProviderDomain): readonly HumanProviderAuditEntry[] {
  return HUMAN_PROVIDER_CATALOG_AUDIT.filter((row) => row.domain === domain);
}

export function implementedHumanProviders(): readonly HumanProviderAuditEntry[] {
  return HUMAN_PROVIDER_CATALOG_AUDIT.filter((row) => row.integrationState === 'implemented_fixture');
}

export function awaitingMasterListProviders(): readonly HumanProviderAuditEntry[] {
  return HUMAN_PROVIDER_CATALOG_AUDIT.filter((row) => row.integrationState === 'awaiting_master_list');
}

export function auditSummary(): {
  readonly total: number;
  readonly implemented: number;
  readonly awaitingMasterList: number;
  readonly domains: readonly HumanProviderDomain[];
} {
  return Object.freeze({
    total: HUMAN_PROVIDER_CATALOG_AUDIT.length,
    implemented: implementedHumanProviders().length,
    awaitingMasterList: awaitingMasterListProviders().length,
    domains: Object.freeze([...new Set(HUMAN_PROVIDER_CATALOG_AUDIT.map((row) => row.domain))].sort()),
  });
}
