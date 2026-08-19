import { createHash } from 'node:crypto';

import { scoreQuality } from '../quality.ts';
import type { FeedSchemaDefinition, QualityClass } from '../types.ts';
import { evaluateIndependence } from './independence.ts';
import { evaluateProvenanceConformance } from './provenance-conformance.ts';
import { buildConformanceReport } from './report.ts';
import { evaluateRevalidation } from './revalidation.ts';
import { evaluateFreshness, scoreReliability } from './reliability.ts';
import { evaluateSchemaConformance } from './schema-conformance.ts';
import { evaluateSecurityConformance } from './security-conformance.ts';
import { evaluateTaxonomyConformance } from './taxonomy.ts';
import {
  CERTIFICATION_MAPPING_VERSION,
  CERTIFICATION_POLICY_VERSION,
  CERTIFICATION_TEST_SUITE_VERSION,
  defaultCertificationPolicy,
  type CertificationPolicy,
  type CertificationStatus,
  type CertificationSubject,
  type EconomicDataSourceCertificationRecord,
  type ProviderConformanceReport,
} from './types.ts';
import { evaluateUnitConformance } from './unit-conformance.ts';

export type CertificationSuiteResult = {
  readonly record: EconomicDataSourceCertificationRecord;
  readonly report: ProviderConformanceReport;
};

