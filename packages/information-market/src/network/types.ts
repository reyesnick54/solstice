import type { UtcInstant } from '../../../domain/src/time.ts';
import type {
  ApprovedComputationId,
  CleanRoomComputationRequestId,
  CleanRoomComputationResultId,
  HumanInformationAssetDescriptorId,
  HumanInformationCompensationInstructionId,
  HumanInformationConsentGrantId,
  HumanInformationIncidentId,
  HumanInformationOfferId,
  HumanInformationPermissionId,
  HumanInformationPurposeGrantId,
  HumanInformationRequestId,
  HumanInformationRevocationId,
  HumanInformationRightId,
  HumanInformationRightsAuditId,
  HumanInformationSubjectId,
  HumanInformationTransactionId,
  HumanInformationUsageReceiptId,
  InformationConnectorId,
} from './ids.ts';
import type { HumanInformationNetworkPolicy } from './policy.ts';
import type {
  DeveloperInformationScope,
  IncidentKind,
  InformationCategory,
  InformationRightType,
  InformationSensitivityClass,
  MobileEventKind,
  NetworkCompensationAsset,
  OutputClass,
  ProcessingClass,
  RawExportPolicy,
  SourceClass,
} from './taxonomy.ts';

export type NetworkFailure = {
  readonly code: string;
  readonly message: string;
};

export type HumanInformationSubject = {
  readonly subjectId: HumanInformationSubjectId;
  readonly internalRef: string;
  readonly publicHandle: string;
  readonly legalNameExposed: false;
  readonly rawIdentityExposed: false;
  readonly createdAt: UtcInstant;
};

export type QualityMetadata = {
  readonly freshness: string;
  readonly completeness: 'COMPLETE' | 'PARTIAL';
  readonly verification: 'SIMULATED' | 'ATTESTED' | 'UNVERIFIED';
  readonly provenanceConfidence: 'HIGH' | 'MEDIUM' | 'LOW';
  readonly isHumanSocialRanking: false;
};

export type HumanInformationAssetDescriptor = {
  readonly descriptorId: HumanInformationAssetDescriptorId;
  readonly subjectId: HumanInformationSubjectId;
  readonly category: InformationCategory;
  readonly schema: string;
  readonly sourceClass: SourceClass;
  readonly freshness: string;
  readonly quality: QualityMetadata;
  readonly sensitivityClass: InformationSensitivityClass;
  readonly permittedComputationClasses: readonly ProcessingClass[];
  readonly rawContentIncluded: false;
};

export type HumanInformationRight = {
  readonly rightId: HumanInformationRightId;
  readonly subjectId: HumanInformationSubjectId;
  readonly descriptorId: HumanInformationAssetDescriptorId;
  readonly rightType: InformationRightType;
  readonly purpose: string;
  readonly processingClass: ProcessingClass;
  readonly outputClass: OutputClass;
  readonly ownershipTransferred: false;
  readonly status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  readonly consentGrantId: HumanInformationConsentGrantId;
  readonly purposeGrantId: HumanInformationPurposeGrantId;
  readonly policyVersion: string;
  readonly expiresAt: UtcInstant;
  readonly createdAt: UtcInstant;
};

export type HumanInformationPermission = {
  readonly permissionId: HumanInformationPermissionId;
  readonly rightId: HumanInformationRightId;
  readonly subjectId: HumanInformationSubjectId;
  readonly requesterId: string;
  readonly purpose: string;
  readonly processingClass: ProcessingClass;
  readonly expiresAt: UtcInstant;
  readonly status: 'ACTIVE' | 'REVOKED';
};

export type HumanInformationConsentGrant = {
  readonly grantId: HumanInformationConsentGrantId;
  readonly subjectId: HumanInformationSubjectId;
  readonly descriptorId: HumanInformationAssetDescriptorId;
  readonly recipientClass: string;
  readonly requesterId: string;
  readonly purpose: string;
  readonly processingClass: ProcessingClass;
  readonly expiresAt: UtcInstant;
  readonly revocationTerms: string;
  readonly compensationTerms: string | null;
  readonly policyVersion: string;
  readonly consentHash: string;
  readonly canonicalConsentRef: string | null;
  readonly ownershipTransferred: false;
  readonly status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  readonly createdAt: UtcInstant;
};

export type HumanInformationPurposeGrant = {
  readonly purposeGrantId: HumanInformationPurposeGrantId;
  readonly grantId: HumanInformationConsentGrantId;
  readonly purpose: string;
  readonly anyFuturePurpose: false;
  readonly status: 'ACTIVE' | 'REVOKED';
};

export type HumanInformationOffer = {
  readonly offerId: HumanInformationOfferId;
  readonly subjectId: HumanInformationSubjectId;
  readonly rightType: InformationRightType;
  readonly purposeClasses: readonly string[];
  readonly requesterClasses: readonly string[];
  readonly compensationRequired: boolean;
  readonly validFrom: UtcInstant;
  readonly validUntil: UtcInstant;
  readonly privacyRequirements: readonly string[];
};

