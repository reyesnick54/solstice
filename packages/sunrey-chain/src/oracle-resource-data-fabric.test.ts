import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { liveMainnetConnectivityEnabled } from './oracle/production/runtime-types.ts';
import { mappingById } from './oracle/source-taxonomy/registry.ts';
import { validateSourceFactClaimMapping } from './oracle/source-taxonomy/validator.ts';
import {
  applyExtractionToReserve,
  assayIsNotMass,
  certifyResourceSandbox,
  evaluateExtractionRights,
  evaluateResourceAdversary,
  evaluateResourceClaimPath,
  identifyExtractionEvents,
  inferLegalOwnerFromOperator,
  ingestResourceRecord,
  ingestResourceRecords,
  linkExtractionToStockpile,
  kgExtractionRecord,
  linkExtractionToProcessing,
  LEGAL_OWNERSHIP_INFERRED,
  mineProductionRecord,
  normalizeMassQuantity,
  quantityToGrams,
  reconcileStockpile,
  refuseDuplicateExtractionMass,
  refuseMassTimesGradeWithoutPolicy,
  classifyResourceIndependence,
  REFERENCE_PRICE_CREATES_OUTPUT,
  reserveCannotCreateOutput,
  reserveEqualsExtraction,
  RESERVE_EQUALS_EXTRACTION,
  resourceCertificationCannotAuthorizeMoonRey,
  resourceFactCannotAutoMint,
  resourceProductionIsActive,
  resourceRealProviderContacted,
  resourceRecord,
  runResourceDataFabricDemo,
  simulationPolicy,
  STOCKPILE_MOVEMENT_EQUALS_EXTRACTION,
  stockpileMovementEqualsExtraction,
  concentrateRecord,
  haulTelemetryRecord,
  independentAssayRecord,
  reserveReportRecord,
  stockpileRecord,
  weighbridgeRecord,
} from './oracle/production/provider-families/resources/index.ts';

const NOW = 1_700_000_000n;

