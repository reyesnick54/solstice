/**
 * Chunk 45 — SunRey machine economic identity and commerce types.
 *
 * A machine is not a wallet with unlimited authority. Every identity
 * resolves to owner, controller, capabilities, limits, purpose,
 * jurisdiction, cryptographic identity, and revocation state.
 *
 * MachineType refines the canonical ActorType. It is not a second
 * actor system.
 */

import type { ActorType } from '../protocol/actor.ts';
import type { NativeAssetId } from '../protocol/assets.ts';

export const MACHINE_ECONOMY_SCHEMA_VERSION = 1 as const;
export const MACHINE_ECONOMY_POLICY_VERSION = 1 as const;

export const MACHINE_TYPES = [
  'AI_AGENT',
  'ROBOT',
  'DEVICE',
  'AUTOMATED_SERVICE',
  'COMPUTE_NODE',
  'PRODUCTIVE_MACHINE',
  'SENSOR',
  'VEHICLE_MACHINE',
  'INDUSTRIAL_MACHINE',
] as const;
export type MachineType = (typeof MACHINE_TYPES)[number];

/** Canonical ActorType each machine type binds to. No parallel actor system. */
export const MACHINE_TYPE_TO_ACTOR: { readonly [K in MachineType]: ActorType } = {
  AI_AGENT: 'AI_AGENT',
  ROBOT: 'ROBOT',
  DEVICE: 'DEVICE',
  AUTOMATED_SERVICE: 'PRODUCTIVE_ASSET',
  COMPUTE_NODE: 'PRODUCTIVE_ASSET',
  PRODUCTIVE_MACHINE: 'PRODUCTIVE_ASSET',
  SENSOR: 'DEVICE',
  VEHICLE_MACHINE: 'ROBOT',
  INDUSTRIAL_MACHINE: 'PRODUCTIVE_ASSET',
};

export const MACHINE_STATUSES = ['ACTIVE', 'RESTRICTED', 'SUSPENDED', 'REVOKED'] as const;
export type MachineStatus = (typeof MACHINE_STATUSES)[number];

export const MACHINE_CAPABILITIES = [
  'PURCHASE_COMPUTE',
  'SELL_COMPUTE',
  'PURCHASE_ENERGY',
  'SELL_ENERGY',
  'PURCHASE_STORAGE',
  'SELL_STORAGE',
  'PURCHASE_BANDWIDTH',
  'SELL_BANDWIDTH',
  'PURCHASE_GOODS',
  'SELL_GOODS',
  'REQUEST_LOGISTICS',
  'PROVIDE_LOGISTICS',
  'PURCHASE_SERVICE',
  'PROVIDE_SERVICE',
] as const;
export type MachineCapability = (typeof MACHINE_CAPABILITIES)[number];

export const SERVICE_CATEGORIES = [
  'GPU_COMPUTE',
  'AI_INFERENCE',
  'ENERGY',
  'BATTERY_STORAGE',
  'MANUFACTURING_TIME',
  'ROBOT_LABOR',
  'WAREHOUSE_STORAGE',
  'NETWORK_BANDWIDTH',
  'DELIVERY_SERVICE',
] as const;
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

export const RESOURCE_UNITS = [
  'GPU_SECOND',
  'INFERENCE_UNIT',
  'KWH',
  'GB_MONTH',
  'BYTE',
  'MANUFACTURED_UNIT',
  'LOGISTICS_METER',
  'SERVICE_SECOND',
] as const;
export type ResourceUnit = (typeof RESOURCE_UNITS)[number];

export const APPROVAL_RULES = [
  'AUTO_WITHIN_MANDATE',
  'CONTROLLER_CONFIRMATION_REQUIRED',
  'MULTI_PARTY_APPROVAL_REQUIRED',
  'DENIED',
] as const;
export type ApprovalRule = (typeof APPROVAL_RULES)[number];

export const COUNTERPARTY_CLASSES = [
  'MACHINE',
  'HUMAN_CONTROLLER',
  'ENTERPRISE',
  'LEGAL_ENTITY',
  'AUTOMATED_SERVICE',
] as const;
export type CounterpartyClass = (typeof COUNTERPARTY_CLASSES)[number];

