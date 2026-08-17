import type { Jurisdiction } from '../../domain/src/jurisdiction.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import type { AssetQuantity } from '../../money/src/asset-quantity.ts';
import type {
  AuctionId,
  ContractId,
  DeliveryId,
  DisputeId,
  EscrowId,
  ExchangeAccountId,
  ExchangeMarketId,
  InstrumentId,
  ListingVersion,
  OrderId,
  RightId,
  SettlementId,
  TemplateHash,
  TradeId,
} from './ids.ts';
import type { ExchangePrice } from './price.ts';
import type {
  AuctionClearingMethod,
  CapacityCategory,
  ComputeServiceClass,
  ContractTemplateId,
  EligibilityReasonCode,
  ExchangeCounterpartyClass,
  ExchangeDisputeKind,
  InstrumentStatus,
  LegalReviewState,
  MarketAccessPolicy,
  MarketFamily,
  MarketMode,
  OracleFactPolicy,
  PartialDeliveryPolicy,
  RevocationBehavior,
  SettlementModel,
} from './taxonomy.ts';

export type DeliveryWindow = {
  readonly startHeight: bigint;
  readonly endHeight: bigint;
  readonly startAt: UtcInstant | null;
  readonly endAt: UtcInstant | null;
};

export type JurisdictionPolicy = {
  readonly permitted: readonly Jurisdiction[];
  readonly denied: readonly Jurisdiction[];
};

export type EligibilityPolicy = {
  readonly access: MarketAccessPolicy;
  readonly counterpartyClasses: readonly ExchangeCounterpartyClass[];
  readonly requiredCapabilities: readonly string[];
  readonly requireVerifiedAccount: boolean;
  readonly machineAllowed: boolean;
  readonly humanOnly: boolean;
};

export type RightsPolicy = {
  readonly requiresConsent: boolean;
  readonly requiresPurpose: boolean;
  readonly cleanRoomRequired: boolean;
  readonly rawExportAllowed: false;
  readonly revocationBehavior: RevocationBehavior;
};

export type OraclePolicy = {
  readonly required: boolean;
  readonly factTypes: readonly string[];
  readonly conflict: OracleFactPolicy;
  readonly stale: OracleFactPolicy;
  readonly maxProviderShareBps: bigint;
};

export type DeliveryPolicy = {
  readonly model: SettlementModel;
  readonly partial: PartialDeliveryPolicy;
  readonly geographyRequired: boolean;
  readonly permittedGeographies: readonly string[];
};

export type DigitalAssetExtension = {
  readonly kind: 'DIGITAL_ASSET';
  readonly nativeAssetId: string;
  readonly listingGovernanceRequired: true;
  readonly autoListForbidden: true;
};

export type InformationUseRightExtension = {
  readonly kind: 'HUMAN_INFORMATION_RIGHT';
  readonly rightId: RightId;
  readonly subjectOrCohortRef: string;
  readonly permittedComputationTemplate: string;
  readonly purpose: string;
  readonly recipientEligibility: readonly string[];
  readonly duration: DeliveryWindow;
  readonly revocationBehavior: RevocationBehavior;
  readonly cleanRoomRequirement: true;
  readonly outputRestrictions: readonly string[];
  readonly compensationTerms: string;
  readonly settlementAsset: string;
  readonly consentPolicyRef: string;
};

export type IntelligenceComputeExtension = {
  readonly kind: 'INTELLIGENCE_COMPUTE';
  readonly provider: string;
  readonly region: string;
  readonly hardwareOrServiceClass: ComputeServiceClass;
  readonly capacity: bigint;
  readonly deliveryWindow: DeliveryWindow;
  readonly unit: string;
  readonly maximumLatencyClass: string | null;
  readonly oracleMeteringPolicy: OraclePolicy;
  readonly settlementAsset: string;
};

export type ProductiveCapacityExtension = {
  readonly kind: 'PRODUCTIVE_CAPACITY';
  readonly productiveObject: string;
  readonly capacityCategory: CapacityCategory;
  readonly quantity: bigint;
  readonly unit: string;
  readonly deliveryWindow: DeliveryWindow;
  readonly deliveryLocation: string;
  readonly rightsReference: string;
  readonly tokenizesTitle: false;
};

export type FamilyExtension =
  | DigitalAssetExtension
  | InformationUseRightExtension
  | IntelligenceComputeExtension
  | ProductiveCapacityExtension;

export type ExchangeInstrument = {
  readonly instrumentId: InstrumentId;
  readonly marketFamily: MarketFamily;
  readonly issuerOrProvider: string;
  readonly underlyingReference: string;
  readonly unit: string;
  readonly settlementAssets: readonly string[];
  readonly jurisdictionPolicy: JurisdictionPolicy;
  readonly eligibilityPolicy: EligibilityPolicy;
  readonly rightsPolicy: RightsPolicy;
  readonly oraclePolicy: OraclePolicy;
  readonly deliveryPolicy: DeliveryPolicy;
  readonly listingVersion: ListingVersion;
  readonly status: InstrumentStatus;
  readonly legalReviewState: LegalReviewState;
  readonly operationalReady: boolean;
  readonly extension: FamilyExtension;
};

