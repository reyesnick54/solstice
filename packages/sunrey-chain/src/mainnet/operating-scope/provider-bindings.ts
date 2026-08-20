/**
 * Provider dependency bindings.
 *
 * Provider technical health does not satisfy legal eligibility.
 * FX liquidity evidence cannot authorize a payment rail.
 */

import type { ProviderBinding } from './types.ts';
import { FIXTURE_ENTITY_XA } from './products.ts';

export const FIXTURE_BANK_XA = 'provider.fiat-banking.fixture-xa' as const;
export const FIXTURE_RAIL_XA = 'provider.payment-rail.fixture-xa' as const;
export const FIXTURE_FX_XA = 'provider.fx-liquidity.fixture-xa' as const;
export const FIXTURE_KYC_XA = 'provider.kyc-aml.fixture-xa' as const;
export const FIXTURE_PARTNER_XA = 'provider.regulated-partner.fixture-xa' as const;

const PROVIDERS: readonly ProviderBinding[] = Object.freeze([
  bind('FIAT_BANKING', FIXTURE_BANK_XA, true, false, 'engineering sandbox bank; not a licensed institution'),
  bind('PAYMENT_RAIL', FIXTURE_RAIL_XA, true, false, 'engineering rail class; not named-network membership'),
  bind('FX_LIQUIDITY', FIXTURE_FX_XA, true, false, 'fixture FX quote path; not a licensed FX principal'),
  bind('KYC_AML', FIXTURE_KYC_XA, true, false, 'simulation screening adapter; not a production KYC program'),
  bind('REGULATED_PARTNER', FIXTURE_PARTNER_XA, false, false, 'no partner agreement evidence'),
]);

function bind(
  kind: ProviderBinding['kind'],
  providerRef: string,
  engineeringHealthy: boolean,
  legallyEligible: boolean,
  notes: string,
): ProviderBinding {
  return Object.freeze({
    bindingId: `${kind}:${providerRef}`,
    kind,
    providerRef,
    legalEntityRef: FIXTURE_ENTITY_XA,
    engineeringHealthy,
    legallyEligible,
    fixture: true,
    notes,
  });
}

export function listProviderBindings(): readonly ProviderBinding[] {
  return PROVIDERS;
}

export function findProvider(kind: ProviderBinding['kind']): ProviderBinding | undefined {
  return PROVIDERS.find((row) => row.kind === kind);
}

export function engineeringHealthIsLegalEligibility(binding: ProviderBinding): boolean {
  return binding.engineeringHealthy && binding.legallyEligible && !binding.fixture;
}

export function fxBindingAuthorizesPaymentRail(
  fx: ProviderBinding,
  rail: ProviderBinding,
): boolean {
  if (fx.kind !== 'FX_LIQUIDITY' || rail.kind !== 'PAYMENT_RAIL') {
    return false;
  }
  return false;
}
