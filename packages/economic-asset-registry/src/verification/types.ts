import type { UtcInstant } from '../../../domain/src/time.ts';
import type {
  AssetId,
  ConsentRef,
  ContentCommitment,
  LicenseRef,
  PurposeRef,
  RightsPolicyRef,
  UsageRestrictionRef,
  VerificationDecisionId,
  VerificationPolicyId,
  VerificationPolicyVersion,
} from '../ids.ts';
import type {
  ConfidenceClass,
  EconomicAssetClass,
  EconomicAssetDomain,
  FreshnessState,
  QualityClass,
  SensitivityClass,
  SourceClass,
  StorageClass,
} from '../taxonomy.ts';
import type { EconomicAssetDescriptor, LineageEdge } from '../types.ts';
import type { EconomicAssetVerificationCode } from './rejections.ts';

export const ECONOMIC_ASSET_VERIFICATION_SCHEMA_VERSION = 1 as const;

export type EconomicAssetVerificationOutcome = 'VERIFIED' | 'REJECTED' | 'REQUIRES_ADDITIONAL_EVIDENCE';

export type VerificationPolicyState = 'DEVELOPMENT' | 'SIMULATION' | 'PRODUCTION_CANDIDATE' | 'SUPERSEDED';

export type RightsModel = 'HUMAN_INFORMATION' | 'INDUSTRIAL_COMMERCIAL';

export type AssetClassVerificationRule = {
  readonly enabled: boolean;
  readonly failClosed: boolean;
  readonly rightsModel: RightsModel;
  readonly requiredSourceClasses: readonly SourceClass[];
  readonly forbiddenSourceClasses: readonly SourceClass[];
  readonly requiredDomains: readonly EconomicAssetDomain[];
  readonly requireController: boolean;
  readonly requireSubject: boolean;
  readonly requireControllerSubjectSeparation: boolean;
  readonly requireOperator: boolean;
  readonly requireRightsPolicy: boolean;
  readonly requireConsent: boolean;
  readonly requirePurpose: boolean;
  readonly requireLicense: boolean;
  readonly requireUsageRestriction: boolean;
  readonly requireRetention: boolean;
  readonly requireSourceOrganization: boolean;
  readonly requireSchema: boolean;
  readonly requireProvenance: boolean;
  readonly requireContentCommitment: boolean;
  readonly requireObservedAt: boolean;
  readonly requireValidityPeriod: boolean;
  readonly requireLineage: boolean;
  readonly requireCanonicalSource: boolean;
  readonly requireContributionFingerprint: boolean;
  readonly requireVerifiedContributionClaim: boolean;
  readonly requireOracleFactLineage: boolean;
  readonly requireProductiveCategory: boolean;
  readonly requireMeasurementPeriod: boolean;
  readonly requireAttestingSource: boolean;
  readonly allowedStorage: readonly StorageClass[] | null;
  readonly minimumQuality: readonly QualityClass[] | null;
  readonly minimumConfidence: readonly ConfidenceClass[] | null;
  readonly requireCurrentFreshness: boolean;
};

export type StorageSensitivityRule = {
  readonly sensitivity: SensitivityClass;
  readonly allowedStorage: readonly StorageClass[];
};

export type EconomicAssetVerificationPolicy = {
  readonly policyId: VerificationPolicyId;
  readonly policyVersion: VerificationPolicyVersion;
  readonly schemaVersion: typeof ECONOMIC_ASSET_VERIFICATION_SCHEMA_VERSION;
  readonly state: VerificationPolicyState;
  readonly assetClassRules: Readonly<Partial<Record<EconomicAssetClass, AssetClassVerificationRule>>>;
  readonly sourceClassRules: Readonly<
    Partial<
      Record<
        SourceClass,
        {
          readonly permittedAssetClasses: readonly EconomicAssetClass[];
          readonly forbiddenStorageForSensitive: readonly StorageClass[];
        }
      >
    >
  >;
  readonly rightsRequirements: {
    readonly rolesAreNotOwnership: true;
    readonly legalOwnershipRequiresExplicitRef: true;
  };
  readonly provenanceRequirements: {
    readonly requireCanonicalSource: true;
    readonly rejectConflictingCombinations: true;
  };
  readonly lineageRequirements: {
    readonly rejectCycles: true;
    readonly rejectFabricatedVerifiedBy: true;
    readonly rejectSettledFromWithoutSettlement: true;
    readonly doNotInferCausalityFromTime: true;
  };
  readonly storageRequirements: readonly StorageSensitivityRule[];
  readonly sensitivityRequirements: {
    readonly noSensitivePayloadOnChain: true;
    readonly secretReferenceNeverExposesPayload: true;
  };
  readonly freshnessRequirements: {
    readonly staleReferenceRequiresAdditionalEvidence: true;
  };
  readonly confidenceRequirements: {
    readonly unscoredInsufficientForReferenceData: true;
  };
  readonly jurisdictionRequirements: {
    readonly mustResolve: true;
    readonly allowedCodedJurisdictions: readonly string[];
  };
  readonly chainAnchorRequirements: {
    readonly finalizedRequiresSimulationMetadata: true;
    readonly unanchoredForbidsFinalizedClaims: true;
    readonly protectedRawDataMayNotAnchor: true;
    readonly protectedCommitmentsMayAnchor: true;
  };
  readonly retentionRequirements: {
    readonly personalSourceDataRequiresRetention: true;
    readonly chainHistoryIsNotDeleted: true;
  };
  readonly effectiveFrom: UtcInstant;
  readonly effectiveUntil: UtcInstant | null;
  readonly governanceReference: string;
  readonly productionActivated: false;
};

export type EconomicAssetVerificationDecision = {
  readonly decisionId: VerificationDecisionId;
  readonly assetId: AssetId;
  readonly assetClass: EconomicAssetClass;
  readonly verificationPolicyId: VerificationPolicyId;
  readonly verificationPolicyVersion: VerificationPolicyVersion;
  readonly decision: EconomicAssetVerificationOutcome;
  readonly evaluatedEvidenceRefs: readonly ContentCommitment[];
  readonly evaluatedRightsRefs: readonly (RightsPolicyRef | ConsentRef | PurposeRef | LicenseRef | UsageRestrictionRef)[];
  readonly evaluatedProvenanceRefs: readonly string[];
  readonly evaluatedLineageRefs: readonly LineageEdge[];
  readonly qualityClass: QualityClass;
  readonly confidenceClass: ConfidenceClass;
  readonly freshnessState: FreshnessState;
  readonly decisionCodes: readonly EconomicAssetVerificationCode[];
  readonly decisionDigest: string;
  readonly evaluatedAt: UtcInstant;
  readonly containsRawSensitiveData: false;
  readonly authorizesValuation: false;
  readonly authorizesSettlement: false;
  readonly authorizesSunReyIssuance: false;
  readonly authorizesMoonReyIssuance: false;
  readonly authorizesExecution: false;
};

export type EconomicAssetVerificationInput = {
  readonly descriptor: EconomicAssetDescriptor;
  readonly policy: EconomicAssetVerificationPolicy;
  readonly knownAssets: readonly EconomicAssetDescriptor[];
  readonly evaluatedAt: UtcInstant;
};
