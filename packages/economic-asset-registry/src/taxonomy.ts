/**
 * Versioned SunRey Dataset & Economic Asset taxonomy.
 *
 * This is a metadata / rights / provenance / lineage / policy vocabulary.
 * Adding a class never stores raw datasets, never values an asset, and
 * never authorizes minting, settlement, or Execution Authority.
 *
 * Native SunRey Coin and MoonRey Coin supply remain outside this registry.
 * Productive MoonRey categories are mirrored for indexing only; Chunk 44
 * remains the productive taxonomy owner.
 */

export const ECONOMIC_ASSET_TAXONOMY_ID = 'sunrey-economic-asset-taxonomy' as const;
export const ECONOMIC_ASSET_TAXONOMY_VERSION = '1' as const;
export const ECONOMIC_ASSET_SCHEMA_VERSION = 1 as const;

export const ECONOMIC_ASSET_CLASSES = [
  'DATASET',
  'INFORMATION_ASSET',
  'INFORMATION_RIGHT',
  'HUMAN_CONTRIBUTION_EVIDENCE',
  'HUMAN_CONTRIBUTION_RECORD',
  'REFERENCE_DATASET',
  'ORACLE_SOURCE_DATASET',
  'ORACLE_OBSERVATION_SET',
  'VERIFIED_ECONOMIC_FACT',
  'PRODUCTIVE_ECONOMIC_OBJECT',
  'PRODUCTIVE_CLAIM',
  'VERIFIED_PRODUCTIVE_CONTRIBUTION',
  'ECONOMIC_REFERENCE_DATA',
  'ECONOMIC_ATTESTATION',
  'OTHER_GOVERNED_ECONOMIC_ASSET',
] as const;
export type EconomicAssetClass = (typeof ECONOMIC_ASSET_CLASSES)[number];

export const NATIVE_MONETARY_ASSET_CLASSES = [
  'SUNREY_COIN',
  'SUNREY_COIN_SUPPLY',
  'MOONREY_COIN',
  'MOONREY_COIN_SUPPLY',
  'NATIVE_ASSET_SUPPLY',
  'NATIVE_ASSET_SUPPLY_BOOK',
] as const;
export type NativeMonetaryAssetClass = (typeof NATIVE_MONETARY_ASSET_CLASSES)[number];

export const ECONOMIC_ASSET_DOMAINS = ['HUMAN_ECONOMY', 'PRODUCTIVE_ECONOMY', 'SHARED_REFERENCE'] as const;
export type EconomicAssetDomain = (typeof ECONOMIC_ASSET_DOMAINS)[number];

export const SOURCE_CLASSES = [
  'HUMAN_INFORMATION_NETWORK',
  'PERSONAL_DATA_VAULT',
  'PERSONAL_ECONOMIC_GRAPH',
  'HUMAN_CONTRIBUTION_REGISTRY',
  'CONSENT_LEDGER',
  'ORACLE_NETWORK',
  'PRODUCTIVE_OBJECT_REGISTRY',
  'PRODUCTIVE_CLAIM_REGISTRY',
  'ECONOMIC_SIMULATION',
  'EXTERNAL_REFERENCE',
  'DERIVED_PROJECTION',
  'OTHER_GOVERNED_SOURCE',
] as const;
export type SourceClass = (typeof SOURCE_CLASSES)[number];

export const FORBIDDEN_SOURCE_CLASSES = [
  'NATIVE_SUNREY_SUPPLY',
  'NATIVE_MOONREY_SUPPLY',
  'MONETARY_CONSTITUTION_SUPPLY_BOOK',
] as const;

export const STORAGE_CLASSES = [
  'OFF_CHAIN_PROTECTED',
  'OFF_CHAIN_RESTRICTED',
  'OFF_CHAIN_PUBLIC_REFERENCE',
  'ON_CHAIN_COMMITMENT_ONLY',
  'ON_CHAIN_PUBLIC_METADATA',
  'DERIVED_REBUILDABLE',
] as const;
export type StorageClass = (typeof STORAGE_CLASSES)[number];

