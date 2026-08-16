import type { Money } from '../../money/src/money.ts';
import type { AssetQuantity } from '../../money/src/asset-quantity.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import type {
  AllowedOutputType,
  CompensationAsset,
  CompensationRealization,
  ContributionState,
  InformationProductType,
  OpportunityDecision,
  OracleClaimType,
  ProhibitedUseCategory,
  RequesterKind,
  RequesterVerificationState,
  RequestStatus,
} from './taxonomy.ts';
import type {
  AttestationId,
  CompensationAgreementId,
  ContributionId,
  EligibilityMatchId,
  MarketRequestId,
  OpportunityId,
  RequesterId,
  SettlementRefId,
} from './ids.ts';

export type InformationMarketFailure = {
  readonly code: string;
  readonly message: string;
};

export type MarketRequester = {
  readonly requesterId: RequesterId;
  readonly kind: RequesterKind;
  readonly legalEntityRef: string;
  readonly jurisdiction: string;
  readonly verificationState: RequesterVerificationState;
  readonly permittedProductClasses: readonly InformationProductType[];
  readonly allowedPurposes: readonly string[];
  readonly riskState: 'CLEAR' | 'HEIGHTENED' | 'BLOCKED';
  readonly policyState: 'SIMULATION_PERMITTED' | 'LEGAL_REVIEW_REQUIRED' | 'DISABLED';
  readonly status: 'ACTIVE_FIXTURE' | 'SUSPENDED';
  readonly simulationFixture: true;
  readonly liveVerifiedInstitution: false;
  readonly recipientId: string;
  readonly actorSubjectId: string;
};

export type CompensationOffer = {
  readonly asset: CompensationAsset;
  readonly fiat?: Money;
  readonly coin?: AssetQuantity;
  readonly realization: CompensationRealization;
  readonly usdConversion: 'UNAVAILABLE';
};

export type MarketRequest = {
  readonly requestId: MarketRequestId;
  readonly requesterId: RequesterId;
  readonly productType: InformationProductType;
  readonly purposeRef: string;
  readonly jurisdiction: string;
  readonly eligibilityCriteria: Readonly<Record<string, string | boolean>>;
  readonly requestedDataCategories: readonly string[];
  readonly requiredAttestations: readonly OracleClaimType[];
  readonly allowedOutputType: AllowedOutputType;
  readonly participantLimit: number;
  readonly compensationByIndex: readonly CompensationOffer[];
  readonly defaultCompensation: CompensationOffer;
  readonly expiresAt: UtcInstant;
  readonly retentionDays: number;
  readonly onwardUse: 'NOT_ALLOWED';
  readonly consentRequirements: readonly string[];
  readonly policyState: 'SIMULATION_PERMITTED' | 'LEGAL_REVIEW_REQUIRED' | 'DISABLED';
  readonly legalReviewState: 'RESEARCH_REQUIRED';
  readonly prohibitedUses: readonly ProhibitedUseCategory[];
  readonly status: RequestStatus;
  readonly rdtCapability: 'INFORMATION_MARKET_REQUEST';
  readonly createdAt: UtcInstant;
  readonly publishedAt: UtcInstant | null;
};

export type EligibilityFact = {
  readonly subjectId: string;
  readonly ageBand?: string;
  readonly researchInclusion?: boolean;
  readonly incomeAboveThreshold?: boolean;
  readonly savingsBehaviorMaintained?: boolean;
  readonly verifiedCredential?: boolean;
  readonly cohortId?: string;
  readonly pegRef?: string;
  readonly vaultMetadataCategories?: readonly string[];
};

export type OracleAttestation = {
  readonly attestationId: AttestationId;
  readonly subjectRef: string;
  readonly claimType: OracleClaimType;
  readonly claimResult: string | boolean;
  readonly sourceRefs: readonly string[];
  readonly purposeRef: string;
  readonly consentRef?: string;
  readonly issuedAt: UtcInstant;
  readonly expiresAt: UtcInstant;
  readonly issuer: string;
  readonly keyVersion: number;
  readonly keyId: string;
  readonly signatureHex: string;
  readonly verificationState: 'SIGNED_SIMULATION' | 'EXPIRED' | 'TAMPERED';
  readonly sourceRecordRevealed: false;
};

export type EligibilityMatch = {
  readonly matchId: EligibilityMatchId;
  readonly requestId: MarketRequestId;
  readonly subjectRef: string;
  readonly attestationIds: readonly AttestationId[];
  readonly matched: boolean;
  readonly reason: string;
  readonly consentGranted: false;
  readonly createdAt: UtcInstant;
};

export type UserOpportunity = {
  readonly opportunityId: OpportunityId;
  readonly requestId: MarketRequestId;
  readonly subjectId: string;
  readonly sponsorLabel: string;
  readonly purposeRef: string;
  readonly requiredDataUse: readonly string[];
  readonly expectedOutput: AllowedOutputType;
  readonly compensation: CompensationOffer;
  readonly timeRequirement: string;
  readonly retentionDays: number;
  readonly privacyTerms: string;
  readonly jurisdictionalRestrictions: readonly string[];
  readonly expiresAt: UtcInstant;
  readonly decision: OpportunityDecision | null;
  readonly darkPattern: false;
};