describe('CHUNK-133 minerals / resource extraction data fabric', () => {
  it('1. accepts valid extraction mass', () => {
    const ingested = ingestResourceRecord(mineProductionRecord(NOW), NOW);
    assert.equal(ingested.ok, true);
    if (!ingested.ok) {
      throw new Error(ingested.error.detail);
    }
    assert.equal(ingested.value.observation.factType, 'RESOURCE_EXTRACTION');
    assert.equal(ingested.value.observation.canCreateOutputClaim, true);
    assert.equal(ingested.value.observation.canMintMoonRey, false);
    assert.equal(ingested.value.evidence.automaticIssuance, false);
  });

  it('2. normalizes kg and tonne exactly', () => {
    const kg = ingestResourceRecord(kgExtractionRecord(NOW), NOW);
    assert.equal(kg.ok, true);
    if (!kg.ok) {
      throw new Error(kg.error.detail);
    }
    assert.equal(kg.value.observation.canonicalUnit, 'kg');
    const grams = quantityToGrams(kg.value.observation.canonicalQuantity);
    assert.equal(grams.ok, true);
    if (!grams.ok) {
      throw new Error(grams.error.detail);
    }
    assert.equal(grams.value, 2_000_000_000n);
    const converted = normalizeMassQuantity({ mantissa: 2_000_000n, unit: 'kg', density: null, targetUnit: 'tonne' });
    assert.equal(converted.ok, true);
    if (!converted.ok) {
      throw new Error(converted.error.detail);
    }
    assert.equal(converted.value.unit, 'tonne');
    const tonneGrams = quantityToGrams(converted.value.canonical);
    assert.equal(tonneGrams.ok, true);
    if (!tonneGrams.ok) {
      throw new Error(tonneGrams.error.detail);
    }
    assert.equal(tonneGrams.value, grams.value);
  });

  it('3. keeps reserve distinct from extraction', () => {
    const reserve = ingestResourceRecord(reserveReportRecord(NOW), NOW);
    assert.equal(reserve.ok, true);
    if (!reserve.ok) {
      throw new Error(reserve.error.detail);
    }
    assert.equal(reserve.value.observation.factType, 'RESOURCE_RESERVE');
    assert.equal(reserve.value.observation.createsExtractionEvent, false);
    assert.equal(reserve.value.observation.canCreateOutputClaim, false);
    assert.equal(reserveEqualsExtraction(), false);
    assert.equal(RESERVE_EQUALS_EXTRACTION, false);
    const disguised = evaluateResourceAdversary('RESERVE_AS_EXTRACTION', NOW);
    assert.equal(disguised.ok, true);
  });

  it('4. refuses reserve OUTPUT automatically', () => {
    const output = reserveCannotCreateOutput('OUTPUT');
    assert.equal(output.ok, false);
    const path = evaluateResourceClaimPath({ factType: 'RESOURCE_RESERVE', claimType: 'OUTPUT' });
    assert.equal(path.ok, false);
    const mapping = mappingById('spm.resources.RESOURCE_RESERVE.MINERALS_RAW_MATERIALS', 1);
    assert.ok(mapping);
    assert.deepEqual(mapping.allowedClaimTypes, ['RESERVE']);
    assert.equal(mapping.allowedClaimTypes.includes('OUTPUT'), false);
  });

  it('5. dedupes truck + scale as one extraction event', () => {
    const batch = ingestResourceRecords(
      [mineProductionRecord(NOW), haulTelemetryRecord(NOW), weighbridgeRecord(NOW)],
      NOW,
    );
    assert.equal(batch.ok, true);
    if (!batch.ok) {
      throw new Error(batch.error.detail);
    }
    const events = identifyExtractionEvents(
      batch.value.map((row) => row.observation),
      NOW,
      NOW + 3_600n,
    );
    assert.equal(events.ok, true);
    if (!events.ok) {
      throw new Error(events.error.detail);
    }
    assert.equal(events.value.length, 1);
    const duplicate = refuseDuplicateExtractionMass(events.value, 3);
    assert.equal(duplicate.ok, false);
    const adversary = evaluateResourceAdversary('TRUCK_SCALE_DOUBLE_COUNT', NOW);
    assert.equal(adversary.ok, true);
  });

  it('6. does not treat stockpile movement as extraction', () => {
    const stockpile = ingestResourceRecord(stockpileRecord(NOW), NOW);
    assert.equal(stockpile.ok, true);
    if (!stockpile.ok) {
      throw new Error(stockpile.error.detail);
    }
    assert.equal(stockpile.value.observation.createsExtractionEvent, false);
    assert.equal(stockpile.value.observation.createsInventoryEvidence, true);
    assert.equal(stockpileMovementEqualsExtraction(), false);
    assert.equal(STOCKPILE_MOVEMENT_EQUALS_EXTRACTION, false);
    const disguised = evaluateResourceAdversary('STOCKPILE_AS_EXTRACTION', NOW);
    assert.equal(disguised.ok, true);
    const extraction = ingestResourceRecord(mineProductionRecord(NOW), NOW);
    assert.equal(extraction.ok, true);
    if (!extraction.ok) {
      throw new Error(extraction.error.detail);
    }
    const lineage = linkExtractionToStockpile({
      extraction: extraction.value.observation,
      stockpile: stockpile.value.observation,
    });
    assert.equal(lineage.ok, true);
    if (!lineage.ok) {
      throw new Error(lineage.error.detail);
    }
    assert.equal(lineage.value.relation, 'STORES');
    assert.equal(lineage.value.impliesDuplicateValue, false);
  });

  it('7-8. keeps extraction→processing lineage and refuses ore+concentrate sum', () => {
    const ore = ingestResourceRecord(mineProductionRecord(NOW), NOW);
    const concentrate = ingestResourceRecord(concentrateRecord(NOW), NOW);
    assert.equal(ore.ok && concentrate.ok, true);
    if (!ore.ok || !concentrate.ok) {
      throw new Error('ingest failed');
    }
    const lineage = linkExtractionToProcessing({
      extraction: ore.value.observation,
      concentrate: concentrate.value.observation,
    });
    assert.equal(lineage.ok, true);
    if (!lineage.ok) {
      throw new Error(lineage.error.detail);
    }
    assert.equal(lineage.value.relation, 'TRANSFORMS');
    assert.equal(lineage.value.impliesDuplicateValue, false);
    assert.equal(concentrate.value.observation.createsExtractionEvent, false);
    assert.equal(concentrate.value.observation.canCreateOutputClaim, false);
  });

  it('9. keeps assay grade as quality evidence', () => {
    const assay = ingestResourceRecord(independentAssayRecord(NOW), NOW);
    assert.equal(assay.ok, false);
    if (assay.ok) {
      throw new Error('assay must not ingest as mass');
    }
    assert.equal(assay.error.code, 'ASSAY_GRADE_IS_NOT_MASS');
    const evidence = assayIsNotMass(independentAssayRecord(NOW));
    assert.equal(evidence.ok, true);
    const multiplied = refuseMassTimesGradeWithoutPolicy(1_000_000n, 50_000n, simulationPolicy());
    assert.equal(multiplied.ok, false);
  });

  it('10. rejects volume-to-mass without density context', () => {
    const volume = evaluateResourceAdversary('VOLUME_AS_MASS_WITHOUT_DENSITY', NOW);
    assert.equal(volume.ok, true);
    const withDensity = ingestResourceRecord(
      resourceRecord({
        unit: 'm3',
        densityEvidence: {
          densityKgPerM3: 2_500n,
          methodologyReference: 'method.density.sim',
          attestationReference: 'att.density.sim',
        },
      }),
      NOW,
    );
    assert.equal(withDensity.ok, true);
  });

  it('11. does not infer operator as legal owner', () => {
    const ingested = ingestResourceRecord(mineProductionRecord(NOW), NOW);
    assert.equal(ingested.ok, true);
    if (!ingested.ok) {
      throw new Error(ingested.error.detail);
    }
    assert.equal(ingested.value.observation.legalOwnershipInferred, false);
    assert.equal(LEGAL_OWNERSHIP_INFERRED, false);
    const inferred = inferLegalOwnerFromOperator(ingested.value.observation.parties);
    assert.equal(inferred.ok, false);
  });

  it('12-13. supports rights references and fails closed when missing', () => {
    const present = evaluateExtractionRights(mineProductionRecord(NOW), simulationPolicy());
    assert.equal(present.ok, true);
    if (!present.ok) {
      throw new Error(present.error.detail);
    }
    assert.equal(present.value[0]?.fixtureOnly, true);
    assert.equal(present.value[0]?.provesRealAuthorization, false);
    const missing = evaluateResourceAdversary('MISSING_RIGHTS', NOW);
    assert.equal(missing.ok, true);
    const optional = evaluateExtractionRights(
      resourceRecord({ rightsReferences: [] }),
      simulationPolicy({ requireExtractionRightsReference: false }),
    );
    assert.equal(optional.ok, true);
  });

  it('14. refuses commodity reference price as a claim', () => {
    const path = evaluateResourceClaimPath({
      factType: 'REFERENCE_PRICE',
      claimType: 'OUTPUT',
      sourceCategory: 'reference_price',
    });
    assert.equal(path.ok, false);
    if (path.ok) {
      throw new Error('price must not create a claim');
    }
    assert.equal(path.error.code, 'REFERENCE_PRICE_CANNOT_CREATE_CLAIM');
    assert.equal(REFERENCE_PRICE_CREATES_OUTPUT, false);
    const mapped = validateSourceFactClaimMapping({
      sourceCategory: 'reference_price',
      factType: 'REFERENCE_PRICE',
      sourceUnit: 'units_produced',
      claimType: 'OUTPUT',
    });
    assert.equal(mapped.ok, false);
    const adversary = evaluateResourceAdversary('COMMODITY_PRICE_AS_EXTRACTION', NOW);
    assert.equal(adversary.ok, true);
  });

  it('15. reconciles stockpile mass within explicit tolerance', () => {
    const okBalance = reconcileStockpile(
      {
        stockpileId: 'stockpile.rom.1',
        openingGrams: 5_000_000_000n,
        inflowsGrams: 1_000_000_000n,
        outflowsGrams: 400_000_000n,
        governedAdjustmentsGrams: 0n,
        closingGrams: 5_600_000_000n,
        toleranceGrams: 1_000_000n,
      },
      simulationPolicy(),
    );
    assert.equal(okBalance.ok, true);
    if (!okBalance.ok) {
      throw new Error(okBalance.error.detail);
    }
    assert.equal(okBalance.value.createsExtraction, false);
    const drift = reconcileStockpile(
      {
        stockpileId: 'stockpile.rom.1',
        openingGrams: 5_000_000_000n,
        inflowsGrams: 1_000_000_000n,
        outflowsGrams: 0n,
        governedAdjustmentsGrams: 0n,
        closingGrams: 1_000_000_000n,
        toleranceGrams: 1_000_000n,
      },
      simulationPolicy(),
    );
    assert.equal(drift.ok, false);
  });

  it('16. does not treat same-controller feeds as independent quorum', () => {
    const fake = evaluateResourceAdversary('SAME_CONTROLLER_FAKE_QUORUM', NOW);
    assert.equal(fake.ok, true);
    const independent = classifyResourceIndependence({
      sourceClass: 'ASSAY_LAB_ATTESTATION',
      controllerId: 'lab-controller',
      upstreamOrganizationId: 'lab-org',
      related: [{ controllerId: 'mine-controller', upstreamOrganizationId: 'mine-org' }],
    });
    assert.equal(independent, 'INDEPENDENT_ORGANIZATION');
    const same = classifyResourceIndependence({
      sourceClass: 'WEIGHBRIDGE',
      controllerId: 'mine-controller',
      upstreamOrganizationId: 'mine-org',
      related: [{ controllerId: 'mine-controller', upstreamOrganizationId: 'mine-org' }],
    });
    assert.equal(same, 'SAME_CONTROLLER');
  });

  it('17. rejects stale reserve references', () => {
    const stale = evaluateResourceAdversary('STALE_SURVEY', NOW);
    assert.equal(stale.ok, true);
    const depletion = applyExtractionToReserve({
      policy: simulationPolicy(),
      reserveGrams: 25_000_000_000_000n,
      extractionGrams: 1_000_000_000n,
    });
    assert.equal(depletion.ok, false);
  });

  it('18. makes no real network calls', () => {
    assert.equal(resourceRealProviderContacted(), false);
    assert.equal(liveMainnetConnectivityEnabled(), false);
    const floatCase = evaluateResourceAdversary('FLOAT_QUANTITY', NOW);
    const negative = evaluateResourceAdversary('NEGATIVE_EXTRACTION', NOW);
    const reset = evaluateResourceAdversary('COUNTER_RESET', NOW);
    const drift = evaluateResourceAdversary('SCHEMA_DRIFT', NOW);
    const mismatch = evaluateResourceAdversary('KG_TONNE_MISMATCH', NOW);
    assert.equal(floatCase.ok && negative.ok && reset.ok && drift.ok && mismatch.ok, true);
  });

  it('19. cannot auto-mint from a resource fact', () => {
    const ingested = ingestResourceRecord(mineProductionRecord(NOW), NOW);
    assert.equal(ingested.ok, true);
    if (!ingested.ok) {
      throw new Error(ingested.error.detail);
    }
    assert.equal(ingested.value.evidence.issued, false);
    assert.equal(ingested.value.observation.canMintMoonRey, false);
    assert.equal(resourceFactCannotAutoMint(), false);
  });

  it('20. certification cannot authorize MoonRey', () => {
    const certified = certifyResourceSandbox('valid_extracted_tonnage', NOW);
    assert.equal(certified.record.productionAuthorized, false);
    assert.equal(certified.record.mintsMoonRey, false);
    assert.equal(certified.record.createsProductiveContribution, false);
    assert.equal(resourceCertificationCannotAuthorizeMoonRey(), false);
    assert.equal(resourceProductionIsActive(), false);
    for (const feed of [
      'valid_weighbridge',
      'valid_reserve_reference',
      'valid_stockpile',
      'valid_assay_attestation',
    ] as const) {
      const row = certifyResourceSandbox(feed, NOW);
      assert.equal(row.record.productionAuthorized, false);
      assert.equal(row.record.mintsMoonRey, false);
    }
  });

  it('prints the demo authority boundary', () => {
    const demo = runResourceDataFabricDemo();
    assert.equal(demo.extractionEventCount, 1);
    assert.equal(demo.concentrateLinked, true);
    assert.equal(demo.flags.RESERVE_EQUALS_EXTRACTION, false);
    assert.equal(demo.flags.STOCKPILE_MOVEMENT_EQUALS_EXTRACTION, false);
    assert.equal(demo.flags.REFERENCE_PRICE_CREATES_OUTPUT, false);
    assert.equal(demo.flags.LEGAL_OWNERSHIP_INFERRED, false);
    assert.equal(demo.flags.REAL_PROVIDER_CONTACTED, false);
    assert.equal(demo.flags.PRODUCTION_ACTIVE, false);
  });
});
