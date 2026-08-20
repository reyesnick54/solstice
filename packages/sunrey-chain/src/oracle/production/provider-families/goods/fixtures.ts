/**
 * Deterministic goods / commerce fixtures. Not commercial providers.
 */

import { GOODS_SCHEMA_IDS } from './schemas.ts';
import type {
  GoodsCommercialContext,
  GoodsIdentityBundle,
  GoodsSourceObservation,
} from './types.ts';

export const SANDBOX_NOW = 1_700_000_000n;
export const SANDBOX_CONTROLLER = 'controller.retailer.alpha';
export const SANDBOX_ORG = 'org.retailer.alpha';
export const SANDBOX_BATCH = 'batch.FG.100';
export const SANDBOX_MFG_EVENT = 'mfg.B1';
export const SANDBOX_AG_EVENT = 'ag.harvest.H1';
export const SANDBOX_CARRIER_EVENT = 'logistics.delivery.D1';

function identity(overrides: Partial<GoodsIdentityBundle> = {}): GoodsIdentityBundle {
  return Object.freeze({
    skuRef: 'sku.device.a',
    productRef: 'product.device.a',
    batchRef: SANDBOX_BATCH,
    serialRef: null,
    lotRef: 'lot.FG.100',
    orderRef: 'order.1001',
    shipmentRef: 'shp.FG.100',
    warehouseRef: 'wh.alpha',
    merchantRef: 'merchant.alpha',
    manufacturingEventRef: SANDBOX_MFG_EVENT,
    agricultureEventRef: null,
    harvestLotRef: null,
    logisticsDeliveryEventRef: null,
    licenseRef: null,
    ...overrides,
  });
}

function commercial(overrides: Partial<GoodsCommercialContext> = {}): GoodsCommercialContext {
  return Object.freeze({
    paymentPresent: false,
    invoicePresent: false,
    paymentValueMinorUnits: null,
    invoiceValueMinorUnits: null,
    salesPriceMinorUnits: null,
    currency: null,
    mapsRevenueToMoonRey: false,
    mapsRevenueToGpuv: false,
    ...overrides,
  });
}

export function goodsObservation(
  overrides: Partial<GoodsSourceObservation> &
    Pick<GoodsSourceObservation, 'observationId' | 'sourceClass' | 'factType'>,
): GoodsSourceObservation {
  return Object.freeze({
    sourceId: 'src.goods.1',
    providerId: 'provider.goods.sandbox',
    controllerId: SANDBOX_CONTROLLER,
    upstreamOrganizationId: SANDBOX_ORG,
    sharedControlGroup: null,
    relatedSourceIds: Object.freeze([]),
    schemaId: overrides.factType === 'GOODS_DELIVERY' ? GOODS_SCHEMA_IDS.GOODS_DELIVERY : GOODS_SCHEMA_IDS.GOODS_OUTPUT,
    schemaVersion: 1,
    sourceTimestampUnix: SANDBOX_NOW,
    numericValue: '100',
    unit: 'units_produced',
    goodsState: 'ACCEPTED',
    orderState: null,
    fulfillmentState: null,
    identity: identity(),
    commercial: commercial(),
    cancelled: false,
    cancelledAfterRealization: false,
    returnOfObservationId: null,
    monetaryAlreadySettled: false,
    productSpecificMassEvidence: false,
    ...overrides,
  });
}

export const VALID_FINISHED_GOODS_BATCH = goodsObservation({
  observationId: 'obs.goods.output.valid',
  sourceClass: 'ERP_GOODS_LEDGER',
  factType: 'GOODS_OUTPUT',
  goodsState: 'AVAILABLE',
});

export const VALID_GOODS_DELIVERY = goodsObservation({
  observationId: 'obs.goods.delivery.valid',
  sourceClass: 'RECEIVER_ACCEPTANCE_SYSTEM',
  factType: 'GOODS_DELIVERY',
  goodsState: 'FULFILLED',
  fulfillmentState: 'ACCEPTED',
  numericValue: '100',
  identity: identity({ logisticsDeliveryEventRef: SANDBOX_CARRIER_EVENT }),
});

export const ORDER_AS_OUTPUT = goodsObservation({
  observationId: 'obs.goods.order-as-output',
  sourceClass: 'ORDER_MANAGEMENT_SYSTEM',
  factType: 'GOODS_OUTPUT',
  goodsState: 'CREATED',
  orderState: 'ORDER_CREATED',
});

export const PAYMENT_AS_OUTPUT = goodsObservation({
  observationId: 'obs.goods.payment-as-output',
  sourceClass: 'POINT_OF_SALE_REFERENCE',
  factType: 'GOODS_OUTPUT',
  goodsState: 'CREATED',
  commercial: commercial({
    paymentPresent: true,
    paymentValueMinorUnits: 12_500n,
    currency: 'USD',
  }),
});