export const MACHINE_ACTIONS = [
  'REGISTER',
  'GRANT_CAPABILITY',
  'SET_SPENDING_MANDATE',
  'SET_RESOURCE_MANDATE',
  'POST_OFFER',
  'SUBMIT_PURCHASE',
  'LOCK_ESCROW',
  'START_METERING',
  'REPORT_DELIVERY',
  'FINALIZE_DELIVERY',
  'SETTLE',
  'OPEN_DISPUTE',
  'REVOKE',
  'ROTATE_KEYS',
  'RESTRICT',
  'SUSPEND',
  'RECOVER',
] as const;
export type MachineAction = (typeof MACHINE_ACTIONS)[number];

export const FORBIDDEN_MACHINE_AUTHORITIES = [
  'VOTE_VALIDATOR_CONSENSUS',
  'VOTE_PROTOCOL_GOVERNANCE',
  'ISSUE_EXECUTION_AUTHORITY',
  'CHANGE_CRYPTO_SUITE_POLICY',
  'MODIFY_ORACLE_REGISTRY_AUTHORITY',
  'CHANGE_MOONREY_ISSUANCE_POLICY',
  'BECOME_VALIDATOR',
  'ISSUE_MOONREY_DIRECTLY',
] as const;
export type ForbiddenMachineAuthority = (typeof FORBIDDEN_MACHINE_AUTHORITIES)[number];

export const ESCROW_STATUSES = [
  'LOCKED',
  'PARTIALLY_RELEASED',
  'SETTLED',
  'RELEASED_UNUSED',
  'DISPUTED',
  'RECOVERY_HOLD',
] as const;
export type EscrowStatus = (typeof ESCROW_STATUSES)[number];

export const METERING_STATUSES = ['PENDING', 'ACTIVE', 'CLOSED', 'CONFLICTED'] as const;
export type MeteringStatus = (typeof METERING_STATUSES)[number];

export const DISPUTE_REASONS = [
  'DELIVERY_MISMATCH',
  'METER_CONFLICT',
  'ORACLE_CONFLICT',
  'QUALITY_ATTESTATION_FAILURE',
  'PAYMENT_CONDITION_FAILURE',
] as const;
export type DisputeReason = (typeof DISPUTE_REASONS)[number];

export const MATCHING_MODES = ['DIRECT_BILATERAL', 'EXCHANGE_ADAPTER'] as const;
export type MatchingMode = (typeof MATCHING_MODES)[number];

export const FUTURE_MACHINE_MARKETS = [
  'COMPUTE_CAPACITY',
  'ENERGY',
  'MACHINE_SERVICES',
  'PRODUCTIVE_CAPACITY_RIGHTS',
] as const;
export type FutureMachineMarket = (typeof FUTURE_MACHINE_MARKETS)[number];

export const FACT_SOURCES = ['ORACLE_NETWORK', 'MACHINE_SELF_REPORT'] as const;
export type FactSource = (typeof FACT_SOURCES)[number];

export const REJECTION_CODES = [
  'MACHINE_NOT_FOUND',
  'MACHINE_NOT_ACTIVE',
  'CAPABILITY_MISSING',
  'UNAUTHORIZED_SERVICE',
  'SPENDING_LIMIT_EXCEEDED',
  'RESOURCE_LIMIT_EXCEEDED',
  'UNSUPPORTED_ASSET',
  'MANDATE_EXPIRED',
  'MANDATE_PURPOSE_MISMATCH',
  'COUNTERPARTY_CLASS_DENIED',
  'APPROVAL_DENIED',
  'CONTROLLER_CONFIRMATION_REQUIRED',
  'MULTI_PARTY_APPROVAL_REQUIRED',
  'KEY_REVOKED',
  'KEY_COMPROMISED',
  'SIGNATURE_INVALID',
  'NONCE_REPLAY',
  'INTENT_EXPIRED',
  'FORBIDDEN_AUTHORITY',
  'ORACLE_CONFLICT',
  'SELF_REPORT_INSUFFICIENT',
  'ESCROW_NOT_FOUND',
  'ESCROW_UNSAFE_STATE',
  'FEE_BYPASS_REJECTED',
  'OFFER_NOT_FOUND',
  'QUANTITY_INVALID',
] as const;
export type RejectionCode = (typeof REJECTION_CODES)[number];

export const SEPARATED_KEY_KINDS = [
  'MACHINE_SIGNING',
  'VALIDATOR_CONSENSUS',
  'GOVERNANCE',
  'EXECUTION_AUTHORITY',
  'HUMAN_WALLET_RECOVERY',
  'ORACLE_PROVIDER',
  'P2P_VALIDATOR',
] as const;
export type SeparatedKeyKind = (typeof SEPARATED_KEY_KINDS)[number];

