/**
 * Chunk 62 — SunRey independent security-review types.
 *
 * This package prepares a reviewer-ready evidence bundle. It does not
 * claim that an external audit has occurred or passed.
 * ReleaseAuthority from Chunk 59 signs the bundle only. It is not
 * Execution Authority and does not change blockchain state.
 */

export const AUDIT_BUNDLE_SCHEMA_VERSION = 1 as const;
export const AUDIT_PROTOCOL_VERSION = '1' as const;
export const AUDIT_TESTNET_NETWORK_ID = 'net_sunrey_testnet_1' as const;
export const AUDIT_TESTNET_CHAIN_ID = 'chn_sunrey_testnet_1' as const;
export const AUDIT_FIXTURE_GENESIS_HASH =
  'cb31243a83383bd6b2d31ad50757b28da06c487c293aeade8b1cb1ffa3e1fbd6' as const;
export const AUDIT_GENERATED_AT_DETERMINISTIC = '1970-01-01T00:00:00Z' as const;
export const AUDIT_CLAIMS_EXTERNAL_AUDIT = false as const;

export const REVIEW_DOMAINS = [
  'CONSENSUS',
  'PROTOCOL_ENCODING',
  'CRYPTOGRAPHY',
  'PQC',
  'WALLETS',
  'VALIDATORS',
  'NATIVE_ASSETS',
  'MOONREY_ISSUANCE',
  'EXCHANGE',
  'CUSTODY',
  'ORACLES',
  'MACHINE_ECONOMY',
  'INTEROPERABILITY',
  'PRIVACY',
  'SUPPLY_CHAIN',
  'OPERATIONS',
] as const;
export type ReviewDomain = (typeof REVIEW_DOMAINS)[number];

export const CONTROL_KINDS = ['preventive', 'detective', 'recovery'] as const;
export type ControlKind = (typeof CONTROL_KINDS)[number];

export const CONTROL_REVIEW_STATUSES = [
  'IMPLEMENTED',
  'PARTIAL',
  'NOT_APPLICABLE',
  'REVIEW_REQUIRED',
] as const;
export type ControlReviewStatus = (typeof CONTROL_REVIEW_STATUSES)[number];

export const EVIDENCE_KINDS = [
  'unit',
  'property',
  'fuzz',
  'formal',
  'adversarial',
  'load',
  'dr_drill',
  'supply_chain',
] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

export const LIMITATION_STATUSES = [
  'OPEN',
  'MITIGATED',
  'ACCEPTED_WITH_HUMAN_APPROVAL',
  'REMEDIATED',
] as const;
export type LimitationStatus = (typeof LIMITATION_STATUSES)[number];

export const RISK_CLASSIFICATIONS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type RiskClassification = (typeof RISK_CLASSIFICATIONS)[number];

export const FINDING_LIFECYCLE = [
  'RECEIVED',
  'TRIAGED',
  'REMEDIATION_IN_PROGRESS',
  'READY_FOR_RETEST',
  'VERIFIED_RESOLVED',
  'ACCEPTED_RISK_WITH_HUMAN_APPROVAL',
] as const;
export type FindingLifecycleStatus = (typeof FINDING_LIFECYCLE)[number];

export const ACTOR_KINDS = ['HUMAN', 'AI', 'SYSTEM'] as const;
export type ActorKind = (typeof ACTOR_KINDS)[number];

export const READINESS_CATEGORIES = [
  'READY_FOR_EXTERNAL_REVIEW',
  'READY_WITH_KNOWN_LIMITATIONS',
  'MISSING_REVIEW_ARTIFACT',
] as const;
export type AuditReadinessCategory = (typeof READINESS_CATEGORIES)[number];

export const INTERNAL_SEVERITIES = [
  'S0_EMERGENCY',
  'S1_CRITICAL',
  'S2_HIGH',
  'S3_MEDIUM',
  'S4_LOW',
  'S5_INFORMATIONAL',
] as const;
export type InternalSeverity = (typeof INTERNAL_SEVERITIES)[number];

export const TRUST_BOUNDARY_IDS = [
  'validator',
  'remote_signer',
  'sentry',
  'public_rpc',
  'sdk',
  'wallet_signer',
  'custody_hsm',
  'exchange',
  'oracle_provider',
  'relayer',
  'explorer',
  'personal_data_vault',
  'clean_room',
  'governance_authority',
  'release_authority',
] as const;
export type TrustBoundaryId = (typeof TRUST_BOUNDARY_IDS)[number];

export type ArtifactHash = {
  readonly path: string;
  readonly sha256: string;
  readonly kind: 'document' | 'evidence' | 'generated' | 'config';
};

export type AuditBundleManifest = {
  readonly bundle_id: string;
  readonly source_commit: string;
  readonly protocol_version: string;
  readonly testnet_network_id: typeof AUDIT_TESTNET_NETWORK_ID;
  readonly genesis_hash: string;
  readonly included_documents: readonly string[];
  readonly included_evidence: readonly string[];
  readonly artifact_hashes: readonly ArtifactHash[];
  readonly sbom_digest: string;
  readonly formal_report_digest: string;
  readonly security_range_report_digest: string;
  readonly generated_timestamp: string;
  readonly bundle_schema_version: typeof AUDIT_BUNDLE_SCHEMA_VERSION;
  readonly claims_external_audit_completed: false;
  readonly environment: 'simulation';
};

