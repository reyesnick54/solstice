/**
 * Pre-genesis qualification report helpers.
 */

import type { PregenesisQualificationReport, PregenesisQualificationState } from './types.ts';

export function summarizePregenesisReport(report: PregenesisQualificationReport): {
  readonly classification: PregenesisQualificationState;
  readonly networkId: string;
  readonly chainId: string;
  readonly mainnetRcId: string;
  readonly candidateV2Id: string;
  readonly findings: number;
  readonly openSecurityBlockers: number;
  readonly mainnetEnabled: false;
  readonly productionAuthorized: false;
} {
  return Object.freeze({
    classification: report.classification,
    networkId: report.network.networkId,
    chainId: report.network.chainId,
    mainnetRcId: report.bindings.mainnetRcId,
    candidateV2Id: report.bindings.candidateV2Id,
    findings: report.findings.length,
    openSecurityBlockers: report.securityReview.openBlockers.length,
    mainnetEnabled: false,
    productionAuthorized: false,
  });
}

export function verifyPregenesisReport(report: PregenesisQualificationReport): {
  readonly ok: boolean;
  readonly mainnetEnabled: false;
  readonly reasons: readonly string[];
} {
  const reasons: string[] = [];
  if (report.mainnetEnabled !== false || report.productionAuthorized !== false) {
    reasons.push('mainnet must remain disabled');
  }
  if (!report.consensus.converged || !report.consensus.noConflictingFinality) {
    reasons.push('consensus did not converge safely');
  }
  if (report.configurationVariances.some((row) => row.classification === 'UNEXPECTED_VARIANCE')) {
    reasons.push('unaccounted configuration variance');
  }
  if (!report.logSecurity.privateKeyAbsent) {
    reasons.push('secret exposure');
  }
  if (report.classification === 'PREGENESIS_QUALIFICATION_INCOMPLETE') {
    reasons.push('qualification incomplete');
  }
  return Object.freeze({
    ok: reasons.length === 0,
    mainnetEnabled: false,
    reasons: Object.freeze(reasons),
  });
}
