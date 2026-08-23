import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  AI_CANNOT_VERIFY_OUTLIER,
  AGENT_PRODUCTIVE_ECONOMY_PERMISSIONS,
  CANONICAL_GPUV_ID,
  GPUV_IS_NOT_MOONREY,
  OBSERVATION_CANNOT_MINT,
  PRODUCTIVE_ECONOMY_CATEGORIES,
  SANDBOX_DRAFTS,
  SANDBOX_RESOURCES,
  SINGLE_SOURCE_IS_NOT_CONSENSUS,
  UNLABELED_NUMERIC_IS_NOT_ECONOMIC_TRUTH,
  authorizeAgentProductiveEconomyAction,
  canonicalGpuvProductization,
  createProductiveEconomyDataPlatform,
  detectOutlier,
  ingestObservation,
  lovableProductiveEconomyContract,
  normalizeEconomyQuantity,
  proposeMoonReyIssuanceFromObservations,
  refuseAiOutlierPromotion,
  refuseFakeConsensus,
  refuseIncompatibleMix,
  refuseStaleForValuation,
  rawObservationPubliclyExposable,
  simulationMethodology,
  verifyObservation,
} from './index.ts';

test('productizes the existing category catalog without inventing a second owner', () => {
  assert.ok(PRODUCTIVE_ECONOMY_CATEGORIES.includes('ENERGY'));
  assert.ok(PRODUCTIVE_ECONOMY_CATEGORIES.includes('COMPUTE'));
  assert.ok(PRODUCTIVE_ECONOMY_CATEGORIES.includes('WATER'));
  assert.ok(PRODUCTIVE_ECONOMY_CATEGORIES.includes('BANDWIDTH'));
  assert.equal(OBSERVATION_CANNOT_MINT, true);
  assert.equal(GPUV_IS_NOT_MOONREY, true);
  assert.equal(SINGLE_SOURCE_IS_NOT_CONSENSUS, true);
  assert.equal(UNLABELED_NUMERIC_IS_NOT_ECONOMIC_TRUTH, true);
});

test('normalizes energy and compute and refuses incompatible mixes', () => {
  const energy = normalizeEconomyQuantity({ category: 'ENERGY', unit: 'MWh', value: 2n });
  assert.equal(energy.ok, true);
  if (energy.ok) {
    assert.equal(energy.value.canonicalUnit, 'Wh');
    assert.equal(energy.value.canonicalValue, 2_000_000n);
  }
  const compute = normalizeEconomyQuantity({ category: 'COMPUTE', unit: 'GPU_HOUR', value: 3n });
  assert.equal(compute.ok, true);
  const mixed = normalizeEconomyQuantity({ category: 'ENERGY', unit: 'kg', value: 1n });
  assert.equal(mixed.ok, false);
  assert.equal(refuseIncompatibleMix('ENERGY', 'AGRICULTURE_FOOD'), true);
  assert.equal(refuseIncompatibleMix('LOGISTICS', 'TRANSPORTATION'), false);
});

test('rejects unlabeled numeric, missing source, and invalid signature', () => {
  const resource = SANDBOX_RESOURCES.energy;
  const unlabeled = ingestObservation(SANDBOX_DRAFTS.unlabeled, {
    nowUtc: '2026-08-23T12:00:00.000Z',
    resource,
  });
  assert.equal(unlabeled.ok, false);
  if (!unlabeled.ok) assert.equal(unlabeled.code, 'UNLABELED_NUMERIC');

  const missing = ingestObservation(SANDBOX_DRAFTS.missingSource, {
    nowUtc: '2026-08-23T12:00:00.000Z',
    resource,
  });
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.code, 'MISSING_SOURCE');

  const invalid = ingestObservation(SANDBOX_DRAFTS.invalidProvenance, {
    nowUtc: '2026-08-23T12:00:00.000Z',
    resource,
  });
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.equal(invalid.code, 'INVALID_SIGNATURE');
});

test('freshness marks stale observations unusable for time-sensitive valuation', () => {
  const platform = createProductiveEconomyDataPlatform();
  const stale = platform.observations('ENERGY').find((row) => row.observationId === 'obs_sandbox_stale');
  assert.ok(stale);
  assert.equal(stale?.verification, 'STALE');
  assert.equal(stale?.freshness.usableForTimeSensitiveValuation, false);
  assert.equal(refuseStaleForValuation(stale!.freshness), true);
});