export const CANCELLED_UNFULFILLED_ORDER = goodsObservation({
  observationId: 'obs.goods.cancelled-order',
  sourceClass: 'ORDER_MANAGEMENT_SYSTEM',
  factType: 'GOODS_OUTPUT',
  goodsState: 'CREATED',
  orderState: 'ORDER_ACCEPTED',
  cancelled: true,
  cancelledAfterRealization: false,
});

export const IN_TRANSIT_DELIVERY = goodsObservation({
  observationId: 'obs.goods.in-transit',
  sourceClass: 'WAREHOUSE_FULFILLMENT_SYSTEM',
  factType: 'GOODS_DELIVERY',
  goodsState: 'FULFILLED',
  fulfillmentState: 'IN_TRANSIT',
});

export const RETURNED_GOOD = goodsObservation({
  observationId: 'obs.goods.return',
  sourceClass: 'ERP_GOODS_LEDGER',
  factType: 'GOODS_OUTPUT',
  goodsState: 'RETURNED',
  returnOfObservationId: 'obs.goods.output.valid',
  monetaryAlreadySettled: true,
});

export const RETURN_REPLAY = goodsObservation({
  observationId: 'obs.goods.return-replay',
  sourceClass: 'ERP_GOODS_LEDGER',
  factType: 'GOODS_OUTPUT',
  goodsState: 'ACCEPTED',
  returnOfObservationId: 'obs.goods.return',
});

export const AGRICULTURE_GOODS_BATCH = goodsObservation({
  observationId: 'obs.goods.ag-batch',
  sourceClass: 'PRODUCT_BATCH_REGISTRY',
  factType: 'GOODS_OUTPUT',
  goodsState: 'AVAILABLE',
  unit: 'kg',
  numericValue: '250',
  productSpecificMassEvidence: true,
  identity: identity({
    manufacturingEventRef: null,
    agricultureEventRef: SANDBOX_AG_EVENT,
    harvestLotRef: 'harvest.H1',
    batchRef: 'batch.produce.H1',
    lotRef: 'harvest.H1',
  }),
});

export const SAME_CONTROLLER_QUORUM = goodsObservation({
  observationId: 'obs.goods.same-controller',
  sourceClass: 'ERP_GOODS_LEDGER',
  factType: 'GOODS_OUTPUT',
  goodsState: 'AVAILABLE',
  sharedControlGroup: 'retailer.alpha.apis',
  relatedSourceIds: Object.freeze(['src.goods.1', 'src.oms.1', 'src.wms.1', 'src.pos.1']),
});

export const CUSTOMER_PII_LEAK = goodsObservation({
  observationId: 'obs.goods.pii',
  sourceClass: 'MERCHANT_FULFILLMENT_SYSTEM',
  factType: 'GOODS_DELIVERY',
  fulfillmentState: 'DELIVERED',
  goodsState: 'FULFILLED',
  rawCustomerName: 'Ada Lovelace',
  rawShippingAddress: '1 Sandbox Lane',
  rawEmail: 'ada@example.test',
});

export const PAYMENT_CARD_LEAK = goodsObservation({
  observationId: 'obs.goods.card',
  sourceClass: 'POINT_OF_SALE_REFERENCE',
  factType: 'GOODS_DELIVERY',
  fulfillmentState: 'ACCEPTED',
  goodsState: 'FULFILLED',
  paymentCardData: '4111111111111111',
});

export const FLOAT_QUANTITY = goodsObservation({
  observationId: 'obs.goods.float',
  sourceClass: 'ERP_GOODS_LEDGER',
  factType: 'GOODS_OUTPUT',
  goodsState: 'AVAILABLE',
  numericValue: '12.5',
});

export const SCHEMA_DRIFT = goodsObservation({
  observationId: 'obs.goods.drift',
  sourceClass: 'ERP_GOODS_LEDGER',
  factType: 'GOODS_OUTPUT',
  goodsState: 'AVAILABLE',
  schemaId: 'goods.output.v1.changed',
  schemaVersion: 2,
});

export const ITEM_COUNT_AS_MASS = goodsObservation({
  observationId: 'obs.goods.item-as-mass',
  sourceClass: 'ERP_GOODS_LEDGER',
  factType: 'GOODS_OUTPUT',
  goodsState: 'AVAILABLE',
  unit: 'units_produced',
  extras: Object.freeze({ massEquivalent: '12kg' }),
});

export const FORBIDDEN_REVENUE_FACT = goodsObservation({
  observationId: 'obs.goods.revenue',
  sourceClass: 'ERP_GOODS_LEDGER',
  factType: 'REVENUE',
  goodsState: 'AVAILABLE',
});

export const NETWORK_ATTEMPT = goodsObservation({
  observationId: 'obs.goods.network',
  sourceClass: 'ERP_GOODS_LEDGER',
  factType: 'GOODS_OUTPUT',
  goodsState: 'AVAILABLE',
  networkCallAttempted: true,
});
