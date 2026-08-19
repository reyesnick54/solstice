import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PRODUCTIVE_CATEGORIES } from './productive/types.ts';
import {
  DATA_SOURCE_CATEGORIES,
  LEGACY_DATA_SOURCE_ALIASES,
  OVERLAP_RISK_PRODUCTIVE_CATEGORIES,
  allowedClaimTypesFor,
  allowedFactTypesFor,
  canonicalSourceTaxonomy,
  evaluateTaxonomyCompleteness,
  mappingAuthorizesMoonRey,
  mappingCreatesProductiveContribution,
  mappingDeclaresProductiveContribution,
  mappingRequiresAttribution,
  mappingsForFactType,
  mappingsForProductiveCategory,
  mappingsForSourceCategory,
  productionIsActive,
  referencePriceCanCreateClaim,
  resolveSourceCategory,
  sourcePathExistsFor,
} from './productive/source-taxonomy/index.ts';

function factsFor(category: (typeof DATA_SOURCE_CATEGORIES)[number]): readonly string[] {
  return mappingsForSourceCategory(category).map((row) => row.factType);
}

function claimsFor(category: (typeof DATA_SOURCE_CATEGORIES)[number], factType: string): readonly string[] {
  return mappingsForSourceCategory(category)
    .filter((row) => row.factType === factType)
    .flatMap((row) => row.allowedClaimTypes);
}

