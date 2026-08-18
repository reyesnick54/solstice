/**
 * Acceptance reports and the ProductionProviderMatrix.
 * Reports never contain secret values.
 */

import { digestJson } from '../infra/hash.ts';
import { assertNoSecretInEvidenceReport } from './evidence.ts';
import { recordAcceptance, type AcceptanceInputs } from './evaluation.ts';
import type {
  ProductionProviderMatrix,
  ProductionProviderMatrixRow,
  ProviderAcceptanceReport,
  ProviderAcceptanceResultRecord,
} from './types.ts';

export function buildAcceptanceReport(
  inputs: readonly AcceptanceInputs[],
  generatedAtUtc: string,
): ProviderAcceptanceReport {
  const results = inputs.map((row) => recordAcceptance(row));
  const report: ProviderAcceptanceReport = Object.freeze({
    schemaVersion: 1,
    toolVersion: 'sunrey-provider-acceptance/1',
    generatedAtUtc,
    technicalAcceptance: results.some((row) => row.engineeringTested),
    securityEvidence: results.some((row) =>
      row.capabilities.some((cap) => cap.capability.includes('security') || row.externalEvidenceSatisfied),
    ),
    commercialEvidence: false,
    legalRegulatoryEvidence: false,
    humanAcceptance: results.some((row) => row.humanAccepted),
    productionEligible: results.some((row) => row.productionEligible),
    secretValuePresent: false,
    results: Object.freeze(results),
    reportDigest: '',
  });
  const digest = digestJson({ ...report, reportDigest: null });
  const sealed = Object.freeze({ ...report, reportDigest: digest });
  const secretCheck = assertNoSecretInEvidenceReport(sealed);
  if (!secretCheck.ok) {
    throw new TypeError(secretCheck.error.message);
  }
  return sealed;
}

export function buildProductionProviderMatrix(results: readonly ProviderAcceptanceResultRecord[]): ProductionProviderMatrix {
  const rows: readonly ProductionProviderMatrixRow[] = Object.freeze(
    results.map((row) =>
      Object.freeze({
        domain: row.domain,
        providerId: row.providerId,
        configured: row.configured,
        engineeringTested: row.engineeringTested,
        externalEvidence: row.externalEvidenceSatisfied,
        humanAccepted: row.humanAccepted,
        productionEligible: row.productionEligible,
        expirationWarnings: row.expirationWarnings,
        capabilities: Object.freeze(row.capabilities.map((cap) => cap.capability)),
      }),
    ),
  );
  const matrix: ProductionProviderMatrix = Object.freeze({
    schemaVersion: 1,
    rows,
    anyProductionEligible: rows.some((row) => row.productionEligible),
    secretValuePresent: false,
    matrixDigest: digestJson(rows),
  });
  const secretCheck = assertNoSecretInEvidenceReport(matrix);
  if (!secretCheck.ok) {
    throw new TypeError(secretCheck.error.message);
  }
  return matrix;
}

export function separateReadinessLanes(report: ProviderAcceptanceReport): {
  readonly technicalAcceptance: boolean;
  readonly securityEvidence: boolean;
  readonly commercialEvidence: boolean;
  readonly legalRegulatoryEvidence: boolean;
  readonly humanAcceptance: boolean;
} {
  return Object.freeze({
    technicalAcceptance: report.technicalAcceptance,
    securityEvidence: report.securityEvidence,
    commercialEvidence: report.commercialEvidence,
    legalRegulatoryEvidence: report.legalRegulatoryEvidence,
    humanAcceptance: report.humanAcceptance,
  });
}
