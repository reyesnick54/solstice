import type { EvidenceCompleteness } from '../../../kernel/src/regulated/providers.ts';
import type { RegulatedActivationCapability } from '../../../kernel/src/regulated/activation-policy.ts';

export type ReadinessDimensionStatus = {
  readonly complete: boolean;
  readonly completeness: EvidenceCompleteness;
  readonly notes: string;
};

export type RegulatedMarketReadinessReport = {
  readonly technical: ReadinessDimensionStatus;
  readonly security: ReadinessDimensionStatus;
  readonly operations: ReadinessDimensionStatus;
  readonly provider: ReadinessDimensionStatus;
  readonly legal: ReadinessDimensionStatus;
  readonly license: ReadinessDimensionStatus;
  readonly humanAuthorization: ReadinessDimensionStatus;
  readonly productionActivated: false;
  readonly liveFlagsRemainDisabled: true;
};

export function evaluateRegulatedMarketReadiness(input: {
  readonly technicalComplete: boolean;
  readonly securityComplete: boolean;
  readonly operationsComplete: boolean;
  readonly providerComplete: boolean;
  readonly legalComplete: boolean;
  readonly licenseComplete: boolean;
  readonly humanAuthorized: boolean;
}): RegulatedMarketReadinessReport {
  return Object.freeze({
    technical: dim(input.technicalComplete, 'Engineering implementation recorded.'),
    security: dim(input.securityComplete, 'Security review remains an external evidence slot.'),
    operations: dim(input.operationsComplete, 'Operations staffing remains an external evidence slot.'),
    provider: dim(input.providerComplete, 'Provider contracts remain unverified.'),
    legal: dim(input.legalComplete, 'Legal review is not fabricated.'),
    license: dim(input.licenseComplete, 'License or registration evidence is missing unless supplied.'),
    humanAuthorization: dim(input.humanAuthorized, 'Human authorization is required and not implied.'),
    productionActivated: false,
    liveFlagsRemainDisabled: true,
  });
}

export function unlicensedActivationRemainsIncomplete(report: RegulatedMarketReadinessReport): boolean {
  return !report.license.complete || !report.legal.complete || !report.humanAuthorization.complete;
}

export function readinessForCapability(
  capability: RegulatedActivationCapability,
  report: RegulatedMarketReadinessReport,
): {
  readonly capability: RegulatedActivationCapability;
  readonly software_ready: boolean;
  readonly security_ready: boolean;
  readonly operational_ready: boolean;
  readonly legal_ready: boolean;
  readonly regulatory_ready: boolean;
  readonly license_or_partner_ready: boolean;
  readonly human_authorized: boolean;
  readonly genesis_enabled: false;
  readonly runtime_enabled: false;
} {
  void capability;
  return Object.freeze({
    capability,
    software_ready: report.technical.complete,
    security_ready: report.security.complete,
    operational_ready: report.operations.complete,
    legal_ready: report.legal.complete,
    regulatory_ready: report.legal.complete,
    license_or_partner_ready: report.license.complete,
    human_authorized: report.humanAuthorization.complete,
    genesis_enabled: false,
    runtime_enabled: false,
  });
}

function dim(complete: boolean, notes: string): ReadinessDimensionStatus {
  return Object.freeze({
    complete,
    completeness: complete ? 'ENGINEERING_RECORDED' : 'MISSING',
    notes,
  });
}