export type InformationUseRightInstrument = InformationUseRightExtension & {
  readonly instrumentId: InstrumentId;
  readonly marketFamily: 'HUMAN_INFORMATION_RIGHT';
};

export type ProductiveCapacityContract = {
  readonly contractId: ContractId;
  readonly instrumentId: InstrumentId;
  readonly marketId: ExchangeMarketId;
  readonly productiveObject: string;
  readonly capacityCategory: CapacityCategory;
  readonly quantity: bigint;
  readonly remaining: bigint;
  readonly delivered: bigint;
  readonly unit: string;
  readonly deliveryWindow: DeliveryWindow;
  readonly deliveryLocation: string;
  readonly rightsReference: string;
  readonly provider: string;
  readonly buyer: string;
  readonly oraclePolicy: OraclePolicy;
  readonly deliveryConditions: readonly string[];
  readonly settlementAsset: string;
  readonly unitPrice: ExchangePrice;
  readonly escrowId: EscrowId | null;
  readonly failureTerms: string;
  readonly partialPolicy: PartialDeliveryPolicy;
  readonly tokenizesTitle: false;
  readonly status: 'OPEN' | 'MATCHED' | 'DELIVERING' | 'SETTLED' | 'DISPUTED' | 'CANCELLED';
};

export type ComputeContract = {
  readonly contractId: ContractId;
  readonly instrumentId: InstrumentId;
  readonly marketId: ExchangeMarketId;
  readonly provider: string;
  readonly buyer: string;
  readonly serviceClass: ComputeServiceClass;
  readonly unit: string;
  readonly ordered: bigint;
  readonly delivered: bigint;
  readonly remaining: bigint;
  readonly unitPrice: ExchangePrice;
  readonly settlementAsset: string;
  readonly escrowId: EscrowId | null;
  readonly deliveryWindow: DeliveryWindow;
  readonly oraclePolicy: OraclePolicy;
  readonly partialPolicy: PartialDeliveryPolicy;
  readonly status: 'OPEN' | 'MATCHED' | 'DELIVERING' | 'SETTLED' | 'DISPUTED' | 'CANCELLED';
};

export type InformationRightContract = {
  readonly contractId: ContractId;
  readonly instrumentId: InstrumentId;
  readonly marketId: ExchangeMarketId;
  readonly rightId: RightId;
  readonly seller: string;
  readonly buyer: string;
  readonly purpose: string;
  readonly templateId: string;
  readonly consentPolicyRef: string;
  readonly cleanRoomRequired: true;
  readonly rawRows: false;
  readonly settlementAsset: string;
  readonly unitPrice: ExchangePrice;
  readonly escrowId: EscrowId | null;
  readonly status: 'OPEN' | 'MATCHED' | 'DELIVERING' | 'SETTLED' | 'DISPUTED' | 'CANCELLED' | 'BLOCKED';
  readonly outputReceiptId: string | null;
};

export type UniversalOrder = {
  readonly orderId: OrderId;
  readonly exchangeAccountId: ExchangeAccountId;
  readonly marketId: ExchangeMarketId;
  readonly instrumentId: InstrumentId;
  readonly family: MarketFamily;
  readonly side: 'BUY' | 'SELL';
  readonly orderType: 'LIMIT' | 'IOC' | 'FOK' | 'POST_ONLY' | 'MARKET';
  readonly quantity: bigint;
  readonly remaining: bigint;
  readonly limitPrice: ExchangePrice | null;
  readonly purpose: string | null;
  readonly recipientClass: string | null;
  readonly actorClass: ExchangeCounterpartyClass;
  readonly capabilities: readonly string[];
  readonly jurisdiction: Jurisdiction;
  readonly geography: string | null;
  readonly machineId: string | null;
  readonly consentRef: string | null;
  readonly clientIdempotencyKey: string;
  readonly sequence: number;
  readonly status: 'OPEN' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELLED' | 'REJECTED';
};

export type EligibilityContext = {
  readonly actorClass: ExchangeCounterpartyClass;
  readonly capabilities: readonly string[];
  readonly jurisdiction: Jurisdiction;
  readonly geography: string | null;
  readonly machineId: string | null;
  readonly purpose: string | null;
  readonly recipientClass: string | null;
  readonly consentActive: boolean;
  readonly consentRevoked: boolean;
  readonly verifiedAccount: boolean;
  readonly access: MarketAccessPolicy;
};

export type EligibilityDecision = {
  readonly eligible: boolean;
  readonly reasonCodes: readonly EligibilityReasonCode[];
};

