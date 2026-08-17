/**
 * Chunk 77 — SunRey protocol treasury, reserve, and budget types.
 *
 * Canonical owner: packages/sunrey-chain/src/economics/treasury.
 * Distinct from packages/treasury (fiat/application treasury).
 * Native holdings only. No second ledger. No new native asset.
 * No customer-asset ownership. No price peg. No treasury mint.
 */

import {
  ENGINEERING_SIMULATION,
  PRODUCTION_PARAMETER_UNCONFIGURED,
  PROTOCOL_TREASURY_CLASS,
  REHEARSAL_ONLY,
  type NativeMonetaryAssetId,
} from '../types.ts';

export const PROTOCOL_TREASURY_SCHEMA_VERSION = 1 as const;
export const PROTOCOL_TREASURY_POLICY_VERSION_ID = 'sunrey.protocol.treasury.v1' as const;
export const PROTOCOL_TREASURY_OWNER = 'packages/sunrey-chain' as const;
export const FIAT_TREASURY_OWNER = 'packages/treasury' as const;
export const PROTOCOL_TREASURY_ACCOUNT_PREFIX = 'sunrey.protocol.treasury' as const;
export const FEE_TREASURY_SINK_ACCOUNT = 'sunrey.fees.treasury' as const;

export const PROTOCOL_RESERVE_CLASSES = [
  'NETWORK_SECURITY_RESERVE',
  'VALIDATOR_REWARD_RESERVE',
  'PROTOCOL_OPERATIONS_RESERVE',
  'ECOSYSTEM_PROGRAM_RESERVE',
  'EMERGENCY_PROTOCOL_RESERVE',
  'FEE_TREASURY_RESERVE',
  'OTHER_GOVERNED_RESERVE',
] as const;
export type ProtocolReserveClass = (typeof PROTOCOL_RESERVE_CLASSES)[number];

export const TREASURY_FUNDING_SOURCES = [
  'EXPLICIT_APPROVED_GENESIS_ALLOCATION',
  'FEE_POLICY_V2_TREASURY_DISPOSITION',
  'GOVERNED_TRANSFER_TO_PROTOCOL_TREASURY',
  'AUTHORIZED_RETURN_REFUND_UNUSED',
  'OTHER_MONETARY_POLICY_APPROVED_SOURCE',
] as const;
export type TreasuryFundingSourceKind = (typeof TREASURY_FUNDING_SOURCES)[number];

export const TREASURY_PURPOSE_CLASSES = [
  'NETWORK_SECURITY',
  'VALIDATOR_OPERATIONS',
  'PROTOCOL_INFRASTRUCTURE',
  'ECOSYSTEM_PROGRAM',
  'SECURITY_RESPONSE',
  'OTHER_GOVERNED_PURPOSE',
] as const;
export type TreasuryPurposeClass = (typeof TREASURY_PURPOSE_CLASSES)[number];

export const TREASURY_RECIPIENT_CLASSES = [
  'VALIDATOR_OPERATOR',
  'PROTOCOL_SERVICE_PROVIDER',
  'ECOSYSTEM_RECIPIENT',
  'GOVERNED_ACCOUNT',
  'OTHER_APPROVED_RECIPIENT',
] as const;
export type TreasuryRecipientClass = (typeof TREASURY_RECIPIENT_CLASSES)[number];

export const TREASURY_ACTOR_KINDS = ['HUMAN', 'PROTOCOL', 'AI', 'AGENT'] as const;
export type TreasuryActorKind = (typeof TREASURY_ACTOR_KINDS)[number];

export const BUDGET_APPROVAL_STATES = [
  'DRAFT',
  'PROPOSED',
  'APPROVED',
  'ACTIVE',
  'EXHAUSTED',
  'CANCELLED',
  'SUPERSEDED',
  'REJECTED',
] as const;
export type BudgetApprovalState = (typeof BUDGET_APPROVAL_STATES)[number];