export type IntegerQuantity = bigint;

export type MachineKeyRecord = {
  readonly keyId: string;
  readonly purpose: 'MACHINE_SIGNING';
  readonly suiteId: string;
  readonly publicKeyHex: string;
  readonly version: number;
  readonly status: 'ACTIVE' | 'ROTATED' | 'REVOKED';
  readonly createdAtUtc: string;
  readonly rotatedFrom: string | null;
};

export type CapabilityManifest = {
  readonly schemaVersion: typeof MACHINE_ECONOMY_SCHEMA_VERSION;
  readonly capabilities: readonly MachineCapability[];
  readonly grantedByController: string;
  readonly grantedAtUtc: string;
  readonly policyVersion: typeof MACHINE_ECONOMY_POLICY_VERSION;
};

export type MachineSpendingMandate = {
  readonly schemaVersion: typeof MACHINE_ECONOMY_SCHEMA_VERSION;
  readonly mandateId: string;
  readonly allowedAssetIds: readonly NativeAssetId[];
  readonly maxPerTransaction: IntegerQuantity;
  readonly maxPerEpoch: IntegerQuantity;
  readonly maxOutstandingCommitments: IntegerQuantity;
  readonly approvedCounterpartyClasses: readonly CounterpartyClass[];
  readonly approvedServiceCategories: readonly ServiceCategory[];
  readonly purposeConstraints: readonly string[];
  readonly expiresAtUtc: string;
  readonly controllerApprovalThreshold: ApprovalRule;
  readonly policyVersion: typeof MACHINE_ECONOMY_POLICY_VERSION;
};

export type MachineResourceMandate = {
  readonly schemaVersion: typeof MACHINE_ECONOMY_SCHEMA_VERSION;
  readonly mandateId: string;
  readonly maxCompute: IntegerQuantity;
  readonly maxEnergy: IntegerQuantity;
  readonly maxBandwidth: IntegerQuantity;
  readonly maxStorage: IntegerQuantity;
  readonly maxProductionCommitment: IntegerQuantity;
  readonly maxDeliveryObligation: IntegerQuantity;
  readonly unitRefs: Readonly<Record<string, ResourceUnit>>;
};

export type MachineEconomicIdentity = {
  readonly schemaVersion: typeof MACHINE_ECONOMY_SCHEMA_VERSION;
  readonly machineId: string;
  readonly actorId: string;
  readonly actorType: ActorType;
  readonly machineType: MachineType;
  readonly ownerActor: string;
  readonly controllerActor: string;
  readonly operatorActor: string | null;
  readonly hardwareIdentityRef: string;
  readonly softwareModelRef: string;
  readonly firmwareHash: string;
  readonly modelHash: string;
  readonly keys: readonly MachineKeyRecord[];
  readonly cryptoSuiteId: string;
  readonly capabilityManifest: CapabilityManifest;
  readonly approvedAssets: readonly NativeAssetId[];
  readonly spendingMandate: MachineSpendingMandate | null;
  readonly resourceMandate: MachineResourceMandate | null;
  readonly jurisdiction: string;
  readonly policyRefs: readonly string[];
  readonly activatedAtUtc: string;
  readonly expiresAtUtc: string | null;
  readonly status: MachineStatus;
  readonly revocationReason: string | null;
};

export type MachineActionIntent = {
  readonly schemaVersion: typeof MACHINE_ECONOMY_SCHEMA_VERSION;
  readonly intentId: string;
  readonly machineId: string;
  readonly action: MachineAction;
  readonly counterpartyId: string | null;
  readonly resource: ServiceCategory | null;
  readonly quantity: IntegerQuantity;
  readonly unit: ResourceUnit | null;
  readonly assetId: NativeAssetId | null;
  readonly maxPrice: IntegerQuantity;
  readonly purpose: string;
  readonly mandateRef: string | null;
  readonly expiresAtUtc: string;
  readonly nonce: string;
  readonly signatureHex: string;
  readonly publicKeyHex: string;
  readonly keyId: string;
};

export type MachineServiceOffer = {
  readonly schemaVersion: typeof MACHINE_ECONOMY_SCHEMA_VERSION;
  readonly offerId: string;
  readonly providerMachineId: string;
  readonly serviceCategory: ServiceCategory;
  readonly capacity: IntegerQuantity;
  readonly unit: ResourceUnit;
  readonly pricePerUnit: IntegerQuantity;
  readonly acceptedAssets: readonly NativeAssetId[];
  readonly availableFromUtc: string;
  readonly availableUntilUtc: string;
  readonly location: string;
  readonly jurisdiction: string;
  readonly oracleRequired: boolean;
  readonly meteringRequired: boolean;
  readonly settlementAsset: NativeAssetId;
  readonly market: FutureMachineMarket;
};