export function runCertificationSuite(
  subject: CertificationSubject,
  feedSchema: FeedSchemaDefinition,
  policy: CertificationPolicy = defaultCertificationPolicy(),
  current?: EconomicDataSourceCertificationRecord,
): CertificationSuiteResult {
  const schema = evaluateSchemaConformance(subject, policy, feedSchema);
  const unit = evaluateUnitConformance(subject);
  const taxonomy = evaluateTaxonomyConformance(subject);
  const provenance = evaluateProvenanceConformance(subject, policy);
  const freshness = evaluateFreshness(subject, policy);
  const security = evaluateSecurityConformance(subject, policy);
  const independence = evaluateIndependence(subject);
  const reliability = scoreReliability(subject, policy);
  const revalidation = evaluateRevalidation(subject, policy, current);

  const technicalPass =
    schema.verdict === 'PASS' &&
    unit.verdict === 'PASS' &&
    taxonomy.verdict === 'PASS' &&
    provenance.verdict === 'PASS' &&
    freshness.verdict === 'PASS';
  const securityEngineeringPass = security.verdict === 'PASS';
  const independencePass = independence.verdict === 'PASS';

  const qualityScore = scoreQuality({
    sourceId: subject.sourceId,
    freshnessBps: reliability.freshnessBps,
    availabilityBps: reliability.availabilityBps,
    historicalConflictRateBps: reliability.conflictBps,
    schemaValidityBps: reliability.schemaValidityBps,
    sourceIndependenceBps: independencePass ? 10_000 : 0,
    attestationLevelBps: securityEngineeringPass ? 8_000 : 2_000,
    qualityClass: 'ENGINEERING',
  });

  const evidence = subject.evidence;
  const commercialConfirmed = evidence.commercialEvidenceState === 'CONFIRMED';
  const licenseConfirmed = evidence.dataLicenseState === 'CONFIRMED';
  const usageConfirmed = evidence.usageRightsState === 'CONFIRMED';
  const jurisdictionConfirmed = evidence.jurisdictionReviewState === 'CONFIRMED';
  const securityEvidenceConfirmed = evidence.securityReviewState === 'CONFIRMED';
  const qualityMeets = qualityScore.scoreBps >= policy.minimumQualityBps;

  const productionEvidenceComplete =
    technicalPass &&
    securityEngineeringPass &&
    independencePass &&
    qualityMeets &&
    (!policy.requireCommercialEvidenceForProduction || commercialConfirmed) &&
    (!policy.requireDataLicenseForProduction || licenseConfirmed) &&
    (!policy.requireUsageRightsForProduction || usageConfirmed) &&
    (!policy.requireJurisdictionForProduction || jurisdictionConfirmed) &&
    (!policy.requireSecurityEvidenceForProduction || securityEvidenceConfirmed);

  const qualityClass: QualityClass = productionEvidenceComplete
    ? 'TESTNET'
    : technicalPass && securityEngineeringPass
      ? 'TESTNET'
      : 'ENGINEERING';

  let status: CertificationStatus = 'ENGINEERING_SANDBOX';
  if (current && revalidation.nextStatus === 'SUSPENDED') {
    status = 'SUSPENDED';
  } else if (current && revalidation.nextStatus === 'REVALIDATION_REQUIRED') {
    status = 'REVALIDATION_REQUIRED';
  } else if (!technicalPass || !securityEngineeringPass) {
    status = 'CONFORMANCE_FAILED';
  } else if (!independencePass) {
    status = 'CONFORMANCE_FAILED';
  } else if (productionEvidenceComplete) {
    status = 'PRODUCTION_CANDIDATE';
  } else if (!securityEvidenceConfirmed && policy.requireSecurityEvidenceForProduction) {
    status = policy.allowTestnetWithoutCommercialEvidence && technicalPass && securityEngineeringPass
      ? 'TESTNET_ADMISSIBLE'
      : 'SECURITY_REVIEW_REQUIRED';
  } else if (!jurisdictionConfirmed && policy.requireJurisdictionForProduction && !policy.allowTestnetWithoutCommercialEvidence) {
    status = 'JURISDICTION_REVIEW_REQUIRED';
  } else if (
    (!commercialConfirmed || !licenseConfirmed || !usageConfirmed) &&
    policy.allowTestnetWithoutCommercialEvidence &&
    technicalPass &&
    securityEngineeringPass
  ) {
    status = 'TESTNET_ADMISSIBLE';
  } else if (!commercialConfirmed || !licenseConfirmed || !usageConfirmed) {
    status = 'COMMERCIAL_EVIDENCE_REQUIRED';
  } else {
    status = 'CONFORMANCE_PASSED';
  }

  if (qualityClass === 'TESTNET' && status === 'CONFORMANCE_PASSED' && policy.allowTestnetWithoutCommercialEvidence) {
    status = 'TESTNET_ADMISSIBLE';
  }

  const createdAtUnix = subject.createdAtUnix ?? subject.nowUnix;
  const expiresAtUnix = createdAtUnix + BigInt(policy.certificationTtlSeconds);
  const certificationId = `cert_${subject.providerId}_${subject.sourceId}_${subject.feedId}_${createdAtUnix.toString()}`;

  const record: EconomicDataSourceCertificationRecord = Object.freeze({
    schemaVersion: 1,
    certificationId,
    providerId: subject.providerId,
    sourceId: subject.sourceId,
    feedId: subject.feedId,
    sourceCategory: subject.sourceCategory,
    factType: subject.factType,
    productiveCategory: subject.productiveCategory,
    schemaId: subject.schemaId,
    schemaVersionRecord: subject.schemaVersion,
    unit: subject.unit,
    normalizationVersion: subject.normalizationVersion,
    mappingVersion: subject.mappingVersion || CERTIFICATION_MAPPING_VERSION,
    connectorRuntimeVersion: subject.connectorRuntimeVersion,
    testSuiteVersion: CERTIFICATION_TEST_SUITE_VERSION,
    certificationPolicyVersion: CERTIFICATION_POLICY_VERSION,
    technicalResults: Object.freeze({ schema, unit, taxonomy, provenance, freshness }),
    securityResults: security,
    schemaResults: schema,
    unitResults: unit,
    provenanceResults: provenance,
    freshnessResults: freshness,
    reliabilityResults: reliability,
    independenceResults: independence,
    commercialEvidenceState: evidence.commercialEvidenceState,
    dataLicenseState: evidence.dataLicenseState,
    usageRightsState: evidence.usageRightsState,
    jurisdictionReviewState: evidence.jurisdictionReviewState,
    securityReviewState: evidence.securityReviewState,
    qualityClass,
    qualityScoreBps: qualityScore.scoreBps,
    status,
    evidenceDigest: digestOf({
      certificationId,
      schema,
      unit,
      taxonomy,
      provenance,
      security,
      independence,
      evidence,
      status,
    }),
    createdAt: unixToIso(createdAtUnix),
    expiresAt: unixToIso(expiresAtUnix),
    createdAtUnix,
    expiresAtUnix,
    productionAuthorized: false,
    finalizesOracleFact: false,
    createsProductiveContribution: false,
    mintsMoonRey: false,
    commercialEvidenceFabricated: false,
    supersededBy: null,
    supersedes: current?.certificationId ?? null,
  });

  return Object.freeze({
    record,
    report: buildConformanceReport(record),
  });
}

function digestOf(value: unknown): string {
  return createHash('sha256').update(stable(value)).digest('hex');
}

function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stable).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(',')}}`;
}

function unixToIso(unix: bigint): string {
  return `${new Date(Number(unix) * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z')}`;
}