export const DISBURSEMENT_STATES = [
  'DRAFTED',
  'APPROVED',
  'RESERVED',
  'SUBMITTED',
  'FINALIZED',
  'CANCELLED',
  'EXPIRED',
  'REJECTED',
] as const;
export type DisbursementState = (typeof DISBURSEMENT_STATES)[number];

export const RESERVATION_STATES = ['ACTIVE', 'FINALIZED', 'CANCELLED', 'EXPIRED'] as const;
export type ReservationState = (typeof RESERVATION_STATES)[number];

export const CUSTOMER_ASSET_DOMAINS = [
  'CUSTOMER_WALLET_HOLDINGS',
  'CUSTODY_CUSTOMER_ASSETS',
  'EXCHANGE_CUSTOMER_OBLIGATIONS',
  'MACHINE_ESCROW_EXTERNAL_ACTOR',
  'FIAT_LEDGER_CUSTOMER_BALANCES',
] as const;
export type CustomerAssetDomain = (typeof CUSTOMER_ASSET_DOMAINS)[number];

export const FIAT_LABELS = ['USD', 'EUR', 'GBP', 'SAR', 'JPY', 'DOLLARS', 'RIYALS', 'EUROS'] as const;

export type TreasuryActor = {
  readonly kind: TreasuryActorKind;
  readonly actorId: string;
  readonly governanceAuthorized: boolean;
  readonly emergencyHeightened: boolean;
  readonly rootOfTrustKeyRefs: readonly string[];
};

export type TreasurySpendingConstraints = {
  readonly perTransactionLimit: bigint | typeof PRODUCTION_PARAMETER_UNCONFIGURED;
  readonly perRecipientLimit: bigint | typeof PRODUCTION_PARAMETER_UNCONFIGURED;
  readonly perReserveLimit: bigint | typeof PRODUCTION_PARAMETER_UNCONFIGURED;
  readonly perCycleLimit: bigint | typeof PRODUCTION_PARAMETER_UNCONFIGURED;
  readonly globalCycleLimit: bigint | typeof PRODUCTION_PARAMETER_UNCONFIGURED;
  readonly productionLimitsConfigured: false;
};

export type ProtocolTreasuryPolicy = {
  readonly schemaVersion: typeof PROTOCOL_TREASURY_SCHEMA_VERSION;
  readonly policyVersion: string;
  readonly owner: typeof PROTOCOL_TREASURY_OWNER;
  readonly classification: typeof PROTOCOL_TREASURY_CLASS;
  readonly distinctFromFiatTreasuryPackage: true;
  readonly fiatTreasuryOwner: typeof FIAT_TREASURY_OWNER;
  readonly allowedAssets: readonly NativeMonetaryAssetId[];
  readonly allowedReserveClasses: readonly ProtocolReserveClass[];
  readonly allowedFundingSources: readonly TreasuryFundingSourceKind[];
  readonly allowedPurposeClasses: readonly TreasuryPurposeClass[];
  readonly allowedRecipientClasses: readonly TreasuryRecipientClass[];
  readonly spendingConstraints: TreasurySpendingConstraints;
  readonly treasuryMintForbidden: true;
  readonly customerAssetClaimForbidden: true;
  readonly fiatRepresentationForbidden: true;
  readonly pricePegForbidden: true;
  readonly algorithmicPegForbidden: true;
  readonly guaranteedValueForbidden: true;
  readonly guaranteedLiquidityForbidden: true;
  readonly guaranteedRedemptionForbidden: true;
  readonly aiMayAnalyze: true;
  readonly aiMayVote: false;
  readonly aiMayApprove: false;
  readonly aiMayAuthorizeTransfer: false;
  readonly aiMayActivateReservePolicy: false;
  readonly emergencyCannotRewriteSupply: true;
  readonly emergencyCannotConfiscateCustomerAssets: true;
  readonly emergencyCannotRollbackFinality: true;
  readonly emergencyCannotChangeMonetaryPolicy: true;
  readonly emergencyCannotMint: true;
  readonly moonreyHoldingsAreNotProductiveContribution: true;
  readonly productionTreasuryInactive: true;
  readonly productionLimitsConfigured: false;
};

