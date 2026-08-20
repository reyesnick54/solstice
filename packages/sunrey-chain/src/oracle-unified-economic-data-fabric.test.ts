import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CERTIFICATION_FINALIZES_ORACLE, CERTIFICATION_MINTS_MOONREY } from './oracle/production/certification/types.ts';
import { FETCH_AUTO_FINALIZED_ORACLE, FETCH_AUTO_MINTED_MOONREY, CONSENSUS_CALLED_HTTP } from './oracle/production/runtime-types.ts';
import { oracleFactCreationNeverMintsMoonRey } from './oracle/production/eligibility.ts';
import { PRODUCTIVE_CATEGORIES } from './productive/types.ts';
import { FACT_TYPES } from './oracle/types.ts';
import { DATA_SOURCE_CATEGORIES } from './productive/source-taxonomy/types.ts';
import {
  CANONICAL_FAMILY_REGISTRY,
  CHUNK_71_REMAINS_MONETARY_AUTHORITY,
  DATA_FABRIC_FINALIZES_FACTS,
  DATA_FABRIC_MINTS_MOONREY,
  EconomicDataFabricStore,
  FABRIC_NOW_UNIX,
  LIVE_PROVIDER_CONNECTED,
  PRODUCTION_ACTIVE,
  PRODUCTION_LIVE_ADMISSION_EXISTS,
  PROVIDER_FAMILY_IDS,
  admitCollection,
  agricultureFixture,
  aiInferenceFixture,
  analyzeIndependentSources,
  arbitraryUrlFixture,
  buildCoverageReport,
  computeUsageFixture,
  conflictingEnergyQuantities,
  credentialFixture,
  detectCorrelationCandidates,
  energyProductionFixture,
  envelopeOmitsRawPayload,
  everyActiveSourceCategoryHasFamilyRouting,
  everyCanonicalFamilyRegistered,
  everyFactTypeHasDeliberateRouting,
  everyProductiveCategoryHasStatus,
  overlayCandidate,
  goodsOutputFixture,
  ingestBatch,
  liveProviderConnectedCount,
  logisticsDeliveryFixture,
  manufacturingOutputFixture,
  privacyLeakFixture,
  rawPayloadFixture,
  referencePriceFixture,
  reportCrossProviderConflicts,
  routeCollection,
  runUnifiedEconomicDataFabricDemo,
  sameControllerSources,
} from './oracle/production/economic-data-fabric/index.ts';

