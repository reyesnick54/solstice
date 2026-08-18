/**
 * Export provider acceptance evidence into the Chunk 62 audit bundle.
 * Secrets are excluded.
 */

import { digestJson } from '../infra/hash.ts';
import { assertNoSecretInEvidenceReport } from './evidence.ts';
import type { ProductionProviderMatrix, ProviderAcceptanceReport } from './types.ts';

export type ProviderAcceptanceAuditExport = {
  readonly kind: 'provider-acceptance';
  readonly chunk: 'CHUNK-82';
  readonly report: ProviderAcceptanceReport;
  readonly matrix: ProductionProviderMatrix;
  readonly secretValuePresent: false;
  readonly claimsExternalContractsPresent: false;
  readonly claimsCommercialHsmCertified: false;
  readonly claimsLicensesPresent: false;
  readonly exportDigest: string;
};

export function exportProviderAcceptanceAudit(
  report: ProviderAcceptanceReport,
  matrix: ProductionProviderMatrix,
): ProviderAcceptanceAuditExport {
  const exported: ProviderAcceptanceAuditExport = Object.freeze({
    kind: 'provider-acceptance',
    chunk: 'CHUNK-82',
    report,
    matrix,
    secretValuePresent: false,
    claimsExternalContractsPresent: false,
    claimsCommercialHsmCertified: false,
    claimsLicensesPresent: false,
    exportDigest: digestJson({ report: report.reportDigest, matrix: matrix.matrixDigest }),
  });
  const check = assertNoSecretInEvidenceReport(exported);
  if (!check.ok) {
    throw new TypeError(check.error.message);
  }
  return exported;
}

export function providerAcceptanceAuditPayload(): unknown {
  return Object.freeze({
    kind: 'provider-acceptance-smoke',
    owner: 'packages/sunrey-chain/src/providers',
    command: 'sunrey-ops provider matrix',
    note: 'Engineering acceptance only. External contracts, licenses, commercial HSM certification, and human approvals remain unfilled.',
    secretValuePresent: false,
  });
}
