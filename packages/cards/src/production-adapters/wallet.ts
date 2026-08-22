/**
 * Provider-neutral digital-wallet provisioning hooks.
 * Does not claim Apple Pay or Google Pay certification.
 */

import type { WalletEligibilityResult } from '../wallet/eligibility.ts';
import type { DevicePaymentTokenStatus, WalletProvider } from '../wallet/token.ts';
import { CARD_ADAPTER_FLAGS } from './types.ts';

export type DigitalWalletHookRequest = {
  readonly cardId: string;
  readonly processorCardRef: string;
  readonly walletProvider: WalletProvider;
  readonly deviceRef: string;
};

export type DigitalWalletHookResult = {
  readonly outcome: 'ACCEPTED' | 'NOT_ELIGIBLE' | 'FAILED';
  readonly status: DevicePaymentTokenStatus | 'NOT_ELIGIBLE' | 'PROVISIONING';
  readonly providerReference: string;
  readonly applePayCertified: false;
  readonly googlePayCertified: false;
};

export type DigitalWalletHooks = {
  readonly applePayCertified: false;
  readonly googlePayCertified: false;
  evaluateEligibility(request: DigitalWalletHookRequest): WalletEligibilityResult | { readonly eligible: boolean };
  requestProvisioning(request: DigitalWalletHookRequest): DigitalWalletHookResult;
  getTokenStatus(request: DigitalWalletHookRequest): DigitalWalletHookResult;
  suspend(request: DigitalWalletHookRequest): DigitalWalletHookResult;
  resume(request: DigitalWalletHookRequest): DigitalWalletHookResult;
  delete(request: DigitalWalletHookRequest): DigitalWalletHookResult;
};

export function walletCertificationPosture(): {
  readonly applePayCertified: false;
  readonly googlePayCertified: false;
} {
  return Object.freeze({
    applePayCertified: CARD_ADAPTER_FLAGS.applePayCertified,
    googlePayCertified: CARD_ADAPTER_FLAGS.googlePayCertified,
  });
}
