import type { Jurisdiction } from '../../../domain/src/jurisdiction.ts';
import type { Result } from '../../../domain/src/result.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import type { AssetQuantity } from '../../../money/src/asset-quantity.ts';
import type { Money } from '../../../money/src/money.ts';
import type {
  ContractId,
  EscrowId,
  ExchangeAccountId,
  ExchangeMarketId,
  InstrumentId,
  OrderId,
} from '../ids.ts';
import type { ExchangePrice } from '../price.ts';
import type { CapacityCategory, ComputeServiceClass, MarketFamily } from '../taxonomy.ts';
import type { DeliveryWindow, OraclePolicy } from '../types-universal.ts';
import type {
  AccessClearingFailureCode,
  AccessPolicyRefusalCode,
  AccessSettlementSemantics,
  CapacityClearingOutcome,
  CapacityOfferState,
  CapacityReservationState,
  CapacityTradeMechanism,
  ConsiderationKind,
  DeliveryEvidenceQuality,
  QueuePriorityClass,
  RefundReason,
  RfqState,
} from './taxonomy.ts';

/**
 * Reference to the canonical productive models owned by
 * `packages/sunrey-chain/src/productive`. The Exchange references a productive
 * object or claim by identifier and canonical unit; it never redefines them and
 * never imports the chain package.
 */
export type ProductiveObjectReference = {
  /** `ProductiveEconomicObject.objectId`. */
  readonly objectId: string;
  /** `ProductiveClaim.claimId` when the offer is backed by a specific claim. */
  readonly claimId: string | null;
  /** `ProductiveClaim.claimType` for the backing claim. */
  readonly claimType: 'CAPACITY' | 'OUTPUT' | 'DELIVERY' | 'USAGE' | 'RESERVE' | null;
  /** `ProductiveCategory` recorded by the canonical productive registry. */
  readonly productiveCategory: string;
  /** Canonical unit id from `packages/sunrey-chain/src/units`. */
  readonly canonicalUnit: string;
  /** `CanonicalProductiveMeasurement.normalizationReceiptId` when present. */
  readonly normalizationReceiptId: string | null;
  /** True only when a verified productive claim backs the listed capacity. */
  readonly claimVerified: boolean;
  /** The Exchange never tokenizes title to a productive object. */
  readonly tokenizesTitle: false;
};

/** Where and how capacity must be delivered. */
export type AccessGeography = {
  readonly deliveryLocation: string;
  readonly region: string | null;
  readonly gridOrNetworkZone: string | null;
};

/** Quality / service class the buyer is contracting for. */
export type AccessServiceClass = {
  readonly label: string;
  readonly computeClass: ComputeServiceClass | null;
  readonly capacityCategory: CapacityCategory | null;
  readonly maximumLatencyClass: string | null;
  readonly minimumAvailabilityBps: bigint | null;
};

/** Rights the provider asserts and the buyer receives. Access, never title. */
export type AccessRightsTerms = {
  readonly rightsReference: string;
  readonly grantsUseNotOwnership: true;
  readonly sublicensable: boolean;
  readonly revocationBehavior: 'BLOCK_FUTURE_USE' | 'ALLOW_IN_FLIGHT_ONLY' | 'REQUIRE_RECONFIRMATION';
  readonly permittedPurposes: readonly string[];
};

/** Policy requirements a counterparty must satisfy before award. */
export type AccessPolicyRequirements = {
  readonly requiredCapabilities: readonly string[];
  readonly requireVerifiedAccount: boolean;
  readonly permittedJurisdictions: readonly Jurisdiction[];
  readonly deniedJurisdictions: readonly Jurisdiction[];
  readonly requiresManualReviewAbove: bigint | null;
  readonly oraclePolicy: OraclePolicy;
};

/** Where the listed capacity came from. */
export type AccessProvenance = {
  readonly providerId: string;
  readonly attestationRefs: readonly string[];
  readonly oracleFactIds: readonly string[];
  readonly economicAssetId: string | null;
  readonly recordedAt: UtcInstant;
};

/** What counts as delivery. */
export type AccessDeliveryRequirements = {
  readonly semantics: AccessSettlementSemantics;
  readonly requiresOracleAttestation: boolean;
  readonly acceptedEvidenceQualities: readonly DeliveryEvidenceQuality[];
  readonly partialDeliveryAllowed: boolean;
  readonly deliveryConditions: readonly string[];
};

