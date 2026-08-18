/**
 * Chunk 79 — SunRey production governance operations types.
 *
 * Operational orchestration and evidence around canonical Chunk 40
 * protocol governance. This is not a second consensus-level governance
 * engine, a governance token, or an authority that can rewrite
 * finalized history.
 */

export const GOVERNANCE_OPS_SCHEMA_VERSION = 1 as const;
export const GOVERNANCE_OPS_DOMAIN = 'sunrey.governance.operations.v1' as const;
export const ECONOMIC_RC_DOMAIN = 'sunrey.governance.economic-rc.v1' as const;

export const GOVERNANCE_OPERATION_TYPES = [
  'PROTOCOL_UPGRADE',
  'MONETARY_POLICY',
  'FEE_POLICY',
  'VALIDATOR_ECONOMICS',
  'MOONREY_POLICY',
  'TREASURY_POLICY',
  'ORACLE_POLICY',
  'CRYPTO_POLICY',
  'VALIDATOR_SET',
  'INTEROP_POLICY',
  'OTHER_GOVERNED_PROTOCOL_ACTION',
] as const;
export type GovernanceOperationType = (typeof GOVERNANCE_OPERATION_TYPES)[number];

export const GOVERNANCE_OPS_ROLES = [
  'PROTOCOL_AUTHORITY',
  'SECURITY_AUTHORITY',
  'OPERATIONS_AUTHORITY',
  'RELEASE_AUTHORITY',
  'ECONOMIC_POLICY_AUTHORITY',
  'VALIDATOR_GOVERNANCE_AUTHORITY',
  'OBSERVER',
  'AI_ANALYST',
] as const;
export type GovernanceOpsRole = (typeof GOVERNANCE_OPS_ROLES)[number];

export const HUMAN_APPROVAL_ROLES = [
  'PROTOCOL_AUTHORITY',
  'SECURITY_AUTHORITY',
  'OPERATIONS_AUTHORITY',
  'RELEASE_AUTHORITY',
  'ECONOMIC_POLICY_AUTHORITY',
  'VALIDATOR_GOVERNANCE_AUTHORITY',
] as const;
export type HumanApprovalRole = (typeof HUMAN_APPROVAL_ROLES)[number];

export const ACTOR_KINDS = ['HUMAN', 'AI', 'AGENT', 'AUTOMATION'] as const;
export type GovernanceOpsActorKind = (typeof ACTOR_KINDS)[number];

export const PACKAGE_STATUSES = [
  'DRAFT',
  'PACKAGED',
  'PREFLIGHT_FAILED',
  'PREFLIGHT_PASSED',
  'AWAITING_APPROVALS',
  'APPROVED',
  'SCHEDULED',
  'ACTIVATED',
  'POST_VERIFIED',
  'REJECTED',
  'EXPIRED',
] as const;
export type GovernancePackageStatus = (typeof PACKAGE_STATUSES)[number];

export const PREFLIGHT_CHECKS = [
  'SCHEMA_VALIDATION',
  'FORMAL_SMOKE',
  'PROPERTY_TESTS',
  'ECONOMIC_STRESS',
  'SIMULATION',
  'COMPATIBILITY',
  'RELEASE_ARTIFACT',
  'SUPPLY_INVARIANTS',
  'PACKAGE_HASH',
  'NETWORK',
  'APPROVAL_WINDOW',
  'ECONOMIC_RC',
] as const;
export type PreflightCheckId = (typeof PREFLIGHT_CHECKS)[number];

export const DIFF_CATEGORIES = [
  'ADDED_PARAMETERS',
  'REMOVED_PARAMETERS',
  'CHANGED_PARAMETERS',
  'CHANGED_AUTHORITY',
  'CHANGED_CAPS',
  'CHANGED_FORMULAS',
  'CHANGED_ELIGIBILITY',
  'CHANGED_ACTIVATION_CONDITIONS',
] as const;
export type PolicyDiffCategory = (typeof DIFF_CATEGORIES)[number];

export const EMERGENCY_ACTION_CLASSES = [
  'RESTRICT_NEW_MOONREY_ISSUANCE',
  'RESTRICT_TREASURY_DISBURSEMENTS',
  'RESTRICT_NEW_EXCHANGE_ORDERS',
  'RESTRICT_EXCHANGE_SETTLEMENT',
  'RESTRICT_CUSTODY_WITHDRAWALS',
  'SUSPEND_ORACLE_PROVIDER',
  'RESTRICT_INTEROP_CHANNEL',
  'RESTRICT_SPECIFIC_PROTOCOL_FEATURE',
] as const;
export type EmergencyActionClass = (typeof EMERGENCY_ACTION_CLASSES)[number];

