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

export const SOLSTICE_EU = freezeLegalEntity({
  id: asLegalEntityId('le_solstice_eu_entity'),
  name: 'Solstice EU Entity (simulation)',
  jurisdiction: asJurisdiction('DE'),
  status: 'ACTIVE',
});

export const SOLSTICE_SA = freezeLegalEntity({
  id: asLegalEntityId('le_solstice_sa_entity'),
  name: 'Solstice SA Entity (simulation)',
  jurisdiction: asJurisdiction('SA'),
  status: 'ACTIVE',
});

export const SOLSTICE_AE = freezeLegalEntity({
  id: asLegalEntityId('le_solstice_ae_entity'),
  name: 'Solstice AE Entity (simulation)',
  jurisdiction: asJurisdiction('AE'),
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

export const PRODUCT_DEMAND_USD_US: Product = freezeProduct({
  id: asProductId('prod_demand_usd_us'),
  name: 'Simulated US-entity USD demand deposit',
  accountClass: 'DEMAND_DEPOSIT',
  currency: asCurrencyCode('USD'),
  legalEntityId: SOLSTICE_US.id,
  jurisdiction: asJurisdiction('US'),
  status: 'ACTIVE',
});

export const PRODUCT_DEMAND_EUR_EU: Product = freezeProduct({
  id: asProductId('prod_demand_eur_eu'),
  name: 'Simulated EU-entity EUR demand deposit — no insurance claim',
  accountClass: 'DEMAND_DEPOSIT',
  currency: asCurrencyCode('EUR'),
  legalEntityId: SOLSTICE_EU.id,
  jurisdiction: asJurisdiction('DE'),
  status: 'ACTIVE',
});

export const PRODUCT_DEMAND_SAR_SA: Product = freezeProduct({
  id: asProductId('prod_demand_sar_sa'),
  name: 'Simulated SA-entity SAR demand deposit — no insurance claim',
  accountClass: 'DEMAND_DEPOSIT',
  currency: asCurrencyCode('SAR'),
  legalEntityId: SOLSTICE_SA.id,
  jurisdiction: asJurisdiction('SA'),
  status: 'ACTIVE',
});

export const PRODUCT_DEMAND_AED_AE: Product = freezeProduct({
  id: asProductId('prod_demand_aed_ae'),
  name: 'Simulated AE-entity AED demand deposit — no insurance claim',
  accountClass: 'DEMAND_DEPOSIT',
  currency: asCurrencyCode('AED'),
  legalEntityId: SOLSTICE_AE.id,
  jurisdiction: asJurisdiction('AE'),
  status: 'ACTIVE',
});

export const PRODUCT_DEMAND_GBP_GB: Product = freezeProduct({
  id: asProductId('prod_demand_gbp_gb'),
  name: 'Simulated GBP-entity GBP demand deposit — no insurance claim',
  accountClass: 'DEMAND_DEPOSIT',
  currency: asCurrencyCode('GBP'),
  legalEntityId: SOLSTICE_UK.id,
  jurisdiction: asJurisdiction('GB'),
  status: 'ACTIVE',
});

export const PRODUCT_DEMAND_EUR_GB: Product = freezeProduct({
  id: asProductId('prod_demand_eur_gb'),
  name: 'Simulated GBP-entity EUR demand deposit — no insurance claim',
  accountClass: 'DEMAND_DEPOSIT',
  currency: asCurrencyCode('EUR'),
  legalEntityId: SOLSTICE_UK.id,
  jurisdiction: asJurisdiction('GB'),
  status: 'ACTIVE',
});

export const PRODUCT_DEMAND_SAR_GB: Product = freezeProduct({
  id: asProductId('prod_demand_sar_gb'),
  name: 'Simulated GBP-entity SAR demand deposit — no insurance claim',
  accountClass: 'DEMAND_DEPOSIT',
  currency: asCurrencyCode('SAR'),
  legalEntityId: SOLSTICE_UK.id,
  jurisdiction: asJurisdiction('GB'),
  status: 'ACTIVE',
});

export const PRODUCT_DEMAND_AED_GB: Product = freezeProduct({
  id: asProductId('prod_demand_aed_gb'),
  name: 'Simulated GBP-entity AED demand deposit — no insurance claim',
  accountClass: 'DEMAND_DEPOSIT',
  currency: asCurrencyCode('AED'),
  legalEntityId: SOLSTICE_UK.id,
  jurisdiction: asJurisdiction('GB'),
  status: 'ACTIVE',
});

export const PRODUCT_PENDING_USD_GB: Product = freezeProduct({
  id: asProductId('prod_pending_usd_gb'),
  name: 'Simulated GBP-entity USD pending settlement — no insurance claim',
  accountClass: 'PENDING_SETTLEMENT',
  currency: asCurrencyCode('USD'),
  legalEntityId: SOLSTICE_UK.id,
  jurisdiction: asJurisdiction('GB'),
  status: 'ACTIVE',
});

export const PRODUCT_BROKERAGE_CASH_USD_GB: Product = freezeProduct({
  id: asProductId('prod_brokerage_cash_usd_gb'),
  name: 'Simulated GBP-entity USD brokerage cash — not an insured-deposit claim',
  accountClass: 'BROKERAGE_CASH',
  currency: asCurrencyCode('USD'),
  legalEntityId: SOLSTICE_UK.id,
  jurisdiction: asJurisdiction('GB'),
  status: 'ACTIVE',
});

export const PRODUCT_SECURITIES_USD_GB: Product = freezeProduct({
  id: asProductId('prod_securities_usd_gb'),
  name: 'Simulated GBP-entity USD securities relationship — paper only',
  accountClass: 'SECURITIES',
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
  legalEntities.put(SOLSTICE_EU.id, SOLSTICE_EU);
  legalEntities.put(SOLSTICE_SA.id, SOLSTICE_SA);
  legalEntities.put(SOLSTICE_AE.id, SOLSTICE_AE);
  const products = new ProductStore();
  products.put(PRODUCT_DEMAND_USD_GB.id, PRODUCT_DEMAND_USD_GB);
  products.put(PRODUCT_SAVINGS_USD_GB.id, PRODUCT_SAVINGS_USD_GB);
  products.put(PRODUCT_DIGITAL_USD_GB.id, PRODUCT_DIGITAL_USD_GB);
  products.put(PRODUCT_DEMAND_USD_US.id, PRODUCT_DEMAND_USD_US);
  products.put(PRODUCT_DEMAND_EUR_EU.id, PRODUCT_DEMAND_EUR_EU);
  products.put(PRODUCT_DEMAND_SAR_SA.id, PRODUCT_DEMAND_SAR_SA);
  products.put(PRODUCT_DEMAND_AED_AE.id, PRODUCT_DEMAND_AED_AE);
  products.put(PRODUCT_DEMAND_GBP_GB.id, PRODUCT_DEMAND_GBP_GB);
  products.put(PRODUCT_DEMAND_EUR_GB.id, PRODUCT_DEMAND_EUR_GB);
  products.put(PRODUCT_DEMAND_SAR_GB.id, PRODUCT_DEMAND_SAR_GB);
  products.put(PRODUCT_DEMAND_AED_GB.id, PRODUCT_DEMAND_AED_GB);
  products.put(PRODUCT_PENDING_USD_GB.id, PRODUCT_PENDING_USD_GB);
  products.put(PRODUCT_BROKERAGE_CASH_USD_GB.id, PRODUCT_BROKERAGE_CASH_USD_GB);
  products.put(PRODUCT_SECURITIES_USD_GB.id, PRODUCT_SECURITIES_USD_GB);
  return {
    legalEntities,
    products,
    entities: [SOLSTICE_UK, SOLSTICE_US, SOLSTICE_EU, SOLSTICE_SA, SOLSTICE_AE],
  };
}