export type HumanInformationRequest = {
  readonly requestId: HumanInformationRequestId;
  readonly requesterId: string;
  readonly requesterOrganization: string;
  readonly requestedRight: InformationRightType;
  readonly purpose: string;
  readonly computationId: ApprovedComputationId | null;
  readonly duration: string;
  readonly compensationAsset: NetworkCompensationAsset;
  readonly compensationMinor: bigint;
  readonly jurisdiction: string;
  readonly evidenceRequirements: readonly string[];
  readonly status: 'SUBMITTED' | 'ELIGIBLE' | 'DENIED' | 'CONSENTED' | 'REVOKED';
  readonly createdAt: UtcInstant;
};

export type HumanInformationTransaction = {
  readonly transactionId: HumanInformationTransactionId;
  readonly requestId: HumanInformationRequestId;
  readonly rightId: HumanInformationRightId | null;
  readonly kind: 'PERMISSION_ACTIVATION' | 'CLEAN_ROOM_AUTHORIZATION' | 'COMPENSATION_AUTHORIZATION' | 'USAGE_RECEIPT';
  readonly settlementRef: string | null;
  readonly createdAt: UtcInstant;
  readonly rawPdvDelivered: false;
};

export type CleanRoomComputationPolicy = {
  readonly policyVersion: string;
  readonly approvedComputationId: ApprovedComputationId;
  readonly computationHash: string;
  readonly artifactDigest: string;
  readonly inputRightDescriptors: readonly string[];
  readonly privacyPolicyVersion: string;
  readonly outputPolicy: string;
  readonly minCohortSize: number;
  readonly rawExportPolicy: RawExportPolicy;
  readonly differentialPrivacyClaimed: false;
};

export type CleanRoomComputationRequest = {
  readonly computationRequestId: CleanRoomComputationRequestId;
  readonly requesterId: string;
  readonly purpose: string;
  readonly inputRightIds: readonly HumanInformationRightId[];
  readonly approvedComputationId: ApprovedComputationId;
  readonly outputClass: OutputClass;
  readonly privacyPolicyVersion: string;
  readonly expiresAt: UtcInstant;
  readonly compensationInstructionId: HumanInformationCompensationInstructionId | null;
  readonly jurisdiction: string;
  readonly evidenceDigest: string;
  readonly policy: CleanRoomComputationPolicy;
  readonly status: 'AUTHORIZED' | 'DENIED' | 'COMPLETED';
};

export type CleanRoomComputationResult = {
  readonly resultId: CleanRoomComputationResultId;
  readonly computationRequestId: CleanRoomComputationRequestId;
  readonly outputClass: OutputClass;
  readonly privacySafeValue: string | number | boolean;
  readonly purpose: string;
  readonly describesPersonWorth: false;
  readonly rawRows: false;
  readonly cohortSize: number;
  readonly createdAt: UtcInstant;
};

export type HumanInformationUsageReceipt = {
  readonly receiptId: HumanInformationUsageReceiptId;
  readonly rightId: HumanInformationRightId;
  readonly requesterId: string;
  readonly purpose: string;
  readonly computationId: ApprovedComputationId;
  readonly policyVersion: string;
  readonly outputClass: OutputClass;
  readonly settlementRef: string | null;
  readonly occurredAt: UtcInstant;
  readonly chainHeight: bigint | null;
  readonly evidenceDigest: string;
  readonly rawPersonalData: false;
};

export type HumanInformationCompensationInstruction = {
  readonly instructionId: HumanInformationCompensationInstructionId;
  readonly subjectId: HumanInformationSubjectId;
  readonly requesterId: string;
  readonly asset: NetworkCompensationAsset;
  readonly amountMinor: bigint;
  readonly mintRequested: false;
  readonly unrestrictedIssuance: false;
  readonly monetaryAuthority: 'CHUNK_71_MONETARY_CONSTITUTION';
  readonly status: 'AUTHORIZED' | 'SETTLED' | 'DENIED';
  readonly settlementRef: string | null;
};

export type HumanInformationRevocation = {
  readonly revocationId: HumanInformationRevocationId;
  readonly grantId: HumanInformationConsentGrantId;
  readonly rightId: HumanInformationRightId;
  readonly subjectId: HumanInformationSubjectId;
  readonly revokedAt: UtcInstant;
  readonly futureUseBlocked: true;
  readonly historicalSettlementErased: false;
};

export type HumanInformationRightsAudit = {
  readonly auditId: HumanInformationRightsAuditId;
  readonly generatedAt: UtcInstant;
  readonly activeRights: number;
  readonly consents: number;
  readonly purposes: number;
  readonly uses: number;
  readonly revocations: number;
  readonly compensationInstructions: number;
  readonly cleanRoomResults: number;
  readonly onChainAnchors: number;
  readonly reconciled: boolean;
};

