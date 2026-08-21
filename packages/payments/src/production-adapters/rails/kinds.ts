/**
 * Product rail kinds supported by the adapter architecture.
 *
 * These names describe engineering classes, not production network
 * membership. Mapping a kind onto a RailClass does not claim ACH,
 * FedNow, RTP, SEPA, SWIFT, SAMA, or remittance connectivity.
 */

import type { RailClass } from '../../rail-types.ts';

export const PAYMENT_RAIL_PRODUCT_KINDS = [
  'ACH',
  'WIRE',
  'RTP',
  'SEPA',
  'SEPA_INSTANT',
  'SWIFT',
  'SAUDI_LOCAL',
  'LOCAL_PAYMENT',
  'INTERNATIONAL_REMITTANCE',
] as const;
export type PaymentRailProductKind = (typeof PAYMENT_RAIL_PRODUCT_KINDS)[number];

export type RailKindMapping = {
  readonly kind: PaymentRailProductKind;
  readonly engineeringRailClass: RailClass;
  readonly namedNetworkMembership: false;
  readonly liveConnected: false;
};

const MAPPINGS: Readonly<Record<PaymentRailProductKind, RailClass>> = {
  ACH: 'US_BATCH',
  WIRE: 'INTERNATIONAL_CORRESPONDENT',
  RTP: 'US_INSTANT',
  SEPA: 'EU_SEPA',
  SEPA_INSTANT: 'EU_SEPA_INSTANT',
  SWIFT: 'INTERNATIONAL_CORRESPONDENT',
  SAUDI_LOCAL: 'SA_DOMESTIC',
  LOCAL_PAYMENT: 'AE_DOMESTIC',
  INTERNATIONAL_REMITTANCE: 'INTERNATIONAL_CORRESPONDENT',
};

export function mapRailProductKind(kind: PaymentRailProductKind): RailKindMapping {
  return Object.freeze({
    kind,
    engineeringRailClass: MAPPINGS[kind],
    namedNetworkMembership: false,
    liveConnected: false,
  });
}

export function railKindIsNotNetworkMembership(kind: PaymentRailProductKind): true {
  void kind;
  return true;
}
