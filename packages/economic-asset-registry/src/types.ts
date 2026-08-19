import type { UtcInstant } from '../../domain/src/time.ts';
import type {
  AssetId,
  BlockId,
  CanonicalOwnerRef,
  CanonicalSourceRef,
  ChainId,
  ConsentRef,
  ContentCommitment,
  ControllerRef,
  CustodianRef,
  DeletionPolicyRef,
  LegalOwnershipRightsRef,
  LicenseRef,
  LineageRoot,
  NetworkId,
  OperatorRef,
  ProvenanceDigest,
  PurposeRef,
  RetentionPolicyRef,
  RightsHolderRef,
  RightsPolicyRef,
  SchemaId,
  SourceOrganizationRef,
  StateRootRef,
  SubjectRef,
  TransactionId,
  UsageRestrictionRef,
  ValuationMethodRef,
} from './ids.ts';
import {
  ECONOMIC_ASSET_SCHEMA_VERSION,
  type AssetLifecycleState,
  type ChainAnchorType,
  type ConfidenceClass,
  type EconomicAssetClass,
  type EconomicAssetDomain,
  type EconomicCategory,
  type FinalityState,
  type FreshnessState,
  type LineageEdgeKind,
  type QualityClass,
  type RightsConcept,
  type SensitivityClass,
  type SourceClass,
  type StorageClass,
} from './taxonomy.ts';

export type RegistryFailure = {
  readonly code: RegistryFailureCode;
  readonly message: string;
};

export type RegistryFailureCode =
  | 'RAW_SENSITIVE_DATA_FORBIDDEN'
  | 'BLOB_STORE_FORBIDDEN'
  | 'NATIVE_MONETARY_ASSET_FORBIDDEN'
  | 'AUTOMATIC_VALUATION_FORBIDDEN'
  | 'MINT_AUTHORITY_FORBIDDEN'
  | 'SETTLEMENT_AUTHORITY_FORBIDDEN'
  | 'LEGAL_OWNERSHIP_INFERRED'
  | 'INVALID_ASSET_CLASS'
  | 'INVALID_SOURCE_CLASS'
  | 'INVALID_STORAGE_CLASS'
  | 'INVALID_SENSITIVITY'
  | 'INVALID_LINEAGE'
  | 'LINEAGE_CYCLE'
  | 'ASSET_NOT_FOUND'
  | 'ALREADY_REGISTERED'
  | 'ALREADY_SUPERSEDED'
  | 'INVALID_LIFECYCLE'
  | 'CORRECTION_TARGET_REQUIRED'
  | 'FORBIDDEN_FIELD'
  | 'INVALID_JURISDICTION'
  | 'INVALID_TIMESTAMP'
  | 'PROTECTED_CONTENT_ON_CHAIN_FORBIDDEN';

export type AuthorityBoundaryFlags = {
  readonly authorizesFinancialExecution: false;
  readonly authorizesSunReyIssuance: false;
  readonly authorizesMoonReyIssuance: false;
  readonly authorizesSettlement: false;
  readonly issuesExecutionAuthority: false;
  readonly productionEnabled: false;
  readonly isNativeMonetarySupply: false;
};

export const AUTHORITY_BOUNDARY: AuthorityBoundaryFlags = Object.freeze({
  authorizesFinancialExecution: false,
  authorizesSunReyIssuance: false,
  authorizesMoonReyIssuance: false,
  authorizesSettlement: false,
  issuesExecutionAuthority: false,
  productionEnabled: false,
  isNativeMonetarySupply: false,
});

export type PrivacyBoundaryFlags = {
  readonly containRawSensitiveData: false;
  readonly isBlobStore: false;
  readonly isPersonalDataVault: false;
  readonly isHumanInformationNetwork: false;
  readonly isPersonalEconomicGraph: false;
  readonly isProductiveEngine: false;
  readonly isOracleConsensus: false;
  readonly isMonetarySupply: false;
  readonly automaticValuation: false;
  readonly humanWorthScore: false;
};

export const PRIVACY_BOUNDARY: PrivacyBoundaryFlags = Object.freeze({
  containRawSensitiveData: false,
  isBlobStore: false,
  isPersonalDataVault: false,
  isHumanInformationNetwork: false,
  isPersonalEconomicGraph: false,
  isProductiveEngine: false,
  isOracleConsensus: false,
  isMonetarySupply: false,
  automaticValuation: false,
  humanWorthScore: false,
});