/**
 * The full descriptor an Exchange capacity order or offer carries. Every field
 * required by ACCESS-09 is present; `evaluateTermsCompleteness` refuses a
 * partially specified term sheet before any market operation.
 */
export type CapacityAccessTerms = {
  readonly termsId: string;
  readonly family: MarketFamily;
  readonly instrumentId: InstrumentId;
  readonly productiveObject: ProductiveObjectReference;
  readonly quantity: bigint;
  readonly unit: string;
  readonly availabilityWindow: DeliveryWindow;
  readonly geography: AccessGeography;
  readonly serviceClass: AccessServiceClass;
  readonly rightsTerms: AccessRightsTerms;
  readonly policyRequirements: AccessPolicyRequirements;
  readonly jurisdiction: Jurisdiction;
  readonly provenance: AccessProvenance;
  readonly deliveryRequirements: AccessDeliveryRequirements;
  readonly permittedConsideration: readonly ConsiderationKind[];
};

export type TermsCompleteness = {
  readonly complete: boolean;
  readonly missing: readonly string[];
};

/** A discoverable capacity listing. Read projection; holds no consideration. */
export type CapacityDiscoveryRecord = {
  readonly listingId: string;
  readonly marketId: ExchangeMarketId;
  readonly mechanism: CapacityTradeMechanism;
  readonly terms: CapacityAccessTerms;
  readonly offeredQuantity: bigint;
  readonly committedQuantity: bigint;
  readonly indicativeUnitPrice: ExchangePrice | null;
  readonly publishedAt: UtcInstant;
};

export type CapacityDiscoveryQuery = {
  readonly productiveObjectId?: string;
  readonly productiveCategory?: string;
  readonly unit?: string;
  readonly minimumQuantity?: bigint;
  readonly deliveryLocation?: string;
  readonly serviceClassLabel?: string;
  readonly jurisdiction?: Jurisdiction;
  readonly mechanism?: CapacityTradeMechanism;
  readonly withinWindow?: { readonly startHeight: bigint; readonly endHeight: bigint };
  readonly consideration?: ConsiderationKind;
};

/** Fixed-price access offer. */
export type FixedPriceAccessOffer = {
  readonly offerId: string;
  readonly listingId: string;
  readonly marketId: ExchangeMarketId;
  readonly providerAccountId: ExchangeAccountId;
  readonly terms: CapacityAccessTerms;
  readonly unitPrice: ExchangePrice;
  readonly minimumTakeQuantity: bigint;
  readonly offeredQuantity: bigint;
  readonly takenQuantity: bigint;
  readonly state: CapacityOfferState;
  readonly createdAt: UtcInstant;
};

/** Request for quote on capacity. */
export type CapacityRfq = {
  readonly rfqId: string;
  readonly marketId: ExchangeMarketId;
  readonly buyerAccountId: ExchangeAccountId;
  readonly terms: CapacityAccessTerms;
  readonly closesAtHeight: bigint;
  readonly state: RfqState;
  readonly invitedProviders: readonly string[];
  readonly createdAt: UtcInstant;
};

export type CapacityQuote = {
  readonly quoteId: string;
  readonly rfqId: string;
  readonly providerAccountId: ExchangeAccountId;
  readonly providerId: string;
  readonly unitPrice: ExchangePrice;
  readonly offeredQuantity: bigint;
  readonly consideration: ConsiderationKind;
  readonly deliverableWindow: DeliveryWindow;
  readonly sequence: number;
  readonly submittedAtHeight: bigint;
};

/**
 * Regulatory compatibility is a filter, never a score. `permitted` is decided
 * before ranking; a non-permitted quote can never win under any weighting.
 */
export type CapacityQuoteEvaluation = {
  readonly quoteId: string;
  readonly permitted: boolean;
  readonly refusalCodes: readonly AccessPolicyRefusalCode[];
};

export type CapacityRfqAward = {
  readonly rfqId: string;
  readonly awardedQuoteId: string | null;
  readonly awardedQuantity: bigint;
  readonly awardedUnitPrice: ExchangePrice | null;
  readonly consideredQuoteIds: readonly string[];
  readonly filteredOut: readonly CapacityQuoteEvaluation[];
  readonly tieBreak: 'PRICE_THEN_SEQUENCE_THEN_QUOTE_ID';
};

