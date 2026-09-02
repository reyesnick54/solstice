export {
  WAVE7_DATA_EXPOSURE_AUDIT,
  highRiskSurfaces,
  surfacesNeedingHardening,
  type DataExposureAuditEntry,
  type ExposureRisk,
  type ExposureSurface,
} from './audit.ts';
export {
  ageThresholdSatisfiedAssertion,
  assertNoRawPayload,
  assertionIdFor,
  computationCompletedAssertion,
  createPrivacyAssertion,
  credentialValidAssertion,
  type AssertionInput,
} from './claims.ts';
export {
  VERIFICATION_FIELD_POLICIES,
  denyOverbroadFieldRequest,
  minimizeRecord,
  resolveAllowedFields,
  type VerificationPurpose,
} from './minimization-policy.ts';
export {
  SELECTIVE_DISCLOSURE_CAPABILITY,
  createUnavailableSelectiveDisclosureProvider,
  validateSelectiveDisclosureResponse,
  type SelectiveDisclosureClaim,
  type SelectiveDisclosureProvider,
  type SelectiveDisclosureRequest,
  type SelectiveDisclosureResponse,
} from './selective-disclosure.ts';
export { ClaimDisclosureService, type ClaimDisclosureRequest, type ClaimDisclosureServiceOptions } from './service.ts';
export {
  ASSERTION_TYPES,
  type AssertionFailure,
  type AssertionFailureCode,
  type AssertionType,
  type CapabilityClassification,
  type EvidenceReference,
  type PrivacyAssertion,
} from './types.ts';
