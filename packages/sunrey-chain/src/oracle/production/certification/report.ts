import type {
  CertificationStatus,
  ControlResult,
  EconomicDataSourceCertificationRecord,
  ProviderConformanceReport,
} from './types.ts';

export function buildConformanceReport(record: EconomicDataSourceCertificationRecord): ProviderConformanceReport {
  const controls: ControlResult[] = [
    control('technical.schema', record.schemaResults.verdict, record.schemaResults.details.join('; ')),
    control('technical.unit', record.unitResults.verdict, record.unitResults.details.join('; ')),
    control('technical.taxonomy', record.technicalResults.taxonomy.verdict, record.technicalResults.taxonomy.details.join('; ')),
    control('technical.provenance', record.provenanceResults.verdict, record.provenanceResults.details.join('; ')),
    control('technical.freshness', record.freshnessResults.verdict, record.freshnessResults.details.join('; ')),
    control('security.engineering', record.securityResults.verdict, record.securityResults.details.join('; ')),
    control('independence.controller', record.independenceResults.verdict, record.independenceResults.details.join('; ')),
    evidenceControl('commercial.agreement', record.commercialEvidenceState),
    evidenceControl('commercial.data-license', record.dataLicenseState),
    evidenceControl('commercial.usage-rights', record.usageRightsState),
    evidenceControl('jurisdiction.review', record.jurisdictionReviewState),
    evidenceControl('security.review-evidence', record.securityReviewState),
  ];

  const missingEvidence: string[] = [];
  if (record.commercialEvidenceState !== 'CONFIRMED') {
    missingEvidence.push('commercial agreement');
  }
  if (record.dataLicenseState !== 'CONFIRMED') {
    missingEvidence.push('data license');
  }
  if (record.usageRightsState !== 'CONFIRMED') {
    missingEvidence.push('usage rights');
  }
  if (record.jurisdictionReviewState !== 'CONFIRMED') {
    missingEvidence.push('jurisdiction review');
  }
  if (record.securityReviewState !== 'CONFIRMED') {
    missingEvidence.push('security review evidence');
  }

  const blockingFailures = controls
    .filter((row) => row.verdict === 'FAIL' && !row.controlId.startsWith('commercial.') && row.controlId !== 'jurisdiction.review' && row.controlId !== 'security.review-evidence')
    .map((row) => `${row.controlId}: ${row.detail}`);

  const warnings = [
    ...missingEvidence.map((item) => `${item} is not CONFIRMED; a fixture string is not evidence`),
    'quality metrics are sandbox/test observations only',
    'no independent security audit is claimed',
  ];

  const testnetAdmissible = record.status === 'TESTNET_ADMISSIBLE' || record.status === 'PRODUCTION_CANDIDATE';
  const productionCandidate = record.status === 'PRODUCTION_CANDIDATE';

  return Object.freeze({
    schemaVersion: 1,
    certificationId: record.certificationId,
    providerId: record.providerId,
    sourceId: record.sourceId,
    feedId: record.feedId,
    status: record.status,
    controls: Object.freeze(controls),
    missingEvidence: Object.freeze(missingEvidence),
    warnings: Object.freeze(warnings),
    blockingFailures: Object.freeze(blockingFailures),
    testnetAdmissible,
    productionCandidate,
    productionAuthorized: false,
    commercialEvidenceFabricated: false,
    certificationFinalizesOracle: false,
    certificationMintsMoonRey: false,
    independentAuditClaimed: false,
    humanReadable: renderHumanReadable(record.status, controls, missingEvidence, blockingFailures),
  });
}

function control(controlId: string, verdict: ControlResult['verdict'], detail: string): ControlResult {
  return Object.freeze({ controlId, verdict, detail });
}

function evidenceControl(controlId: string, state: string): ControlResult {
  if (state === 'CONFIRMED') {
    return control(controlId, 'REVIEW_REQUIRED', `${state} must be supplied by a human record; certification does not confirm it`);
  }
  if (state === 'REFERENCE_RECORDED') {
    return control(controlId, 'REVIEW_REQUIRED', 'reference recorded; human confirmation is still required');
  }
  return control(controlId, 'REVIEW_REQUIRED', 'NOT_PROVIDED');
}

function renderHumanReadable(
  status: CertificationStatus,
  controls: readonly ControlResult[],
  missingEvidence: readonly string[],
  blockingFailures: readonly string[],
): string {
  const lines = [
    `Provider certification status: ${status}`,
    ...controls.map((row) => `${row.verdict.padEnd(16)} ${row.controlId} — ${row.detail || 'ok'}`),
    missingEvidence.length === 0 ? 'No missing evidence labels.' : `Missing evidence: ${missingEvidence.join(', ')}`,
    blockingFailures.length === 0 ? 'No blocking technical failures.' : `Blocking: ${blockingFailures.join(' | ')}`,
    'Certification does not finalize an oracle fact, create a productive contribution, or mint MoonRey.',
  ];
  return lines.join('\n');
}
