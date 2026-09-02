/**
 * Static audit manifest for Human Information Network data paths (Wave 6 Task 1).
 *
 * Documents what is implemented vs conceptual across HIN-related packages.
 * Does not activate new sensitive-data ingestion.
 */

export type HinDataPathStatus = 'IMPLEMENTED' | 'CONCEPTUAL' | 'API_EXPOSED' | 'STORED' | 'SIMULATION' | 'INGEST_BLOCKED';

export type HinDomainAuditEntry = {
  readonly domain: string;
  readonly hinNetworkCategory: string | null;
  readonly pdvCategory: string | null;
  readonly hecContributionClass: string | null;
  readonly status: readonly HinDataPathStatus[];
  readonly notes: string;
};

export const HIN_DOMAIN_AUDIT: readonly HinDomainAuditEntry[] = Object.freeze([
  {
    domain: 'health',
    hinNetworkCategory: 'HEALTH_WELLNESS',
    pdvCategory: 'health_wellness',
    hecContributionClass: null,
    status: ['IMPLEMENTED', 'SIMULATION', 'INGEST_BLOCKED'],
    notes: 'Default-deny in HIN; PDV ingest disabled; prohibited monetization uses defined',
  },
  {
    domain: 'wellness',
    hinNetworkCategory: 'HEALTH_WELLNESS',
    pdvCategory: 'health_wellness',
    hecContributionClass: null,
    status: ['IMPLEMENTED', 'SIMULATION', 'INGEST_BLOCKED'],
    notes: 'Grouped with health in HIN taxonomy',
  },
  {
    domain: 'consumption',
    hinNetworkCategory: 'COMMERCE_PREFERENCES',
    pdvCategory: 'consumption',
    hecContributionClass: 'ECONOMIC_PARTICIPATION',
    status: ['IMPLEMENTED', 'SIMULATION', 'STORED', 'API_EXPOSED'],
    notes: 'PDV sandbox ingestible; BFF /api/v1/data and /api/v1/hin routes',
  },
  {
    domain: 'entertainment',
    hinNetworkCategory: null,
    pdvCategory: 'digital_activity',
    hecContributionClass: null,
    status: ['CONCEPTUAL', 'INGEST_BLOCKED'],
    notes: 'No first-class HIN enum; indirect via digital_activity (ingest disabled)',
  },
  {
    domain: 'goals',
    hinNetworkCategory: null,
    pdvCategory: 'goals_preferences',
    hecContributionClass: null,
    status: ['IMPLEMENTED', 'SIMULATION', 'STORED'],
    notes: 'PDV sandbox ingestible; maps to PREFERENCE_DATA',
  },
  {
    domain: 'work',
    hinNetworkCategory: 'PROFESSIONAL_INFORMATION',
    pdvCategory: 'employment',
    hecContributionClass: 'WORK_PRODUCTIVE_ACTIVITY',
    status: ['IMPLEMENTED', 'SIMULATION', 'API_EXPOSED'],
    notes: 'HIN professional category; HEC work class; no live credential verification',
  },
  {
    domain: 'lifestyle',
    hinNetworkCategory: null,
    pdvCategory: null,
    hecContributionClass: null,
    status: ['CONCEPTUAL'],
    notes: 'No first-class taxonomy; indirect via goals/consumption/attention',
  },
  {
    domain: 'psychological',
    hinNetworkCategory: null,
    pdvCategory: null,
    hecContributionClass: null,
    status: ['CONCEPTUAL'],
    notes: 'BEHAVIORAL_TRAIT forbidden in HEC; no dedicated ingest path',
  },
  {
    domain: 'DNA',
    hinNetworkCategory: null,
    pdvCategory: 'genetic',
    hecContributionClass: null,
    status: ['IMPLEMENTED', 'INGEST_BLOCKED', 'SIMULATION'],
    notes: 'GENETIC_SENSITIVE; SALE_OF_RAW_GENETIC_DATA prohibited',
  },
  {
    domain: 'attention/time',
    hinNetworkCategory: null,
    pdvCategory: 'attention_time',
    hecContributionClass: 'ATTENTION_ENGAGEMENT',
    status: ['IMPLEMENTED', 'SIMULATION', 'STORED'],
    notes: 'HIN product category ATTENTION_ENGAGEMENT; consent required',
  },
  {
    domain: 'education',
    hinNetworkCategory: null,
    pdvCategory: 'education',
    hecContributionClass: 'EDUCATION_SKILL_ATTESTATION',
    status: ['IMPLEMENTED', 'SIMULATION', 'STORED'],
    notes: 'User-declared schema; not verified transcript',
  },
  {
    domain: 'location',
    hinNetworkCategory: 'MOBILITY_LOCATION',
    pdvCategory: 'mobility_location',
    hecContributionClass: null,
    status: ['IMPLEMENTED', 'SIMULATION', 'INGEST_BLOCKED'],
    notes: 'Default-deny in HIN; PDV AUTHORIZED_ONLY, ingest disabled',
  },
  {
    domain: 'communications',
    hinNetworkCategory: null,
    pdvCategory: 'communications_metadata',
    hecContributionClass: null,
    status: ['IMPLEMENTED', 'INGEST_BLOCKED', 'SIMULATION'],
    notes: 'PDV category defined; ingest disabled pending counsel',
  },
  {
    domain: 'social graph',
    hinNetworkCategory: null,
    pdvCategory: 'social_contribution',
    hecContributionClass: 'COMMUNITY_CONTRIBUTION',
    status: ['CONCEPTUAL', 'SIMULATION'],
    notes: 'Contribution metadata only; no graph engine in HIN packages',
  },
  {
    domain: 'economic activity',
    hinNetworkCategory: 'FINANCIAL_ACTIVITY_METADATA',
    pdvCategory: 'financial',
    hecContributionClass: 'ECONOMIC_PARTICIPATION',
    status: ['IMPLEMENTED', 'SIMULATION', 'API_EXPOSED', 'STORED'],
    notes: 'HIN marketplace, rights, earnings APIs; simulation only',
  },
]);

export function auditDomainsMatching(predicate: (entry: HinDomainAuditEntry) => boolean): readonly HinDomainAuditEntry[] {
  return HIN_DOMAIN_AUDIT.filter(predicate);
}

export function domainsWithIngestBlocked(): readonly HinDomainAuditEntry[] {
  return auditDomainsMatching((entry) => entry.status.includes('INGEST_BLOCKED'));
}
