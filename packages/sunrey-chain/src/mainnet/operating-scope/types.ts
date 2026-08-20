/**
 * Chunk 161 — Jurisdictional operating scope, licensing, regulatory-evidence
 * binding, corridor eligibility, and product activation matrix.
 *
 * This is a readiness / operating-scope control plane. It is not legal
 * advice. Software capability never infers regulatory permission.
 * Unknown jurisdictions, unknown corridors, and missing evidence stay
 * disabled. The module cannot issue Execution Authority.
 */

import type { ActivationDomain } from '../types.ts';

export const OPERATING_SCOPE_SCHEMA_VERSION = 1 as const;
export const OPERATING_SCOPE_TOOL_VERSION = 'sunrey-mainnet/operating-scope/1' as const;
export const OPERATING_SCOPE_ID = 'sunrey.mainnet.operating-scope.v1' as const;
export const CHUNK_161_ID = 'CHUNK-161' as const;

export const UNKNOWN_JURISDICTION_ENABLED = false as const;
export const ENGINEERING_TEST_EQUALS_LEGAL_APPROVAL = false as const;
export const SUNREY_SCOPE_EQUALS_MOONREY_SCOPE = false as const;
export const EXCHANGE_SCOPE_EQUALS_CUSTODY_SCOPE = false as const;
export const CUSTODY_SCOPE_EQUALS_ISSUANCE_SCOPE = false as const;
export const AI_CAN_APPROVE_JURISDICTION = false as const;
export const PRODUCTION_ACTIVE = false as const;
export const MODULE_ISSUES_EXECUTION_AUTHORITY = false as const;
export const REGULATORY_TWIN_CAN_EXTERNALLY_VERIFY = false as const;
export const CONFIRMED_BY_COUNSEL = false as const;

export const OPERATING_SCOPE_STATUSES = [
  'RESEARCH_REQUIRED',
  'EVIDENCE_REQUIRED',
  'UNDER_REVIEW',
  'ENGINEERING_READY',
  'EXTERNALLY_VERIFIED',
  'HUMAN_APPROVAL_REQUIRED',
  'ELIGIBLE_CANDIDATE',
  'DISABLED',
  'EXPIRED',
  'REVOKED',
] as const;
export type OperatingScopeStatus = (typeof OPERATING_SCOPE_STATUSES)[number];

export const OPERATING_SCOPE_REASON_CODES = [
  'JURISDICTION_RESEARCH_REQUIRED',
  'LICENSE_EVIDENCE_MISSING',
  'COUNSEL_EVIDENCE_MISSING',
  'REGULATORY_APPROVAL_MISSING',
  'PARTNER_AGREEMENT_MISSING',
  'PROVIDER_NOT_ELIGIBLE',
  'DATA_RIGHTS_EVIDENCE_MISSING',
  'PRIVACY_REVIEW_MISSING',
  'CORRIDOR_DISABLED',
  'EVIDENCE_EXPIRED',
  'EVIDENCE_REVOKED',
  'HUMAN_APPROVAL_REQUIRED',
  'LEGAL_ENTITY_MISMATCH',
  'ASSET_SCOPE_INDEPENDENT',
  'DOMAIN_SCOPE_INDEPENDENT',
  'ENGINEERING_TEST_NOT_LEGAL_APPROVAL',
  'FIXTURE_EVIDENCE_INSUFFICIENT',
  'AI_CANNOT_APPROVE_JURISDICTION',
  'TWIN_CANNOT_EXTERNALLY_VERIFY',
  'PRODUCTION_INACTIVE',
  'CONSENT_EVIDENCE_MISSING',
  'DATA_RESIDENCY_EVIDENCE_MISSING',
  'PURPOSE_CONTROL_EVIDENCE_MISSING',
  'TERMS_AGREEMENT_MISSING',
  'SOURCE_CERTIFICATION_MISSING',
  'FX_EVIDENCE_NOT_PAYMENT_RAIL',
] as const;
export type OperatingScopeReasonCode = (typeof OPERATING_SCOPE_REASON_CODES)[number];

export const OPERATING_SCOPE_ACTOR_KINDS = [
  'HUMAN',
  'AI',
  'S3M',
  'GROK',
  'AGENT',
  'AUTOMATION',
  'SERVICE',
] as const;
export type OperatingScopeActorKind = (typeof OPERATING_SCOPE_ACTOR_KINDS)[number];

