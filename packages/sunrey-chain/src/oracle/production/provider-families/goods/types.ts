/**
 * Chunk 137 — Goods and commercial-fulfillment economic data fabric types.
 *
 * Provider-neutral evidence for finished goods, goods completion, and
 * commercial delivery/acceptance. Extends the existing production-oracle
 * owner. Does not create a second oracle, mint, or unit authority.
 * Production valuation remains inactive.
 *
 * Invoice, payment, and order records may corroborate a commercial
 * event. They are not productive output.
 */

import type { FactType, UnitCode } from '../../../types.ts';
import type { ClaimType, ProductiveCategory } from '../../../../productive/types.ts';

export const GOODS_FABRIC_ID = 'sunrey.goods-commerce-data-fabric.v1' as const;
export const GOODS_FABRIC_SCHEMA_VERSION = 1 as const;

export const PRODUCTION_ACTIVE = false as const;
export const REAL_PROVIDER_CONTACTED = false as const;
export const GOODS_FACT_AUTO_MINTS = false as const;
export const ORDER_EQUALS_OUTPUT = false as const;
export const PAYMENT_EQUALS_PRODUCTIVE_OUTPUT = false as const;
export const INVOICE_EQUALS_COMPLETED_SERVICE = false as const;
export const MANUFACTURING_PLUS_GOODS_DOUBLE_COUNT = false as const;
export const CARRIER_PLUS_GOODS_DELIVERY_DOUBLE_COUNT = false as const;
export const HUMAN_WORTH_SCORING = false as const;
export const FLOAT_MATH_USED = false as const;

export const GOODS_SOURCE_CLASSES = [
  'ERP_GOODS_LEDGER',
  'ORDER_MANAGEMENT_SYSTEM',
  'WAREHOUSE_FULFILLMENT_SYSTEM',
  'MERCHANT_FULFILLMENT_SYSTEM',
  'PRODUCT_BATCH_REGISTRY',
  'SERIALIZED_GOODS_SYSTEM',
  'POINT_OF_SALE_REFERENCE',
  'RECEIVER_ACCEPTANCE_SYSTEM',
  'INDEPENDENT_GOODS_ATTESTATION',
] as const;
export type GoodsSourceClass = (typeof GOODS_SOURCE_CLASSES)[number];

export const GOODS_FACT_TYPES = ['GOODS_OUTPUT', 'GOODS_DELIVERY'] as const satisfies readonly FactType[];
export type GoodsFactType = (typeof GOODS_FACT_TYPES)[number];

export const FORBIDDEN_GOODS_FACT_TYPES = ['REVENUE', 'SALES_VALUE', 'INVOICE_VALUE'] as const;
export type ForbiddenGoodsFactType = (typeof FORBIDDEN_GOODS_FACT_TYPES)[number];

export const GOODS_LIFECYCLE_STATES = [
  'CREATED',
  'ACCEPTED',
  'REJECTED',
  'AVAILABLE',
  'FULFILLED',
  'RETURNED',
  'DESTROYED',
] as const;
export type GoodsLifecycleState = (typeof GOODS_LIFECYCLE_STATES)[number];

/** Only these realized states may support GOODS_OUTPUT. */
export const GOODS_OUTPUT_ELIGIBLE_STATES = ['ACCEPTED', 'AVAILABLE', 'FULFILLED'] as const;
export type GoodsOutputEligibleState = (typeof GOODS_OUTPUT_ELIGIBLE_STATES)[number];

export const ORDER_LIFECYCLE_STATES = [
  'QUOTE',
  'CART',
  'ORDER_CREATED',
  'ORDER_ACCEPTED',
  'BACKORDER',
  'SCHEDULED',
] as const;
export type OrderLifecycleState = (typeof ORDER_LIFECYCLE_STATES)[number];

export const FULFILLMENT_STATES = [
  'PICKED',
  'PACKED',
  'SHIPPED',
  'IN_TRANSIT',
  'DELIVERED',
  'RECEIVED',
  'ACCEPTED',
] as const;
export type FulfillmentState = (typeof FULFILLMENT_STATES)[number];

export const GOODS_DELIVERY_COMPLETION_STATES = ['DELIVERED', 'RECEIVED', 'ACCEPTED'] as const;
export type GoodsDeliveryCompletionState = (typeof GOODS_DELIVERY_COMPLETION_STATES)[number];

export const GOODS_UNITS = ['units_produced', 'UNIT', 'kg', 'tonne'] as const;
export type GoodsUnit = (typeof GOODS_UNITS)[number];

export const GOODS_REFUSAL_CODES = [
  'ORDER_IS_NOT_OUTPUT',
  'PAYMENT_IS_NOT_OUTPUT',
  'INVOICE_IS_NOT_OUTPUT',
  'GOODS_STATE_NOT_REALIZED',
  'DELIVERY_NOT_COMPLETED',
  'CANCELLED_BEFORE_REALIZATION',
  'FORBIDDEN_FACT_TYPE',
  'ITEM_COUNT_TO_MASS_FORBIDDEN',
  'FLOAT_QUANTITY_FORBIDDEN',
  'SCHEMA_DRIFT',
  'SAME_CONTROLLER_FAKE_QUORUM',
  'CUSTOMER_PII_FORBIDDEN',
  'PAYMENT_CREDENTIAL_FORBIDDEN',
  'UNKNOWN_SOURCE_CLASS',
  'UNKNOWN_FACT_TYPE',
  'NETWORK_FORBIDDEN',
  'AUTO_MINT_FORBIDDEN',
  'MANUFACTURING_GOODS_DOUBLE_COUNT',
  'AGRICULTURE_GOODS_DOUBLE_COUNT',
  'CARRIER_GOODS_DELIVERY_DOUBLE_COUNT',
  'RETURN_REPLAY_FORBIDDEN',
  'MISSING_REALIZED_EVIDENCE',
  'WRONG_UNIT',
  'PRICE_IS_NOT_QUANTITY',
] as const;
export type GoodsRefusalCode = (typeof GOODS_REFUSAL_CODES)[number];

