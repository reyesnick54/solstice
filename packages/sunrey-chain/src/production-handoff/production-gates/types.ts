/**
 * Phase I Prompt 5 — Production Gate framework.
 *
 * Extends the existing production-handoff owner. Composes Chunk 160
 * external-evidence references. Does not grant licenses, legal
 * approvals, or activate production.
 *
 * Not packages/production-gates, packages/legal-engine,
 * packages/external-audit, packages/readiness-v2, or a second
 * Evidence Vault / Kernel / Execution Authority.
 */

export const PRODUCTION_GATE_SCHEMA_VERSION = 1 as const;
export const PRODUCTION_GATE_TOOL_VERSION = 'sunrey-ops/production/gates/1' as const;
export const PRODUCTION_GATE_REGISTRY_ID = 'sunrey.external-input.registry.v1' as const;
export const PRODUCTION_GATE_HASH_DOMAIN = 'SUNREY_PRODUCTION_GATE_V1' as const;

export const PRODUCTION_ACTIVE = false as const;
export const PRODUCTION_READY = false as const;
export const LIVE_CONNECTIVITY_ENABLED = false as const;
export const INTERNAL_TEST_EQUALS_EXTERNAL_AUDIT = false as const;
export const AI_MAY_OVERRIDE_GATES = false as const;
export const DEVELOPER_MAY_OVERRIDE_GATES = false as const;
export const AGENT_MAY_OVERRIDE_GATES = false as const;
export const FIXTURE_COUNTS_AS_EXTERNAL = false as const;
export const CONFIRMED_BY_COUNSEL_FORBIDDEN_HERE = true as const;

export const FORBIDDEN_PARALLEL_PACKAGES = [
  'packages/production-gates',
  'packages/legal-engine',
  'packages/external-audit',
  'packages/readiness-v2',
  'packages/licensing',
  'packages/country-law',
  'packages/global-regulation',
] as const;

export const GATE_CATEGORIES = [
  'REGULATORY',
  'LEGAL',
  'BANKING',
  'PAYMENTS',
  'CARDS',
  'INVESTMENTS',
  'EXCHANGE',
  'CUSTODY',
  'BLOCKCHAIN',
  'AI',
  'PRIVACY',
  'DATA_MARKETPLACE',
  'SECURITY',
  'OPERATIONS',
  'INFRASTRUCTURE',
  'GOVERNANCE',
  'PROVIDER',
  'TRAINING',
  'BUSINESS_CONTINUITY',
  'RECONCILIATION',
  'CUSTOMER_EXPERIENCE',
  'INTERNAL_SOFTWARE',
] as const;
export type GateCategory = (typeof GATE_CATEGORIES)[number];

export const GATE_EVIDENCE_STATUSES = [
  'MISSING',
  'IN_PROGRESS',
  'PRESENT_UNVERIFIED',
  'VERIFIED',
  'EXPIRED',
  'NOT_APPLICABLE',
] as const;
export type GateEvidenceStatus = (typeof GATE_EVIDENCE_STATUSES)[number];

export const GATE_KINDS = [
  'INTERNAL_SOFTWARE',
  'EXTERNAL_HUMAN',
  'EXTERNAL_PROVIDER',
  'EXTERNAL_AUDIT',
  'EXTERNAL_REGULATORY',
  'EXTERNAL_LEGAL',
] as const;
export type GateKind = (typeof GATE_KINDS)[number];

export const RELEASE_DECISIONS = [
  'BLOCKED',
  'CONDITIONAL',
  'READY_FOR_LIMITED_LIVE',
  'READY_FOR_PRODUCTION',
] as const;
export type ReleaseDecision = (typeof RELEASE_DECISIONS)[number];

export const REQUIRED_FOR = [
  'BACKEND_SOFTWARE',
  'LIMITED_LIVE',
  'PRODUCTION',
  'MAINNET',
  'EXCHANGE',
  'FRONTEND_LAUNCH',
] as const;
export type RequiredFor = (typeof REQUIRED_FOR)[number];

export const COUNSEL_STATES = ['NOT_APPLICABLE', 'COUNSEL_REVIEW_REQUIRED', 'COUNSEL_REVIEWED'] as const;
export type CounselState = (typeof COUNSEL_STATES)[number];

export const OWNER_ROLES = [
  'ENGINEERING',
  'COMPLIANCE_OPERATIONS',
  'FRAUD',
  'PAYMENTS',
  'TREASURY',
  'RECONCILIATION',
  'EXCHANGE_SURVEILLANCE',
  'CUSTODY_OPERATIONS',
  'SRE_ONCALL',
  'SECURITY',
  'CUSTOMER_SUPPORT',
  'INCIDENT_COMMANDER',
  'DATA_PRIVACY',
  'AGENT_OPERATIONS',
  'LEGAL_COUNSEL',
  'REGULATORY_AFFAIRS',
  'GOVERNANCE_ADMIN',
  'HUMAN_GOVERNANCE',
  'PROVIDER_OPERATIONS',
] as const;
export type OwnerRole = (typeof OWNER_ROLES)[number];

export const ACTOR_KINDS = [
  'HUMAN',
  'AI',
  'S3M',
  'GROK',
  'AGENT',
  'AUTOMATION',
  'SERVICE',
  'DEVELOPER',
] as const;
export type GateActorKind = (typeof ACTOR_KINDS)[number];