export type TreasuryBudgetPolicy = {
  readonly policyVersion: string;
  readonly parentTreasuryPolicyVersion: string;
  readonly allowedReserveClasses: readonly ProtocolReserveClass[];
  readonly cycleLengthEpochs: bigint;
  readonly perProposalLimit: bigint | typeof PRODUCTION_PARAMETER_UNCONFIGURED;
  readonly perCycleLimit: bigint | typeof PRODUCTION_PARAMETER_UNCONFIGURED;
  readonly recipientRules: readonly TreasuryRecipientClass[];
  readonly purposeRules: readonly TreasuryPurposeClass[];
  readonly approvalRequirements: {
    readonly humanGovernanceRequired: true;
    readonly aiApprovalRejected: true;
    readonly emergencyHeightenedForEmergencyReserve: true;
    readonly rootOfTrustKeysRequired: true;
  };
  readonly activationBoundaries: {
    readonly minActivationEpoch: bigint;
    readonly maxActivationEpoch: bigint | typeof PRODUCTION_PARAMETER_UNCONFIGURED;
  };
};

export type ProtocolTreasuryAccount = {
  readonly classification: typeof PROTOCOL_TREASURY_CLASS;
  readonly distinctFromFiatTreasuryPackage: true;
  readonly fiatTreasuryOwner: typeof FIAT_TREASURY_OWNER;
  readonly accountId: string;
  readonly asset: NativeMonetaryAssetId;
  readonly reserveClass: ProtocolReserveClass;
  readonly policyVersion: string;
  readonly openingBalance: bigint;
  readonly authorizedFunding: bigint;
  readonly returnedFunds: bigint;
  readonly finalizedDisbursements: bigint;
  readonly availableQuantity: bigint;
  readonly reservedQuantity: bigint;
  readonly encumberedQuantity: bigint;
  readonly governanceAuthority: 'SUNREY_PROTOCOL_GOVERNANCE';
  readonly spendingConstraints: TreasurySpendingConstraints;
};

export type TreasuryFundingSource = {
  readonly fundingId: string;
  readonly source: TreasuryFundingSourceKind;
  readonly asset: NativeMonetaryAssetId;
  readonly reserveClass: ProtocolReserveClass;
  readonly quantity: bigint;
  readonly epoch: bigint;
  readonly height: bigint;
  readonly evidenceRef: string;
  readonly monetaryPolicyVersion: string;
  readonly createsSupply: false;
};

export type TreasuryBudgetCycle = {
  readonly cycleId: string;
  readonly policyVersion: string;
  readonly startEpoch: bigint;
  readonly endEpoch: bigint;
  readonly startHeight: bigint;
  readonly endHeight: bigint;
  readonly historicalReproducible: true;
};

export type TreasuryBudget = {
  readonly budgetId: string;
  readonly policyVersion: string;
  readonly asset: NativeMonetaryAssetId;
  readonly reserveClass: ProtocolReserveClass;
  readonly purpose: TreasuryPurposeClass;
  readonly maximumAuthorizedQuantity: bigint;
  readonly reservedQuantity: bigint;
  readonly disbursedQuantity: bigint;
  readonly remainingQuantity: bigint;
  readonly cycle: TreasuryBudgetCycle;
  readonly recipientClass: TreasuryRecipientClass;
  readonly evidenceRefs: readonly string[];
  readonly governanceProposalRef: string;
  readonly approvalState: BudgetApprovalState;
};

export type TreasuryAllocation = {
  readonly allocationId: string;
  readonly budgetId: string;
  readonly asset: NativeMonetaryAssetId;
  readonly reserveClass: ProtocolReserveClass;
  readonly quantity: bigint;
  readonly purpose: TreasuryPurposeClass;
  readonly recipientClass: TreasuryRecipientClass;
  readonly policyVersion: string;
};

