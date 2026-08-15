import { asProviderAcceptanceTransactionRef, asProviderDeviceReference } from './ids.ts';
import type { TapToPayAcceptanceProvider } from './port.ts';
import type { AcceptancePaymentResult } from './payment.ts';

/**
 * Deterministic simulation adapter. Not a certified SoftPOS/NFC kernel.
 */
export class SimulatedTapToPayAdapter implements TapToPayAcceptanceProvider {
  private readonly results = new Map<string, AcceptancePaymentResult>();

  registerDevice(input: { readonly merchantId: string; readonly deviceId: string }) {
    return Object.freeze({
      providerDeviceReference: asProviderDeviceReference(`sim_adev_${input.deviceId}`),
      attestationReference: `sim_attest_${input.deviceId}`,
    });
  }

  verifyDeviceEligibility(providerDeviceReference: string): boolean {
    return providerDeviceReference.startsWith('sim_adev_');
  }

  createAcceptanceSession(input: { readonly merchantId: string; readonly deviceId: string; readonly currency: string }) {
    return Object.freeze({
      providerSessionRef: `sim_asess_${input.merchantId}_${input.deviceId}_${input.currency}`,
    });
  }

  startPayment(input: { readonly sessionRef: string; readonly amount: import('../../../money/src/money.ts').Money; readonly reference: string }) {
    const result: AcceptancePaymentResult = input.reference.includes('DECLINE')
      ? 'DECLINED'
      : input.reference.includes('FAIL')
        ? 'FAILED'
        : input.reference.includes('CANCEL')
          ? 'CANCELLED'
          : 'APPROVED';
    const providerTransactionRef = asProviderAcceptanceTransactionRef(`sim_atxn_${input.reference}`);
    this.results.set(providerTransactionRef, result);
    return Object.freeze({ result, providerTransactionRef });
  }

  cancelPayment(providerTransactionRef: import('./ids.ts').ProviderAcceptanceTransactionRef): AcceptancePaymentResult {
    this.results.set(providerTransactionRef, 'CANCELLED');
    return 'CANCELLED';
  }

  queryPayment(providerTransactionRef: import('./ids.ts').ProviderAcceptanceTransactionRef): AcceptancePaymentResult {
    return this.results.get(providerTransactionRef) ?? 'UNKNOWN';
  }

  receivePaymentResult(providerTransactionRef: import('./ids.ts').ProviderAcceptanceTransactionRef): AcceptancePaymentResult {
    return this.queryPayment(providerTransactionRef);
  }

  retrieveSettlement(input: import('./ids.ts').ProviderAcceptanceTransactionRef) {
    return Object.freeze({
      providerTransactionRef: input,
      settlementRef: `sim_asetl_${input}`,
    });
  }

  disableDevice(_providerDeviceReference: import('./ids.ts').ProviderDeviceReference): void {
    return;
  }
}