export type SignedAuditBundle = {
  readonly manifest: AuditBundleManifest;
  readonly signature: {
    readonly artifactDigest: string;
    readonly publicKeyHex: string;
    readonly signatureHex: string;
    readonly suiteId: string;
    readonly authorityId: string;
  };
  readonly authorityId: string;
};

export type ReviewDomainRecord = {
  readonly id: ReviewDomain;
  readonly title: string;
  readonly ownerPath: string;
  readonly additionalPaths: readonly string[];
  readonly inScope: boolean;
  readonly notes: string;
};

export type OwnershipEntry = {
  readonly subsystem: string;
  readonly domain: ReviewDomain;
  readonly canonicalPath: string;
  readonly additionalPaths: readonly string[];
};

export type TrustBoundary = {
  readonly id: TrustBoundaryId;
  readonly description: string;
  readonly mayContainSecrets: boolean;
  readonly secretClasses: readonly string[];
  readonly ownerPath: string;
};

export type ProtectedAsset = {
  readonly asset_id: string;
  readonly name: string;
  readonly classification: 'key_material' | 'authority' | 'state' | 'personal_data' | 'artifact';
  readonly ownerPath: string;
  readonly trustBoundary: TrustBoundaryId;
  readonly notes: string;
};

export type ThreatModel = {
  readonly threat_id: string;
  readonly title: string;
  readonly domain: ReviewDomain;
  readonly description: string;
  readonly controls: readonly string[];
  readonly tests: readonly string[];
  readonly residualRisk: string;
};

export type SecurityControl = {
  readonly control_id: string;
  readonly description: string;
  readonly kind: ControlKind;
  readonly implementationPath: string;
  readonly testReferences: readonly string[];
  readonly formalPropertyReferences: readonly string[];
  readonly runbook: string | null;
  readonly knownLimitations: readonly string[];
  readonly reviewStatus: ControlReviewStatus;
  readonly domain: ReviewDomain;
};

export type EvidenceLink = {
  readonly control_id: string;
  readonly kind: EvidenceKind;
  readonly reference: string;
  readonly reproducible: boolean;
};

export type KnownSecurityLimitation = {
  readonly limitation_id: string;
  readonly subsystem: string;
  readonly description: string;
  readonly riskClassification: RiskClassification;
  readonly temporaryMitigation: string;
  readonly plannedRemediation: string;
  readonly externalDependency: string | null;
  readonly status: LimitationStatus;
};

export type SecurityException = {
  readonly exception_id: string;
  readonly scope: string;
  readonly reason: string;
  readonly owner: string;
  readonly expirationOrReviewDate: string;
  readonly mitigation: string;
  readonly humanApprovalReference: string;
  readonly grantedAutomatically: false;
};

export type ExternalReviewFinding = {
  readonly finding_id: string;
  readonly reviewer_reference: string;
  readonly title: string;
  readonly description: string;
  readonly affected_component: string;
  readonly reviewer_severity: string;
  readonly sunrey_triage_status: FindingLifecycleStatus;
  readonly remediation_reference: string | null;
  readonly verification_evidence: string | null;
  readonly resolution_status: FindingLifecycleStatus;
  readonly internal_severity: InternalSeverity | null;
};

export type FindingTransition = {
  readonly from: FindingLifecycleStatus;
  readonly to: FindingLifecycleStatus;
  readonly actor: ActorKind;
  readonly humanApprovalReference: string | null;
};

export type AttackSurfaceEntry = {
  readonly surface_id: string;
  readonly name: string;
  readonly authentication: string;
  readonly authorization: string;
  readonly networkExposure: string;
  readonly rateLimits: string;
  readonly sensitiveOperations: readonly string[];
  readonly tests: readonly string[];
};

export type DataFlowNode = {
  readonly id: string;
  readonly label: string;
  readonly trustBoundary: TrustBoundaryId | 'external';
};

export type DataFlowEdge = {
  readonly from: string;
  readonly to: string;
  readonly data: string;
  readonly authenticated: boolean;
};

export type DataFlow = {
  readonly flow_id: string;
  readonly title: string;
  readonly nodes: readonly DataFlowNode[];
  readonly edges: readonly DataFlowEdge[];
};

export type ReviewerChecklistItem = {
  readonly item_id: string;
  readonly topic: string;
  readonly prompt: string;
  readonly relatedControls: readonly string[];
};

export type AuditReadinessReport = {
  readonly category: AuditReadinessCategory;
  readonly claims_external_audit_completed: false;
  readonly missingArtifacts: readonly string[];
  readonly knownLimitationCount: number;
  readonly controlCount: number;
  readonly threatModelCount: number;
  readonly reviewDomainCount: number;
  readonly notes: string;
};

export type SourceReproducibility = {
  readonly gitCommit: string;
  readonly packageLock: string;
  readonly cargoLockRust: string;
  readonly cargoLockNode: string;
  readonly toolchains: {
    readonly node: string;
    readonly rust: string;
  };
  readonly formalToolVersions: {
    readonly propertyHarness: string;
    readonly machineCheckedProofs: 'NOT_APPLICABLE';
  };
  readonly pqcProviderVersion: string;
  readonly testConfiguration: string;
};

export type BundleVerificationResult = {
  readonly ok: boolean;
  readonly checks: readonly { readonly id: string; readonly ok: boolean; readonly detail: string }[];
};
