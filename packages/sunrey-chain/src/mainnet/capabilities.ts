/**
 * Per-capability production activation matrix.
 *
 * A production blockchain does not automatically authorize financial
 * products. No capability inherits another capability's legal authority.
 */

import { ACTIVATION_DOMAINS, type ActivationDomain, type ProductionCapabilityActivation } from './types.ts';

const SOFTWARE_IMPLEMENTED = new Set<ActivationDomain>([
  'SUNREY_CHAIN',
  'SUNREY_COIN_NATIVE_ASSET',
  'MOONREY_COIN_NATIVE_ASSET',
  'SUNREY_EXCHANGE',
  'INSTITUTIONAL_CUSTODY',
  'FIAT_BANKING',
  'PAYMENT_RAILS',
  'CARDS',
  'INVESTMENTS',
  'HUMAN_INFORMATION_MARKET',
  'PRODUCTIVE_CAPACITY_MARKET',
  'INTEROPERABILITY',
]);

export function defaultCapabilityActivation(
  capability: ActivationDomain,
): ProductionCapabilityActivation {
  return Object.freeze({
    capability,
    software_ready: SOFTWARE_IMPLEMENTED.has(capability),
    security_ready: false,
    operational_ready: false,
    legal_ready: false,
    regulatory_ready: false,
    license_or_partner_ready: false,
    human_authorized: false,
    genesis_enabled: false,
    runtime_enabled: false,
  });
}

export function defaultActivationMatrix(): readonly ProductionCapabilityActivation[] {
  return Object.freeze(ACTIVATION_DOMAINS.map(defaultCapabilityActivation));
}

export function capabilityAvailable(row: ProductionCapabilityActivation): boolean {
  return (
    row.software_ready &&
    row.security_ready &&
    row.operational_ready &&
    row.legal_ready &&
    row.regulatory_ready &&
    row.license_or_partner_ready &&
    row.human_authorized &&
    row.genesis_enabled &&
    row.runtime_enabled
  );
}

export function assertCapabilityDoesNotInherit(
  matrix: readonly ProductionCapabilityActivation[],
  source: ActivationDomain,
  target: ActivationDomain,
): void {
  const from = matrix.find((row) => row.capability === source);
  const to = matrix.find((row) => row.capability === target);
  if (!from || !to) {
    throw new TypeError('unknown capability');
  }
  if (from.legal_ready && !to.legal_ready) {
    return;
  }
  if (from.legal_ready && to.legal_ready && source !== target) {
    throw new TypeError(`${target} must not inherit legal authority from ${source}`);
  }
}

export function unlicensedCapabilitiesRemainUnavailable(
  matrix: readonly ProductionCapabilityActivation[],
): boolean {
  return matrix.every((row) => {
    if (row.license_or_partner_ready && row.legal_ready && row.regulatory_ready && row.human_authorized) {
      return true;
    }
    return !row.runtime_enabled && !row.genesis_enabled && !capabilityAvailable(row);
  });
}
