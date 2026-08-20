/**
 * Provider-neutral goods source-class profiles. Named commerce vendors
 * are not connected.
 */

import type { GoodsFactType, GoodsSourceClass } from './types.ts';
import type { ClaimType, ProductiveCategory } from '../../../../productive/types.ts';

export type GoodsSourceProfile = {
  readonly sourceClass: GoodsSourceClass;
  readonly factType: GoodsFactType;
  readonly productiveCategory: ProductiveCategory;
  readonly claimType: ClaimType;
  readonly defaultUnit: 'units_produced' | 'kg' | 'tonne';
  readonly namedVendorRequired: false;
};

export const GOODS_SOURCE_PROFILES: Readonly<Record<GoodsSourceClass, GoodsSourceProfile>> = Object.freeze({
  ERP_GOODS_LEDGER: Object.freeze({
    sourceClass: 'ERP_GOODS_LEDGER',
    factType: 'GOODS_OUTPUT',
    productiveCategory: 'GOODS',
    claimType: 'OUTPUT',
    defaultUnit: 'units_produced',
    namedVendorRequired: false,
  }),
  ORDER_MANAGEMENT_SYSTEM: Object.freeze({
    sourceClass: 'ORDER_MANAGEMENT_SYSTEM',
    factType: 'GOODS_OUTPUT',
    productiveCategory: 'GOODS',
    claimType: 'OUTPUT',
    defaultUnit: 'units_produced',
    namedVendorRequired: false,
  }),
  WAREHOUSE_FULFILLMENT_SYSTEM: Object.freeze({
    sourceClass: 'WAREHOUSE_FULFILLMENT_SYSTEM',
    factType: 'GOODS_DELIVERY',
    productiveCategory: 'GOODS',
    claimType: 'DELIVERY',
    defaultUnit: 'units_produced',
    namedVendorRequired: false,
  }),
  MERCHANT_FULFILLMENT_SYSTEM: Object.freeze({
    sourceClass: 'MERCHANT_FULFILLMENT_SYSTEM',
    factType: 'GOODS_DELIVERY',
    productiveCategory: 'GOODS',
    claimType: 'DELIVERY',
    defaultUnit: 'units_produced',
    namedVendorRequired: false,
  }),
  PRODUCT_BATCH_REGISTRY: Object.freeze({
    sourceClass: 'PRODUCT_BATCH_REGISTRY',
    factType: 'GOODS_OUTPUT',
    productiveCategory: 'GOODS',
    claimType: 'OUTPUT',
    defaultUnit: 'units_produced',
    namedVendorRequired: false,
  }),
  SERIALIZED_GOODS_SYSTEM: Object.freeze({
    sourceClass: 'SERIALIZED_GOODS_SYSTEM',
    factType: 'GOODS_OUTPUT',
    productiveCategory: 'GOODS',
    claimType: 'OUTPUT',
    defaultUnit: 'units_produced',
    namedVendorRequired: false,
  }),
  POINT_OF_SALE_REFERENCE: Object.freeze({
    sourceClass: 'POINT_OF_SALE_REFERENCE',
    factType: 'GOODS_DELIVERY',
    productiveCategory: 'GOODS',
    claimType: 'DELIVERY',
    defaultUnit: 'units_produced',
    namedVendorRequired: false,
  }),
  RECEIVER_ACCEPTANCE_SYSTEM: Object.freeze({
    sourceClass: 'RECEIVER_ACCEPTANCE_SYSTEM',
    factType: 'GOODS_DELIVERY',
    productiveCategory: 'GOODS',
    claimType: 'DELIVERY',
    defaultUnit: 'units_produced',
    namedVendorRequired: false,
  }),
  INDEPENDENT_GOODS_ATTESTATION: Object.freeze({
    sourceClass: 'INDEPENDENT_GOODS_ATTESTATION',
    factType: 'GOODS_OUTPUT',
    productiveCategory: 'GOODS',
    claimType: 'OUTPUT',
    defaultUnit: 'units_produced',
    namedVendorRequired: false,
  }),
});

export function profileFor(sourceClass: GoodsSourceClass): GoodsSourceProfile {
  return GOODS_SOURCE_PROFILES[sourceClass];
}

export function namedVendorConnected(): false {
  return false;
}
