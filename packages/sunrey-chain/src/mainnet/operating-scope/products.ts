/**
 * Activation-domain product rows. Each domain is independently scoped.
 * SunRey Coin does not authorize MoonRey Coin. Exchange does not
 * authorize custody. Custody does not authorize native issuance.
 */

import { ACTIVATION_DOMAINS, type ActivationDomain } from '../types.ts';
import type { LegalEntityRef, ProductScopeRow } from './types.ts';
import { FIXTURE_JURISDICTION_XA, FIXTURE_JURISDICTION_XB } from './jurisdictions.ts';

export const FIXTURE_ENTITY_XA = 'le_sunrey_fixture_xa' as const;
export const FIXTURE_ENTITY_XB = 'le_sunrey_fixture_xb' as const;

export const FIXTURE_LEGAL_ENTITIES: readonly LegalEntityRef[] = Object.freeze([
  Object.freeze({
    entityRef: FIXTURE_ENTITY_XA,
    jurisdiction: FIXTURE_JURISDICTION_XA,
    displayName: 'SunRey fixture legal-entity reference A (not a real company record)',
    fixture: true,
    inventedCorporateData: false,
  }),
  Object.freeze({
    entityRef: FIXTURE_ENTITY_XB,
    jurisdiction: FIXTURE_JURISDICTION_XB,
    displayName: 'SunRey fixture legal-entity reference B (not a real company record)',
    fixture: true,
    inventedCorporateData: false,
  }),
]);

const INDEPENDENT_OF: Record<ActivationDomain, readonly ActivationDomain[]> = {
  SUNREY_CHAIN: ['SUNREY_COIN_NATIVE_ASSET', 'MOONREY_COIN_NATIVE_ASSET', 'SUNREY_EXCHANGE', 'INSTITUTIONAL_CUSTODY'],
  SUNREY_COIN_NATIVE_ASSET: ['MOONREY_COIN_NATIVE_ASSET', 'SUNREY_EXCHANGE', 'INSTITUTIONAL_CUSTODY'],
  MOONREY_COIN_NATIVE_ASSET: ['SUNREY_COIN_NATIVE_ASSET', 'SUNREY_EXCHANGE', 'INSTITUTIONAL_CUSTODY'],
  SUNREY_EXCHANGE: ['INSTITUTIONAL_CUSTODY', 'SUNREY_COIN_NATIVE_ASSET', 'MOONREY_COIN_NATIVE_ASSET'],
  INSTITUTIONAL_CUSTODY: ['SUNREY_EXCHANGE', 'SUNREY_COIN_NATIVE_ASSET', 'MOONREY_COIN_NATIVE_ASSET'],
  FIAT_BANKING: ['PAYMENT_RAILS', 'CARDS'],
  PAYMENT_RAILS: ['FIAT_BANKING', 'CARDS'],
  CARDS: ['FIAT_BANKING', 'PAYMENT_RAILS', 'INVESTMENTS'],
  INVESTMENTS: ['CARDS', 'SUNREY_EXCHANGE'],
  HUMAN_INFORMATION_MARKET: ['PRODUCTIVE_CAPACITY_MARKET', 'SUNREY_CHAIN'],
  PRODUCTIVE_CAPACITY_MARKET: ['HUMAN_INFORMATION_MARKET', 'MOONREY_COIN_NATIVE_ASSET'],
  INTEROPERABILITY: ['SUNREY_CHAIN', 'SUNREY_EXCHANGE'],
};

export function listLegalEntities(): readonly LegalEntityRef[] {
  return FIXTURE_LEGAL_ENTITIES;
}

export function findLegalEntity(entityRef: string): LegalEntityRef | undefined {
  return FIXTURE_LEGAL_ENTITIES.find((row) => row.entityRef === entityRef);
}

export function defaultProductRows(): readonly ProductScopeRow[] {
  const rows: ProductScopeRow[] = [];
  for (const entity of FIXTURE_LEGAL_ENTITIES) {
    for (const domain of ACTIVATION_DOMAINS) {
      rows.push(
        Object.freeze({
          rowId: `${entity.entityRef}:${entity.jurisdiction}:${domain}`,
          key: Object.freeze({
            jurisdiction: entity.jurisdiction,
            activationDomain: domain,
            legalEntityRef: entity.entityRef,
            ...(domain === 'SUNREY_COIN_NATIVE_ASSET' ? { asset: 'SUNREY_COIN' as const } : {}),
            ...(domain === 'MOONREY_COIN_NATIVE_ASSET' ? { asset: 'MOONREY_COIN' as const } : {}),
          }),
          softwareImplemented: true,
          independentOf: INDEPENDENT_OF[domain],
          hinPrivacyRequired: domain === 'HUMAN_INFORMATION_MARKET',
          productiveUseRightRequired: domain === 'PRODUCTIVE_CAPACITY_MARKET',
        }),
      );
    }
  }
  return Object.freeze(rows);
}

export function domainDoesNotAuthorize(
  source: ActivationDomain,
  target: ActivationDomain,
): boolean {
  return source !== target;
}
