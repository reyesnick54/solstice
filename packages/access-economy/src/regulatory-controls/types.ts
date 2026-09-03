/**
 * ACCESS Wave 5 Prompt 40 — Regulatory control types.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import type {
  AccessAccountingEventType,
  AccessDisclosureStatus,
  AccessDisclosureType,
  AccessDisputeCategory,
  AccessEconomicClassification,
  AccessFundingSourceClassification,
  ForbiddenAccessEconomicClassification,
  AccessGlAccountRole,
  AccessJurisdictionPolicyDimension,
  AccessLiabilityRecognitionStage,
  AccessPaymentProviderState,
  AccessProviderContractState,
  AccessRefundState,
  AccessTaxComponentRole,
  AccessTreasuryExposureStatus,
  AccessTreasuryOperationalState,
} from './taxonomy.ts';

export type { AccessGlAccountRole, AccessTreasuryExposureStatus } from './taxonomy.ts';

export type AccessDisclosureId = string;
export type AccessDisclosureVersion = string;
export type AccessAccountingEventId = string;
export type AccessTreasuryPolicyId = string;

/** Branded quantity of Access units — not Money. */
export type AccessUnitQuantity = bigint & { readonly __brand: 'AccessUnitQuantity' };

/** Branded fiat minor units within an explicit coverage context. */
export type AccessCoverageMinorUnits = bigint & { readonly __brand: 'AccessCoverageMinorUnits' };

export type AccessEconomicPosture = {
  readonly classification: AccessEconomicClassification;
  readonly forbiddenClassifications: readonly ForbiddenAccessEconomicClassification[];
  readonly isNonCash: true;
  readonly isGuaranteedFiatRedemption: false;
  readonly isTokenRedemption: false;
};

export type AccessAccountingEvent = {
  readonly eventId: AccessAccountingEventId;
  readonly eventType: AccessAccountingEventType;
  readonly liabilityStage: AccessLiabilityRecognitionStage | null;
  readonly accessTransactionId: string | null;
  readonly fundingPoolId: string | null;
  readonly currency: string | null;
  readonly amountMinorUnits: bigint | null;
  readonly canonicalMoneyEventRef: string | null;
  readonly evidenceReference: string;
  readonly metadata: Readonly<Record<string, string>>;
  readonly createdAt: UtcInstant;
};

export type AccessGlMapping = {
  readonly mappingId: string;
  readonly accountRole: AccessGlAccountRole;
  readonly accountCodePlaceholder: string;
  readonly accountName: string;
  readonly debitOnEventTypes: readonly AccessAccountingEventType[];
  readonly creditOnEventTypes: readonly AccessAccountingEventType[];
  readonly notes: string;
  readonly effectiveFrom: UtcInstant;
  readonly status: 'DRAFT' | 'APPROVED_BY_ACCOUNTING';
};

export type AccessTreasuryExposure = {
  readonly category: string | null;
  readonly currency: string;
  readonly availableFunding: bigint;
  readonly reservedFunding: bigint;
  readonly capturedFunding: bigint;
  readonly pendingRefunds: bigint;
  readonly riskReserve: bigint;
  readonly refundReserve: bigint;
  readonly unsettledProviderExposure: bigint;
  readonly userCopayAuthorized: bigint;
  readonly userCopayReceivable: bigint;
  readonly providerDiscountCapacity: bigint;
  readonly maximumPotentialExposure: bigint;
  readonly status: AccessTreasuryExposureStatus;
  readonly calculatedAt: UtcInstant;
};

export type AccessTreasuryLimit = {
  readonly limitId: string;
  readonly dimension:
    | 'GLOBAL'
    | 'DAILY_SETTLEMENT'
    | 'CATEGORY'
    | 'GEOGRAPHY'
    | 'PROVIDER'
    | 'TRANSACTION'
    | 'UNSETTLED_EXPOSURE'
    | 'REFUND_RESERVE_MINIMUM'
    | 'MAX_OUTSTANDING_AUTHORIZATIONS';
  readonly scope: string | null;
  readonly currency: string;
  readonly maxMinorUnits: bigint | null;
  readonly minMinorUnits: bigint | null;
  readonly enabled: boolean;
};

export type AccessTreasuryPolicy = {
  readonly policyId: AccessTreasuryPolicyId;
  readonly name: string;
  readonly operationalState: AccessTreasuryOperationalState;
  readonly limits: readonly AccessTreasuryLimit[];
  readonly effectiveFrom: UtcInstant;
  readonly notes: string;
};