export type TreasuryDisbursementIntent = {
  readonly intentId: string;
  readonly budgetId: string;
  readonly recipient: string;
  readonly recipientClass: TreasuryRecipientClass;
  readonly asset: NativeMonetaryAssetId;
  readonly quantity: bigint;
  readonly purpose: TreasuryPurposeClass;
  readonly policyVersion: string;
  readonly expirationEpoch: bigint;
  readonly approval: BudgetApprovalState;
  readonly transactionContentHash: string;
  readonly state: DisbursementState;
  readonly reservationId: string | null;
  readonly chainFinalityRef: string | null;
};

export type TreasuryReservation = {
  readonly reservationId: string;
  readonly intentId: string;
  readonly budgetId: string;
  readonly accountId: string;
  readonly asset: NativeMonetaryAssetId;
  readonly quantity: bigint;
  readonly state: ReservationState;
  readonly createdEpoch: bigint;
  readonly expirationEpoch: bigint;
};

export type TreasuryReceipt = {
  readonly receiptId: string;
  readonly intentId: string;
  readonly reservationId: string;
  readonly budgetId: string;
  readonly asset: NativeMonetaryAssetId;
  readonly quantity: bigint;
  readonly recipient: string;
  readonly purpose: TreasuryPurposeClass;
  readonly policyVersion: string;
  readonly chainFinalityRef: string;
  readonly height: bigint;
  readonly epoch: bigint;
};

export type TreasuryEquation = {
  readonly openingBalance: bigint;
  readonly authorizedFunding: bigint;
  readonly returnedFunds: bigint;
  readonly finalizedDisbursements: bigint;
  readonly availableQuantity: bigint;
  readonly reservedQuantity: bigint;
  readonly encumberedQuantity: bigint;
  readonly left: bigint;
  readonly right: bigint;
  readonly balanced: boolean;
};

export type TreasuryReconciliation = {
  readonly schemaVersion: typeof PROTOCOL_TREASURY_SCHEMA_VERSION;
  readonly classification: typeof ENGINEERING_SIMULATION;
  readonly policyVersion: string;
  readonly accounts: readonly (ProtocolTreasuryAccount & { readonly equation: TreasuryEquation })[];
  readonly budgets: readonly TreasuryBudget[];
  readonly funding: readonly TreasuryFundingSource[];
  readonly reservations: readonly TreasuryReservation[];
  readonly disbursements: readonly TreasuryDisbursementIntent[];
  readonly returns: readonly TreasuryFundingSource[];
  readonly receipts: readonly TreasuryReceipt[];
  readonly customerAssetsUnreachable: true;
  readonly treasuryMintUnavailable: true;
  readonly ok: boolean;
};

export type TreasuryGovernancePackage = {
  readonly packageId: string;
  readonly proposalRef: string;
  readonly policyVersion: string;
  readonly upgradeKind: 'TREASURY_POLICY_CHANGE' | 'TREASURY_BUDGET' | 'TREASURY_DISBURSEMENT';
  readonly aiPrepared: boolean;
  readonly aiVoted: false;
  readonly aiApproved: false;
  readonly humanGovernanceRequired: true;
  readonly rootOfTrustKeyRefs: readonly string[];
  readonly emergencyHeightened: boolean;
};