describe('Chunk 116 MoonRey source-to-productive taxonomy', () => {
  it('gives every ProductiveCategory a deliberate source path', () => {
    const completeness = evaluateTaxonomyCompleteness();
    assert.deepEqual(completeness.productiveCategoryGaps, []);
    for (const category of PRODUCTIVE_CATEGORIES) {
      assert.equal(sourcePathExistsFor(category), true, category);
      assert.ok(mappingsForProductiveCategory(category).length > 0, category);
    }
    assert.equal(completeness.gapCount, 0);
  });

  it('gives every active source category a deliberate mapping', () => {
    const completeness = evaluateTaxonomyCompleteness();
    assert.deepEqual(completeness.unmappedActiveSourceCategories, []);
    for (const category of DATA_SOURCE_CATEGORIES) {
      assert.ok(mappingsForSourceCategory(category).length > 0, category);
      assert.ok(allowedFactTypesFor(category).length > 0, category);
    }
  });

  it('keeps reference_price from creating a productive claim', () => {
    const mappings = mappingsForSourceCategory('reference_price');
    assert.equal(mappings.length, 1);
    const mapping = mappings[0];
    assert.ok(mapping);
    assert.equal(mapping.factType, 'REFERENCE_PRICE');
    assert.equal(mapping.productiveCategory, null);
    assert.deepEqual(mapping.allowedClaimTypes, []);
    assert.equal(mapping.canCreateProductiveClaim, false);
    assert.equal(mapping.canBecomeProductiveContribution, false);
    assert.equal(mapping.economicAssetCategory, 'SHARED_ECONOMIC_REFERENCE');
    assert.equal(referencePriceCanCreateClaim(), false);
    assert.equal(allowedClaimTypesFor('reference_price').length, 0);
    assert.equal(canonicalSourceTaxonomy.evaluateFactClaimPair('REFERENCE_PRICE', 'OUTPUT').ok, false);
  });

  it('maps energy production, capacity, and consumption', () => {
    assert.deepEqual(factsFor('energy'), ['ENERGY_PRODUCTION', 'ENERGY_CAPACITY', 'ENERGY_CONSUMPTION']);
    assert.deepEqual(claimsFor('energy', 'ENERGY_PRODUCTION'), ['OUTPUT']);
    assert.deepEqual(claimsFor('energy', 'ENERGY_CAPACITY'), ['CAPACITY']);
    assert.deepEqual(claimsFor('energy', 'ENERGY_CONSUMPTION'), ['USAGE']);
    assert.equal(mappingsForFactType('ENERGY_PRODUCTION')[0]?.productiveCategory, 'ENERGY');
  });

  it('maps food and agricultural output', () => {
    assert.deepEqual(factsFor('food_agriculture'), ['FOOD_PRODUCTION', 'AGRICULTURAL_OUTPUT']);
    assert.deepEqual(claimsFor('food_agriculture', 'FOOD_PRODUCTION'), ['OUTPUT']);
    assert.deepEqual(claimsFor('food_agriculture', 'AGRICULTURAL_OUTPUT'), ['OUTPUT']);
    assert.equal(mappingsForProductiveCategory('FOOD_AGRICULTURE')[0]?.dataSourceCategory, 'food_agriculture');
  });

  it('maps water production and availability', () => {
    assert.deepEqual(factsFor('water'), ['WATER_PRODUCTION', 'WATER_AVAILABILITY']);
    assert.deepEqual(claimsFor('water', 'WATER_PRODUCTION'), ['OUTPUT']);
    assert.deepEqual(claimsFor('water', 'WATER_AVAILABILITY'), ['CAPACITY']);
  });

  it('maps minerals and legacy resources without rewriting history', () => {
    assert.deepEqual(factsFor('minerals_resources'), ['RESOURCE_EXTRACTION', 'RESOURCE_RESERVE']);
    assert.deepEqual(factsFor('resources'), ['RESOURCE_EXTRACTION', 'RESOURCE_RESERVE']);
    assert.deepEqual(claimsFor('minerals_resources', 'RESOURCE_EXTRACTION'), ['OUTPUT']);
    assert.deepEqual(claimsFor('minerals_resources', 'RESOURCE_RESERVE'), ['RESERVE']);
    for (const row of mappingsForSourceCategory('resources')) {
      assert.equal(row.dataSourceCategory, 'resources');
      assert.equal(row.productiveCategory, 'MINERALS_RAW_MATERIALS');
    }
  });

  it('maps compute usage and capacity', () => {
    assert.deepEqual(factsFor('compute'), ['COMPUTE_USAGE', 'COMPUTE_CAPACITY']);
    assert.deepEqual(claimsFor('compute', 'COMPUTE_USAGE'), ['USAGE']);
    assert.deepEqual(claimsFor('compute', 'COMPUTE_CAPACITY'), ['CAPACITY']);
  });

  it('maps AI compute inference, training, and capacity', () => {
    assert.deepEqual(factsFor('ai_compute'), ['AI_INFERENCE_USAGE', 'AI_TRAINING_USAGE', 'AI_COMPUTE_CAPACITY']);
    assert.deepEqual(claimsFor('ai_compute', 'AI_INFERENCE_USAGE'), ['USAGE']);
    assert.deepEqual(claimsFor('ai_compute', 'AI_TRAINING_USAGE'), ['USAGE']);
    assert.deepEqual(claimsFor('ai_compute', 'AI_COMPUTE_CAPACITY'), ['CAPACITY']);
    assert.equal(mappingsForProductiveCategory('AI_COMPUTE').every((row) => row.productiveCategory === 'AI_COMPUTE'), true);
  });

  it('maps manufacturing output and capacity', () => {
    assert.deepEqual(factsFor('manufacturing'), ['MANUFACTURING_OUTPUT', 'MANUFACTURING_CAPACITY']);
    assert.deepEqual(claimsFor('manufacturing', 'MANUFACTURING_OUTPUT'), ['OUTPUT']);
    assert.deepEqual(claimsFor('manufacturing', 'MANUFACTURING_CAPACITY'), ['CAPACITY']);
    assert.equal(mappingRequiresAttribution('MANUFACTURING'), true);
  });

  it('maps real-estate use capacity', () => {
    assert.deepEqual(factsFor('real_estate_use'), ['REAL_ESTATE_USE_CAPACITY']);
    assert.deepEqual(claimsFor('real_estate_use', 'REAL_ESTATE_USE_CAPACITY'), ['CAPACITY']);
    assert.equal(mappingsForSourceCategory('real_estate_use')[0]?.productiveCategory, 'REAL_ESTATE_USE');
  });

  it('maps storage capacity', () => {
    assert.deepEqual(factsFor('storage'), ['STORAGE_CAPACITY']);
    assert.deepEqual(claimsFor('storage', 'STORAGE_CAPACITY'), ['CAPACITY']);
  });

  it('maps logistics capacity and delivery', () => {
    assert.deepEqual(factsFor('logistics'), ['LOGISTICS_CAPACITY', 'DELIVERY_COMPLETION']);
    assert.deepEqual(claimsFor('logistics', 'LOGISTICS_CAPACITY'), ['CAPACITY']);
    assert.deepEqual(claimsFor('logistics', 'DELIVERY_COMPLETION'), ['DELIVERY']);
    assert.equal(mappingRequiresAttribution('LOGISTICS_TRANSPORTATION'), true);
  });

  it('maps bandwidth capacity and usage', () => {
    assert.deepEqual(factsFor('bandwidth'), ['BANDWIDTH_CAPACITY', 'BANDWIDTH_USAGE']);
    assert.deepEqual(claimsFor('bandwidth', 'BANDWIDTH_CAPACITY'), ['CAPACITY']);
    assert.deepEqual(claimsFor('bandwidth', 'BANDWIDTH_USAGE'), ['USAGE']);
  });

  it('maps infrastructure capacity and usage as explicit paths', () => {
    assert.deepEqual(factsFor('infrastructure'), ['INFRASTRUCTURE_CAPACITY', 'INFRASTRUCTURE_USAGE']);
    assert.deepEqual(claimsFor('infrastructure', 'INFRASTRUCTURE_CAPACITY'), ['CAPACITY']);
    assert.deepEqual(claimsFor('infrastructure', 'INFRASTRUCTURE_USAGE'), ['USAGE']);
    assert.equal(sourcePathExistsFor('INFRASTRUCTURE'), true);
  });

  it('maps goods output and delivery as explicit paths', () => {
    assert.deepEqual(factsFor('goods'), ['GOODS_OUTPUT', 'GOODS_DELIVERY']);
    assert.deepEqual(claimsFor('goods', 'GOODS_OUTPUT'), ['OUTPUT']);
    assert.deepEqual(claimsFor('goods', 'GOODS_DELIVERY'), ['DELIVERY']);
    assert.equal(sourcePathExistsFor('GOODS'), true);
    assert.equal(mappingRequiresAttribution('GOODS'), true);
  });

  it('maps services and the legacy service_delivery alias', () => {
    assert.deepEqual(factsFor('services'), ['SERVICE_DELIVERY']);
    assert.deepEqual(factsFor('service_delivery'), ['SERVICE_DELIVERY']);
    assert.deepEqual(claimsFor('services', 'SERVICE_DELIVERY'), ['DELIVERY']);
    assert.equal(mappingsForSourceCategory('service_delivery')[0]?.dataSourceCategory, 'service_delivery');
  });

  it('maps autonomous machine output as an explicit path', () => {
    assert.deepEqual(factsFor('automated_machine_output'), ['AUTOMATED_MACHINE_OUTPUT']);
    assert.deepEqual(claimsFor('automated_machine_output', 'AUTOMATED_MACHINE_OUTPUT'), ['OUTPUT']);
    assert.equal(sourcePathExistsFor('AUTOMATED_MACHINE_OUTPUT'), true);
    assert.equal(mappingRequiresAttribution('AUTOMATED_MACHINE_OUTPUT'), true);
  });

  it('rejects an invalid fact and source-category pair', () => {
    const rejected = canonicalSourceTaxonomy.evaluateFactCategoryPair('energy', 'SERVICE_DELIVERY');
    assert.equal(rejected.ok, false);
    if (!rejected.ok) {
      assert.equal(rejected.error.code, 'INVALID_FACT_CATEGORY_PAIR');
    }
    assert.equal(canonicalSourceTaxonomy.factTypeIsMappedForSource('goods', 'MANUFACTURING_OUTPUT'), false);
  });

  it('rejects an invalid fact and claim pair', () => {
    const rejected = canonicalSourceTaxonomy.evaluateFactClaimPair('ENERGY_CAPACITY', 'OUTPUT');
    assert.equal(rejected.ok, false);
    if (!rejected.ok) {
      assert.equal(rejected.error.code, 'INVALID_FACT_CLAIM_PAIR');
    }
    assert.equal(canonicalSourceTaxonomy.claimTypeIsMappedForFact('ENERGY_PRODUCTION', 'RESERVE'), false);
    assert.equal(canonicalSourceTaxonomy.claimTypeIsMappedForFact('RESOURCE_RESERVE', 'OUTPUT'), false);
  });

  it('resolves legacy category aliases deterministically without rewriting records', () => {
    assert.deepEqual(resolveSourceCategory('resources'), {
      input: 'resources',
      canonical: 'minerals_resources',
      isLegacyAlias: true,
      historicalRecordRewritten: false,
    });
    assert.deepEqual(resolveSourceCategory('ai_usage'), {
      input: 'ai_usage',
      canonical: 'ai_compute',
      isLegacyAlias: true,
      historicalRecordRewritten: false,
    });
    assert.deepEqual(resolveSourceCategory('service_delivery'), {
      input: 'service_delivery',
      canonical: 'services',
      isLegacyAlias: true,
      historicalRecordRewritten: false,
    });
    assert.deepEqual(resolveSourceCategory('energy'), {
      input: 'energy',
      canonical: 'energy',
      isLegacyAlias: false,
      historicalRecordRewritten: false,
    });
    assert.deepEqual(Object.keys(LEGACY_DATA_SOURCE_ALIASES).sort(), ['ai_usage', 'resources', 'service_delivery']);
    assert.deepEqual(factsFor('ai_usage'), factsFor('ai_compute'));
    assert.notEqual(mappingsForSourceCategory('ai_usage')[0]?.dataSourceCategory, 'ai_compute');
  });

  it('does not let a mapping mint MoonRey', () => {
    assert.equal(mappingAuthorizesMoonRey(), false);
    assert.equal(productionIsActive(), false);
    for (const mapping of canonicalSourceTaxonomy.all()) {
      assert.equal(mapping.automaticIssuance, false, mapping.mappingId);
      assert.equal(mapping.mappingAuthorizesIssuance, false, mapping.mappingId);
      assert.equal(mapping.verifiedFactAloneCanMint, false, mapping.mappingId);
      assert.equal(mapping.capacityClaimAutomaticallyIssues, false, mapping.mappingId);
      assert.equal(mapping.reserveClaimAutomaticallyIssues, false, mapping.mappingId);
      assert.equal(canonicalSourceTaxonomy.mappingAloneCannotMint(), false);
    }
  });

  it('does not let a mapping declare a productive contribution', () => {
    assert.equal(mappingDeclaresProductiveContribution(), false);
    assert.equal(mappingCreatesProductiveContribution(), false);
    for (const mapping of canonicalSourceTaxonomy.all()) {
      assert.equal(mapping.mappingCreatesProductiveContribution, false, mapping.mappingId);
      assert.equal(mapping.mappingDeclaresProductiveContribution, false, mapping.mappingId);
    }
    assert.equal(canonicalSourceTaxonomy.mappingAloneCannotDeclareContribution(), false);
  });

  it('marks overlap-risk productive categories for later attribution policy', () => {
    assert.deepEqual(OVERLAP_RISK_PRODUCTIVE_CATEGORIES, [
      'MANUFACTURING',
      'GOODS',
      'AUTOMATED_MACHINE_OUTPUT',
      'LOGISTICS_TRANSPORTATION',
    ]);
    for (const category of OVERLAP_RISK_PRODUCTIVE_CATEGORIES) {
      assert.equal(mappingRequiresAttribution(category), true, category);
      assert.equal(
        mappingsForProductiveCategory(category).every((row) => row.requiresAttributionPolicy),
        true,
        category,
      );
    }
    assert.equal(mappingRequiresAttribution('ENERGY'), false);
    assert.equal(mappingRequiresAttribution('WATER'), false);
  });
});
