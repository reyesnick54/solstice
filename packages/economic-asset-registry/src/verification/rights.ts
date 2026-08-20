import type { EconomicAssetDescriptor } from '../types.ts';
import type { AssetClassVerificationRule, EconomicAssetVerificationPolicy } from './types.ts';
import type { EconomicAssetVerificationCode } from './rejections.ts';

export function collectRightsCodes(
  descriptor: EconomicAssetDescriptor,
  policy: EconomicAssetVerificationPolicy,
  rule: AssetClassVerificationRule | undefined,
  remember: (code: EconomicAssetVerificationCode) => void,
): void {
  if (descriptor.roles.controllerIsLegalOwner || descriptor.roles.subjectIsLegalOwner || descriptor.roles.operatorIsLegalOwner) {
    remember('LEGAL_OWNERSHIP_EVIDENCE_REQUIRED');
  }
  if (descriptor.roles.legalOwnershipEstablished && descriptor.roles.legalOwnershipRightsRef == null) {
    remember('LEGAL_OWNERSHIP_EVIDENCE_REQUIRED');
  }
  if (descriptor.roles.legalOwnershipRightsRef != null && !descriptor.roles.legalOwnershipEstablished) {
    remember('LEGAL_OWNERSHIP_EVIDENCE_REQUIRED');
  }

  if (!rule) {
    return;
  }

  if (rule.requireController && !descriptor.controllerRef) {
    remember('RIGHTS_REFERENCE_REQUIRED');
  }
  if (rule.requireSubject && !descriptor.subjectRef) {
    remember('RIGHTS_REFERENCE_REQUIRED');
  }
  if (
    rule.requireControllerSubjectSeparation &&
    descriptor.controllerRef &&
    descriptor.subjectRef &&
    String(descriptor.controllerRef) === String(descriptor.subjectRef)
  ) {
    remember('CONTROLLER_SUBJECT_SEPARATION_REQUIRED');
  }
  if (rule.requireOperator && !descriptor.operatorRef) {
    remember('OPERATOR_REFERENCE_REQUIRED');
  }
  if (rule.requireRightsPolicy && !descriptor.rightsPolicyRef && !descriptor.rights.rightsPolicyRef) {
    remember('RIGHTS_REFERENCE_REQUIRED');
  }
  if (rule.rightsModel === 'HUMAN_INFORMATION') {
    if (rule.requireConsent && descriptor.consentRefs.length === 0 && descriptor.rights.consentRefs.length === 0) {
      remember('CONSENT_REFERENCE_REQUIRED');
    }
    if (rule.requirePurpose && descriptor.purposeRefs.length === 0 && descriptor.rights.purposeRefs.length === 0) {
      remember('PURPOSE_REFERENCE_REQUIRED');
    }
    if (rule.requireUsageRestriction && descriptor.usageRestrictionRefs.length === 0 && descriptor.rights.usageRestrictionRefs.length === 0) {
      remember('RIGHTS_REFERENCE_REQUIRED');
    }
  }
  if (rule.rightsModel === 'INDUSTRIAL_COMMERCIAL') {
    if (rule.requireLicense && descriptor.licenseRefs.length === 0 && descriptor.rights.licenseRefs.length === 0) {
      remember('LICENSE_REFERENCE_REQUIRED');
    }
  }

  if (descriptor.rights.rightsPolicyRef !== descriptor.rightsPolicyRef) {
    remember('RIGHTS_REFERENCE_REQUIRED');
  }

  void policy;
}

export function rolesDoNotInferOwnership(descriptor: EconomicAssetDescriptor): boolean {
  return (
    descriptor.roles.controllerIsLegalOwner === false &&
    descriptor.roles.subjectIsLegalOwner === false &&
    descriptor.roles.operatorIsLegalOwner === false &&
    (descriptor.roles.legalOwnershipEstablished === false || descriptor.roles.legalOwnershipRightsRef != null)
  );
}
