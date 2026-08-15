import type { AcceptanceDevice } from './device.ts';
import type { MerchantAcceptance } from './merchant.ts';
import type { MerchantPayment } from './payment.ts';
import type { AcceptanceReconciliationResult } from './reconciliation.ts';
import type { AcceptanceSession } from './session.ts';

export class AcceptanceStore {
  private readonly merchants = new Map<string, MerchantAcceptance>();
  private readonly devices = new Map<string, AcceptanceDevice>();
  private readonly sessions = new Map<string, AcceptanceSession>();
  private readonly payments = new Map<string, MerchantPayment>();
  private readonly paymentsByKey = new Map<string, MerchantPayment>();
  private readonly callbacks = new Map<string, MerchantPayment>();
  private readonly reconciliations = new Map<string, AcceptanceReconciliationResult>();

  saveMerchant(merchant: MerchantAcceptance): void {
    this.merchants.set(merchant.merchantId, merchant);
  }

  getMerchant(id: string): MerchantAcceptance | undefined {
    return this.merchants.get(id);
  }

  saveDevice(device: AcceptanceDevice): void {
    this.devices.set(device.deviceId, device);
  }

  getDevice(id: string): AcceptanceDevice | undefined {
    return this.devices.get(id);
  }

  saveSession(session: AcceptanceSession): void {
    this.sessions.set(session.sessionId, session);
  }

  getSession(id: string): AcceptanceSession | undefined {
    return this.sessions.get(id);
  }

  savePayment(payment: MerchantPayment): void {
    this.payments.set(payment.paymentId, payment);
  }

  getPayment(id: string): MerchantPayment | undefined {
    return this.payments.get(id);
  }

  paymentByIdempotency(key: string): MerchantPayment | undefined {
    return this.paymentsByKey.get(key);
  }

  markPaymentIdempotency(key: string, payment: MerchantPayment): void {
    this.paymentsByKey.set(key, payment);
  }

  callbackByKey(key: string): MerchantPayment | undefined {
    return this.callbacks.get(key);
  }

  markCallback(key: string, payment: MerchantPayment): void {
    this.callbacks.set(key, payment);
  }

  saveReconciliation(result: AcceptanceReconciliationResult): void {
    this.reconciliations.set(result.subjectId, result);
  }

  getReconciliation(subjectId: string): AcceptanceReconciliationResult | undefined {
    return this.reconciliations.get(subjectId);
  }
}