export const SENSITIVITY_CLASSES = [
  'PUBLIC',
  'INTERNAL',
  'CONFIDENTIAL',
  'PERSONAL',
  'SENSITIVE_PERSONAL',
  'RESTRICTED_COMMERCIAL',
  'RESTRICTED_INDUSTRIAL',
  'REGULATED',
  'SECRET_REFERENCE_ONLY',
] as const;
export type SensitivityClass = (typeof SENSITIVITY_CLASSES)[number];

export const QUALITY_CLASSES = ['AUTHORITATIVE', 'VERIFIED', 'ATTESTED', 'DERIVED', 'INFERRED'] as const;
export type QualityClass = (typeof QUALITY_CLASSES)[number];

export const FRESHNESS_STATES = ['CURRENT', 'STALE', 'CONFLICTED', 'INCOMPLETE', 'SUPERSEDED'] as const;
export type FreshnessState = (typeof FRESHNESS_STATES)[number];

export const CONFIDENCE_CLASSES = ['HIGH', 'MEDIUM', 'LOW', 'UNSCORED'] as const;
export type ConfidenceClass = (typeof CONFIDENCE_CLASSES)[number];

export const LINEAGE_EDGE_KINDS = [
  'DERIVED_FROM',
  'VERIFIED_BY',
  'ATTESTED_BY',
  'AGGREGATED_FROM',
  'NORMALIZED_FROM',
  'TRANSFORMED_FROM',
  'CONTRIBUTED_TO',
  'SETTLED_FROM',
  'SUPERSEDES',
  'CORRECTS',
] as const;
export type LineageEdgeKind = (typeof LINEAGE_EDGE_KINDS)[number];

export const ASSET_LIFECYCLE_STATES = [
  'DRAFT',
  'REGISTERED',
  'VERIFIED',
  'RESTRICTED',
  'SUSPENDED',
  'SUPERSEDED',
  'RETIRED',
] as const;
export type AssetLifecycleState = (typeof ASSET_LIFECYCLE_STATES)[number];

export const CHAIN_ANCHOR_TYPES = [
  'DESCRIPTOR_COMMITMENT',
  'RIGHTS_COMMITMENT',
  'PROVENANCE_COMMITMENT',
  'USAGE_COMMITMENT',
  'VERIFIED_FACT_COMMITMENT',
  'CONTRIBUTION_COMMITMENT',
  'SETTLEMENT_COMMITMENT',
] as const;
export type ChainAnchorType = (typeof CHAIN_ANCHOR_TYPES)[number];

export const FINALITY_STATES = ['UNANCHORED', 'ANCHORED', 'FINALIZED_ON_SIMULATION'] as const;
export type FinalityState = (typeof FINALITY_STATES)[number];

export const RIGHTS_CONCEPTS = [
  'SUBJECT_RIGHTS',
  'CONTROLLER_RIGHTS',
  'USAGE_RIGHTS',
  'COMPUTATION_RIGHTS',
  'MODEL_TRAINING_RIGHTS',
  'REDISTRIBUTION_RIGHTS',
  'COMMERCIALIZATION_RIGHTS',
  'DERIVATIVE_WORK_RIGHTS',
  'RETENTION_LIMITS',
  'JURISDICTION_RESTRICTIONS',
] as const;
export type RightsConcept = (typeof RIGHTS_CONCEPTS)[number];

/**
 * Cross-domain economic categories for indexing. Human classes are
 * original to this registry. Productive classes mirror the Chunk 44
 * MoonRey taxonomy and must not replace it.
 */
export const HUMAN_ECONOMIC_CATEGORIES = [
  'HUMAN_INFORMATION',
  'KNOWLEDGE',
  'CREATIVE_PRODUCTION',
  'RESEARCH',
  'PROFESSIONAL_SERVICES',
  'COMMUNITY_PARTICIPATION',
  'ECONOMIC_PARTICIPATION',
  'EDUCATION',
  'MODEL_TRAINING_PARTICIPATION',
] as const;
export type HumanEconomicCategory = (typeof HUMAN_ECONOMIC_CATEGORIES)[number];