export const SCOPE_EVIDENCE_CLASSES = [
  'LICENSE_OR_REGISTRATION',
  'COUNSEL_OPINION',
  'REGULATORY_APPROVAL',
  'PARTNER_AGREEMENT',
  'PRIVACY_REVIEW',
  'DATA_RESIDENCY',
  'CONSENT_CONTROL',
  'PURPOSE_CONTROL',
  'TERMS_AGREEMENT',
  'DATA_LICENSE',
  'PROVIDER_CONTRACT',
  'JURISDICTIONAL_USE_RIGHT',
  'SOURCE_CERTIFICATION',
  'KYC_AML_PROGRAM',
  'ENGINEERING_TEST',
  'HUMAN_AUTHORIZATION',
] as const;
export type ScopeEvidenceClass = (typeof SCOPE_EVIDENCE_CLASSES)[number];

export const SCOPE_EVIDENCE_STATES = [
  'NOT_PROVIDED',
  'RESEARCH_REQUIRED',
  'PROVIDED_UNVERIFIED',
  'ENGINEERING_VERIFIED',
  'EXTERNALLY_VERIFIED',
  'EXPIRED',
  'REVOKED',
] as const;
export type ScopeEvidenceState = (typeof SCOPE_EVIDENCE_STATES)[number];

export const PROVIDER_DEPENDENCY_KINDS = [
  'FIAT_BANKING',
  'PAYMENT_RAIL',
  'FX_LIQUIDITY',
  'KYC_AML',
  'REGULATED_PARTNER',
] as const;
export type ProviderDependencyKind = (typeof PROVIDER_DEPENDENCY_KINDS)[number];

export const CUSTOMER_CLASSES = ['RETAIL', 'INSTITUTIONAL', 'ALL'] as const;
export type OperatingCustomerClass = (typeof CUSTOMER_CLASSES)[number];

export const PAYMENT_PURPOSE_CLASSES = [
  'GOODS',
  'SERVICES',
  'PERSONAL',
  'TREASURY',
  'UNSPECIFIED',
] as const;
export type PaymentPurposeClass = (typeof PAYMENT_PURPOSE_CLASSES)[number];

export const NATIVE_ASSETS = ['SUNREY_COIN', 'MOONREY_COIN'] as const;
export type NativeAssetScope = (typeof NATIVE_ASSETS)[number];

export const JURISDICTION_CATALOG_STATES = ['KNOWN_FIXTURE', 'UNKNOWN'] as const;
export type JurisdictionCatalogState = (typeof JURISDICTION_CATALOG_STATES)[number];

export type OperatingScopeKey = {
  readonly jurisdiction: string;
  readonly activationDomain: ActivationDomain;
  readonly legalEntityRef: string;
  readonly customerClass?: OperatingCustomerClass;
  readonly currency?: string;
  readonly corridorId?: string;
  readonly asset?: NativeAssetScope;
  readonly providerDependencies?: readonly ProviderDependencyKind[];
};

export type JurisdictionRecord = {
  readonly code: string;
  readonly displayName: string;
  readonly catalogState: JurisdictionCatalogState;
  readonly fixture: boolean;
  readonly researchRequired: true;
  readonly legalConclusionInvented: false;
};

export type LegalEntityRef = {
  readonly entityRef: string;
  readonly jurisdiction: string;
  readonly displayName: string;
  readonly fixture: boolean;
  readonly inventedCorporateData: false;
};

export type ScopeEvidenceRecord = {
  readonly evidenceId: string;
  readonly evidenceClass: ScopeEvidenceClass;
  readonly legalEntityRef: string;
  readonly jurisdiction: string;
  readonly activationDomain: ActivationDomain | '*';
  readonly state: ScopeEvidenceState;
  readonly fixture: boolean;
  readonly fixtureKind: string | null;
  readonly actorKind: OperatingScopeActorKind | null;
  readonly reference: string | null;
  readonly contentHash: string | null;
  readonly expiresAtUtc: string | null;
  readonly chunk160RegistryId: string | null;
  readonly notes: string;
};

export type ScopeRequirement = {
  readonly requirementId: string;
  readonly activationDomain: ActivationDomain;
  readonly evidenceClass: ScopeEvidenceClass;
  readonly blocking: true;
  readonly hinOnly?: boolean;
  readonly productiveUseRight?: boolean;
  readonly corridorEndpoint?: 'SOURCE' | 'DESTINATION' | 'BOTH';
};