/** Non-price queue market for capacity that is allocated rather than auctioned. */
export type CapacityQueueTicket = {
  readonly ticketId: string;
  readonly queueId: string;
  readonly requesterAccountId: ExchangeAccountId;
  readonly terms: CapacityAccessTerms;
  readonly requestedQuantity: bigint;
  readonly priorityClass: QueuePriorityClass;
  readonly sequence: number;
};

export type CapacityQueueAllocation = {
  readonly queueId: string;
  readonly availableQuantity: bigint;
  readonly allocated: readonly {
    readonly ticketId: string;
    readonly quantity: bigint;
    readonly priorityClass: QueuePriorityClass;
  }[];
  readonly unallocatedQuantity: bigint;
  readonly unservedTicketIds: readonly string[];
  readonly rationing: 'PRIORITY_THEN_SEQUENCE';
};

/**
 * One independent consideration leg. Legs never declare a rate between two
 * coins: there is no field on which such a rate could be written.
 */
export type FiatConsiderationLeg = {
  readonly kind: 'FIAT';
  readonly amount: Money;
  readonly payerCashAccountId: string;
  readonly payerOwnerId: string;
  readonly payeeCashAccountId: string;
  readonly payeeOwnerId: string;
  readonly reservationCashAccountId: string;
};

type NativeAssetConsiderationLegBase = {
  readonly amount: AssetQuantity;
  readonly rail: 'CUSTODY_ASSET' | 'NATIVE_CHAIN';
  readonly payerRef: string;
  readonly payeeRef: string;
  readonly payerVaultId: string | null;
  readonly payeeVaultId: string | null;
};

/**
 * Each coin is its own leg type with a singular discriminant. There is no shared
 * "native coin amount" that could be reinterpreted as the other coin, and no
 * field on which a SunRey/MoonRey rate could be written.
 */
export type SunReyCoinConsiderationLeg = NativeAssetConsiderationLegBase & {
  readonly kind: 'SUNREY_COIN';
};

export type MoonReyCoinConsiderationLeg = NativeAssetConsiderationLegBase & {
  readonly kind: 'MOONREY_COIN';
};

export type NativeAssetConsiderationLeg =
  | SunReyCoinConsiderationLeg
  | MoonReyCoinConsiderationLeg;

export type AccessEntitlementConsiderationLeg = {
  readonly kind: 'ACCESS_ENTITLEMENT';
  readonly entitlementId: string;
  readonly holderId: string;
  readonly units: bigint;
  readonly unit: string;
  readonly transferable: false;
  readonly redeemableForMoney: false;
};

export type RewardCreditConsiderationLeg = {
  readonly kind: 'REWARD_CREDIT';
  readonly programId: string;
  readonly holderId: string;
  readonly units: bigint;
  readonly permittedUse: string;
  readonly transferable: false;
  readonly redeemableForMoney: false;
};

export type ConsiderationLeg =
  | FiatConsiderationLeg
  | SunReyCoinConsiderationLeg
  | MoonReyCoinConsiderationLeg
  | AccessEntitlementConsiderationLeg
  | RewardCreditConsiderationLeg;

/** The consideration a reservation carries. Independent legs, no numeraire. */
export type ConsiderationTerms = {
  readonly legs: readonly ConsiderationLeg[];
  readonly semantics: AccessSettlementSemantics;
  readonly impliedCoinConversion: false;
  readonly commonNumeraire: null;
};

/** Attested delivery of capacity. */
export type CapacityDeliveryEvidence = {
  readonly evidenceId: string;
  readonly reservationId: string;
  readonly deliveredQuantity: bigint;
  readonly unit: string;
  readonly quality: DeliveryEvidenceQuality;
  readonly oracleFactIds: readonly string[];
  readonly productiveClaimId: string | null;
  readonly attestedAt: UtcInstant;
};

/**
 * A capacity reservation. It records commitments and rail references. It never
 * records a balance, an available amount, or a holdings figure: those are read
 * from the canonical Ledger, custody, chain, or entitlement owner.
 */
