import type { Money } from '../../../money/src/money.ts';
import type { AssetQuantity } from '../../../money/src/asset-quantity.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import type {
  CompensationPolicyId,
  CompensationAllocationId,
  DataProductId,
  InformationLicenseId,
  InformationRightId,
  LicenseRequestId,
  LicenseSettlementId,
  LicenseeCredentialId,
  PricingPolicyId,
  UsageEventId,
} from './ids.ts';
import type {
  AccessKind,
  AccessMode,
  CompensationRecipientClass,
  DataProductForm,
  InformationRightStatus,
  LicensePurpose,
  LicenseStatus,
  Licenseability,
  MarketplaceCompensationAsset,
  ParticipationStatus,
  PricingModel,
  Transferability,
} from './taxonomy.ts';

export type RightsMarketplaceFailure = {
  readonly code: string;
  readonly message: string;
};

export type InformationRight = {
  readonly rightId: InformationRightId;
  readonly rightsHolder: string;
  readonly underlyingCategory: string;
  readonly underlyingProductId: DataProductId | null;
  readonly scope: string;
  readonly eligiblePurposes: readonly LicensePurpose[];
  readonly prohibitedPurposes: readonly LicensePurpose[];
  readonly transferability: Transferability;
  readonly licenseability: Licenseability;
  readonly jurisdiction: string;
  readonly privacyRequirements: readonly string[];
  readonly consentDependency: string;
  readonly status: InformationRightStatus;
  readonly termsVersion: string;
  readonly ownershipTransferred: false;
  readonly usageRightOnly: true;
  readonly createdAt: UtcInstant;
};

export type DataProduct = {
  readonly productId: DataProductId;
  readonly form: DataProductForm;
  readonly displayName: string;
  readonly rightIds: readonly InformationRightId[];
  readonly classification: string;
  readonly eligiblePurposes: readonly LicensePurpose[];
  readonly prohibitedPurposes: readonly LicensePurpose[];
  readonly sensitiveCategory: boolean;
  readonly minimumAggregationThreshold: number;
  readonly jurisdiction: string;
  readonly retentionDays: number;
  readonly licensingEligible: boolean;
  readonly privacyPolicyVersion: string;
  readonly accessMode: AccessMode;
  readonly rawDatabaseAccess: false;
  readonly differentialPrivacyClaimed: false;
  readonly status: 'ELIGIBLE' | 'INELIGIBLE' | 'RETIRED';
  readonly createdAt: UtcInstant;
};

export type LicenseCompensationTerms = {
  readonly asset: MarketplaceCompensationAsset;
  readonly fiat?: Money;
  readonly coin?: AssetQuantity;
  readonly pricingPolicyId: PricingPolicyId;
  readonly compensationPolicyId: CompensationPolicyId;
};

export type LicenseRevocationRules = {
  readonly consentRevocationStopsFutureAccess: true;
  readonly historicalLawfulUsageRetained: true;
  readonly dataDeletionIfApplicable: boolean;
  readonly remainingObligations: string;
};

export type InformationLicense = {
  readonly licenseId: InformationLicenseId;
  readonly requestId: LicenseRequestId;
  readonly licenseeId: string;
  readonly productId: DataProductId;
  readonly purpose: LicensePurpose;
  readonly scope: string;
  readonly durationDays: number;
  readonly queryLimit: number;
  readonly downloadLimit: number;
  readonly redistribution: 'PROHIBITED';
  readonly retentionDays: number;
  readonly compensation: LicenseCompensationTerms;
  readonly revocationRules: LicenseRevocationRules;
  readonly termsVersion: string;
  readonly status: LicenseStatus;
  readonly activatedAt: UtcInstant | null;
  readonly expiresAt: UtcInstant | null;
  readonly revokedAt: UtcInstant | null;
  readonly createdAt: UtcInstant;
};

export type LicenseRequest = {
  readonly requestId: LicenseRequestId;
  readonly licenseeId: string;
  readonly productId: DataProductId;
  readonly purpose: LicensePurpose;
  readonly scope: string;
  readonly durationDays: number;
  readonly queryLimit: number;
  readonly downloadLimit: number;
  readonly jurisdiction: string;
  readonly consentRef: string | null;
  readonly status:
    | 'SUBMITTED'
    | 'ELIGIBILITY_FAILED'
    | 'AWAITING_CONSENT'
    | 'AWAITING_APPROVAL'
    | 'AWAITING_PAYMENT'
    | 'APPROVED'
    | 'DENIED';
  readonly createdAt: UtcInstant;
};

