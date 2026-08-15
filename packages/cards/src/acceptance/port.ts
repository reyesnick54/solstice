import type { Money } from '../../../money/src/money.ts';
import type { AcceptancePaymentResult } from './payment.ts';
import type { ProviderAcceptanceTransactionRef, ProviderDeviceReference } from './ids.ts';

/**
 * Provider-neutral SoftPOS / Tap-to-Pay acceptance port.
 * Adapters must not post journals, issue Execution Authority, or persist
 * raw EMV / contactless card data.
 */
export type TapToPayAcceptanceProvider = {
  registerDevice(input: { readonly merchantId: string; readonly deviceId: string }): {
    readonly providerDeviceReference: ProviderDeviceReference;
    readonly attestationReference: string;
  };
  verifyDeviceEligibility(providerDeviceReference: ProviderDeviceReference): boolean;
  createAcceptanceSession(input: { readonly merchantId: string; readonly deviceId: string; readonly currency: string }): {
    readonly providerSessionRef: string;
  };
  startPayment(input: { readonly sessionRef: string; readonly amount: Money; readonly reference: string }): {
    readonly result: AcceptancePaymentResult;
    readonly providerTransactionRef: ProviderAcceptanceTransactionRef;
  };
  cancelPayment(providerTransactionRef: ProviderAcceptanceTransactionRef): AcceptancePaymentResult;
  queryPayment(providerTransactionRef: ProviderAcceptanceTransactionRef): AcceptancePaymentResult;
  receivePaymentResult(providerTransactionRef: ProviderAcceptanceTransactionRef): AcceptancePaymentResult;
  retrieveSettlement(providerTransactionRef: ProviderAcceptanceTransactionRef): {
    readonly providerTransactionRef: ProviderAcceptanceTransactionRef;
    readonly settlementRef: string;
  };
  disableDevice(providerDeviceReference: ProviderDeviceReference): void;
};