export const PRODUCTIVE_ECONOMIC_CATEGORIES = [
  'ENERGY',
  'FOOD_AGRICULTURE',
  'WATER',
  'MINERALS_RAW_MATERIALS',
  'REAL_ESTATE_USE',
  'COMPUTE',
  'AI_COMPUTE',
  'MANUFACTURING',
  'LOGISTICS_TRANSPORTATION',
  'STORAGE',
  'BANDWIDTH_COMMUNICATIONS',
  'INFRASTRUCTURE',
  'GOODS',
  'SERVICES',
  'AUTOMATED_MACHINE_OUTPUT',
] as const;
export type ProductiveEconomicCategory = (typeof PRODUCTIVE_ECONOMIC_CATEGORIES)[number];

export const SHARED_ECONOMIC_CATEGORIES = ['SHARED_ECONOMIC_REFERENCE'] as const;
export type SharedEconomicCategory = (typeof SHARED_ECONOMIC_CATEGORIES)[number];

export const ECONOMIC_CATEGORIES = [
  ...HUMAN_ECONOMIC_CATEGORIES,
  ...PRODUCTIVE_ECONOMIC_CATEGORIES,
  ...SHARED_ECONOMIC_CATEGORIES,
] as const;
export type EconomicCategory = (typeof ECONOMIC_CATEGORIES)[number];

export const ROLE_KINDS = ['CONTROLLER', 'RIGHTS_HOLDER', 'CUSTODIAN', 'OPERATOR', 'SUBJECT'] as const;
export type RoleKind = (typeof ROLE_KINDS)[number];

export type ClassPolicyControls = {
  readonly settlementAuthorizedByRegistration: false;
  readonly mintAuthorizedByRegistration: false;
  readonly automaticValuation: false;
  readonly storesRawDataset: false;
  readonly productionEnabledByDefault: false;
};

export const DEFAULT_CLASS_POLICY: ClassPolicyControls = Object.freeze({
  settlementAuthorizedByRegistration: false,
  mintAuthorizedByRegistration: false,
  automaticValuation: false,
  storesRawDataset: false,
  productionEnabledByDefault: false,
});

export type EconomicAssetClassRecord = {
  readonly assetClass: EconomicAssetClass;
  readonly taxonomyVersion: typeof ECONOMIC_ASSET_TAXONOMY_VERSION;
  readonly policy: ClassPolicyControls;
  readonly typicalDomain: EconomicAssetDomain;
  readonly typicalStorage: StorageClass;
  readonly nativeMonetaryAsset: false;
};

function classRecord(assetClass: EconomicAssetClass, typicalDomain: EconomicAssetDomain, typicalStorage: StorageClass): EconomicAssetClassRecord {
  return Object.freeze({
    assetClass,
    taxonomyVersion: ECONOMIC_ASSET_TAXONOMY_VERSION,
    policy: DEFAULT_CLASS_POLICY,
    typicalDomain,
    typicalStorage,
    nativeMonetaryAsset: false,
  });
}