export const FORBIDDEN_EMERGENCY_POWERS = [
  'MINT_NATIVE_ASSETS',
  'REWRITE_SUPPLY',
  'CONFISCATE_CUSTOMER_WALLETS',
  'REWRITE_FINALIZED_BLOCKS',
  'FORGE_ORACLE_FACTS',
  'ERASE_EVIDENCE',
  'ALTER_HISTORICAL_POLICY',
  'UNILATERAL_LEGAL_APPROVAL',
  'CONVERT_TESTNET_TO_MAINNET',
] as const;
export type ForbiddenEmergencyPower = (typeof FORBIDDEN_EMERGENCY_POWERS)[number];

export const RESTRICTION_STATES = [
  'INACTIVE',
  'ACTIVE',
  'PENDING_REVIEW',
  'EXPIRED_AWAITING_AUTHORITY',
  'RESUMED',
] as const;
export type RestrictionState = (typeof RESTRICTION_STATES)[number];

export const NETWORK_CLASSES = ['DEVELOPMENT', 'TESTNET', 'REHEARSAL', 'PRODUCTION_CANDIDATE'] as const;
export type GovernanceNetworkClass = (typeof NETWORK_CLASSES)[number];

export type ActivationCoordinate = {
  readonly kind: 'HEIGHT' | 'EPOCH';
  readonly height: number;
  readonly epoch: number | null;
};

export type PolicyParameterMap = Readonly<Record<string, string | number | boolean | null>>;

export type PolicySnapshot = {
  readonly policyId: string;
  readonly policyFamily: GovernanceOperationType;
  readonly version: number;
  readonly authority: string;
  readonly caps: PolicyParameterMap;
  readonly formulas: PolicyParameterMap;
  readonly eligibility: PolicyParameterMap;
  readonly activation: PolicyParameterMap;
  readonly parameters: PolicyParameterMap;
};

export type CanonicalPolicyDiff = {
  readonly schemaVersion: typeof GOVERNANCE_OPS_SCHEMA_VERSION;
  readonly fromVersion: number;
  readonly toVersion: number;
  readonly addedParameters: readonly string[];
  readonly removedParameters: readonly string[];
  readonly changedParameters: readonly string[];
  readonly changedAuthority: boolean;
  readonly changedCaps: readonly string[];
  readonly changedFormulas: readonly string[];
  readonly changedEligibility: readonly string[];
  readonly changedActivationConditions: readonly string[];
  readonly diffHash: string;
};

export type GovernanceEvidenceBundle = {
  readonly schemaHash: string;
  readonly formalReportHash: string;
  readonly propertyTestHash: string;
  readonly economicStressReportHash: string;
  readonly simulationEvidenceHash: string;
  readonly qualificationReportHash: string;
  readonly readinessEvidenceHash: string;
  readonly releaseArtifactHash: string;
  readonly economicReleaseCandidateHash: string;
  readonly supplyInvariantHash: string;
};

export type GovernanceApprovalRecord = {
  readonly actorId: string;
  readonly actorKind: GovernanceOpsActorKind;
  readonly role: GovernanceOpsRole;
  readonly packageHash: string;
  readonly networkId: string;
  readonly chainId: string;
  readonly policyVersion: number;
  readonly activationHeight: number;
  readonly signedAtUtc: string;
  readonly publicKeyHex: string;
  readonly signatureHex: string;
  readonly accepted: boolean;
  readonly rejectionReason: string | null;
};

export type GovernanceApprovalSet = {
  readonly requiredRoles: readonly HumanApprovalRole[];
  readonly minimumDistinctActors: number;
  readonly records: readonly GovernanceApprovalRecord[];
  readonly satisfied: boolean;
};

export type GovernancePreflightCheck = {
  readonly id: PreflightCheckId;
  readonly passed: boolean;
  readonly detail: string;
};

export type GovernancePreflightReport = {
  readonly packageHash: string;
  readonly networkId: string;
  readonly chainId: string;
  readonly checks: readonly GovernancePreflightCheck[];
  readonly passed: boolean;
  readonly binaryInstallActivatesPolicy: false;
};

export type EconomicPolicyChangePackage = {
  readonly targetPolicy: GovernanceOperationType;
  readonly currentVersion: number;
  readonly proposedVersion: number;
  readonly currentSnapshot: PolicySnapshot;
  readonly proposedSnapshot: PolicySnapshot;
  readonly canonicalDiff: CanonicalPolicyDiff;
  readonly activation: ActivationCoordinate;
  readonly evidence: GovernanceEvidenceBundle;
  readonly releaseCandidateHash: string;
};

