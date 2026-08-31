import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';

import {
  createHealthProviderRuntime,
  createHealthReferenceSandbox,
  HEALTH_ADAPTER_IDS,
  toHealthAgentEvidence,
  normalizeToServing,
  identityNutritionValue,
  assertCompatibleBasis,
  markAsHinReferenceData,
  markAsHinPrivateData,
  mayAttachGeneticsToUserProfile,
  assertNotDiagnosis,
  checkVaultPermissionForCombine,
  classifyPublicHealthReference,
  agentHealthInferenceBlocked,
  healthCoverageReport,
  FIXTURE_FOOD_PRODUCTS,
  OpenFdaFixtureProvider,
  NppesFixtureProvider,
} from '../packages/sunrey-chain/src/health-reference/index.ts';
import { dispatchHealthReference } from '../services/api/src/consumer/health-reference.ts';
import { createCanonicalToolRegistry } from '../packages/sunrey-agent/src/tools/catalog.ts';

describe('Wave 6 Prompt 22 health reference providers', () => {
  it('registers all 9 health providers from catalog', () => {
    const runtime = createHealthProviderRuntime({ mode: 'simulation' });
    assert.equal(HEALTH_ADAPTER_IDS.length, 9);
    assert.equal(runtime.registry.list().length, 9);
    for (const id of HEALTH_ADAPTER_IDS) {
      assert.ok(runtime.registry.has(id), `missing provider ${id}`);
    }
  });

  it('catalog identity matches adapter IDs', () => {
    const catalog = parseYaml(readFileSync('config/providers/wave6-health-hin-catalog-entries.yaml', 'utf8'));
    const ids = catalog.providers.map((p: { provider_id: string }) => p.provider_id);
    assert.equal(ids.length, 9);
    for (const id of HEALTH_ADAPTER_IDS) {
      assert.ok(ids.includes(id), `catalog missing ${id}`);
    }
  });

  it('normalizes food products with authority class', () => {
    const svc = createHealthReferenceSandbox();
    const community = svc.searchFoods('Nutella', 5);
    assert.ok(community.data.length > 0);
    assert.equal(community.data[0]!.authorityClass, 'community_data');
    assert.equal(community.data[0]!.providerId, 'open-food-facts');
    assert.equal(community.data[0]!.referenceOnly, true);

    const government = svc.searchFoods('chicken', 5);
    const usda = government.data.find((f) => f.providerId === 'usda-fooddata-central');
    assert.ok(usda);
    assert.equal(usda!.authorityClass, 'authoritative_official');
  });

  it('normalizes nutrition with explicit units', () => {
    const svc = createHealthReferenceSandbox();
    const result = svc.searchFoods('chicken', 5);
    const product = result.data.find((f) => f.providerId === 'usda-fooddata-central');
    assert.ok(product);
    const protein = product!.nutrition.find((n) => n.nutrient === 'protein');
    assert.ok(protein);
    assert.equal(protein!.unit, 'g');
    assert.equal(protein!.basis, 'per_100g');
  });

  it('preserves serving basis without silent mixing', () => {
    const perServing = identityNutritionValue('fat', 4.6, 'g', 'per_serving');
    const per100g = identityNutritionValue('fat', 30.9, 'g', 'per_100g');
    assert.equal(assertCompatibleBasis(perServing.basis, per100g.basis), false);
  });

  it('converts per-100g to per-serving with explicit method', () => {
    const converted = normalizeToServing('protein', 22.5, 'g', 'per_100g', 150);
    assert.equal(converted.ok, true);
    if (converted.ok) {
      assert.equal(converted.normalized.basis, 'per_serving');
      assert.ok(converted.normalized.conversionMethod?.includes('150'));
      assert.equal(converted.normalized.sourceBasis, 'per_100g');
    }
  });

  it('differentiates government vs community authority class', () => {
    const off = FIXTURE_FOOD_PRODUCTS.find((f) => f.providerId === 'open-food-facts');
    const usda = FIXTURE_FOOD_PRODUCTS.find((f) => f.providerId === 'usda-fooddata-central');
    assert.equal(off?.authorityClass, 'community_data');
    assert.equal(usda?.authorityClass, 'authoritative_official');
  });

  it('normalizes drug reference without prescribing advice', () => {
    const svc = createHealthReferenceSandbox();
    const result = svc.searchDrugs('ibuprofen', 5);
    assert.ok(result.data.length > 0);
    assert.equal(result.data[0]!.notPrescribingAdvice, true);
    assert.equal(result.data[0]!.referenceOnly, true);
  });

  it('normalizes medical device reference', () => {
    const svc = createHealthReferenceSandbox();
    const result = svc.searchDevices('glucose', 5);
    assert.ok(result.data.length > 0);
    assert.equal(result.data[0]!.referenceOnly, true);
    assert.ok(result.data[0]!.deviceClass);
  });

  it('normalizes genetics reference as educational only', () => {
    const svc = createHealthReferenceSandbox();
    const result = svc.searchGenetics('BRCA1', 5);
    assert.ok(result.data.length > 0);
    assert.equal(result.data[0]!.educationalOnly, true);
    assert.equal(result.data[0]!.notPersonalizedInterpretation, true);
  });

  it('normalizes clinical trial as informational only', () => {
    const svc = createHealthReferenceSandbox();
    const result = svc.searchClinicalTrials('diabetes', 5);
    assert.ok(result.data.length > 0);
    assert.equal(result.data[0]!.informationalOnly, true);
    assert.equal(result.data[0]!.notEligibilityDetermination, true);
  });

  it('normalizes healthcare provider directory semantics', () => {
    const svc = createHealthReferenceSandbox();
    const result = svc.searchHealthcareProviders('Smith', 5);
    assert.ok(result.data.length > 0);
    assert.equal(result.data[0]!.directoryOnly, true);
    assert.equal(result.data[0]!.notQualityEndorsement, true);
    assert.equal(result.data[0]!.notInsuranceEligibility, true);
  });

  it('handles stale data via freshness status', () => {
    const svc = createHealthReferenceSandbox();
    const result = svc.searchFoods('Nutella', 5);
    assert.ok(result.data[0]!.freshness.freshnessStatus);
  });

  it('uses cache for repeated food searches', () => {
    const runtime = createHealthProviderRuntime({ mode: 'simulation' });
    const svc = runtime.service;
    svc.searchFoods('chicken', 5);
    assert.ok(runtime.cache.size() > 0);
    svc.searchFoods('chicken', 5);
    assert.ok(runtime.cache.size() > 0);
  });

  it('handles provider timeout via unhealthy state', () => {
    const providers = createHealthProviderRuntime({ mode: 'simulation' }).providers;
    (providers.openfda as OpenFdaFixtureProvider).markTimeout();
    const health = providers.openfda.health();
    assert.equal(health.healthy, false);
    assert.ok(health.message.includes('timeout'));
  });

  it('handles 429 rate limiting', () => {
    const providers = createHealthProviderRuntime({ mode: 'simulation' }).providers;
    (providers.nppes as NppesFixtureProvider).markRateLimited();
    const health = providers.nppes.health();
    assert.equal(health.degraded, true);
    assert.ok(health.message.includes('429'));
  });

  it('handles malformed payload via empty results', () => {
    const svc = createHealthReferenceSandbox();
    const result = svc.searchFoods('__nonexistent_product_xyz__', 5);
    assert.equal(result.data.length, 0);
    assert.equal(result.degraded, true);
  });

  it('enforces HIN reference/private separation', () => {
    const reference = markAsHinReferenceData();
    const priv = markAsHinPrivateData();
    assert.equal(reference.layer, 'HIN_REFERENCE_DATA');
    assert.equal(priv.layer, 'HIN_PRIVATE_DATA');
    assert.equal(reference.nonUserSpecific, true);
    assert.equal(priv.subjectBound, true);
  });

  it('does not bypass vault permissions for combine', () => {
    assert.equal(
      checkVaultPermissionForCombine({ vaultConsentGranted: false, operation: 'COMBINE_REFERENCE_WITH_PRIVATE' }),
      false,
    );
    assert.equal(
      checkVaultPermissionForCombine({ vaultConsentGranted: true, operation: 'COMBINE_REFERENCE_WITH_PRIVATE' }),
      true,
    );
  });

  it('public genetics data does not attach to user DNA without consent', () => {
    const blocked = mayAttachGeneticsToUserProfile({
      hasUserGeneticData: true,
      userAuthorized: false,
      vaultPolicyPermits: true,
    });
    assert.equal(blocked.allowed, false);
    const noData = mayAttachGeneticsToUserProfile({
      hasUserGeneticData: false,
      userAuthorized: true,
      vaultPolicyPermits: true,
    });
    assert.equal(noData.allowed, false);
  });

  it('public health data does not create diagnosis', () => {
    const svc = createHealthReferenceSandbox();
    const result = svc.searchPublicHealth('health', 5);
    assert.equal(assertNotDiagnosis(result.data).isDiagnosis, false);
  });

  it('agent does not infer health condition', () => {
    const svc = createHealthReferenceSandbox();
    const context = svc.buildResearchContext();
    const evidence = toHealthAgentEvidence(context);
    assert.equal(evidence.inferHealthCondition, false);
    assert.equal(evidence.grantsDiagnosis, false);
    assert.equal(evidence.referenceOnly, true);
    assert.equal(agentHealthInferenceBlocked().inferHealthCondition, false);
  });

  it('BFF exposes no sensitive provider/user data', () => {
    const res = dispatchHealthReference(
      { method: 'GET', path: '/api/v1/health/reference/foods', query: { q: 'chicken' } },
      'req-1',
      {},
    );
    assert.ok(res);
    assert.equal(res!.status, 200);
    const body = res!.body as { hinLayer: string; notDiagnosis: boolean; data: unknown[] };
    assert.equal(body.hinLayer, 'HIN_REFERENCE_DATA');
    assert.equal(body.notDiagnosis, true);
    const json = JSON.stringify(body);
    assert.equal(json.includes('dna'), false);
    assert.equal(json.includes('diagnosis'), false);
    assert.equal(json.includes('api_key'), false);
  });

  it('BFF nutrition route returns explicit units', () => {
    const res = dispatchHealthReference(
      { method: 'GET', path: '/api/v1/health/reference/nutrition', query: { q: 'chicken' } },
      'req-2',
      {},
    );
    assert.ok(res);
    const body = res!.body as { data: { nutrients: { unit: string; basis: string }[] }[] };
    const nutrients = body.data[0]?.nutrients ?? [];
    assert.ok(nutrients.every((n) => ['kcal', 'g', 'mg', 'mcg', 'iu'].includes(n.unit)));
  });

  it('classifies public health reference separately from PHI', () => {
    assert.equal(classifyPublicHealthReference(), 'PUBLIC_HEALTH_REFERENCE');
  });

  it('reports coverage with production vs research tiers', () => {
    const report = healthCoverageReport();
    assert.equal(report.total, 9);
    assert.ok(report.productionCandidate >= 6);
    assert.ok(report.researchOnly >= 1);
  });

  it('agent tool registry does not add health inference tools', () => {
    const registry = createCanonicalToolRegistry();
    const tools = registry.list();
    const healthInference = tools.filter(
      (t) =>
        t.toolId.includes('diagnos') ||
        t.toolId.includes('health_infer') ||
        t.toolId.includes('medical_advice'),
    );
    assert.equal(healthInference.length, 0);
  });
});