export type CompensationShare = {
  readonly recipientClass: CompensationRecipientClass;
  readonly recipientRef: string;
  readonly basisPoints: number;
};

export type CompensationPolicy = {
  readonly policyId: CompensationPolicyId;
  readonly version: string;
  readonly shares: readonly CompensationShare[];
  readonly approvedEconomicPolicy: false;
  readonly simulationFixture: boolean;
  readonly productionAuthorized: false;
};

export type PricingPolicy = {
  readonly policyId: PricingPolicyId;
  readonly version: string;
  readonly model: PricingModel;
  readonly fixedFiat?: Money;
  readonly usageUnitFiat?: Money;
  readonly subscriptionFiat?: Money;
  readonly negotiatedFiat?: Money;
  readonly auctionEnabled: boolean;
  readonly llmInvented: boolean;
};

export type CompensationAllocation = {
  readonly allocationId: CompensationAllocationId;
  readonly settlementId: LicenseSettlementId;
  readonly licenseId: InformationLicenseId;
  readonly policyVersion: string;
  readonly recipientClass: CompensationRecipientClass;
  readonly recipientRef: string;
  readonly asset: MarketplaceCompensationAsset;
  readonly fiat?: Money;
  readonly coin?: AssetQuantity;
  readonly guaranteed: false;
};

export type LicenseSettlement = {
  readonly settlementId: LicenseSettlementId;
  readonly licenseId: InformationLicenseId;
  readonly usageId: UsageEventId;
  readonly policyVersion: string;
  readonly revenueFiat?: Money;
  readonly revenueCoin?: AssetQuantity;
  readonly allocations: readonly CompensationAllocation[];
  readonly journalId: string | null;
  readonly nativeTransferId: string | null;
  readonly evidenceRef: string;
  readonly createdAt: UtcInstant;
};

export type UsageEvent = {
  readonly usageId: UsageEventId;
  readonly licenseId: InformationLicenseId;
  readonly licenseeId: string;
  readonly productId: DataProductId;
  readonly accessKind: AccessKind;
  readonly purpose: LicensePurpose;
  readonly volume: number;
  readonly usageCount: number;
  readonly billingReference: string;
  readonly occurredAt: UtcInstant;
  readonly rawQueryOutput: false;
  readonly rawSensitivePayload: false;
};

export type LicenseeSecurity = {
  readonly credentialId: LicenseeCredentialId;
  readonly licenseeId: string;
  readonly clientIdentity: string;
  readonly apiCredentialRef: string;
  readonly rateLimitPerWindow: number;
  readonly purposeRestrictions: readonly LicensePurpose[];
  readonly auditEnabled: true;
  readonly killSwitch: boolean;
  readonly incidentSuspension: boolean;
  readonly secretMaterialIncluded: false;
};

export type ControlledAccessResult = {
  readonly licenseId: InformationLicenseId;
  readonly accessMode: AccessMode;
  readonly purpose: LicensePurpose;
  readonly outputClass: 'PRIVACY_SAFE' | 'DENIED';
  readonly payload: string | number | boolean | null;
  readonly rawDatabaseCredential: false;
  readonly rawRows: false;
};

export type RevocationRecord = {
  readonly licenseId: InformationLicenseId;
  readonly revokedAt: UtcInstant;
  readonly remainingObligations: string;
  readonly dataDeletionObligation: boolean;
  readonly historicalLawfulUsageRetained: true;
  readonly futureAccessStopped: true;
};

export type RightsMarketplaceStoreSnapshot = {
  readonly rights: readonly InformationRight[];
  readonly products: readonly DataProduct[];
  readonly licenses: readonly InformationLicense[];
  readonly requests: readonly LicenseRequest[];
  readonly policies: readonly CompensationPolicy[];
  readonly pricing: readonly PricingPolicy[];
  readonly usage: readonly UsageEvent[];
  readonly settlements: readonly LicenseSettlement[];
  readonly credentials: readonly LicenseeSecurity[];
  readonly participation: readonly {
    readonly rightsHolder: string;
    readonly status: ParticipationStatus;
  }[];
  readonly replayKeys: readonly string[];
};
