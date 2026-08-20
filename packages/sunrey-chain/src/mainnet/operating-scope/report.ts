/**
 * Human-readable operating-scope report. Never claims production is
 * active or that software capability is a license.
 */

import { toOperatingScopeFact } from './evaluation.ts';
import type { OperatingScopeEvaluation, OperatingScopeReport } from './types.ts';
import { OPERATING_SCOPE_TOOL_VERSION } from './types.ts';

export function buildOperatingScopeReport(
  evaluations: readonly OperatingScopeEvaluation[],
): OperatingScopeReport {
  return Object.freeze({
    toolVersion: OPERATING_SCOPE_TOOL_VERSION,
    evaluations: Object.freeze([...evaluations]),
    facts: Object.freeze(evaluations.map(toOperatingScopeFact)),
    unknownJurisdictionEnabled: false,
    engineeringTestEqualsLegalApproval: false,
    sunreyScopeEqualsMoonreyScope: false,
    exchangeScopeEqualsCustodyScope: false,
    aiCanApproveJurisdiction: false,
    productionActive: false,
    confirmedByCounsel: false,
  });
}

export function formatOperatingScopeReport(report: OperatingScopeReport): string {
  const lines: string[] = [
    `sunrey-operating-scope ${report.toolVersion}`,
    `UNKNOWN_JURISDICTION_ENABLED=${String(report.unknownJurisdictionEnabled)}`,
    `ENGINEERING_TEST_EQUALS_LEGAL_APPROVAL=${String(report.engineeringTestEqualsLegalApproval)}`,
    `SUNREY_SCOPE_EQUALS_MOONREY_SCOPE=${String(report.sunreyScopeEqualsMoonreyScope)}`,
    `EXCHANGE_SCOPE_EQUALS_CUSTODY_SCOPE=${String(report.exchangeScopeEqualsCustodyScope)}`,
    `AI_CAN_APPROVE_JURISDICTION=${String(report.aiCanApproveJurisdiction)}`,
    `PRODUCTION_ACTIVE=${String(report.productionActive)}`,
    '',
  ];
  for (const row of report.evaluations) {
    lines.push(
      `${row.key.activationDomain} ${row.key.jurisdiction} ${row.key.legalEntityRef} status=${row.status} eligible=${String(row.eligible)} reasons=${row.reasonCodes.join(',')}`,
    );
  }
  return `${lines.join('\n')}\n`;
}