export type AuctionBook = {
  readonly auctionId: AuctionId;
  readonly marketId: ExchangeMarketId;
  readonly instrumentId: InstrumentId;
  readonly openHeight: bigint;
  readonly closeHeight: bigint;
  readonly clearingMethod: AuctionClearingMethod;
  readonly state: 'OPEN' | 'CLOSED' | 'CLEARED' | 'SETTLED';
  readonly bids: readonly UniversalOrder[];
  readonly offers: readonly UniversalOrder[];
};

export type AuctionClearing = {
  readonly auctionId: AuctionId;
  readonly clearingPrice: ExchangePrice | null;
  readonly allocated: readonly {
    readonly bidOrderId: OrderId;
    readonly offerOrderId: OrderId;
    readonly quantity: bigint;
    readonly price: ExchangePrice;
  }[];
  readonly unfilledBidQuantity: bigint;
  readonly unfilledOfferQuantity: bigint;
  readonly method: AuctionClearingMethod;
  readonly tieBreak: 'PRICE_THEN_SEQUENCE';
};

export type ContractTemplate = {
  readonly templateId: ContractTemplateId;
  readonly version: 1;
  readonly contentHash: TemplateHash;
  readonly family: MarketFamily;
  readonly settlementModel: SettlementModel;
  readonly partialPolicy: PartialDeliveryPolicy;
  readonly oracleRequired: boolean;
  readonly description: string;
};

export type EscrowRecord = {
  readonly escrowId: EscrowId;
  readonly ownerAccountId: ExchangeAccountId;
  readonly assetId: string;
  readonly locked: bigint;
  readonly released: bigint;
  readonly paid: bigint;
  readonly state: 'LOCKED' | 'PARTIALLY_RELEASED' | 'SETTLED' | 'RELEASED_UNUSED' | 'DISPUTED';
};

export type DeliveryRecord = {
  readonly deliveryId: DeliveryId;
  readonly contractId: ContractId;
  readonly factId: string | null;
  readonly quantity: bigint;
  readonly unit: string;
  readonly quality: 'FINALIZED' | 'CONFLICTED' | 'STALE' | 'SELF_REPORT';
  readonly recordedAt: UtcInstant;
};

export type ExchangeDispute = {
  readonly disputeId: DisputeId;
  readonly kind: ExchangeDisputeKind;
  readonly contractId: ContractId | null;
  readonly tradeId: TradeId | null;
  readonly settlementId: SettlementId | null;
  readonly caseRef: string;
  readonly legalConclusion: false;
  readonly status: 'OPEN' | 'REFERRED';
};

export type FamilyMarketData = {
  readonly marketId: ExchangeMarketId;
  readonly family: MarketFamily;
  readonly mode: MarketMode;
  readonly digital: {
    readonly bestBid: ExchangePrice | null;
    readonly bestAsk: ExchangePrice | null;
    readonly lastTradePrice: ExchangePrice | null;
    readonly volume: bigint;
  } | null;
  readonly capacity: {
    readonly deliveryPeriod: DeliveryWindow | null;
    readonly availableQuantity: bigint;
    readonly clearingPrice: ExchangePrice | null;
    readonly verifiedDelivery: bigint;
  } | null;
  readonly compute: {
    readonly unitPrice: ExchangePrice | null;
    readonly availableCapacity: bigint;
    readonly deliveryWindow: DeliveryWindow | null;
  } | null;
  readonly information: {
    readonly contractAvailability: bigint;
    readonly purposeCategory: string | null;
    readonly authorizedOutputType: string | null;
    readonly subjectLevelData: false;
  } | null;
};

export type ListingGovernanceCheck = {
  readonly schemaValid: boolean;
  readonly familyPolicyOk: boolean;
  readonly rightsOk: boolean;
  readonly oracleOk: boolean;
  readonly legalResearchStatus: LegalReviewState;
  readonly operationalReady: boolean;
  readonly aiApproved: false;
  readonly accepted: boolean;
  readonly reasonCodes: readonly string[];
};

export type RiskLimitSet = {
  readonly maxOpenOrders: bigint;
  readonly maxOutstandingNotional: bigint;
  readonly maxOutstandingEscrow: bigint;
  readonly maxCapacityCommitments: bigint;
  readonly maxProviderConcentrationBps: bigint;
  readonly maxOracleConcentrationBps: bigint;
  readonly maxInstrumentConcentrationBps: bigint;
};

export type RiskUsage = {
  readonly accountId: ExchangeAccountId;
  readonly openOrders: bigint;
  readonly outstandingNotional: bigint;
  readonly outstandingEscrow: bigint;
  readonly capacityCommitments: bigint;
  readonly byProvider: Readonly<Record<string, bigint>>;
  readonly byOracle: Readonly<Record<string, bigint>>;
  readonly byInstrument: Readonly<Record<string, bigint>>;
};

export type PartialSettlement = {
  readonly contractId: ContractId;
  readonly ordered: bigint;
  readonly delivered: bigint;
  readonly paid: bigint;
  readonly releasedUnused: bigint;
  readonly remainingEscrow: bigint;
  readonly exact: true;
};
