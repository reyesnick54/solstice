/**
 * Bounded restriction controls reused from Chunk 79 governance operations.
 *
 * Restrictions remain bounded. They cannot mint, rewrite supply, rewrite
 * finalized blocks, or convert rehearsal into production.
 */

import {
  EMERGENCY_ACTION_CLASSES,
  FORBIDDEN_EMERGENCY_POWERS,
  type EmergencyActionClass,
  type RestrictionState,
} from '../governance-ops/types.ts';
import type { IndependentCapability } from './types.ts';

export const CAPABILITY_RESTRICTIONS: Readonly<Record<IndependentCapability, readonly EmergencyActionClass[]>> = {
  SUNREY_COIN_NATIVE_ASSET: Object.freeze(['RESTRICT_NEW_SUNREY_ISSUANCE']),
  MOONREY_COIN_NATIVE_ASSET: Object.freeze(['RESTRICT_NEW_MOONREY_ISSUANCE']),
  SUNREY_EXCHANGE: Object.freeze(['RESTRICT_NEW_EXCHANGE_ORDERS', 'RESTRICT_EXCHANGE_SETTLEMENT']),
  INSTITUTIONAL_CUSTODY: Object.freeze(['RESTRICT_CUSTODY_WITHDRAWALS']),
  FIAT_BANKING: Object.freeze(['RESTRICT_BANKING_RAILS']),
  PAYMENT_RAILS: Object.freeze(['RESTRICT_PAYMENT_SUBMISSIONS']),
  CARDS: Object.freeze(['RESTRICT_SPECIFIC_PROTOCOL_FEATURE']),
  INVESTMENTS: Object.freeze(['RESTRICT_SPECIFIC_PROTOCOL_FEATURE']),
  HUMAN_INFORMATION_MARKET: Object.freeze(['RESTRICT_HUMAN_INFORMATION_MARKET']),
  PRODUCTIVE_CAPACITY_MARKET: Object.freeze(['SUSPEND_ORACLE_PROVIDER']),
  INTEROPERABILITY: Object.freeze(['RESTRICT_INTEROP_CHANNEL']),
};

export function restrictionFor(capability: IndependentCapability): readonly EmergencyActionClass[] {
  return CAPABILITY_RESTRICTIONS[capability];
}

export function applyRestriction(
  current: RestrictionState,
  capability: IndependentCapability,
): { readonly state: RestrictionState; readonly actions: readonly EmergencyActionClass[]; readonly bounded: true } {
  return Object.freeze({
    state: current === 'RESUMED' ? 'ACTIVE' : 'ACTIVE',
    actions: restrictionFor(capability),
    bounded: true,
  });
}

export function restrictionBypassRejected(power: string): boolean {
  return (FORBIDDEN_EMERGENCY_POWERS as readonly string[]).includes(power);
}

export function knownRestrictionClasses(): readonly EmergencyActionClass[] {
  return EMERGENCY_ACTION_CLASSES;
}