export type GoodsRefusal = {
  readonly code: GoodsRefusalCode;
  readonly detail: string;
};

export type GoodsIdentityBundle = {
  readonly skuRef: string | null;
  readonly productRef: string | null;
  readonly batchRef: string | null;
  readonly serialRef: string | null;
  readonly lotRef: string | null;
  readonly orderRef: string | null;
  readonly shipmentRef: string | null;
  readonly warehouseRef: string | null;
  readonly merchantRef: string | null;
  readonly manufacturingEventRef: string | null;
  readonly agricultureEventRef: string | null;
  readonly harvestLotRef: string | null;
  readonly logisticsDeliveryEventRef: string | null;
  readonly licenseRef: string | null;
};

export type GoodsCommercialContext = {
  readonly paymentPresent: boolean;
  readonly invoicePresent: boolean;
  readonly paymentValueMinorUnits: bigint | null;
  readonly invoiceValueMinorUnits: bigint | null;
  readonly salesPriceMinorUnits: bigint | null;
  readonly currency: string | null;
  readonly mapsRevenueToMoonRey: false;
  readonly mapsRevenueToGpuv: false;
};

export type GoodsSourceObservation = {
  readonly observationId: string;
  readonly sourceClass: GoodsSourceClass;
  readonly sourceId: string;
  readonly providerId: string;
  readonly controllerId: string;
  readonly upstreamOrganizationId: string;
  readonly sharedControlGroup: string | null;
  readonly relatedSourceIds: readonly string[];
  readonly factType: FactType | ForbiddenGoodsFactType;
  readonly schemaId: string;
  readonly schemaVersion: number;
  readonly sourceTimestampUnix: bigint;
  readonly numericValue: string;
  readonly unit: string;
  readonly goodsState: GoodsLifecycleState;
  readonly orderState: OrderLifecycleState | null;
  readonly fulfillmentState: FulfillmentState | null;
  readonly identity: GoodsIdentityBundle;
  readonly commercial: GoodsCommercialContext;
  readonly cancelled: boolean;
  readonly cancelledAfterRealization: boolean;
  readonly returnOfObservationId: string | null;
  readonly monetaryAlreadySettled: boolean;
  readonly productSpecificMassEvidence: boolean;
  readonly extras?: Readonly<Record<string, unknown>>;
  readonly rawCustomerName?: string;
  readonly rawShippingAddress?: string;
  readonly rawEmail?: string;
  readonly rawPhone?: string;
  readonly orderNotes?: string;
  readonly paymentCardData?: string;
  readonly networkCallAttempted?: boolean;
};

export type PublicGoodsEvidence = {
  readonly observationId: string;
  readonly sourceClass: GoodsSourceClass;
  readonly factType: GoodsFactType;
  readonly claimType: ClaimType;
  readonly productiveCategory: ProductiveCategory;
  readonly goodsState: GoodsLifecycleState;
  readonly unit: string;
  readonly mantissa: string;
  readonly identity: GoodsIdentityBundle;
  readonly licenseRef: string | null;
  readonly containsCustomerPii: false;
  readonly containsPaymentCredentials: false;
  readonly orderEqualsOutput: false;
  readonly paymentEqualsOutput: false;
  readonly mintsMoonRey: false;
};

export function isGoodsSourceClass(value: string): value is GoodsSourceClass {
  return (GOODS_SOURCE_CLASSES as readonly string[]).includes(value);
}

export function isGoodsFactType(value: string): value is GoodsFactType {
  return (GOODS_FACT_TYPES as readonly string[]).includes(value);
}

export function isForbiddenGoodsFactType(value: string): value is ForbiddenGoodsFactType {
  return (FORBIDDEN_GOODS_FACT_TYPES as readonly string[]).includes(value);
}

export function isGoodsOutputEligible(state: GoodsLifecycleState): boolean {
  return (GOODS_OUTPUT_ELIGIBLE_STATES as readonly string[]).includes(state);
}

export function isGoodsDeliveryCompleted(state: FulfillmentState | null): boolean {
  return state !== null && (GOODS_DELIVERY_COMPLETION_STATES as readonly string[]).includes(state);
}

export function goodsFactCannotAutoMint(): true {
  return GOODS_FACT_AUTO_MINTS === false;
}

export function orderDoesNotEqualOutput(): true {
  return ORDER_EQUALS_OUTPUT === false;
}

export function paymentDoesNotEqualOutput(): true {
  return PAYMENT_EQUALS_PRODUCTIVE_OUTPUT === false;
}

export function isGoodsUnit(unit: string): unit is GoodsUnit | UnitCode {
  return (GOODS_UNITS as readonly string[]).includes(unit);
}
