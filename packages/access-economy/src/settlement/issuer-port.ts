/**
 * Restricted card issuer port — provider abstraction for Access virtual cards.
 *
 * Do not hard-code a single issuer into the Access domain. Adapters implement
 * this port using sandbox or production card-issuing infrastructure in
 * `packages/cards` (see `packages/cards/src/access-settlement/`).
 */

import type { AccessCardControls } from './types.ts';

/** PCI-safe card metadata — no PAN/CVV. Mirrors cards processor safe metadata. */
export type IssuerSafeCardMetadata = {
  readonly processorCardRef: string;
  readonly formFactor: 'VIRTUAL' | 'PHYSICAL';
  readonly status: string;
  readonly displayHint: string;
  readonly last4: string | null;
  readonly expiryMonth: number | null;
  readonly expiryYear: number | null;
  readonly issueOutcome: 'SUCCESS' | 'PENDING' | 'FAILURE';
};

/** Issuer capability declaration — only claim controls the provider actually supports. */
export type IssuerControlSupport = {
  readonly maximumAmount: boolean;
  readonly singleTransaction: boolean;
  readonly singleUse: boolean;
  readonly expiration: boolean;
  readonly merchantId: boolean;
  readonly merchantCategory: boolean;
  readonly country: boolean;
  readonly currency: boolean;
  readonly allowedMerchant: boolean;
  readonly blockedMerchantCategories: boolean;
  readonly incrementalAuthorization: boolean;
};

export type RestrictedCardIssueInput = {
  readonly cardId: string;
  readonly programId: string;
  readonly controls: AccessCardControls;
};

export type RestrictedCardIssueResult =
  | { readonly ok: true; readonly metadata: IssuerSafeCardMetadata }
  | { readonly ok: false; readonly code: 'CARD_ISSUANCE_FAILED' | 'ISSUER_TIMEOUT' | 'PROVIDER_BLOCKED' };

export type RestrictedCardIssuerPort = {
  readonly providerId: string;
  readonly lifecycle: 'SIMULATED' | 'SANDBOX' | 'PRODUCTION';
  readonly controlSupport: IssuerControlSupport;
  issueRestrictedCard(input: RestrictedCardIssueInput): RestrictedCardIssueResult;
  applyControls(providerCardId: string, controls: AccessCardControls): IssuerSafeCardMetadata | undefined;
  disableCard(providerCardId: string): IssuerSafeCardMetadata | undefined;
};

export const FULL_SIMULATED_CONTROL_SUPPORT: IssuerControlSupport = Object.freeze({
  maximumAmount: true,
  singleTransaction: true,
  singleUse: true,
  expiration: true,
  merchantId: true,
  merchantCategory: true,
  country: true,
  currency: true,
  allowedMerchant: true,
  blockedMerchantCategories: true,
  incrementalAuthorization: true,
});

export const PRODUCTION_SHELL_CONTROL_SUPPORT: IssuerControlSupport = Object.freeze({
  maximumAmount: false,
  singleTransaction: false,
  singleUse: false,
  expiration: false,
  merchantId: false,
  merchantCategory: false,
  country: false,
  currency: false,
  allowedMerchant: false,
  blockedMerchantCategories: false,
  incrementalAuthorization: false,
});
