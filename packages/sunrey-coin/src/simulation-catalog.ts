import { asCurrencyCode } from '../../domain/src/currency.ts';
import { asJurisdiction } from '../../domain/src/jurisdiction.ts';
import { asLegalEntityId, freezeLegalEntity } from '../../domain/src/legal-entity.ts';
import { asProductId, freezeProduct, type Product } from '../../domain/src/product.ts';

/** Kernel facts for simulation issuance. Not a SunRey Coin ticker or ISO asset code. */
export const SIMULATION_SOLSTICE_UK = freezeLegalEntity({
  id: asLegalEntityId('le_solstice_uk_ltd'),
  name: 'Solstice UK Ltd (simulation)',
  jurisdiction: asJurisdiction('GB'),
  status: 'ACTIVE',
});

export const SIMULATION_DIGITAL_CUSTODY_GB: Product = freezeProduct({
  id: asProductId('prod_digital_usd_gb'),
  name: 'Simulated GBP-entity USD digital-asset custody',
  accountClass: 'DIGITAL_ASSET_CUSTODY',
  currency: asCurrencyCode('USD'),
  legalEntityId: SIMULATION_SOLSTICE_UK.id,
  jurisdiction: asJurisdiction('GB'),
  status: 'ACTIVE',
});