export type HumanInformationNetworkReport = {
  readonly chunk: 'CHUNK-100';
  readonly syntheticData: true;
  readonly rawPersonalDataExported: false;
  readonly productionActivated: false;
  readonly humanWorthScore: false;
  readonly socialCredit: false;
  readonly policy: HumanInformationNetworkPolicy;
  readonly legalStatus: typeof import('./taxonomy.ts').NETWORK_LEGAL_STATUS;
};

export type NetworkRequester = {
  readonly requesterId: string;
  readonly organization: string;
  readonly applicationId: string | null;
  readonly accountable: true;
  readonly requesterClass: string;
  readonly jurisdiction: string;
};

export type ApprovedComputation = {
  readonly computationId: ApprovedComputationId;
  readonly codeVersion: string;
  readonly queryDefinition: string;
  readonly artifactDigest: string;
  readonly allowedOutputClasses: readonly OutputClass[];
  readonly allowListed: true;
};

export type InformationConnector = {
  readonly connectorId: InformationConnectorId;
  readonly schema: string;
  readonly dataClasses: readonly InformationCategory[];
  readonly collectionAuthority: string;
  readonly subjectMapping: string;
  readonly freshness: string;
  readonly revocationImplications: string;
  readonly privacyClassification: InformationSensitivityClass;
  readonly scraping: false;
  readonly authorizedSourceRelationship: true;
};

export type InformationProvenance = {
  readonly source: string;
  readonly subjectRelationship: string;
  readonly collectionAuthority: string;
  readonly timestamp: UtcInstant;
  readonly transforms: readonly string[];
  readonly attestations: readonly string[];
};

export type DeveloperAccessContext = {
  readonly credentialId: string;
  readonly applicationApproved: boolean;
  readonly scopes: readonly (DeveloperInformationScope | 'CHAIN_READ' | string)[];
  readonly purpose: string;
  readonly consentPresent: boolean;
  readonly privacyPolicyAccepted: boolean;
  readonly eligibilitySatisfied: boolean;
};

export type AgentMandateContext = {
  readonly mandateId: string;
  readonly explicitHumanInformationMandate: boolean;
  readonly genericFinancialAgent: boolean;
};

export type MobileNotification = {
  readonly kind: MobileEventKind;
  readonly subjectHandle: string;
  readonly category: InformationCategory | null;
  readonly requesterClass: string | null;
  readonly purpose: string | null;
  readonly rawPayload: false;
  readonly legalName: false;
};

/**
 * Weak HIN-local evidence projection retained for Chunk 100 audit
 * counts. Canonical chain-bound records live in
 * `HumanInformationChainAnchorRecord` at `./chain-anchor`.
 */
export type OnChainAnchor = {
  readonly permissionId: string | null;
  readonly consentHash: string | null;
  readonly purposeHash: string | null;
  readonly rightState: string | null;
  readonly usageReceiptHash: string | null;
  readonly settlementRef: string | null;
  readonly revocationRef: string | null;
  readonly rawSensitivePersonalInformation: false;
};

export type PrivacyIncident = {
  readonly incidentId: HumanInformationIncidentId;
  readonly kind: IncidentKind;
  readonly openedAt: UtcInstant;
  readonly status: 'OPEN' | 'CONTAINED';
};

export type ConsentPreview = {
  readonly who: string;
  readonly category: InformationCategory;
  readonly purpose: string;
  readonly computation: string;
  readonly output: OutputClass;
  readonly duration: string;
  readonly frequency: string;
  readonly compensation: string;
  readonly revocationTerms: string;
};

export type ControlCenterProjection = {
  readonly subjectHandle: string;
  readonly categories: readonly InformationCategory[];
  readonly activePermissions: readonly HumanInformationPermission[];
  readonly requesters: readonly string[];
  readonly purposes: readonly string[];
  readonly compensation: readonly HumanInformationCompensationInstruction[];
  readonly usageHistory: readonly HumanInformationUsageReceipt[];
  readonly revocations: readonly HumanInformationRevocation[];
  readonly pendingRequests: readonly HumanInformationRequest[];
};

export type RequesterPortalProjection = {
  readonly requesterId: string;
  readonly requests: readonly HumanInformationRequest[];
  readonly eligibility: readonly {
    readonly requestId: string;
    readonly eligible: boolean;
    readonly reason: string;
  }[];
  readonly compensation: readonly HumanInformationCompensationInstruction[];
  readonly cleanRoomJobs: readonly CleanRoomComputationRequest[];
  readonly results: readonly CleanRoomComputationResult[];
  readonly usageReceipts: readonly HumanInformationUsageReceipt[];
};
