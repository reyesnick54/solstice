/**
 * M07 — canonical Gold identities.
 *
 * GLD ETF, reference gold, futures family, specific contracts, and continuous
 * research series are separate instruments. Never treat them as interchangeable.
 */

import { commodityAssetId } from '../../market-reference/assets.ts';
import {
  GOLD_FUTURES_CONTINUOUS_ID,
  GOLD_FUTURES_FAMILY_ID,
  GOLD_FUTURES_GCZ2026_ID,
} from '../futures/contract-registry.ts';
import type { GoldCanonicalIdentity, GoldIdentityKind } from './types.ts';

export const GOLD_ETF_GLD_ID = 'SECURITY:US:GLD:ARCX' as const;

/** Reuses market-reference commodity identity — distinct from GLD and futures. */
export const GOLD_REFERENCE_ID = 'COMMODITY:gold:USD:troy_oz' as const;

export const GOLD_CANONICAL_IDENTITIES: readonly GoldCanonicalIdentity[] = Object.freeze([
  Object.freeze({
    identityId: GOLD_ETF_GLD_ID,
    kind: 'etf_proxy' as GoldIdentityKind,
    displayName: 'SPDR Gold Shares (GLD)',
    symbol: 'GLD',
    venueId: 'ARCX',
    currency: 'USD',
    executable: true,
    feedQualification: 'QUALIFIED' as const,
  }),
  Object.freeze({
    identityId: GOLD_REFERENCE_ID,
    kind: 'reference_commodity' as GoldIdentityKind,
    displayName: 'Gold (reference / spot)',
    symbol: 'XAU',
    venueId: 'COMEX',
    currency: 'USD',
    executable: false,
    feedQualification: 'QUALIFIED' as const,
  }),
  Object.freeze({
    identityId: GOLD_FUTURES_FAMILY_ID,
    kind: 'futures_family' as GoldIdentityKind,
    displayName: 'COMEX Gold Futures (GC family)',
    symbol: 'GC',
    venueId: 'COMEX',
    currency: 'USD',
    executable: false,
    feedQualification: 'EXTERNAL_PROVIDER_REQUIRED' as const,
  }),
  Object.freeze({
    identityId: GOLD_FUTURES_GCZ2026_ID,
    kind: 'futures_contract' as GoldIdentityKind,
    displayName: 'COMEX Gold Dec 2026 (GCZ2026)',
    symbol: 'GCZ2026',
    venueId: 'COMEX',
    currency: 'USD',
    executable: true,
    feedQualification: 'EXTERNAL_PROVIDER_REQUIRED' as const,
  }),
  Object.freeze({
    identityId: GOLD_FUTURES_CONTINUOUS_ID,
    kind: 'continuous_research' as GoldIdentityKind,
    displayName: 'COMEX Gold Continuous (research only)',
    symbol: 'GC',
    venueId: 'COMEX',
    currency: 'USD',
    executable: false,
    feedQualification: 'EXTERNAL_PROVIDER_REQUIRED' as const,
  }),
]);

const byId = new Map(GOLD_CANONICAL_IDENTITIES.map((row) => [row.identityId, row]));

export function resolveGoldIdentity(identityId: string): GoldCanonicalIdentity | undefined {
  return byId.get(identityId);
}

export function goldReferenceAssetId(): string {
  const id = commodityAssetId('gold');
  if (!id) {
    throw new Error('gold reference asset not registered');
  }
  return id;
}

export function assertGoldIdentitySeparation(a: GoldCanonicalIdentity, b: GoldCanonicalIdentity): boolean {
  return a.identityId !== b.identityId && a.kind !== b.kind;
}

export function listGoldIdentities(): readonly GoldCanonicalIdentity[] {
  return GOLD_CANONICAL_IDENTITIES;
}