export type ProviderBinding = {
  readonly bindingId: string;
  readonly kind: ProviderDependencyKind;
  readonly providerRef: string;
  readonly legalEntityRef: string;
  readonly engineeringHealthy: boolean;
  readonly legallyEligible: boolean;
  readonly fixture: boolean;
  readonly notes: string;
};

export type CorridorEligibilityRecord = {
  readonly corridorId: string;
  readonly sourceJurisdiction: string;
  readonly destinationJurisdiction: string;
  readonly sourceCurrency: string;
  readonly destinationCurrency: string;
  readonly customerClass: OperatingCustomerClass;
  readonly paymentPurposeClass: PaymentPurposeClass;
  readonly servingLegalEntityRef: string;
  readonly requiredProviders: readonly ProviderDependencyKind[];
  readonly requiredEvidenceClasses: readonly ScopeEvidenceClass[];
  readonly kernelPolicyRef: string;
  readonly fixture: true;
  readonly researchRequired: true;
  readonly liveStatus: 'DISABLED';
  readonly legalConclusionInvented: false;
};

export type ProductScopeRow = {
  readonly rowId: string;
  readonly key: OperatingScopeKey;
  readonly softwareImplemented: boolean;
  readonly independentOf: readonly ActivationDomain[];
  readonly hinPrivacyRequired: boolean;
  readonly productiveUseRightRequired: boolean;
};

export type OperatingScopeEvaluation = {
  readonly key: OperatingScopeKey;
  readonly status: OperatingScopeStatus;
  readonly eligible: boolean;
  readonly available: boolean;
  readonly reasonCodes: readonly OperatingScopeReasonCode[];
  readonly evidenceReferences: readonly string[];
  readonly missingRequirements: readonly string[];
  readonly productionActive: false;
  readonly issuesExecutionAuthority: false;
  readonly confirmedByCounsel: false;
  readonly engineeringTestUsedAsLegalApproval: false;
  readonly notes: string;
};

/**
 * Safe Kernel / policy-layer output. Kernel still decides.
 * This object is never an Execution Authority.
 */
export type OperatingScopeFact = {
  readonly schemaVersion: typeof OPERATING_SCOPE_SCHEMA_VERSION;
  readonly jurisdiction: string;
  readonly activationDomain: ActivationDomain;
  readonly legalEntityRef: string;
  readonly eligibility: boolean;
  readonly status: OperatingScopeStatus;
  readonly reasonCodes: readonly OperatingScopeReasonCode[];
  readonly evidenceReferences: readonly string[];
  readonly productionActive: false;
  readonly issuesExecutionAuthority: false;
  readonly confirmedByCounsel: false;
};

export type OperatingScopeCatalog = {
  readonly schemaVersion: typeof OPERATING_SCOPE_SCHEMA_VERSION;
  readonly jurisdictions: readonly JurisdictionRecord[];
  readonly legalEntities: readonly LegalEntityRef[];
  readonly products: readonly ProductScopeRow[];
  readonly requirements: readonly ScopeRequirement[];
  readonly corridors: readonly CorridorEligibilityRecord[];
  readonly providers: readonly ProviderBinding[];
  readonly evidence: readonly ScopeEvidenceRecord[];
};

export type OperatingScopeQuery = {
  readonly jurisdiction: string;
  readonly activationDomain: ActivationDomain;
  readonly legalEntityRef: string;
  readonly customerClass?: OperatingCustomerClass;
  readonly currency?: string;
  readonly corridorId?: string;
  readonly asset?: NativeAssetScope;
  readonly nowUtc?: string;
  readonly actorKind?: OperatingScopeActorKind;
  readonly twinOverlay?: boolean;
};

export type OperatingScopeReport = {
  readonly toolVersion: typeof OPERATING_SCOPE_TOOL_VERSION;
  readonly evaluations: readonly OperatingScopeEvaluation[];
  readonly facts: readonly OperatingScopeFact[];
  readonly unknownJurisdictionEnabled: false;
  readonly engineeringTestEqualsLegalApproval: false;
  readonly sunreyScopeEqualsMoonreyScope: false;
  readonly exchangeScopeEqualsCustodyScope: false;
  readonly aiCanApproveJurisdiction: false;
  readonly productionActive: false;
  readonly confirmedByCounsel: false;
};
