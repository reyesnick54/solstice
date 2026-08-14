import { asCurrencyCode } from '../../../packages/domain/src/currency.ts';
import { asJurisdiction } from '../../../packages/domain/src/jurisdiction.ts';
import { asLegalEntityId, freezeLegalEntity, type LegalEntity } from '../../../packages/domain/src/legal-entity.ts';
import { asProductId, freezeProduct, type Product } from '../../../packages/domain/src/product.ts';
import { LegalEntityStore, ProductStore } from './stores.ts';

export const SOLSTICE_UK = freezeLegalEntity({
  id: asLegalEntityId('le_solstice_uk_ltd'),
  name: 'Solstice UK Ltd (simulation)',
  jurisdiction: asJurisdiction('GB'),
  status: 'ACTIVE',
});

export const SOLSTICE_US = freezeLegalEntity({
  id: asLegalEntityId('le_solstice_us_inc'),
  name: 'Solstice US Inc (simulation)',
  jurisdiction: asJurisdiction('US'),
  status: 'ACTIVE',
});

export const PRODUCT_DEMAND_USD_GB: Product = freezeProduct({
  id: asProductId('prod_demand_usd_gb'),
  name: 'Simulated GBP-entity USD demand deposit',
  accountClass: 'DEMAND_DEPOSIT',
  currency: asCurrencyCode('USD'),
  legalEntityId: SOLSTICE_UK.id,
  jurisdiction: asJurisdiction('GB'),
  status: 'ACTIVE',
});

export const PRODUCT_SAVINGS_USD_GB: Product = freezeProduct({
  id: asProductId('prod_savings_usd_gb'),
  name: 'Simulated GBP-entity USD savings deposit',
  accountClass: 'SAVINGS_DEPOSIT',
  currency: asCurrencyCode('USD'),
  legalEntityId: SOLSTICE_UK.id,
  jurisdiction: asJurisdiction('GB'),
  status: 'ACTIVE',
});

export const PRODUCT_DIGITAL_USD_GB: Product = freezeProduct({
  id: asProductId('prod_digital_usd_gb'),
  name: 'Simulated GBP-entity USD digital-asset custody',
  accountClass: 'DIGITAL_ASSET_CUSTODY',
  currency: asCurrencyCode('USD'),
  legalEntityId: SOLSTICE_UK.id,
  jurisdiction: asJurisdiction('GB'),
  status: 'ACTIVE',
});

export function seedSimulationCatalog(): {
  legalEntities: LegalEntityStore;
  products: ProductStore;
  entities: readonly LegalEntity[];
} {
  const legalEntities = new LegalEntityStore();
  legalEntities.put(SOLSTICE_UK.id, SOLSTICE_UK);
  legalEntities.put(SOLSTICE_US.id, SOLSTICE_US);
  const products = new ProductStore();
  products.put(PRODUCT_DEMAND_USD_GB.id, PRODUCT_DEMAND_USD_GB);
  products.put(PRODUCT_SAVINGS_USD_GB.id, PRODUCT_SAVINGS_USD_GB);
  products.put(PRODUCT_DIGITAL_USD_GB.id, PRODUCT_DIGITAL_USD_GB);
  return { legalEntities, products, entities: [SOLSTICE_UK, SOLSTICE_US] };
}
