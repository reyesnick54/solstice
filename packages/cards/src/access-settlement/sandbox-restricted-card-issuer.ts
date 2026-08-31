/**
 * Sandbox restricted card issuer for Access virtual-card settlement.
 *
 * Structural mirror of access-economy RestrictedCardIssuerPort. Callers in
 * services or tests wire this into RestrictedVirtualCardAccessRail.
 */

import { asCardId } from '../ids.ts';
import type { CardControls } from '../controls.ts';
import { assertNoSensitiveCardData } from '../pci-boundary.ts';
import { SimulatedProductionCardIssuer } from '../production-adapters/simulated.ts';

export type AccessSettlementCardControls = {
  readonly maximumAmountMinorUnits: bigint;
  readonly singleTransaction: boolean;
  readonly singleUse: boolean;
  readonly expiresAt: string;
  readonly merchantId: string | null;
  readonly allowedMerchantCategories: readonly string[] | null;
  readonly blockedMerchantCategories: readonly string[];
  readonly country: string | null;
  readonly currency: string;
  readonly allowedMerchant: string | null;
};

export type AccessSettlementIssuerMetadata = {
  readonly processorCardRef: string;
  readonly formFactor: 'VIRTUAL' | 'PHYSICAL';
  readonly status: string;
  readonly displayHint: string;
  readonly last4: string | null;
  readonly expiryMonth: number | null;
  readonly expiryYear: number | null;
  readonly issueOutcome: 'SUCCESS' | 'PENDING' | 'FAILURE';
};

export const SANDBOX_ACCESS_CONTROL_SUPPORT = Object.freeze({
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

function toProcessorCardControls(controls: AccessSettlementCardControls): CardControls {
  return Object.freeze({
    frozen: false,
    transactionAmountLimitMinor: controls.maximumAmountMinorUnits,
    dailyAmountLimitMinor: controls.maximumAmountMinorUnits,
    blockedMerchantCategories: Object.freeze([...controls.blockedMerchantCategories]),
    allowedMerchantCategories:
      controls.allowedMerchantCategories === null
        ? null
        : Object.freeze([...controls.allowedMerchantCategories]),
    blockedCountries: Object.freeze([]),
    allowedCountries: controls.country === null ? null : Object.freeze([controls.country]),
    ecommerceEnabled: true,
    cashAtmEnabled: false,
    contactlessEnabled: true,
    internationalEnabled: controls.country === null,
  });
}

export class SandboxRestrictedCardIssuer {
  readonly providerId = 'SIMULATED_CARD_PROCESSOR';
  readonly lifecycle = 'SANDBOX' as const;
  readonly controlSupport = SANDBOX_ACCESS_CONTROL_SUPPORT;

  private readonly issuer = new SimulatedProductionCardIssuer();

  issueRestrictedCard(input: {
    readonly cardId: string;
    readonly programId: string;
    readonly controls: AccessSettlementCardControls;
  }):
    | { readonly ok: true; readonly metadata: AccessSettlementIssuerMetadata }
    | { readonly ok: false; readonly code: 'CARD_ISSUANCE_FAILED' | 'ISSUER_TIMEOUT' | 'PROVIDER_BLOCKED' } {
    const cardId = asCardId(input.cardId);
    const issued = this.issuer.issueVirtualCard({
      cardId,
      formFactor: 'VIRTUAL',
      programId: input.programId,
    });
    if (issued.issueOutcome === 'FAILURE') {
      return { ok: false, code: 'CARD_ISSUANCE_FAILED' };
    }
    if (issued.issueOutcome === 'PENDING') {
      return { ok: false, code: 'ISSUER_TIMEOUT' };
    }
    assertNoSensitiveCardData(issued);
    const activated = this.issuer.activateCard(issued.processorCardRef);
    this.issuer.setControls(activated.processorCardRef, toProcessorCardControls(input.controls));
    return { ok: true, metadata: Object.freeze({ ...activated }) };
  }

  applyControls(
    providerCardId: string,
    controls: AccessSettlementCardControls,
  ): AccessSettlementIssuerMetadata | undefined {
    return Object.freeze({ ...this.issuer.setControls(providerCardId as never, toProcessorCardControls(controls)) });
  }

  disableCard(providerCardId: string): AccessSettlementIssuerMetadata | undefined {
    return Object.freeze({ ...this.issuer.closeCard(providerCardId as never) });
  }

  getUnderlyingIssuer(): SimulatedProductionCardIssuer {
    return this.issuer;
  }
}

/** Adapts SandboxRestrictedCardIssuer to the access-economy issuer port shape. */
export function asAccessSettlementIssuerPort(sandbox: SandboxRestrictedCardIssuer): {
  readonly providerId: string;
  readonly lifecycle: 'SANDBOX';
  readonly controlSupport: typeof SANDBOX_ACCESS_CONTROL_SUPPORT;
  issueRestrictedCard(input: {
    readonly cardId: string;
    readonly programId: string;
    readonly controls: AccessSettlementCardControls;
  }): ReturnType<SandboxRestrictedCardIssuer['issueRestrictedCard']>;
  applyControls(
    providerCardId: string,
    controls: AccessSettlementCardControls,
  ): AccessSettlementIssuerMetadata | undefined;
  disableCard(providerCardId: string): AccessSettlementIssuerMetadata | undefined;
} {
  return Object.freeze({
    providerId: sandbox.providerId,
    lifecycle: 'SANDBOX' as const,
    controlSupport: sandbox.controlSupport,
    issueRestrictedCard: (input) => sandbox.issueRestrictedCard(input),
    applyControls: (providerCardId, controls) => sandbox.applyControls(providerCardId, controls),
    disableCard: (providerCardId) => sandbox.disableCard(providerCardId),
  });
}