export type AccessDisclosure = {
  readonly disclosureId: AccessDisclosureId;
  readonly version: AccessDisclosureVersion;
  readonly disclosureType: AccessDisclosureType;
  readonly jurisdiction: string;
  readonly category: string | null;
  readonly effectiveFrom: UtcInstant;
  readonly requiredAcknowledgement: boolean;
  readonly displayContentReference: string;
  readonly status: AccessDisclosureStatus;
};

export type AccessDisclosureAcknowledgment = {
  readonly acknowledgmentId: string;
  readonly disclosureId: AccessDisclosureId;
  readonly version: AccessDisclosureVersion;
  readonly userId: string;
  readonly transactionId: string | null;
  readonly acknowledgedAt: UtcInstant;
};

export type AccessPriceComponents = {
  readonly basePriceMinorUnits: bigint;
  readonly taxMinorUnits: bigint;
  readonly mandatoryFeesMinorUnits: bigint;
  readonly optionalFeesMinorUnits: bigint;
  readonly depositMinorUnits: bigint;
  readonly accessCoverageMinorUnits: bigint;
  readonly userContributionMinorUnits: bigint;
  readonly accessServiceFeeMinorUnits: bigint;
  readonly providerTotalMinorUnits: bigint;
  readonly currency: string;
};

export type AccessRefundTransparency = {
  readonly refundId: string;
  readonly transactionId: string;
  readonly states: readonly {
    readonly state: AccessRefundState;
    readonly amountMinorUnits: bigint | null;
    readonly currency: string | null;
    readonly estimated: boolean;
    readonly updatedAt: UtcInstant;
  }[];
  readonly providerPenaltyMinorUnits: bigint | null;
  readonly estimatedUserRefundMinorUnits: bigint | null;
  readonly estimatedAccessRestorationMinorUnits: bigint | null;
};

export type AccessCancellationPreview = {
  readonly transactionId: string;
  readonly providerPenaltyMinorUnits: bigint | null;
  readonly estimatedRefundableMinorUnits: bigint | null;
  readonly estimatedAccessRestorationUnits: bigint | null;
  readonly estimatedUserRefundMinorUnits: bigint | null;
  readonly amountsConfirmed: boolean;
  readonly disclosures: readonly AccessDisclosureId[];
};

export type AccessCheckoutDisclosureRequirement = {
  readonly disclosure: AccessDisclosure;
  readonly reason: string;
};

export type AccessFundingRestrictionPolicy = {
  readonly policyId: string;
  readonly sourceClassification: AccessFundingSourceClassification;
  readonly allowedCategories: readonly string[] | null;
  readonly allowedGeographies: readonly string[] | null;
  readonly allowedProviders: readonly string[] | null;
  readonly programId: string | null;
  readonly survivesRefund: boolean;
  readonly survivesSettlement: boolean;
};

export type AccessJurisdictionPolicyRule = {
  readonly ruleId: string;
  readonly dimension: AccessJurisdictionPolicyDimension;
  readonly scope: string;
  readonly allowed: boolean;
  readonly category: string | null;
  readonly paymentRail: string | null;
  readonly providerId: string | null;
  readonly programId: string | null;
  readonly notes: string;
  readonly effectiveFrom: UtcInstant;
};

export type AccessProviderContractGate = {
  readonly providerId: string;
  readonly contractState: AccessProviderContractState;
  readonly allowsProductionFulfillment: boolean;
  readonly allowsDiscoveryOnly: boolean;
  readonly evidenceReference: string | null;
};

export type AccessPaymentProviderGate = {
  readonly paymentProviderId: string;
  readonly state: AccessPaymentProviderState;
  readonly environment: 'simulation' | 'sandbox' | 'production';
  readonly credentialsValid: boolean;
  readonly complianceReady: boolean;
  readonly allowsProductionSettlement: boolean;
};

export type AccessComplianceGateResult = {
  readonly allowed: boolean;
  readonly kernelDecisionRef: string | null;
  readonly reason: string;
  readonly requiresManualReview: boolean;
};

export type AccessDisputeContext = {
  readonly disputeId: string;
  readonly category: AccessDisputeCategory;
  readonly accessTransactionId: string;
  readonly canonicalPaymentDisputeRef: string | null;
  readonly providerDisputeRef: string | null;
  readonly entitlementDisputeRef: string | null;
};

export type AccessTaxComponent = {
  readonly role: AccessTaxComponentRole;
  readonly amountMinorUnits: bigint;
  readonly currency: string;
  readonly providerSupplied: boolean;
  readonly jurisdiction: string | null;
};

export type AccessServiceFee = {
  readonly feeId: string;
  readonly amountMinorUnits: bigint;
  readonly currency: string;
  readonly explicit: true;
  readonly waived: boolean;
};
