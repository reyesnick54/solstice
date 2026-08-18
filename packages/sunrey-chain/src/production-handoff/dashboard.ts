/**
 * Safe internal operational projection. No secrets.
 */

import { createHandoffReport } from './handoff.ts';
import { assertNoSecrets } from './hash.ts';
import type { OperatorDashboardProjection } from './types.ts';

export function createOperatorDashboard(root = process.cwd()): OperatorDashboardProjection {
  const report = createHandoffReport(root);
  const projection: OperatorDashboardProjection = Object.freeze({
    networkHealth: 'REHEARSAL_ISOLATED',
    validatorHealth: 'ENGINEERING_READY',
    release: report.package.mainnetRcId,
    policyVersions: report.baseline.policyVersions,
    providerState: report.readiness.externalProviderReadiness,
    backupState: 'RECURRING_VERIFICATION_DEFINED',
    economicReconciliation: 'REHEARSAL_INTEGRITY_INDICATORS',
    incidents: Object.freeze([]),
    capabilityStatus: report.package.activeCapabilities,
    secretsPresent: false as const,
  });
  assertNoSecrets(projection);
  return projection;
}