test('oracle verification distinguishes single-source, corroboration, dispute, and outlier', () => {
  const single = verifyObservation({
    signatureValid: true,
    provenancePresent: true,
    freshnessState: 'FRESH',
    independentSourceCount: 1,
    values: [120n],
    subjectValue: 120n,
  });
  assert.equal(single.status, 'SINGLE_SOURCE_VERIFIED');
  assert.equal(single.consensusClaimed, false);
  assert.equal(refuseFakeConsensus(single.status), true);

  const multi = verifyObservation({
    signatureValid: true,
    provenancePresent: true,
    freshnessState: 'FRESH',
    independentSourceCount: 2,
    values: [120n, 118n],
    subjectValue: 120n,
  });
  assert.equal(multi.status, 'MULTI_SOURCE_CORROBORATED');
  assert.equal(refuseFakeConsensus(multi.status), false);

  const conflict = verifyObservation({
    signatureValid: true,
    provenancePresent: true,
    freshnessState: 'FRESH',
    independentSourceCount: 2,
    values: [120n, 9_000n],
    subjectValue: 9_000n,
  });
  assert.ok(conflict.status === 'DISPUTED' || conflict.status === 'OUTLIER');

  const outlier = detectOutlier({ value: 50_000n, peers: [120n, 118n] });
  assert.equal(outlier.outlier, true);
  assert.equal(outlier.aiPromotedToVerified, false);
  assert.equal(AI_CANNOT_VERIFY_OUTLIER, true);
  assert.equal(refuseAiOutlierPromotion().code, 'AI_CANNOT_VERIFY_OUTLIER');
});

test('sandbox platform aggregates verified input and withholds licensed raw data', () => {
  const platform = createProductiveEconomyDataPlatform();
  assert.ok(platform.observations('ENERGY').some((row) => row.verification === 'MULTI_SOURCE_CORROBORATED'));
  assert.ok(platform.observations('COMPUTE').length >= 1);
  assert.ok(platform.observations('MANUFACTURING').length === 1);
  assert.ok(platform.observations('AGRICULTURE_FOOD').length === 1);
  assert.ok(platform.observations('LOGISTICS').length === 1);
  const aggregates = platform.aggregates();
  assert.ok(aggregates.some((row) => row.dimension === 'TOTAL_VERIFIED_INPUT' && row.observationIds.length > 0));
  const restricted = platform.observations('COMPUTE').find((row) => row.license === 'EXTERNAL_RESTRICTED');
  assert.ok(restricted);
  assert.equal(rawObservationPubliclyExposable(restricted!), false);
  assert.ok(platform.publicMetrics().some((row) => row.rawWithheld));
});

test('GPUV methodology is versioned and does not hardcode issuance ratios', () => {
  const gpuv = canonicalGpuvProductization();
  assert.equal(gpuv.unitId, CANONICAL_GPUV_ID);
  assert.equal(gpuv.notAutomaticTokenAmount, true);
  assert.equal(gpuv.notMoonReyQuantity, true);
  const methodology = simulationMethodology('ENERGY', 'ENERGY_PRODUCTION');
  assert.equal(methodology.hardcodedIssuanceRatio, false);
  assert.equal(methodology.conversionBasis, 'GPUV_INPUT_NOT_MOONREY_RATIO');
  assert.equal(methodology.productionAuthorized, false);
});

test('MoonRey issuance remains governance-controlled and market price stays separate', () => {
  const platform = createProductiveEconomyDataPlatform();
  const refused = platform.issuanceFromObservations();
  assert.equal(refused.ok, false);
  assert.equal(refused.minted, false);
  const direct = proposeMoonReyIssuanceFromObservations({
    observations: platform.observations('ENERGY'),
    methodology: simulationMethodology('ENERGY', 'ENERGY_PRODUCTION'),
  });
  assert.equal(direct.ok, false);
  assert.equal(direct.minted, false);
  const separation = platform.separation();
  assert.equal(separation.interchangeable, false);
  assert.equal(separation.productiveEconomicValue.isMoonReyQuantity, false);
  assert.equal(separation.moonreySupplyPolicy.productionActive, false);
  assert.equal(separation.moonreyExchangePrice.valuationDoesNotSetPrice, true);
});

test('Lovable contract shows only verified configured categories', () => {
  const contract = lovableProductiveEconomyContract(createProductiveEconomyDataPlatform());
  assert.equal(contract.schema, 'sunrey.consumer.productive-economy.v1');
  assert.equal(contract.productionActive, false);
  const energy = contract.categories.find((row) => row.id === 'ENERGY');
  assert.equal(energy?.connected, true);
  assert.equal(energy?.metric, 'ENERGY_PRODUCTION');
  assert.ok(energy?.value);
  assert.ok(energy?.unit);
  assert.equal(contract.moonreyInput.minted, false);
  assert.equal(contract.moonreyInput.marketPriceSet, false);
});

test('agent may explain and may not mint, invent, or predict price', () => {
  assert.equal(AGENT_PRODUCTIVE_ECONOMY_PERMISSIONS.mayExplainProductiveEconomy, true);
  assert.equal(authorizeAgentProductiveEconomyAction('EXPLAIN').ok, true);
  assert.equal(authorizeAgentProductiveEconomyAction('INVENT_DATA').ok, false);
  assert.equal(authorizeAgentProductiveEconomyAction('CHANGE_METHODOLOGY').ok, false);
  assert.equal(authorizeAgentProductiveEconomyAction('MINT_MOONREY').ok, false);
  assert.equal(authorizeAgentProductiveEconomyAction('PREDICT_GUARANTEED_PRICE').ok, false);
});
