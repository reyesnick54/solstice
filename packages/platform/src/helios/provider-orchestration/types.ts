import type { CustomerId } from '../../../../domain/src/customer.ts';
import type { Jurisdiction } from '../../../../domain/src/jurisdiction.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';
import type {
  CustodyWalletProvisionId,
  ExternalAccountApplicationId,
  FundingOperationId,
  FundingRelationshipId,
} from './ids.ts';
import type {
  CustodyWalletProvisionStatus,
  CustomerActionRequirementKind,
  ExternalAccountApplicationStatus,
  ExternalAccountType,
  FundingOperationStatus,
  FundingVerificationState,
  ProviderOrchestrationCapabilityState,
  ProviderOrchestrationEnvironment,
  ProviderOrchestrationReadiness,
} from './taxonomy.ts';

/** Provider response treated as evidence — never fabricated. */
export type ProviderEvidence = {
  readonly providerId: string;
  readonly providerObjectId: string | null;
  readonly providerTimestamp: UtcInstant | null;
  readonly arrivalTimestamp: UtcInstant;
  readonly correlationId: string;
  readonly operationId: string;
  readonly evidenceRef: string | null;
  readonly rawStatus: string | null;
};

export type ProviderCapabilityDiscovery = {
  readonly providerId: string;
  readonly environment: ProviderOrchestrationEnvironment;
  readonly capabilities: Readonly<Record<string, ProviderOrchestrationCapabilityState>>;
  readonly overallAvailable: boolean;
  readonly discoveredAt: UtcInstant;
};

export type CustomerActionRequirement = {
  readonly requirementId: string;
  readonly kind: CustomerActionRequirementKind;
  readonly description: string;
  readonly providerReference: string | null;
  readonly dueBy: UtcInstant | null;
  readonly aiMayComplete: false;
};

export type ExternalAccountApplication = {
  readonly applicationId: ExternalAccountApplicationId;
  readonly customerId: CustomerId;
  readonly legalIdentityRef: string;
  readonly kycState: string;
  readonly jurisdiction: Jurisdiction;
  readonly productRequested: string;
  readonly providerId: string;
  readonly accountType: ExternalAccountType;
  readonly requiredAgreements: readonly string[];
  readonly idempotencyKey: string;
  readonly workOrderRef: string | null;
  readonly growRef: string | null;
  readonly environment: ProviderOrchestrationEnvironment;
  readonly status: ExternalAccountApplicationStatus;
  readonly providerAccountRef: string | null;
  readonly internalAccountRelationId: string | null;
  readonly capabilityState: ProviderOrchestrationCapabilityState | null;
  readonly actionRequirements: readonly CustomerActionRequirement[];
  readonly latestEvidence: ProviderEvidence | null;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
  readonly reconciliationRequired: boolean;
};

export type FundingRelationship = {
  readonly relationshipId: FundingRelationshipId;
  readonly customerId: CustomerId;
  readonly sourceAccountRef: string;
  readonly destinationProviderAccountRef: string;
  readonly owner: CustomerId;
  readonly currency: string;
  readonly supportedRails: readonly string[];
  readonly providerId: string;
  readonly verificationState: FundingVerificationState;
  readonly fundingLimitMinor: string | null;
  readonly settlementBehavior: string | null;
  readonly environment: ProviderOrchestrationEnvironment;
  readonly evidence: ProviderEvidence | null;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
};

export type FundingOperation = {
  readonly operationId: FundingOperationId;
  readonly relationshipId: FundingRelationshipId;
  readonly customerId: CustomerId;
  readonly providerId: string;
  readonly destinationAccountRef: string;
  readonly amountMinor: string;
  readonly currency: string;
  readonly idempotencyKey: string;
  readonly status: FundingOperationStatus;
  readonly buyingPowerCredited: false;
  readonly environment: ProviderOrchestrationEnvironment;
  readonly latestEvidence: ProviderEvidence | null;
  readonly actionRequirements: readonly CustomerActionRequirement[];
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
  readonly reconciliationRequired: boolean;
};

export type CustodyWalletProvision = {
  readonly provisionId: CustodyWalletProvisionId;
  readonly customerId: CustomerId;
  readonly assetId: string;
  readonly networkId: string;
  readonly custodyProviderId: string;
  readonly signingPolicyRef: string;
  readonly environment: ProviderOrchestrationEnvironment;
  readonly addressOrReference: string | null;
  readonly status: CustodyWalletProvisionStatus;
  readonly idempotencyKey: string;
  readonly latestEvidence: ProviderEvidence | null;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
  readonly reconciliationRequired: boolean;
};

export type AccountApplicationRequest = {
  readonly customerId: CustomerId;
  readonly legalIdentityRef: string;
  readonly kycState: string;
  readonly jurisdiction: Jurisdiction;
  readonly productRequested: string;
  readonly providerId: string;
  readonly accountType: ExternalAccountType;
  readonly requiredAgreements: readonly string[];
  readonly idempotencyKey: string;
  readonly workOrderRef?: string | null;
  readonly growRef?: string | null;
  readonly environment: ProviderOrchestrationEnvironment;
};

export type FundingRequest = {
  readonly customerId: CustomerId;
  readonly relationshipId: FundingRelationshipId;
  readonly providerId: string;
  readonly destinationAccountRef: string;
  readonly amountMinor: string;
  readonly currency: string;
  readonly idempotencyKey: string;
  readonly environment: ProviderOrchestrationEnvironment;
};

export type WalletProvisionRequest = {
  readonly customerId: CustomerId;
  readonly assetId: string;
  readonly networkId: string;
  readonly custodyProviderId: string;
  readonly signingPolicyRef: string;
  readonly idempotencyKey: string;
  readonly environment: ProviderOrchestrationEnvironment;
  readonly requiredByProduct: string;
};

export type ProviderOrchestrationStoreSnapshot = {
  readonly applications: readonly ExternalAccountApplication[];
  readonly fundingRelationships: readonly FundingRelationship[];
  readonly fundingOperations: readonly FundingOperation[];
  readonly walletProvisions: readonly CustodyWalletProvision[];
};

export type OrchestrationFailure = {
  readonly code:
    | 'CUSTOMER_MISMATCH'
    | 'PROVIDER_UNAVAILABLE'
    | 'KYC_INCOMPLETE'
    | 'IDEMPOTENCY_PAYLOAD_MISMATCH'
    | 'NOT_FOUND'
    | 'RELATIONSHIP_UNVERIFIED'
    | 'AGENT_FINANCIAL_OWNERSHIP_FORBIDDEN'
    | 'SIGNING_MATERIAL_FORBIDDEN'
    | 'QUERY_REQUIRED_BEFORE_RETRY'
    | 'PROVIDER_NOT_CONFIGURED';
  readonly message: string;
};

export type OrchestrationReadinessReport = {
  readonly readiness: ProviderOrchestrationReadiness;
  readonly providerCount: number;
  readonly qualifiedProviderCount: number;
  readonly evaluatedAt: UtcInstant;
  readonly notes: readonly string[];
};