export type MachinePurchaseOrder = {
  readonly schemaVersion: typeof MACHINE_ECONOMY_SCHEMA_VERSION;
  readonly orderId: string;
  readonly buyerMachineId: string;
  readonly providerMachineId: string;
  readonly offerId: string;
  readonly resource: ServiceCategory;
  readonly quantity: IntegerQuantity;
  readonly unit: ResourceUnit;
  readonly maxPrice: IntegerQuantity;
  readonly deliveryFromUtc: string;
  readonly deliveryUntilUtc: string;
  readonly meteringMethod: 'ORACLE_NETWORK' | 'POLICY_PERMITTED_SELF_REPORT';
  readonly settlementAsset: NativeAssetId;
  readonly escrowRequired: true;
  readonly purpose: string;
  readonly matchingMode: MatchingMode;
  readonly protocolFee: IntegerQuantity;
};

export type MachineEscrow = {
  readonly escrowId: string;
  readonly orderId: string;
  readonly buyerMachineId: string;
  readonly providerMachineId: string;
  readonly assetId: NativeAssetId;
  readonly locked: IntegerQuantity;
  readonly paid: IntegerQuantity;
  readonly releasedUnused: IntegerQuantity;
  readonly status: EscrowStatus;
  readonly lockRef: string;
};

export type MeteringSession = {
  readonly sessionId: string;
  readonly orderId: string;
  readonly buyerMachineId: string;
  readonly providerMachineId: string;
  readonly resource: ServiceCategory;
  readonly unit: ResourceUnit;
  readonly maximumQuantity: IntegerQuantity;
  readonly startUtc: string;
  readonly endUtc: string | null;
  readonly meterFeedIds: readonly string[];
  readonly settlementAsset: NativeAssetId;
  readonly status: MeteringStatus;
};

export type VerifiedEconomicFact = {
  readonly factId: string;
  readonly sessionId: string;
  readonly resource: ServiceCategory;
  readonly quantity: IntegerQuantity;
  readonly unit: ResourceUnit;
  readonly source: FactSource;
  readonly finalized: boolean;
  readonly conflicted: boolean;
  readonly oracleRefs: readonly string[];
};

export type MachineDeliveryProof = {
  readonly proofId: string;
  readonly sessionId: string;
  readonly orderId: string;
  readonly factIds: readonly string[];
  readonly deliveredQuantity: IntegerQuantity;
  readonly unit: ResourceUnit;
  readonly finalized: boolean;
  readonly highValue: boolean;
};

export type MachineSettlement = {
  readonly settlementId: string;
  readonly orderId: string;
  readonly escrowId: string;
  readonly assetId: NativeAssetId;
  readonly paid: IntegerQuantity;
  readonly unusedReleased: IntegerQuantity;
  readonly protocolFee: IntegerQuantity;
  readonly converted: false;
  readonly productiveEligible: boolean;
  readonly moonreyIssued: false;
};

export type MachineCommerceDispute = {
  readonly disputeId: string;
  readonly orderId: string;
  readonly escrowId: string;
  readonly reason: DisputeReason;
  readonly openedBy: string;
  readonly aiBindingResolution: false;
  readonly assetsPreserved: true;
  readonly status: 'OPEN' | 'RECOVERY';
};

export type MachineRejection = {
  readonly rejectionId: string;
  readonly machineId: string;
  readonly code: RejectionCode;
  readonly reason: string;
  readonly atUtc: string;
  readonly intentId: string | null;
};

export type MachineAuditRecord = {
  readonly kind: string;
  readonly machineId: string | null;
  readonly contentHash: string;
  readonly atUtc: string;
  readonly payload: Readonly<Record<string, string | number | boolean | null>>;
};

export type MachineEconomyMetrics = {
  readonly active_machine_identities: number;
  readonly machine_transactions: number;
  readonly machine_transaction_rejections: number;
  readonly machine_escrow_locked: string;
  readonly machine_settlement_volume_by_asset: Readonly<Record<NativeAssetId, string>>;
  readonly machine_resource_volume: string;
  readonly machine_mandate_rejections: number;
  readonly machine_revocations: number;
  readonly machine_disputes: number;
  readonly machine_oracle_conflicts: number;
};