export type CapacityReservation = {
  readonly reservationId: string;
  readonly contractId: ContractId;
  readonly marketId: ExchangeMarketId;
  readonly mechanism: CapacityTradeMechanism;
  readonly buyerAccountId: ExchangeAccountId;
  readonly providerAccountId: ExchangeAccountId;
  readonly terms: CapacityAccessTerms;
  readonly reservedQuantity: bigint;
  readonly deliveredQuantity: bigint;
  readonly unitPrice: ExchangePrice;
  readonly consideration: ConsiderationTerms;
  readonly state: CapacityReservationState;
  readonly escrowId: EscrowId | null;
  readonly sourceOrderId: OrderId | null;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
};

/** Rail references produced by one clearing attempt. Not a balance. */
export type ClearingLegReference = {
  readonly kind: ConsiderationKind;
  readonly rail: 'LEDGER_FIAT' | 'CUSTODY_ASSET' | 'NATIVE_CHAIN' | 'ENTITLEMENT_PORT' | 'REWARD_PORT';
  readonly journalId: string | null;
  readonly providerTxRef: string | null;
  readonly chainTxId: string | null;
  readonly consumptionId: string | null;
  readonly committed: boolean;
};

export type CapacityClearingReceipt = {
  readonly receiptId: string;
  readonly reservationId: string;
  readonly outcome: CapacityClearingOutcome;
  readonly phase: 'RESERVE_CONSIDERATION' | 'SETTLE_DELIVERY' | 'REFUND';
  readonly semantics: AccessSettlementSemantics;
  readonly legs: readonly ClearingLegReference[];
  readonly failureCode: AccessClearingFailureCode | null;
  readonly refusalCodes: readonly AccessPolicyRefusalCode[];
  readonly compensations: readonly RefundSettlementIntent[];
  readonly mintsCoin: false;
  readonly productionActivated: false;
  readonly at: UtcInstant;
};

/**
 * A refund or cancellation settlement intent. Corrections are new compensating
 * entries; a posted journal is never edited or deleted.
 */
export type RefundSettlementIntent = {
  readonly intentId: string;
  readonly reservationId: string;
  readonly reason: RefundReason;
  readonly legs: readonly ConsiderationLeg[];
  readonly compensating: true;
  readonly editsOriginalPosting: false;
  readonly requiresExecutionAuthority: boolean;
  readonly createdAt: UtcInstant;
};

export type AccessFabricFailure = {
  readonly code: AccessClearingFailureCode;
  readonly message: string;
};

/**
 * Owner of non-monetary access entitlements. The Exchange reads granted units
 * and records consumption references; it never stores the granted amount and
 * has no way to transfer an entitlement.
 */
export type AccessEntitlementPort = {
  readonly transferable: false;
  readonly redeemableForMoney: false;
  grantedUnits(input: {
    readonly entitlementId: string;
    readonly holderId: string;
    readonly unit: string;
  }): bigint;
  consume(input: {
    readonly entitlementId: string;
    readonly holderId: string;
    readonly units: bigint;
    readonly unit: string;
    readonly reservationId: string;
  }): Result<{ readonly consumptionId: string }, AccessFabricFailure>;
  restore(input: {
    readonly consumptionId: string;
  }): Result<{ readonly restored: true }, AccessFabricFailure>;
};

/**
 * Owner of permitted reward credit. Reward credit is consumed for permitted
 * access only. It is not money and is not redeemable for money.
 */
export type RewardCreditPort = {
  readonly transferable: false;
  readonly redeemableForMoney: false;
  permittedUnits(input: {
    readonly programId: string;
    readonly holderId: string;
    readonly permittedUse: string;
  }): bigint;
  consume(input: {
    readonly programId: string;
    readonly holderId: string;
    readonly units: bigint;
    readonly permittedUse: string;
    readonly reservationId: string;
  }): Result<{ readonly consumptionId: string }, AccessFabricFailure>;
  restore(input: {
    readonly consumptionId: string;
  }): Result<{ readonly restored: true }, AccessFabricFailure>;
};

/** Product configuration for one capacity market. Decides permitted mechanisms and consideration. */
export type CapacityMarketConfiguration = {
  readonly marketId: ExchangeMarketId;
  readonly permittedMechanisms: readonly CapacityTradeMechanism[];
  readonly permittedConsideration: readonly ConsiderationKind[];
  readonly defaultSemantics: AccessSettlementSemantics;
  readonly deniedJurisdictions: readonly Jurisdiction[];
  readonly requiresExecutionAuthorityForConsideration: true;
};