export type RightsMetadata = {
  readonly rightsPolicyRef: RightsPolicyRef;
  readonly consentRefs: readonly ConsentRef[];
  readonly purposeRefs: readonly PurposeRef[];
  readonly licenseRefs: readonly LicenseRef[];
  readonly usageRestrictionRefs: readonly UsageRestrictionRef[];
  readonly concepts: readonly RightsConcept[];
};

export type RoleBindings = {
  readonly controllerRef: ControllerRef;
  readonly rightsHolderRefs: readonly RightsHolderRef[];
  readonly custodianRef: CustodianRef | null;
  readonly operatorRef: OperatorRef | null;
  readonly subjectRef: SubjectRef | null;
  readonly controllerIsLegalOwner: false;
  readonly subjectIsLegalOwner: false;
  readonly operatorIsLegalOwner: false;
  readonly legalOwnershipEstablished: boolean;
  readonly legalOwnershipRightsRef: LegalOwnershipRightsRef | null;
};

export type EconomicAssetChainAnchor = {
  readonly networkId: NetworkId;
  readonly chainId: ChainId;
  readonly transactionId: TransactionId | null;
  readonly blockHeight: bigint | null;
  readonly blockId: BlockId | null;
  readonly stateRootRef: StateRootRef | null;
  readonly contentCommitment: ContentCommitment;
  readonly anchorType: ChainAnchorType;
  readonly finalityState: FinalityState;
};

export type LineageEdge = {
  readonly kind: LineageEdgeKind;
  readonly fromAssetId: AssetId;
  readonly toAssetId: AssetId;
};

export type EconomicAssetDescriptor = {
  readonly schemaVersion: typeof ECONOMIC_ASSET_SCHEMA_VERSION;
  readonly assetId: AssetId;
  readonly assetClass: EconomicAssetClass;
  readonly domain: EconomicAssetDomain;
  readonly canonicalOwner: CanonicalOwnerRef;
  readonly canonicalOwnerSystem: string;
  readonly canonicalSourceRef: CanonicalSourceRef;
  readonly schemaId: SchemaId;
  readonly sourceSchemaVersion: string;
  readonly controllerRef: ControllerRef;
  readonly rightsHolderRefs: readonly RightsHolderRef[];
  readonly custodianRef: CustodianRef | null;
  readonly operatorRef: OperatorRef | null;
  readonly subjectRef: SubjectRef | null;
  readonly roles: RoleBindings;
  readonly sourceClass: SourceClass;
  readonly sourceSystem: string;
  readonly sourceOrganizationRef: SourceOrganizationRef | null;
  readonly jurisdiction: string;
  readonly geography: string | null;
  readonly rights: RightsMetadata;
  readonly rightsPolicyRef: RightsPolicyRef;
  readonly consentRefs: readonly ConsentRef[];
  readonly purposeRefs: readonly PurposeRef[];
  readonly licenseRefs: readonly LicenseRef[];
  readonly usageRestrictionRefs: readonly UsageRestrictionRef[];
  readonly sensitivityClass: SensitivityClass;
  readonly retentionPolicyRef: RetentionPolicyRef | null;
  readonly deletionPolicyRef: DeletionPolicyRef | null;
  readonly qualityClass: QualityClass;
  readonly confidenceClass: ConfidenceClass;
  readonly freshness: FreshnessState;
  readonly observedAt: UtcInstant | null;
  readonly validFrom: UtcInstant;
  readonly validUntil: UtcInstant | null;
  readonly economicCategory: EconomicCategory;
  readonly permittedValuationMethodRefs: readonly ValuationMethodRef[];
  readonly contentCommitment: ContentCommitment;
  readonly provenanceDigest: ProvenanceDigest;
  readonly lineageRoot: LineageRoot;
  readonly lineage: readonly LineageEdge[];
  readonly storageClass: StorageClass;
  readonly chainAnchor: EconomicAssetChainAnchor | null;
  readonly status: AssetLifecycleState;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
  readonly supersedes: AssetId | null;
  readonly supersededBy: AssetId | null;
  readonly corrects: AssetId | null;
  readonly correctedBy: AssetId | null;
  readonly privacyBoundary: PrivacyBoundaryFlags;
  readonly authorityBoundary: AuthorityBoundaryFlags;
  readonly automaticValue: null;
  readonly automaticSunReyQuantity: null;
  readonly automaticMoonReyQuantity: null;
  readonly issuanceEligible: false;
};