export type TreasuryTransparencyReport = {
  readonly classification: 'PUBLIC_PROTOCOL_TREASURY';
  readonly distinctFromCustomerCustody: true;
  readonly distinctFromFiatLedger: true;
  readonly distinctFromExchangeCustomerBalances: true;
  readonly policyVersion: string;
  readonly reserves: readonly {
    readonly reserveClass: ProtocolReserveClass;
    readonly asset: NativeMonetaryAssetId;
    readonly available: string;
    readonly reserved: string;
    readonly encumbered: string;
  }[];
  readonly budgets: readonly {
    readonly budgetId: string;
    readonly asset: NativeMonetaryAssetId;
    readonly reserveClass: ProtocolReserveClass;
    readonly purpose: TreasuryPurposeClass;
    readonly maximumAuthorizedQuantity: string;
    readonly remainingQuantity: string;
    readonly approvalState: BudgetApprovalState;
    readonly cycleId: string;
  }[];
  readonly approvedDisbursements: readonly {
    readonly intentId: string;
    readonly quantity: string;
    readonly purpose: TreasuryPurposeClass;
    readonly state: DisbursementState;
  }[];
  readonly finalizedDisbursements: readonly {
    readonly receiptId: string;
    readonly quantity: string;
    readonly purpose: TreasuryPurposeClass;
    readonly chainFinalityRef: string;
  }[];
  readonly credentialsExposed: false;
  readonly confidentialVendorDataExposed: false;
};

export type TreasurySolvencyMetrics = {
  readonly classification: typeof ENGINEERING_SIMULATION;
  readonly bankSolvencyClaim: false;
  readonly depositInsuranceClaim: false;
  readonly availableReserve: bigint;
  readonly reservedReserve: bigint;
  readonly budgetObligations: bigint;
  readonly fundingInflow: bigint;
  readonly outflow: bigint;
  readonly coverageRatioNumerator: bigint;
  readonly coverageRatioDenominator: bigint;
  readonly reserveConcentration: readonly {
    readonly reserveClass: ProtocolReserveClass;
    readonly quantity: bigint;
    readonly shareNumerator: bigint;
    readonly shareDenominator: bigint;
  }[];
};

export type TreasuryResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: TreasuryRefusalCode; readonly message: string };

export const TREASURY_REFUSAL_CODES = [
  'TREASURY_MINT_UNAVAILABLE',
  'CUSTOMER_ASSETS_UNREACHABLE',
  'UNAUTHORIZED_BUDGET_REJECTED',
  'AI_APPROVAL_REJECTED',
  'WRONG_ASSET_REJECTED',
  'OVERSPEND_REJECTED',
  'DUPLICATE_DISBURSEMENT_REJECTED',
  'RESERVATION_RACE_REJECTED',
  'TAMPERED_RECIPIENT_REJECTED',
  'TAMPERED_QUANTITY_REJECTED',
  'EMERGENCY_CANNOT_REWRITE_SUPPLY',
  'EMERGENCY_CANNOT_MINT',
  'EMERGENCY_CANNOT_CONFISCATE_CUSTOMER_ASSETS',
  'EMERGENCY_CANNOT_ROLLBACK_FINALITY',
  'EMERGENCY_CANNOT_CHANGE_MONETARY_POLICY',
  'FIAT_REPRESENTATION_FORBIDDEN',
  'PRICE_PEG_FORBIDDEN',
  'UNAUTHORIZED_RECIPIENT_REJECTED',
  'UNAUTHORIZED_PURPOSE_REJECTED',
  'UNAUTHORIZED_RESERVE_REJECTED',
  'UNAUTHORIZED_FUNDING_SOURCE_REJECTED',
  'OFF_CHAIN_APPROVAL_DOES_NOT_MOVE_ASSETS',
  'BUDGET_NOT_APPROVED',
  'INTENT_NOT_APPROVED',
  'INTENT_EXPIRED',
  'POLICY_VERSION_MISMATCH',
  'HEIGHTENED_APPROVAL_REQUIRED',
  'PRODUCTION_TREASURY_INACTIVE',
  'MOONREY_HOLDING_IS_NOT_PRODUCTIVE',
  'EXCHANGE_PRIVILEGED_TRADING_FORBIDDEN',
  'UNKNOWN_ACCOUNT',
  'UNKNOWN_BUDGET',
  'UNKNOWN_INTENT',
  'UNKNOWN_RESERVATION',
] as const;
export type TreasuryRefusalCode = (typeof TREASURY_REFUSAL_CODES)[number];