export const ECONOMIC_ASSET_CLASS_RECORDS: Readonly<Record<EconomicAssetClass, EconomicAssetClassRecord>> = Object.freeze({
  DATASET: classRecord('DATASET', 'SHARED_REFERENCE', 'OFF_CHAIN_RESTRICTED'),
  INFORMATION_ASSET: classRecord('INFORMATION_ASSET', 'HUMAN_ECONOMY', 'OFF_CHAIN_PROTECTED'),
  INFORMATION_RIGHT: classRecord('INFORMATION_RIGHT', 'HUMAN_ECONOMY', 'ON_CHAIN_PUBLIC_METADATA'),
  HUMAN_CONTRIBUTION_EVIDENCE: classRecord('HUMAN_CONTRIBUTION_EVIDENCE', 'HUMAN_ECONOMY', 'OFF_CHAIN_PROTECTED'),
  HUMAN_CONTRIBUTION_RECORD: classRecord('HUMAN_CONTRIBUTION_RECORD', 'HUMAN_ECONOMY', 'ON_CHAIN_COMMITMENT_ONLY'),
  REFERENCE_DATASET: classRecord('REFERENCE_DATASET', 'SHARED_REFERENCE', 'OFF_CHAIN_PUBLIC_REFERENCE'),
  ORACLE_SOURCE_DATASET: classRecord('ORACLE_SOURCE_DATASET', 'SHARED_REFERENCE', 'OFF_CHAIN_RESTRICTED'),
  ORACLE_OBSERVATION_SET: classRecord('ORACLE_OBSERVATION_SET', 'SHARED_REFERENCE', 'ON_CHAIN_COMMITMENT_ONLY'),
  VERIFIED_ECONOMIC_FACT: classRecord('VERIFIED_ECONOMIC_FACT', 'SHARED_REFERENCE', 'ON_CHAIN_PUBLIC_METADATA'),
  PRODUCTIVE_ECONOMIC_OBJECT: classRecord('PRODUCTIVE_ECONOMIC_OBJECT', 'PRODUCTIVE_ECONOMY', 'ON_CHAIN_PUBLIC_METADATA'),
  PRODUCTIVE_CLAIM: classRecord('PRODUCTIVE_CLAIM', 'PRODUCTIVE_ECONOMY', 'ON_CHAIN_COMMITMENT_ONLY'),
  VERIFIED_PRODUCTIVE_CONTRIBUTION: classRecord('VERIFIED_PRODUCTIVE_CONTRIBUTION', 'PRODUCTIVE_ECONOMY', 'ON_CHAIN_COMMITMENT_ONLY'),
  ECONOMIC_REFERENCE_DATA: classRecord('ECONOMIC_REFERENCE_DATA', 'SHARED_REFERENCE', 'OFF_CHAIN_PUBLIC_REFERENCE'),
  ECONOMIC_ATTESTATION: classRecord('ECONOMIC_ATTESTATION', 'SHARED_REFERENCE', 'ON_CHAIN_PUBLIC_METADATA'),
  OTHER_GOVERNED_ECONOMIC_ASSET: classRecord('OTHER_GOVERNED_ECONOMIC_ASSET', 'SHARED_REFERENCE', 'OFF_CHAIN_RESTRICTED'),
});

export type EconomicAssetTaxonomy = {
  readonly taxonomyId: typeof ECONOMIC_ASSET_TAXONOMY_ID;
  readonly schemaVersion: typeof ECONOMIC_ASSET_SCHEMA_VERSION;
  readonly taxonomyVersion: typeof ECONOMIC_ASSET_TAXONOMY_VERSION;
  readonly classes: readonly EconomicAssetClass[];
  readonly domains: readonly EconomicAssetDomain[];
  readonly sourceClasses: readonly SourceClass[];
  readonly storageClasses: readonly StorageClass[];
  readonly sensitivityClasses: readonly SensitivityClass[];
  readonly qualityClasses: readonly QualityClass[];
  readonly freshnessStates: readonly FreshnessState[];
  readonly lineageEdgeKinds: readonly LineageEdgeKind[];
  readonly economicCategories: readonly EconomicCategory[];
  readonly records: Readonly<Record<EconomicAssetClass, EconomicAssetClassRecord>>;
  readonly nativeMonetaryAssetsExcluded: true;
  readonly registrationDoesNotAuthorizeSettlement: true;
  readonly registrationDoesNotAuthorizeMint: true;
  readonly productionActivated: false;
};

export const ECONOMIC_ASSET_TAXONOMY: EconomicAssetTaxonomy = Object.freeze({
  taxonomyId: ECONOMIC_ASSET_TAXONOMY_ID,
  schemaVersion: ECONOMIC_ASSET_SCHEMA_VERSION,
  taxonomyVersion: ECONOMIC_ASSET_TAXONOMY_VERSION,
  classes: ECONOMIC_ASSET_CLASSES,
  domains: ECONOMIC_ASSET_DOMAINS,
  sourceClasses: SOURCE_CLASSES,
  storageClasses: STORAGE_CLASSES,
  sensitivityClasses: SENSITIVITY_CLASSES,
  qualityClasses: QUALITY_CLASSES,
  freshnessStates: FRESHNESS_STATES,
  lineageEdgeKinds: LINEAGE_EDGE_KINDS,
  economicCategories: ECONOMIC_CATEGORIES,
  records: ECONOMIC_ASSET_CLASS_RECORDS,
  nativeMonetaryAssetsExcluded: true,
  registrationDoesNotAuthorizeSettlement: true,
  registrationDoesNotAuthorizeMint: true,
  productionActivated: false,
});

