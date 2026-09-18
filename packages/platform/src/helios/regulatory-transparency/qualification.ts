import {
  HELIOS_REGULATORY_TRANSPARENCY_BLOCKED,
  HELIOS_REGULATORY_TRANSPARENCY_QUALIFIED,
} from './taxonomy.ts';

export type RegulatoryTransparencyQualificationResult = {
  readonly marker:
    | typeof HELIOS_REGULATORY_TRANSPARENCY_QUALIFIED
    | typeof HELIOS_REGULATORY_TRANSPARENCY_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export type RegulatoryTransparencyQualificationChecks = {
  readonly leastPrivilegeExportHolds: boolean;
  readonly unauthorizedExportDenied: boolean;
  readonly scopedCustomerExport: boolean;
  readonly redactionApplied: boolean;
  readonly packageHashIntegrity: boolean;
  readonly auditTrailRecorded: boolean;
  readonly officialSourceRequired: boolean;
  readonly aiCannotActivatePolicy: boolean;
  readonly reviewRequiredStateWorks: boolean;
  readonly testsFailBlocksActivation: boolean;
  readonly authorizedActivationWorks: boolean;
  readonly scheduledEffectiveDateWorks: boolean;
  readonly rollbackWorks: boolean;
  readonly historicalPolicyPreserved: boolean;
  readonly pendingWorkflowSurvivesRestart: boolean;
  readonly duplicateActivationPrevented: boolean;
  readonly jurisdictionIsolation: boolean;
  readonly supervisoryQueryReconstructs: boolean;
};

export function evaluateRegulatoryTransparencyQualification(
  checks: RegulatoryTransparencyQualificationChecks,
): RegulatoryTransparencyQualificationResult {
  const blockers: string[] = [];
  const entries: [keyof RegulatoryTransparencyQualificationChecks, string][] = [
    ['leastPrivilegeExportHolds', 'least-privilege export failed'],
    ['unauthorizedExportDenied', 'unauthorized export not denied'],
    ['scopedCustomerExport', 'scoped customer export failed'],
    ['redactionApplied', 'redaction not applied'],
    ['packageHashIntegrity', 'package hash integrity failed'],
    ['auditTrailRecorded', 'audit trail not recorded'],
    ['officialSourceRequired', 'official source not required'],
    ['aiCannotActivatePolicy', 'AI can activate policy'],
    ['reviewRequiredStateWorks', 'review-required state failed'],
    ['testsFailBlocksActivation', 'failed tests did not block activation'],
    ['authorizedActivationWorks', 'authorized activation failed'],
    ['scheduledEffectiveDateWorks', 'scheduled effective date failed'],
    ['rollbackWorks', 'rollback failed'],
    ['historicalPolicyPreserved', 'historical policy not preserved'],
    ['pendingWorkflowSurvivesRestart', 'pending workflow lost on restart'],
    ['duplicateActivationPrevented', 'duplicate activation not prevented'],
    ['jurisdictionIsolation', 'jurisdiction isolation failed'],
    ['supervisoryQueryReconstructs', 'supervisory query reconstruction failed'],
  ];

  for (const [key, message] of entries) {
    if (!checks[key]) {
      blockers.push(message);
    }
  }

  if (blockers.length > 0) {
    return Object.freeze({
      marker: HELIOS_REGULATORY_TRANSPARENCY_BLOCKED,
      qualified: false,
      blockers: Object.freeze(blockers),
    });
  }

  return Object.freeze({
    marker: HELIOS_REGULATORY_TRANSPARENCY_QUALIFIED,
    qualified: true,
    blockers: Object.freeze([]),
  });
}