export const OVERRIDE_FORBIDDEN_KINDS = ['AI', 'S3M', 'GROK', 'AGENT', 'AUTOMATION', 'SERVICE', 'DEVELOPER'] as const;

export const PROVIDER_FAMILIES = [
  'bank-baas',
  'payment-rails',
  'fx',
  'cards',
  'kyc',
  'aml-sanctions',
  'travel-rule',
  'custody',
  'market-data',
  'oracles',
  'blockchain-analytics',
  'ai-model',
] as const;
export type ProviderFamily = (typeof PROVIDER_FAMILIES)[number];

export const PROVIDER_EVIDENCE_SLOTS = [
  'production-credentials',
  'contract',
  'sandbox-certification',
  'webhooks-validated',
  'reconciliation-validated',
  'operational-contacts',
  'incident-path',
  'production-approval',
] as const;
export type ProviderEvidenceSlot = (typeof PROVIDER_EVIDENCE_SLOTS)[number];

export const CEREMONY_ITEM_STATUSES = [
  'PREPARED_NOT_EXECUTED',
  'BLOCKED_MISSING_INPUT',
  'NOT_APPLICABLE',
] as const;
export type CeremonyItemStatus = (typeof CEREMONY_ITEM_STATUSES)[number];

export type GateEvidenceRecord = {
  readonly evidenceId: string;
  readonly gateId: string;
  readonly version: number;
  readonly previousVersionId: string | null;
  readonly sourceKind: 'EXTERNAL_REGISTERED' | 'INTERNAL_TEST' | 'FIXTURE' | 'ENGINEERING_NOTE';
  readonly reference: string;
  readonly contentDigest: string;
  readonly attachedAtUtc: string;
  readonly expiresAtUtc: string | null;
  readonly lastValidatedUtc: string | null;
  readonly verified: boolean;
  readonly fixture: boolean;
  readonly notes: string;
};

export type GateExceptionRecord = {
  readonly exceptionId: string;
  readonly gateId: string;
  readonly actorKind: GateActorKind;
  readonly actorRole: OwnerRole;
  readonly actorId: string;
  readonly reason: string;
  readonly approvedAtUtc: string;
  readonly expiresAtUtc: string;
  readonly exceptionHash: string;
  readonly auditable: true;
};

export type ExternalInputRecord = {
  readonly gateId: string;
  readonly category: GateCategory;
  readonly description: string;
  readonly requiredFor: readonly RequiredFor[];
  readonly jurisdiction: string;
  readonly status: GateEvidenceStatus;
  readonly evidenceReference: string | null;
  readonly ownerRole: OwnerRole;
  readonly expiration: string | null;
  readonly lastValidated: string | null;
  readonly notes: string;
  readonly kind: GateKind;
  readonly counselState: CounselState;
  readonly exceptionEligible: boolean;
  readonly selfCertificationForbidden: boolean;
  readonly satisfiableByInternalTests: false | true;
  readonly parentGateId: string | null;
  readonly providerFamily: ProviderFamily | null;
  readonly providerSlot: ProviderEvidenceSlot | null;
};

export type GateDefinition = Omit<ExternalInputRecord, 'status' | 'evidenceReference' | 'expiration' | 'lastValidated'> & {
  readonly defaultStatus: GateEvidenceStatus;
};

export type ProductionGateSnapshot = {
  readonly schemaVersion: typeof PRODUCTION_GATE_SCHEMA_VERSION;
  readonly registryId: typeof PRODUCTION_GATE_REGISTRY_ID;
  readonly toolVersion: typeof PRODUCTION_GATE_TOOL_VERSION;
  readonly evaluatedAtUtc: string;
  readonly failClosed: true;
  readonly productionActive: false;
  readonly productionReady: false;
  readonly liveConnectivityEnabled: false;
  readonly backendSoftwareReady: boolean;
  readonly externalGatesMissing: boolean;
  readonly releaseDecision: ReleaseDecision;
  readonly registryHash: string;
  readonly decisionHash: string;
  readonly inputs: readonly ExternalInputRecord[];
  readonly satisfiedInternalGateIds: readonly string[];
  readonly missingExternalGateIds: readonly string[];
  readonly expiredGateIds: readonly string[];
  readonly unverifiedGateIds: readonly string[];
  readonly blockers: readonly string[];
  readonly limitedLiveBlockers: readonly string[];
  readonly exceptions: readonly GateExceptionRecord[];
  readonly ceremonyPrepared: true;
  readonly ceremonyExecuted: false;
};

export type ProductionGateError = {
  readonly code: string;
  readonly message: string;
};

export type ProductionGateResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ProductionGateError };

export function gateOk<T>(value: T): ProductionGateResult<T> {
  return { ok: true, value };
}

export function gateErr(code: string, message: string): ProductionGateResult<never> {
  return { ok: false, error: { code, message } };
}

export function isSatisfyingStatus(status: GateEvidenceStatus): boolean {
  return status === 'VERIFIED' || status === 'NOT_APPLICABLE';
}

export function isBlockingStatus(status: GateEvidenceStatus): boolean {
  return status === 'MISSING' || status === 'IN_PROGRESS' || status === 'PRESENT_UNVERIFIED' || status === 'EXPIRED';
}

export function isExternalKind(kind: GateKind): boolean {
  return kind !== 'INTERNAL_SOFTWARE';
}