export const PROTECTED_CONTENT_SENSITIVITY: readonly SensitivityClass[] = [
  'PERSONAL',
  'SENSITIVE_PERSONAL',
  'SECRET_REFERENCE_ONLY',
];

export const INDUSTRIAL_RESTRICTED_SENSITIVITY: readonly SensitivityClass[] = [
  'RESTRICTED_COMMERCIAL',
  'RESTRICTED_INDUSTRIAL',
  'REGULATED',
];

export const FORBIDDEN_SCORE_FIELDS = [
  'humanWorthScore',
  'human_worth_score',
  'socialCreditScore',
  'automaticValue',
  'automaticSunReyQuantity',
  'automaticMoonReyQuantity',
  'sunReyQuantity',
  'moonReyQuantity',
  'valuationAmount',
  'mintAmount',
  'issuanceQuantity',
  'tokenQuantity',
  'yieldRate',
  'blendedReturn',
] as const;

export const FORBIDDEN_IDENTITY_FIELDS = [
  'legalName',
  'fullName',
  'email',
  'phone',
  'ssn',
  'passport',
  'dateOfBirth',
  'homeAddress',
  'rawDataset',
  'rawContent',
  'rawPdvContent',
  'rawTelemetry',
  'blob',
  'payload',
] as const;

export const REGISTRY_NOT_BLOB_STORE =
  'The Economic Asset Registry stores metadata, rights references, provenance, lineage, and commitments. It is not a blob store and does not require raw datasets.';

export const REGISTRY_NOT_MONETARY_SUPPLY =
  'SunRey Coin and MoonRey Coin native supply records remain owned by the monetary constitution. They are not economic-asset descriptors.';

export const REGISTRY_NOT_VALUATION =
  'A registry entry may list permittedValuationMethodRefs. It does not compute an automatic value, SunRey quantity, or MoonRey quantity.';

export const REGISTRY_NOT_MINT =
  'Registry existence does not authorize settlement or minting. VERIFIED means registry metadata passed registry policy, not issuance eligibility.';

export const ROLES_ARE_NOT_OWNERSHIP =
  'Controller, rights holder, custodian, operator, and subject are distinct roles. None is legal ownership unless an explicit rights record establishes it.';

export function isEconomicAssetClass(value: string): value is EconomicAssetClass {
  return (ECONOMIC_ASSET_CLASSES as readonly string[]).includes(value);
}

export function isNativeMonetaryAssetClass(value: string): value is NativeMonetaryAssetClass {
  return (NATIVE_MONETARY_ASSET_CLASSES as readonly string[]).includes(value);
}

export function isSourceClass(value: string): value is SourceClass {
  return (SOURCE_CLASSES as readonly string[]).includes(value);
}

export function isEconomicCategory(value: string): value is EconomicCategory {
  return (ECONOMIC_CATEGORIES as readonly string[]).includes(value);
}

export function defaultStorageForSensitivity(sensitivity: SensitivityClass): StorageClass {
  if (sensitivity === 'PUBLIC') {
    return 'OFF_CHAIN_PUBLIC_REFERENCE';
  }
  if ((PROTECTED_CONTENT_SENSITIVITY as readonly string[]).includes(sensitivity)) {
    return 'OFF_CHAIN_PROTECTED';
  }
  if ((INDUSTRIAL_RESTRICTED_SENSITIVITY as readonly string[]).includes(sensitivity)) {
    return 'OFF_CHAIN_RESTRICTED';
  }
  return 'OFF_CHAIN_RESTRICTED';
}

export function storageAllowsPublicOnChainMetadata(sensitivity: SensitivityClass): boolean {
  return sensitivity === 'PUBLIC' || sensitivity === 'INTERNAL';
}
