export {
  ACTOR_CONTEXT_ISSUER,
  ACTOR_CONTEXT_TTL_MS,
  ActorContextIssuer,
  isVerifiedActorContext,
  type ActorContext,
  type ActorContextFailure,
  type ActorContextIntegrity,
  type VerifiedActorContext,
} from './actor-context.ts';
export {
  AUTHENTICATION_ASSURANCES,
  assuranceAtLeast,
  assuranceFromFactors,
  type AuthenticationAssurance,
} from './assurance.ts';
export {
  AUTHENTICATION_FACTORS,
  DEVICE_TRUST_STATES,
  SESSION_REVOCATION_STATES,
  SESSION_RISK_STATES,
  WEBAUTHN_CHALLENGE_PURPOSES,
  WEBAUTHN_TRANSPORTS,
  type AuthenticationFactor,
  type DeviceRiskProvider,
  type DeviceRiskSignal,
  type DeviceTrustState,
  type IdentitySession,
  type RegisteredDevice,
  type SessionRevocationState,
  type SessionRiskState,
  type WebAuthnAuthenticationRequest,
  type WebAuthnAuthenticationResponse,
  type WebAuthnChallenge,
  type WebAuthnChallengePurpose,
  type WebAuthnCredential,
  type WebAuthnRegistrationRequest,
  type WebAuthnRegistrationResponse,
  type WebAuthnRelyingParty,
  type WebAuthnTransport,
} from './auth.ts';
export {
  ACTION_TYPE_FOR_CAPABILITY,
  ACTION_TYPES_FOR_CAPABILITY,
  IDENTITY_CAPABILITIES,
  actionTypesFromCapabilities,
  deriveCapabilities,
  isGrantActive,
  requiredAssuranceFor,
  type CapabilityDerivationFacts,
  type CapabilityGrant,
  type IdentityCapability,
} from './capability.ts';
export {
  STAFF_ONLY_CAPABILITIES,
  STAFF_ROLES,
  STAFF_ROLE_CAPABILITIES,
  isStaffOnlyCapability,
  isStaffRole,
  staffRolesFromCapabilities,
  type StaffRole,
} from './admin-roles.ts';
export {
  PRINCIPAL_KINDS,
  assertCapability,
  deriveAuthorizationContext,
  type AuthorizationAgentBinding,
  type AuthorizationContext,
  type AuthorizationDevice,
  type AuthorizationRequestMetadata,
  type AuthorizationUser,
  type PrincipalKind,
} from './authorization-context.ts';
export {
  CLIENT_DENIAL_CODES,
  CLIENT_SAFE_DENIAL_MESSAGES,
  PRIVILEGED_CLIENT_CLAIM_KEYS,
  clientDenial,
  privilegedClientClaims,
  type ClientDenial,
  type ClientDenialCode,
} from './client-denial.ts';
export {
  FRONTEND_AUTHORITY_STATES,
  frontendAuthorityView,
  type FrontendAuthorityState,
  type FrontendAuthorityView,
} from './frontend-authority-contract.ts';
export {
  PRODUCT_CAPABILITIES,
  PRODUCT_TO_IDENTITY_CAPABILITY,
  actionTypesForProductCapability,
  hasProductCapability,
  identityCapabilitiesForProduct,
  isProductCapability,
  type ProductCapability,
} from './product-capability.ts';
export {
  OWNED_RESOURCE_KINDS,
  ResourceOwnershipRegistry,
  isOwnedResourceKind,
  type OwnedResource,
  type OwnedResourceKind,
} from './resource-ownership.ts';
export type { IdentityFacts } from './facts.ts';
export {
  asActorId,
  asAuthChallengeId,
  asBusinessIdentityId,
  asCapabilityGrantId,
  asChallengeId,
  asCredentialId,
  asDeviceId,
  asKycRecordId,
  asLoginHandleId,
  asPasswordCredentialId,
  asRecoveryRequestId,
  asRefreshTokenId,
  asSecurityEventId,
  asSessionId,
  asSolsticeIdentityId,
  asSunReyIdentityId,
  asTotpCredentialId,
  type ActorId,
  type AuthChallengeId,
  type BusinessIdentityId,
  type CapabilityGrantId,
  type ChallengeId,
  type CredentialId,
  type DeviceId,
  type KycRecordId,
  type LoginHandleId,
  type PasswordCredentialId,
  type RecoveryRequestId,
  type RefreshTokenId,
  type SecurityEventId,
  type SessionId,
  type SolsticeIdentityId,
  type SunReyIdentityId,
  type TotpCredentialId,
} from './ids.ts';
export {
  KYC_VERIFICATION_LEVELS,
  KYC_VERIFICATION_STATES,
  kycEffectiveState,
  kycIsFresh,
  type KycRecord,
  type KycVerificationLevel,
  type KycVerificationState,
  type KycVerifiedAttribute,
} from './kyc.ts';
export {
  ATTRIBUTE_PROVENANCE,
  IDENTITY_KINDS,
  IDENTITY_STATUSES,
  emptyPersonalAttributes,
  isBlockedIdentityStatus,
  isUsableIdentityStatus,
  undeclaredAttribute,
  type AttributeProvenance,
  type AttributeRef,
  type BusinessIdentity,
  type BusinessRepresentativeRef,
  type IdentityKind,
  type IdentityStatus,
  type IdentitySubject,
  type PersonIdentity,
  type PersonalIdentityAttributes,
} from './model.ts';
export type {
  BeneficialOwnershipProvider,
  BusinessVerificationProvider,
  DocumentVerificationProvider,
  IdentityProviderPorts,
  IdentityVerificationProvider,
  IdentityVerificationResult,
  LivenessVerificationProvider,
} from './ports.ts';
export { RECOVERY_STATES, type RecoveryRequest, type RecoveryState } from './recovery.ts';
export {
  CAPABILITY_GRANT_TTL_MS,
  CHALLENGE_TTL_MS,
  IdentityService,
  SESSION_TTL_MS,
  type IdentityAuthorityPort,
  type IdentityFailure,
} from './service.ts';
export {
  SimulatedAuthenticator,
  SimulatedIdentityAdapter,
  SimulatedWebAuthnRelyingParty,
  simulatedBeneficialOwnership,
  simulatedBusinessVerification,
  simulatedDeviceRisk,
  simulatedDocumentVerification,
  simulatedIdentityVerification,
  simulatedLiveness,
  simulatedProviderPorts,
} from './simulation.ts';
export { IdentityStore, type IdentitySnapshot } from './store.ts';
export * as identityProviderCandidate from './provider-candidate/index.ts';
export {
  PASSWORD_KDF,
  PASSWORD_MIN_LENGTH,
  SCRYPT_N,
  assertPasswordPolicy,
  hashPassword,
  verifyPassword,
  type PasswordDigest,
} from './password.ts';
export {
  TOTP_ALGORITHM,
  TOTP_DIGITS,
  TOTP_PERIOD_SECONDS,
  fromBase32,
  generateTotpSecret,
  otpauthUri,
  totpAt,
  verifyTotp,
} from './totp.ts';
export {
  ACCESS_TOKEN_TTL_MS,
  REFRESH_TOKEN_TTL_MS,
  hashRefreshToken,
  issueAccessToken,
  issueRefreshToken,
  verifyAccessToken,
  type AccessTokenClaims,
  type IssuedTokenPair,
} from './tokens.ts';
export { SECURITY_EVENT_KINDS, type IdentitySecurityEvent, type SecurityEventKind } from './security-events.ts';
export {
  AUTH_RATE_LIMIT_POLICIES,
  AuthRateLimiter,
  type AuthRateLimitPort,
  type AuthRateLimitPurpose,
} from './auth-rate-limit.ts';
export {
  HANDLE_VERIFICATION_STATES,
  LOGIN_HANDLE_KINDS,
  handleLookupHash,
  normalizeEmail,
  normalizeHandle,
  normalizePhone,
  type LoginHandle,
  type LoginHandleKind,
} from './login-handle.ts';
export {
  AuthenticationStore,
  AUTH_CHALLENGE_PURPOSES,
  type AuthChallenge,
  type AuthenticationSnapshot,
  type PasswordCredential,
  type RefreshSession,
  type TotpCredential,
} from './auth-store.ts';
export {
  AuthenticationService,
  MFA_CHALLENGE_TTL_MS,
  RECOVERY_CHALLENGE_TTL_MS,
  isMfaRequired,
  type AuthenticateResult,
  type AuthenticatedRequestContext,
  type AuthFailure,
  type MfaRequiredResult,
  type RegisterResult,
  type TokenBundle,
} from './authentication-service.ts';
export { evaluateStepUp, type StepUpDecision } from './step-up.ts';
export {
  ProductionWebAuthnRelyingParty,
  WEBAUTHN_BROWSER_DEPENDENCY,
  WEBAUTHN_PRODUCTION_BLOCKER,
  WEBAUTHN_PRODUCTION_DEPENDENCY,
  isProductionWebAuthnAvailable,
} from './webauthn-production.ts';
export { authenticateRequestMiddleware, dispatchAuthHttp, type AuthHttpRequest, type AuthHttpResponse } from './http/auth-http.ts';