export type RegisterAssetInput = {
  readonly assetId?: AssetId;
  readonly assetClass: EconomicAssetClass;
  readonly domain: EconomicAssetDomain;
  readonly canonicalOwnerSystem: string;
  readonly canonicalSourceRef?: CanonicalSourceRef;
  readonly schemaId?: SchemaId;
  readonly sourceSchemaVersion?: string;
  readonly controllerRef?: ControllerRef;
  readonly rightsHolderRefs?: readonly RightsHolderRef[];
  readonly custodianRef?: CustodianRef | null;
  readonly operatorRef?: OperatorRef | null;
  readonly subjectRef?: SubjectRef | null;
  readonly sourceClass: SourceClass;
  readonly sourceSystem: string;
  readonly sourceOrganizationRef?: SourceOrganizationRef | null;
  readonly jurisdiction: string;
  readonly geography?: string | null;
  readonly rightsPolicyRef?: RightsPolicyRef;
  readonly consentRefs?: readonly ConsentRef[];
  readonly purposeRefs?: readonly PurposeRef[];
  readonly licenseRefs?: readonly LicenseRef[];
  readonly usageRestrictionRefs?: readonly UsageRestrictionRef[];
  readonly rightsConcepts?: readonly RightsConcept[];
  readonly sensitivityClass: SensitivityClass;
  readonly retentionPolicyRef?: RetentionPolicyRef | null;
  readonly deletionPolicyRef?: DeletionPolicyRef | null;
  readonly qualityClass: QualityClass;
  readonly confidenceClass?: ConfidenceClass;
  readonly freshness?: FreshnessState;
  readonly observedAt?: UtcInstant | null;
  readonly validFrom: UtcInstant;
  readonly validUntil?: UtcInstant | null;
  readonly economicCategory: EconomicCategory;
  readonly permittedValuationMethodRefs?: readonly ValuationMethodRef[];
  readonly contentCommitmentMaterial: string;
  readonly provenanceMaterial: string;
  readonly lineage?: readonly LineageEdge[];
  readonly storageClass?: StorageClass;
  readonly chainAnchor?: EconomicAssetChainAnchor | null;
  readonly status?: AssetLifecycleState;
  readonly createdAt: UtcInstant;
  readonly legalOwnershipRightsRef?: LegalOwnershipRightsRef | null;
  readonly supersedes?: AssetId | null;
  readonly corrects?: AssetId | null;
};

export type EconomicAssetQuery = {
  readonly assetId?: AssetId;
  readonly assetClass?: EconomicAssetClass;
  readonly domain?: EconomicAssetDomain;
  readonly canonicalOwner?: CanonicalOwnerRef;
  readonly controller?: ControllerRef;
  readonly jurisdiction?: string;
  readonly economicCategory?: EconomicCategory;
  readonly sensitivity?: SensitivityClass;
  readonly quality?: QualityClass;
  readonly freshness?: FreshnessState;
  readonly sourceClass?: SourceClass;
  readonly status?: AssetLifecycleState;
  readonly chainAnchor?: ContentCommitment;
  readonly lineageParent?: AssetId;
  readonly permittedValuationMethod?: ValuationMethodRef;
};

export type EconomicAssetRegistrySnapshot = {
  readonly descriptors: readonly EconomicAssetDescriptor[];
  readonly rawDataStored: false;
  readonly automaticValuation: false;
  readonly automaticSunReyMint: false;
  readonly automaticMoonReyMint: false;
  readonly isNativeMonetarySupply: false;
};

export type RegistryAudit = {
  readonly registered: number;
  readonly verified: number;
  readonly superseded: number;
  readonly corrected: number;
  readonly countsByClass: readonly { readonly assetClass: EconomicAssetClass; readonly count: number }[];
  readonly valuationTotals: null;
  readonly sunReyTotals: null;
  readonly moonReyTotals: null;
};

export type ExecutionRefusal = {
  readonly authorized: false;
  readonly issuesExecutionAuthority: false;
  readonly reason: 'ECONOMIC_ASSET_CANNOT_AUTHORIZE_EXECUTION';
  readonly assetId: AssetId;
};

export type MintRefusal = {
  readonly authorized: false;
  readonly sunReyQuantity: null;
  readonly moonReyQuantity: null;
  readonly reason: 'ECONOMIC_ASSET_CANNOT_AUTHORIZE_MINT';
  readonly assetId: AssetId;
};