export type GovernanceOperationPackage = {
  readonly schemaVersion: typeof GOVERNANCE_OPS_SCHEMA_VERSION;
  readonly packageId: string;
  readonly operationType: GovernanceOperationType;
  readonly networkId: string;
  readonly chainId: string;
  readonly networkClass: GovernanceNetworkClass;
  readonly protocolGovernanceReference: 'CHUNK_40_UPGRADE_PLAN';
  readonly replacesConsensusGovernance: false;
  readonly governanceToken: false;
  readonly aiMayVote: false;
  readonly mayRewriteFinalizedHistory: false;
  readonly currentProtocolVersion: number;
  readonly targetProtocolVersion: number;
  readonly activation: ActivationCoordinate;
  readonly approvalValidFromUtc: string;
  readonly approvalValidUntilUtc: string;
  readonly economic: EconomicPolicyChangePackage | null;
  readonly evidence: GovernanceEvidenceBundle;
  readonly upgradePlanHash: string | null;
  readonly packageHash: string;
  readonly status: GovernancePackageStatus;
};

export type GovernanceActivationRecord = {
  readonly packageHash: string;
  readonly activation: ActivationCoordinate;
  readonly activatedAtHeight: number | null;
  readonly binaryInstalled: boolean;
  readonly policyActivated: boolean;
  readonly actorKind: GovernanceOpsActorKind;
  readonly actorId: string;
  readonly accepted: boolean;
  readonly rejectionReason: string | null;
};

export type GovernancePostActivationReport = {
  readonly packageHash: string;
  readonly activePolicyVersion: number;
  readonly stateRootAgreement: boolean;
  readonly nativeSupplyUnchangedExceptGoverned: boolean;
  readonly feeBehaviorMatchesPolicy: boolean;
  readonly validatorEconomicsMatchPolicy: boolean;
  readonly moonreyIssuanceMatchesPolicy: boolean;
  readonly treasuryBehaviorMatchesPolicy: boolean;
  readonly explorerCompatible: boolean;
  readonly historyRewritten: false;
  readonly passed: boolean;
};

export type EmergencyAuthorityPolicy = {
  readonly policyId: string;
  readonly networkId: string;
  readonly chainId: string;
  readonly permittedClasses: readonly EmergencyActionClass[];
  readonly forbiddenPowers: readonly ForbiddenEmergencyPower[];
  readonly requiredRoles: readonly HumanApprovalRole[];
  readonly minimumDistinctActors: number;
  readonly aiCannotApprove: true;
  readonly mayMintNativeAssets: false;
  readonly mayRewriteSupply: false;
  readonly mayRewriteFinalizedHistory: false;
};

export type EmergencyActionRecord = {
  readonly actionId: string;
  readonly incidentReference: string;
  readonly actionClass: EmergencyActionClass;
  readonly scope: string;
  readonly authority: string;
  readonly packageHash: string;
  readonly approvals: GovernanceApprovalSet;
  readonly activation: ActivationCoordinate;
  readonly expiresAtHeight: number | null;
  readonly reviewAtHeight: number | null;
  readonly evidenceHash: string;
  readonly result: RestrictionState;
  readonly accepted: boolean;
  readonly rejectionReason: string | null;
};

export type GovernanceOperationsAudit = {
  readonly packageId: string;
  readonly packageHash: string;
  readonly proposal: GovernanceOperationPackage;
  readonly diff: CanonicalPolicyDiff | null;
  readonly evidence: GovernanceEvidenceBundle;
  readonly approvals: GovernanceApprovalSet;
  readonly releaseHash: string;
  readonly activation: GovernanceActivationRecord | null;
  readonly postActivation: GovernancePostActivationReport | null;
  readonly emergencyActions: readonly EmergencyActionRecord[];
  readonly openFindings: readonly string[];
};

export type GovernanceOfflinePackage = {
  readonly kind: 'SUNREY_GOVERNANCE_OFFLINE_PACKAGE';
  readonly packageKind: 'APPROVAL_REQUESTS' | 'RELEASE_CANDIDATE_HASHES' | 'POLICY_HASHES';
  readonly payload: {
    readonly policyHash: string;
    readonly releaseHash: string;
    readonly activation: ActivationCoordinate;
    readonly approvalRequest: string;
    readonly publicSignatures: readonly string[];
  };
  readonly payloadHash: string;
  readonly containsPrivateKeys: false;
};

export type PublicGovernanceView = {
  readonly proposalId: string;
  readonly operationType: GovernanceOperationType;
  readonly policyDiff: CanonicalPolicyDiff | null;
  readonly activationCoordinate: ActivationCoordinate;
  readonly approvalResult: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  readonly activeVersion: number | null;
  readonly emergencyRestrictionClass: EmergencyActionClass | null;
  readonly restrictionState: RestrictionState;
};

export type EconomicReleaseCandidateBinding = {
  readonly domain: typeof ECONOMIC_RC_DOMAIN;
  readonly releaseArtifactHash: string;
  readonly formalReportHash: string;
  readonly economicStressReportHash: string;
  readonly qualificationReportHash: string;
  readonly economicReleaseCandidateHash: string;
};