describe('CHUNK-138 unified economic data fabric', () => {
  it('1. all provider families registered', () => {
    assert.equal(everyCanonicalFamilyRegistered(), true);
    assert.equal(CANONICAL_FAMILY_REGISTRY.list().length, PROVIDER_FAMILY_IDS.length);
    assert.equal(CANONICAL_FAMILY_REGISTRY.verifyTaxonomyCompatibility().ok, true);
    assert.equal(CANONICAL_FAMILY_REGISTRY.hasDuplicateFamilyIds(), false);
  });

  it('2. all ProductiveCategories accounted for', () => {
    const report = buildCoverageReport();
    assert.equal(everyProductiveCategoryHasStatus(report), true);
    assert.equal(report.productiveCategories.length, PRODUCTIVE_CATEGORIES.length);
  });

  it('3. all source categories routed', () => {
    const report = buildCoverageReport();
    assert.equal(everyActiveSourceCategoryHasFamilyRouting(report), true);
    assert.equal(report.sourceCategories.length, DATA_SOURCE_CATEGORIES.length);
  });

  it('4. reference_price remains reference-only', () => {
    const admitted = admitCollection(referencePriceFixture(), 'FIXTURE_ONLY', FABRIC_NOW_UNIX);
    assert.equal(admitted.ok, true);
    if (admitted.ok) {
      assert.equal(admitted.value.familyId, 'REFERENCE_DATA');
      assert.equal(admitted.value.productiveCategory, null);
      assert.equal(admitted.value.canCreateProductiveClaim, false);
      assert.equal(admitted.value.canMint, false);
    }
    const claimed = admitCollection(
      overlayCandidate(referencePriceFixture(), {
        claimedProductiveCategory: 'ENERGY',
      }),
      'FIXTURE_ONLY',
      FABRIC_NOW_UNIX,
    );
    assert.equal(claimed.ok, false);
  });

  it('5. invalid family routing rejected', () => {
    const routed = routeCollection({
      sourceCategory: 'energy',
      factType: 'ENERGY_PRODUCTION',
      claimedFamilyId: 'GOODS',
    });
    assert.equal(routed.ok, false);
    if (!routed.ok) {
      assert.equal(routed.error.code, 'INVALID_FAMILY_ROUTING');
    }
  });

  it('6. invalid source/fact mapping rejected', () => {
    const routed = routeCollection({
      sourceCategory: 'energy',
      factType: 'FOOD_PRODUCTION',
    });
    assert.equal(routed.ok, false);
    if (!routed.ok) {
      assert.equal(routed.error.code, 'AMBIGUOUS_FAMILY_ROUTING');
    }
  });

  it('7. expired certification rejected', () => {
    const expired = admitCollection(
      overlayCandidate(energyProductionFixture(), {
        certificationExpired: true,
        certificationStatus: 'TESTNET_ADMISSIBLE',
      }),
      'TESTNET_ADMISSIBLE',
      FABRIC_NOW_UNIX,
    );
    assert.equal(expired.ok, false);
    if (!expired.ok) {
      assert.equal(expired.error.code, 'CERTIFICATION_EXPIRED');
    }
  });

  it('8. suspended provider rejected', () => {
    const suspended = admitCollection(
      overlayCandidate(energyProductionFixture(), {
        providerSuspended: true,
      }),
      'FIXTURE_ONLY',
      FABRIC_NOW_UNIX,
    );
    assert.equal(suspended.ok, false);
    if (!suspended.ok) {
      assert.equal(suspended.error.code, 'PROVIDER_SUSPENDED');
    }
  });

  it('9. same-controller source count not fake quorum', () => {
    const independence = analyzeIndependentSources([
      {
        sourceId: 'src_a',
        controllerId: 'controller.shared',
        upstreamOrganizationId: 'org.shared',
        sharedControlGroup: 'group.shared',
        endpointId: 'endpoint.a',
      },
      {
        sourceId: 'src_b',
        controllerId: 'controller.shared',
        upstreamOrganizationId: 'org.shared',
        sharedControlGroup: 'group.shared',
        endpointId: 'endpoint.b',
      },
    ]);
    assert.equal(independence.rawSourceCount, 2);
    assert.equal(independence.independentControllerCount, 1);
    assert.equal(independence.endpointCountIsNotIndependence, true);
    const batch = ingestBatch(sameControllerSources(), 'FIXTURE_ONLY', FABRIC_NOW_UNIX);
    assert.equal(batch.fabricCountsAsQuorum, false);
  });

  it('10. batch idempotency', () => {
    const store = new EconomicDataFabricStore();
    const first = ingestBatch([energyProductionFixture()], 'FIXTURE_ONLY', FABRIC_NOW_UNIX, store);
    const second = ingestBatch([energyProductionFixture()], 'FIXTURE_ONLY', FABRIC_NOW_UNIX, store);
    assert.equal(first.accepted.length, 1);
    assert.equal(second.results[0]?.ok, true);
    if (second.results[0]?.ok) {
      assert.equal(second.results[0].replay, true);
      assert.equal(second.results[0].envelope.envelopeId, first.accepted[0]?.envelopeId);
    }
    assert.equal(store.list().length, 1);
  });

  it('11. partial batch failure isolation', () => {
    const batch = ingestBatch(
      [energyProductionFixture(), overlayCandidate(energyProductionFixture('prov_bad'), { providerSuspended: true })],
      'FIXTURE_ONLY',
      FABRIC_NOW_UNIX,
    );
    assert.equal(batch.accepted.length, 1);
    assert.equal(batch.rejected.length, 1);
    assert.equal(batch.fabricCountsAsQuorum, false);
  });

  it('12. cross-provider conflict surfaced', () => {
    const batch = ingestBatch(conflictingEnergyQuantities(), 'FIXTURE_ONLY', FABRIC_NOW_UNIX);
    const conflicts = reportCrossProviderConflicts(batch.accepted);
    assert.equal(conflicts.length >= 1, true);
    assert.equal(conflicts[0]?.resolved, false);
    assert.equal(conflicts[0]?.oracleConsensusAuthoritative, true);
  });

  it('13. manufacturing/goods correlation candidate', () => {
    const batch = ingestBatch([manufacturingOutputFixture(), goodsOutputFixture()], 'FIXTURE_ONLY', FABRIC_NOW_UNIX);
    assert.equal(batch.accepted.length, 2);
    const left = batch.accepted.find((row) => row.familyId === 'MANUFACTURING')!;
    const right = batch.accepted.find((row) => row.familyId === 'GOODS')!;
    const candidates = detectCorrelationCandidates(batch.accepted, [
      { leftEnvelopeId: left.envelopeId, rightEnvelopeId: right.envelopeId, batchRef: 'batch.1', objectRef: 'object.1' },
    ]);
    assert.equal(candidates[0]?.confidence === 'STRONG_CORRELATION' || candidates[0]?.confidence === 'AUTHORITATIVE_REFERENCE', true);
    assert.equal(candidates[0]?.merged, false);
  });

  it('14. goods/logistics correlation candidate', () => {
    const batch = ingestBatch([goodsOutputFixture(), logisticsDeliveryFixture()], 'FIXTURE_ONLY', FABRIC_NOW_UNIX);
    const left = batch.accepted.find((row) => row.familyId === 'GOODS')!;
    const right = batch.accepted.find((row) => row.familyId === 'LOGISTICS')!;
    const candidates = detectCorrelationCandidates(batch.accepted, [
      { leftEnvelopeId: left.envelopeId, rightEnvelopeId: right.envelopeId, lineageRef: 'ship.1' },
    ]);
    assert.equal(candidates[0]?.merged, false);
    assert.notEqual(candidates[0]?.confidence, 'NO_CORRELATION');
  });

  it('15. compute/AI correlation candidate', () => {
    const batch = ingestBatch([computeUsageFixture(), aiInferenceFixture()], 'FIXTURE_ONLY', FABRIC_NOW_UNIX);
    assert.equal(batch.accepted.length, 2);
    const left = batch.accepted.find((row) => row.familyId === 'COMPUTE')!;
    const right = batch.accepted.find((row) => row.familyId === 'AI_COMPUTE')!;
    const candidates = detectCorrelationCandidates(batch.accepted, [
      { leftEnvelopeId: left.envelopeId, rightEnvelopeId: right.envelopeId, objectRef: 'job.1' },
    ]);
    assert.equal(candidates[0]?.attributionResolved, false);
    assert.notEqual(candidates[0]?.confidence, 'NO_CORRELATION');
  });

  it('16. weak correlation does not merge', () => {
    const batch = ingestBatch([manufacturingOutputFixture(), goodsOutputFixture()], 'FIXTURE_ONLY', FABRIC_NOW_UNIX);
    const left = batch.accepted[0]!;
    const right = batch.accepted[1]!;
    const candidates = detectCorrelationCandidates(batch.accepted, [
      { leftEnvelopeId: left.envelopeId, rightEnvelopeId: right.envelopeId, sameQuantityOnly: true, nearbyTimeOnly: true, sameControllerOnly: true },
    ]);
    assert.equal(candidates[0]?.confidence, 'NO_CORRELATION');
    assert.equal(candidates[0]?.merged, false);
  });

  it('17. privacy firewall', () => {
    const leaked = admitCollection(privacyLeakFixture(), 'FIXTURE_ONLY', FABRIC_NOW_UNIX);
    assert.equal(leaked.ok, false);
    if (!leaked.ok) {
      assert.equal(leaked.error.code, 'PRIVACY_FIREWALL_VIOLATION');
    }
  });

  it('18. credentials absent', () => {
    const leaked = admitCollection(credentialFixture(), 'FIXTURE_ONLY', FABRIC_NOW_UNIX);
    assert.equal(leaked.ok, false);
    if (!leaked.ok) {
      assert.equal(leaked.error.code, 'CREDENTIAL_MATERIAL_PRESENT');
    }
    const admitted = admitCollection(energyProductionFixture(), 'FIXTURE_ONLY', FABRIC_NOW_UNIX);
    assert.equal(admitted.ok, true);
    if (admitted.ok) {
      assert.equal(admitted.value.credentialsPresent, false);
    }
  });

  it('19. raw provider payload absent', () => {
    const leaked = admitCollection(rawPayloadFixture(), 'FIXTURE_ONLY', FABRIC_NOW_UNIX);
    assert.equal(leaked.ok, false);
    if (!leaked.ok) {
      assert.equal(leaked.error.code, 'RAW_PAYLOAD_PRESENT');
    }
    const admitted = admitCollection(energyProductionFixture(), 'FIXTURE_ONLY', FABRIC_NOW_UNIX);
    assert.equal(admitted.ok, true);
    if (admitted.ok) {
      assert.equal(envelopeOmitsRawPayload(admitted.value), true);
    }
  });

  it('20. no arbitrary URLs', () => {
    const leaked = admitCollection(arbitraryUrlFixture(), 'FIXTURE_ONLY', FABRIC_NOW_UNIX);
    assert.equal(leaked.ok, false);
    if (!leaked.ok) {
      assert.equal(leaked.error.code, 'ARBITRARY_URL_FORBIDDEN');
    }
  });

  it('21. no real external network calls', () => {
    assert.equal(CONSENSUS_CALLED_HTTP, false);
    assert.equal(LIVE_PROVIDER_CONNECTED, false);
    assert.equal(liveProviderConnectedCount(), 0);
  });

  it('22. existing oracle remains fact authority', () => {
    assert.equal(DATA_FABRIC_FINALIZES_FACTS, false);
    assert.equal(FETCH_AUTO_FINALIZED_ORACLE, false);
    assert.equal(CERTIFICATION_FINALIZES_ORACLE, false);
  });

  it('23-27. existing authorities remain; Chunk 71 mints; supply reconciles', () => {
    assert.equal(DATA_FABRIC_MINTS_MOONREY, false);
    assert.equal(CERTIFICATION_MINTS_MOONREY, false);
    assert.equal(FETCH_AUTO_MINTED_MOONREY, false);
    assert.equal(oracleFactCreationNeverMintsMoonRey(), true);
    assert.equal(CHUNK_71_REMAINS_MONETARY_AUTHORITY, true);
    const demo = runUnifiedEconomicDataFabricDemo();
    assert.equal(demo.energyFactId.startsWith('fact_'), true);
    assert.equal(demo.manufacturingFactId.startsWith('fact_'), true);
    assert.equal(demo.flags.ENERGY_SUPPLY_RECONCILES, true);
    assert.equal(demo.flags.MANUFACTURING_SUPPLY_RECONCILES, true);
    assert.equal(demo.flags.DATA_FABRIC_FINALIZES_FACTS, false);
    assert.equal(demo.flags.DATA_FABRIC_MINTS_MOONREY, false);
    assert.equal(demo.flags.CHUNK_71_REMAINS_MONETARY_AUTHORITY, true);
    assert.equal(demo.flags.PRODUCTION_ACTIVE, false);
  });

  it('28. simulation e2e reconciles and every fact type is reported', () => {
    const report = buildCoverageReport();
    assert.equal(everyFactTypeHasDeliberateRouting(report), true);
    assert.equal(report.factTypes.length, FACT_TYPES.length);
    assert.equal(PRODUCTION_ACTIVE, false);
    assert.equal(PRODUCTION_LIVE_ADMISSION_EXISTS, false);
    const agriculture = admitCollection(agricultureFixture(), 'FIXTURE_ONLY', FABRIC_NOW_UNIX);
    assert.equal(agriculture.ok, true);
  });

  it('authority collapse is refused at every layer', () => {
    assert.equal(FETCH_AUTO_FINALIZED_ORACLE, false);
    assert.equal(CERTIFICATION_FINALIZES_ORACLE, false);
    assert.equal(DATA_FABRIC_FINALIZES_FACTS, false);
    assert.equal(oracleFactCreationNeverMintsMoonRey(), true);
    assert.equal(DATA_FABRIC_MINTS_MOONREY, false);
    assert.equal(CHUNK_71_REMAINS_MONETARY_AUTHORITY, true);
  });
});
