/**
 * Public goods evidence must not carry customer PII, shipping addresses,
 * payment-card data, emails, phones, or order notes.
 */

import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import type { GoodsRefusal, GoodsSourceObservation, PublicGoodsEvidence } from './types.ts';
import { ORDER_EQUALS_OUTPUT, PAYMENT_EQUALS_PRODUCTIVE_OUTPUT } from './types.ts';

const PII_KEY_HINTS = [
  'customername',
  'customeremail',
  'email',
  'phone',
  'shippingaddress',
  'streetaddress',
  'ordernotes',
  'supportchat',
] as const;

const CREDENTIAL_KEY_HINTS = [
  'pan',
  'cardnumber',
  'cvv',
  'paymentcard',
  'carddata',
  'apikey',
  'password',
  'secret',
] as const;

function normalizedKey(key: string): string {
  return key.replace(/[^A-Za-z]/g, '').toLowerCase();
}

export function refusePrivacyLeaks(observation: GoodsSourceObservation): Result<true, GoodsRefusal> {
  if (
    observation.rawCustomerName ||
    observation.rawShippingAddress ||
    observation.rawEmail ||
    observation.rawPhone ||
    observation.orderNotes
  ) {
    return err({
      code: 'CUSTOMER_PII_FORBIDDEN',
      detail: 'customer names, addresses, emails, phones, and order notes are not economic evidence',
    });
  }
  if (observation.paymentCardData) {
    return err({
      code: 'PAYMENT_CREDENTIAL_FORBIDDEN',
      detail: 'payment card data is not stored on goods economic evidence',
    });
  }
  for (const key of Object.keys(observation.extras ?? {})) {
    const normalized = normalizedKey(key);
    if (PII_KEY_HINTS.some((hint) => normalized.includes(hint))) {
      return err({
        code: 'CUSTOMER_PII_FORBIDDEN',
        detail: `extras must not include ${key}`,
      });
    }
    if (CREDENTIAL_KEY_HINTS.some((hint) => normalized.includes(hint))) {
      return err({
        code: 'PAYMENT_CREDENTIAL_FORBIDDEN',
        detail: `extras must not include ${key}`,
      });
    }
  }
  return ok(true);
}

export function publicEvidenceFrom(
  observation: GoodsSourceObservation,
  claimType: PublicGoodsEvidence['claimType'],
): PublicGoodsEvidence {
  return Object.freeze({
    observationId: observation.observationId,
    sourceClass: observation.sourceClass,
    factType: observation.factType === 'GOODS_DELIVERY' ? 'GOODS_DELIVERY' : 'GOODS_OUTPUT',
    claimType,
    productiveCategory: 'GOODS',
    goodsState: observation.goodsState,
    unit: observation.unit,
    mantissa: observation.numericValue,
    identity: Object.freeze({ ...observation.identity }),
    licenseRef: observation.identity.licenseRef,
    containsCustomerPii: false,
    containsPaymentCredentials: false,
    orderEqualsOutput: ORDER_EQUALS_OUTPUT,
    paymentEqualsOutput: PAYMENT_EQUALS_PRODUCTIVE_OUTPUT,
    mintsMoonRey: false,
  });
}

export function publicEvidenceOmitsPii(evidence: PublicGoodsEvidence): boolean {
  const encoded = JSON.stringify(evidence).toLowerCase();
  return (
    !encoded.includes('@') &&
    !encoded.includes('visa') &&
    !encoded.includes('cardnumber') &&
    evidence.containsCustomerPii === false &&
    evidence.containsPaymentCredentials === false
  );
}
