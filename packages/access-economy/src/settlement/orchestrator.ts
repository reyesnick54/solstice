/**
 * Access settlement orchestrator for restricted virtual-card rails.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import { providerRefFor } from '../ids.ts';
import { MockRestrictedCardIssuer } from './adapters/mock-restricted-card-issuer.ts';
import { ProductionRestrictedCardIssuerShell } from './adapters/production-restricted-card-issuer.ts';
import type { RestrictedCardIssuerPort } from './issuer-port.ts';
import { RestrictedVirtualCardAccessRail } from './restricted-virtual-card-rail.ts';
import type {
  AccessPaymentRail,
  AccessSettlementReconciliation,
  AccessVirtualCardRequest,
  FundingReservationVerifier,
} from './types.ts';

export type AccessSettlementOrchestratorOptions = {
  readonly rail: AccessPaymentRail;
};

export type SettlementOrchestrationResult =
  | {
      readonly ok: true;
      readonly cardId: string;
      readonly settlementId: string;
      readonly railStatus: string;
    }
  | { readonly ok: false; readonly code: string; readonly message: string };

export class AccessSettlementOrchestrator {
  private readonly rail: AccessPaymentRail;

  constructor(options: AccessSettlementOrchestratorOptions) {
    this.rail = options.rail;
  }

  async settleWithVirtualCard(request: AccessVirtualCardRequest): Promise<SettlementOrchestrationResult> {
    const result = await this.rail.createVirtualCard(request);
    if (!result.ok) {
      return { ok: false, code: result.code, message: result.message };
    }
    return {
      ok: true,
      cardId: result.card.cardId,
      settlementId: request.settlementId,
      railStatus: this.rail.status,
    };
  }

  authorizeMerchantCharge(input: Parameters<AccessPaymentRail['validateAuthorization']>[0]) {
    return this.rail.validateAuthorization(input);
  }

  captureCharge(input: Parameters<AccessPaymentRail['capture']>[0]) {
    return this.rail.capture(input);
  }

  reconcileSettlement(settlementId: string, now: UtcInstant): AccessSettlementReconciliation | undefined {
    return this.rail.reconcile(settlementId, now);
  }

  disableCompromisedCard(cardId: string, now: UtcInstant) {
    return this.rail.disableCard({ cardId, reason: 'compromised', now });
  }

  getRail(): AccessPaymentRail {
    return this.rail;
  }
}

export type RailFactoryMode = 'mock' | 'sandbox' | 'production';

export function createRestrictedVirtualCardRail(input: {
  readonly issuer: RestrictedCardIssuerPort;
  readonly fundingVerifier: FundingReservationVerifier;
}): RestrictedVirtualCardAccessRail {
  return new RestrictedVirtualCardAccessRail({
    issuer: input.issuer,
    fundingVerifier: input.fundingVerifier,
  });
}

export function createRestrictedVirtualCardRailWithIssuer(input: {
  readonly mode: RailFactoryMode;
  readonly fundingVerifier: FundingReservationVerifier;
  readonly sandboxIssuer?: RestrictedCardIssuerPort;
  readonly productionProviderId?: string;
}): RestrictedVirtualCardAccessRail {
  let issuer: RestrictedCardIssuerPort;
  switch (input.mode) {
    case 'mock':
      issuer = new MockRestrictedCardIssuer();
      break;
    case 'sandbox':
      if (!input.sandboxIssuer) {
        throw new Error('sandbox issuer must be injected from packages/cards');
      }
      issuer = input.sandboxIssuer;
      break;
    case 'production':
      issuer = new ProductionRestrictedCardIssuerShell(input.productionProviderId);
      break;
  }
  return createRestrictedVirtualCardRail({ issuer, fundingVerifier: input.fundingVerifier });
}

export function createAccessSettlementOrchestrator(input: {
  readonly rail: AccessPaymentRail;
}): AccessSettlementOrchestrator {
  return new AccessSettlementOrchestrator({ rail: input.rail });
}

export class InMemoryFundingReservationVerifier implements FundingReservationVerifier {
  private readonly reservations = new Map<
    string,
    { accessTransactionId: string; amountMinorUnits: bigint; currency: string }
  >();

  reserve(input: {
    readonly fundingReservationId: string;
    readonly accessTransactionId: string;
    readonly amountMinorUnits: bigint;
    readonly currency: string;
  }): void {
    this.reservations.set(input.fundingReservationId, {
      accessTransactionId: input.accessTransactionId,
      amountMinorUnits: input.amountMinorUnits,
      currency: input.currency,
    });
  }

  release(fundingReservationId: string): void {
    this.reservations.delete(fundingReservationId);
  }

  isReserved(input: {
    readonly fundingReservationId: string;
    readonly accessTransactionId: string;
    readonly amountMinorUnits: bigint;
    readonly currency: string;
  }): boolean {
    const row = this.reservations.get(input.fundingReservationId);
    if (!row) {
      return false;
    }
    return (
      row.accessTransactionId === input.accessTransactionId &&
      row.amountMinorUnits >= input.amountMinorUnits &&
      row.currency === input.currency
    );
  }
}

export function fixtureVirtualCardRequest(
  overrides?: Partial<AccessVirtualCardRequest>,
): AccessVirtualCardRequest {
  const now = overrides?.validFrom ?? ('2026-08-31T12:00:00.000Z' as UtcInstant);
  const expires = overrides?.expiresAt ?? ('2026-09-01T12:00:00.000Z' as UtcInstant);
  return Object.freeze({
    accessTransactionId: 'txn_fixture_001',
    settlementId: 'stl_fixture_001',
    maximumAmount: 40_000n,
    currency: 'USD',
    merchantRestriction: 'merchant_turo_us',
    countryRestriction: 'US',
    validFrom: now,
    expiresAt: expires,
    singleUse: true,
    providerId: providerRefFor('turo'),
    purpose: 'PROVIDER_SETTLEMENT',
    idempotencyKey: 'idem_fixture_001',
    category: 'MOBILITY',
    fundingReservationId: 'fres_fixture_001',
    userFiatContributionMinorUnits: 10_000n,
    accessPoolContributionMinorUnits: 30_000n,
    securityDepositRequired: false,
    tokenConversionContributionMinorUnits: 0n,
    ...overrides,
  });
}