export type ProofOfContribution = {
  readonly contributionId: ContributionId;
  readonly subjectRef: string;
  readonly requesterId: RequesterId;
  readonly requestId: MarketRequestId;
  readonly opportunityId: OpportunityId;
  readonly consentRef: string;
  readonly purposeRef: string;
  readonly permittedDataCategories: readonly string[];
  readonly cleanRoomJobId: string;
  readonly computationReceiptId: string;
  readonly oracleAttestationRefs: readonly AttestationId[];
  readonly status: ContributionState;
  readonly compensationAgreementId: CompensationAgreementId;
  readonly settlementRef: SettlementRefId | null;
  readonly provenanceHash: string;
  readonly createdAt: UtcInstant;
  readonly rawDataIncluded: false;
};

export type CompensationAgreement = {
  readonly agreementId: CompensationAgreementId;
  readonly contributionId: ContributionId;
  readonly offer: CompensationOffer;
  readonly realization: CompensationRealization;
  readonly holdId?: string;
};

export type SettlementReference = {
  readonly settlementRef: SettlementRefId;
  readonly contributionId: ContributionId;
  readonly asset: CompensationAsset;
  readonly intentId: string;
  readonly journalId?: string;
  readonly transferId?: string;
  readonly realization: 'REALIZED';
  readonly peveRef?: string;
};

export type BillingBreakdown = {
  readonly enterpriseAmountCharged: Money;
  readonly participantCompensation: CompensationOffer;
  readonly platformFee: Money;
  readonly computeFee: Money;
  readonly sunreyCoinIncentive: AssetQuantity | null;
  readonly protocolNetworkFeePlaceholder: Money;
  readonly blended: false;
};

export type DemandIndexObservation = {
  readonly observedAt: UtcInstant;
  readonly requestCount: number;
  readonly categoryDemand: Readonly<Record<string, number>>;
  readonly authorizedContributorSupply: number;
  readonly matchRate: string;
  readonly completedComputationCount: number;
  readonly averageOfferedFiatMinor: string;
  readonly realizedClearingFiatMinor: string;
  readonly geography: Readonly<Record<string, number>>;
  readonly requesterTypeCounts: Readonly<Record<string, number>>;
  readonly timeToFillMs: number | null;
  readonly isCoinPrice: false;
  readonly isHumanWorth: false;
  readonly isGuaranteedCompensation: false;
  readonly isTokenValuation: false;
};

export type FutureChainReference = {
  readonly consentReceiptHash?: string;
  readonly attestationHash?: string;
  readonly provenanceHash?: string;
  readonly proofOfContributionHash?: string;
  readonly policyDecisionRef?: string;
  readonly settlementRef?: string;
  readonly rawDataIncluded: false;
  readonly chainImplemented: false;
};

export type ExchangeIntegrationBoundary = {
  readonly marketII: 'INFORMATION_ASSETS';
  readonly marketIII: 'INTELLIGENCE_COMPUTE';
  readonly publicBrand: 'SunRey Exchange';
  readonly orderBookImplemented: false;
  readonly matchingEngineImplemented: false;
};

export type VerifiableCredentialPort = {
  issueSimulationCredential(attestation: OracleAttestation): { readonly mode: 'SIMULATION_ONLY'; readonly credentialId: string };
};

export type ZeroKnowledgeProofPort = {
  proveSimulation(claim: string): { readonly mode: 'SIMULATION_ONLY'; readonly proofId: string };
};

export type SecureComputeProofPort = {
  adaptReceipt(receiptId: string): { readonly mode: 'SIMULATION_ONLY'; readonly adapter: 'CLEAN_ROOM_RECEIPT' };
};

export type FiatCompensationPort = {
  creditParticipant(input: {
    readonly actorId: string;
    readonly customerId: string;
    readonly participantAccountId: string;
    readonly amount: Money;
    readonly contributionId: string;
  }): { readonly outcome: 'OK'; readonly intentId: string; readonly journalId: string } | { readonly outcome: 'REJECTED'; readonly code: string; readonly message: string };
};

export type InformationMarketStoreSnapshot = {
  readonly requesters: readonly MarketRequester[];
  readonly requests: readonly MarketRequest[];
  readonly facts: readonly EligibilityFact[];
  readonly attestations: readonly OracleAttestation[];
  readonly matches: readonly EligibilityMatch[];
  readonly opportunities: readonly UserOpportunity[];
  readonly contributions: readonly ProofOfContribution[];
  readonly agreements: readonly CompensationAgreement[];
  readonly settlements: readonly SettlementReference[];
  readonly observations: readonly DemandIndexObservation[];
  readonly replayKeys: readonly string[];
};
