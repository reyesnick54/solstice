/**
 * Domain-scoped emergency restrictions.
 *
 * Restrictions narrow future activity in the affected domain only.
 * Unrelated safe domains remain available. Provider suspension suspends
 * a provider/domain route, not the canonical domain owner.
 */

import type { EmergencyActionClass } from '../types.ts';
import type { IndependentCapability } from '../../post-genesis/types.ts';
import { INDEPENDENT_CAPABILITIES } from '../../post-genesis/types.ts';
import { restrictionFor } from '../../post-genesis/restrictions.ts';
import type { DomainRestrictionPlan, RecoveryDomain } from './types.ts';

const DOMAIN_CAPABILITIES: Readonly<Record<RecoveryDomain, readonly IndependentCapability[]>> = {
  ORACLE: Object.freeze(['PRODUCTIVE_CAPACITY_MARKET', 'MOONREY_COIN_NATIVE_ASSET']),
  MOONREY_ISSUANCE: Object.freeze(['MOONREY_COIN_NATIVE_ASSET']),
  SUNREY_ISSUANCE: Object.freeze(['SUNREY_COIN_NATIVE_ASSET']),
  HSM_CUSTODY: Object.freeze(['INSTITUTIONAL_CUSTODY']),
  PAYMENT_RAIL: Object.freeze(['PAYMENT_RAILS']),
  BANKING_RAIL: Object.freeze(['FIAT_BANKING']),
  HUMAN_INFORMATION_MARKET: Object.freeze(['HUMAN_INFORMATION_MARKET']),
  COMPLIANCE: Object.freeze([
    'SUNREY_EXCHANGE',
    'INSTITUTIONAL_CUSTODY',
    'FIAT_BANKING',
    'PAYMENT_RAILS',
    'CARDS',
    'INVESTMENTS',
    'HUMAN_INFORMATION_MARKET',
  ]),
  DATABASE: Object.freeze([]),
  CHAIN_FINALITY: Object.freeze([]),
  PROVIDER_BINDING: Object.freeze([]),
  APPLICATION_RELEASE: Object.freeze([]),
};

const DOMAIN_ACTIONS: Readonly<Record<RecoveryDomain, readonly EmergencyActionClass[]>> = {
  ORACLE: Object.freeze(['SUSPEND_ORACLE_PROVIDER', 'RESTRICT_NEW_MOONREY_ISSUANCE', 'SUSPEND_PROVIDER_DOMAIN']),
  MOONREY_ISSUANCE: Object.freeze(['RESTRICT_NEW_MOONREY_ISSUANCE']),
  SUNREY_ISSUANCE: Object.freeze(['RESTRICT_NEW_SUNREY_ISSUANCE']),
  HSM_CUSTODY: Object.freeze(['RESTRICT_CUSTODY_WITHDRAWALS', 'SUSPEND_PROVIDER_DOMAIN']),
  PAYMENT_RAIL: Object.freeze(['RESTRICT_PAYMENT_SUBMISSIONS', 'SUSPEND_PROVIDER_DOMAIN']),
  BANKING_RAIL: Object.freeze(['RESTRICT_BANKING_RAILS', 'SUSPEND_PROVIDER_DOMAIN']),
  HUMAN_INFORMATION_MARKET: Object.freeze(['RESTRICT_HUMAN_INFORMATION_MARKET']),
  COMPLIANCE: Object.freeze(['RESTRICT_SPECIFIC_PROTOCOL_FEATURE']),
  DATABASE: Object.freeze(['RESTRICT_SPECIFIC_PROTOCOL_FEATURE']),
  CHAIN_FINALITY: Object.freeze(['RESTRICT_SPECIFIC_PROTOCOL_FEATURE']),
  PROVIDER_BINDING: Object.freeze(['SUSPEND_PROVIDER_DOMAIN']),
  APPLICATION_RELEASE: Object.freeze(['RESTRICT_SPECIFIC_PROTOCOL_FEATURE']),
};

export function restrictionPlanFor(input: {
  readonly incidentId: string;
  readonly domain: RecoveryDomain;
}): DomainRestrictionPlan {
  return Object.freeze({
    incidentId: input.incidentId,
    domain: input.domain,
    actions: DOMAIN_ACTIONS[input.domain],
    scopedCapabilities: DOMAIN_CAPABILITIES[input.domain],
    unrelatedCapabilitiesRemainAvailable: true,
    suspendsCanonicalDomainOwner: false,
    deletesFinalizedBalances: false,
    rewritesSupply: false,
  });
}

export function availableUnrelatedCapabilities(restricted: readonly IndependentCapability[]): readonly IndependentCapability[] {
  const blocked = new Set(restricted);
  return Object.freeze(INDEPENDENT_CAPABILITIES.filter((capability) => !blocked.has(capability)));
}

export function capabilityActions(capability: IndependentCapability): readonly EmergencyActionClass[] {
  return restrictionFor(capability);
}

export function providerSuspensionScopesRouteOnly(scope: string): boolean {
  return scope.startsWith('provider:') || scope.startsWith('route:');
}
