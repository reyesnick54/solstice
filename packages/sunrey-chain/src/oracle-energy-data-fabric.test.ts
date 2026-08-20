import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createOnboardingDraft, emptyOnboardingEvidence } from './oracle/production/onboarding.ts';
import { sandboxSource } from './oracle/production/sandbox-fixture.ts';
import { CONSENSUS_CALLED_HTTP, DEFAULT_CONNECTOR_RUNTIME_CONFIG } from './oracle/production/runtime-types.ts';
import { FakeExternalHttpTransport } from './oracle/production/transport.ts';
import { EconomicDataConnectorRuntime, createDeterministicRandom, createFrozenConnectorClock } from './oracle/production/runtime.ts';
import { sandboxApiKeyAuth, sandboxEndpointProfile, sandboxFeed, sandboxIdentity, sandboxSecrets } from './oracle/production/sandbox-fixture.ts';
import { profileUrl } from './oracle/production/auth-runtime.ts';
import { validateSourceFactClaimMapping } from './oracle/source-taxonomy/validator.ts';
import {
  ENERGY_FACT_AUTO_MINTS_MOONREY,
  ENERGY_NOW_UNIX,
  ENERGY_PRODUCTION_ACTIVE,
  ENERGY_REFERENCE_PRICE_CREATES_CLAIM,
  EnergyObservationStore,
  EnergyProviderFamilyAdapter,
  REAL_EXTERNAL_PROVIDER_CONTACTED,
  behindTheMeterPair,
  capacityMwhAsMwFixture,
  capacityPowerDimensionFixture,
  credentialLeakFixture,
  energyEventIdentity,
  energyEventsShareIdentity,
  energyFactDoesNotAutoMintMoonRey,
  energyObservationDoesNotAutoFinalize,
  energyProfilesDoNotNameVendors,
  energyReferencePriceCannotCreateClaim,
  energyReferencePriceCannotMint,
  firstCumulativeRegisterReading,
  floatQuantityFixture,
  ingestEnergyObservation,
  invalidIntervalFixture,
  meterResetFixture,
  missingSourceTimestampFixture,
  plantTelemetrySameEvent,
  projectEnergyAssets,
  quantityToWh,
  sameControllerQuorumFixture,
  staleReadingFixture,
  unitAliasRetransmission,
  validCumulativeMeterFeed,
  validGeneratorIntervalFeed,
  validGridExportFeed,
  validGridImportFeed,
  validReferencePriceFeed,
  validStorageChargeFeed,
  validStorageDischargeFeed,
  validUtilityConsumptionFeed,
  wrongUnitFixture,
} from './oracle/production/provider-families/energy/index.ts';

const NOW = ENERGY_NOW_UNIX;

function mustIngest(input: Parameters<typeof ingestEnergyObservation>[0], store?: EnergyObservationStore) {
  const result = ingestEnergyObservation(input, NOW, store);
  if (!result.ok) {
    throw new Error(`${result.error.code}: ${result.error.detail}`);
  }
  return result;
}

describe('CHUNK-129 energy economic data fabric', () => {
  it('1. accepts interval energy production and maps ENERGY_PRODUCTION', () => {
    const result = mustIngest(validGeneratorIntervalFeed());
    assert.equal(result.value.factType, 'ENERGY_PRODUCTION');
    assert.equal(result.value.channel, 'LOCAL_PRODUCTION');
    assert.equal(result.value.mappingId, 'spm.energy.ENERGY_PRODUCTION.ENERGY');
    assert.equal(result.value.canCreateProductiveClaim, true);
    const mapped = validateSourceFactClaimMapping({
      sourceCategory: 'energy',
      factType: 'ENERGY_PRODUCTION',
      sourceUnit: 'kWh',
      productiveCategory: 'ENERGY',
      claimType: 'OUTPUT',
    });
    assert.equal(mapped.ok, true);
  });

  it('2. derives cumulative register delta as period quantity', () => {
    const result = mustIngest(validCumulativeMeterFeed());
    assert.equal(result.value.meterSemantics, 'CUMULATIVE_REGISTER');
    assert.equal(result.value.intervalQuantity?.unit, 'Wh');
    assert.equal(result.value.intervalQuantity?.mantissa, 100_000n);
    assert.equal(result.value.sourceQuantity.mantissa, 9100n);
    assert.equal(result.value.sourceQuantity.originalUnit, 'kWh');
  });

  it('3. rejects cumulative meter reset without inventing negative production', () => {
    const result = ingestEnergyObservation(meterResetFixture(), NOW);
    assert.equal(result.ok, false);
    if (result.ok) {
      throw new Error('expected refusal');
    }
    assert.equal(result.error.code, 'METER_RESET');
    assert.equal(result.error.reviewRequired, true);
  });

  it('4. treats duplicate cumulative readings as idempotent', () => {
    const store = new EnergyObservationStore();
    const first = mustIngest(validCumulativeMeterFeed({ sourceObservationId: 'obs_cum_1' }), store);
    const replay = ingestEnergyObservation(validCumulativeMeterFeed({ sourceObservationId: 'obs_cum_1' }), NOW, store);
    if (!replay.ok) {
      throw new Error(replay.error.detail);
    }
    assert.equal(replay.idempotentReplay, true);
    assert.equal(replay.value.observationKey, first.value.observationKey);
    const sameReading = ingestEnergyObservation(
      validCumulativeMeterFeed({
        sourceObservationId: 'obs_cum_retransmit',
        quantity: '9000',
        prior: {
          meterRef: 'meter.gen.sim.1',
          registerId: 'reg.kwh.1',
          readingMantissa: 9_000n,
          unit: 'kWh',
          sourceTimestampUnix: NOW - 3_600n,
          subjectCanonicalRef: 'x',
        },
      }),
      NOW,
    );
    assert.equal(sameReading.ok, false);
    if (sameReading.ok) {
      throw new Error('expected duplicate');
    }
    assert.equal(sameReading.error.code, 'DUPLICATE_READING');
  });

  it('5. keeps ENERGY_PRODUCTION and ENERGY_CONSUMPTION on separate channels', () => {
    const pair = behindTheMeterPair();
    const production = mustIngest(pair.production);
    const consumption = mustIngest(pair.consumption);
    assert.equal(production.value.factType, 'ENERGY_PRODUCTION');
    assert.equal(consumption.value.factType, 'ENERGY_CONSUMPTION');
    assert.equal(production.value.channel, 'LOCAL_PRODUCTION');
    assert.equal(consumption.value.channel, 'LOCAL_CONSUMPTION');
    const collision = ingestEnergyObservation(validUtilityConsumptionFeed({ channel: 'LOCAL_PRODUCTION' }), NOW);
    assert.equal(collision.ok, false);
    if (collision.ok) {
      throw new Error('expected collision');
    }
    assert.equal(collision.error.code, 'PRODUCTION_CONSUMPTION_COLLISION');
    const usage = validateSourceFactClaimMapping({
      sourceCategory: 'energy',
      factType: 'ENERGY_CONSUMPTION',
      sourceUnit: 'kWh',
      productiveCategory: 'ENERGY',
      claimType: 'USAGE',
    });
    assert.equal(usage.ok, true);
  });

  it('6. keeps grid import and export distinct from local production and consumption', () => {
    const exportFeed = mustIngest(validGridExportFeed());
    const importFeed = mustIngest(validGridImportFeed());
    const local = mustIngest(validGeneratorIntervalFeed({ quantity: '100' }));
    assert.equal(exportFeed.value.channel, 'GRID_EXPORT');
    assert.equal(importFeed.value.channel, 'GRID_IMPORT');
    assert.equal(local.value.channel, 'LOCAL_PRODUCTION');
    assert.equal(exportFeed.value.canCreateProductiveClaim, false);
    assert.notEqual(exportFeed.value.intervalQuantity?.mantissa, local.value.intervalQuantity?.mantissa);
  });

  it('7. does not count battery charge as output', () => {
    const charge = mustIngest(validStorageChargeFeed());
    assert.equal(charge.value.channel, 'STORAGE_CHARGE');
    assert.equal(charge.value.factType, 'ENERGY_CONSUMPTION');
    assert.equal(charge.value.canCreateProductiveClaim, false);
    const asProduction = ingestEnergyObservation(validStorageChargeFeed({ factType: 'ENERGY_PRODUCTION' }), NOW);
    assert.equal(asProduction.ok, false);
    if (asProduction.ok) {
      throw new Error('expected charge refusal');
    }
    assert.equal(asProduction.error.code, 'STORAGE_CHARGE_NOT_OUTPUT');
  });

  it('8. does not treat battery discharge as automatic independent production', () => {
    const upstream = mustIngest(validGeneratorIntervalFeed());
    const discharge = mustIngest(validStorageDischargeFeed(upstream.value.provenanceCommitment));
    assert.equal(discharge.value.channel, 'STORAGE_DISCHARGE');
    assert.equal(discharge.value.economicEventRef, null);
    assert.equal(discharge.value.canCreateProductiveClaim, false);
    assert.notEqual(discharge.value.economicEventRef, upstream.value.economicEventRef);
  });

  it('9. normalizes Wh / kWh / MWh through the canonical constitution', () => {
    const kwh = mustIngest(validGeneratorIntervalFeed({ quantity: '2', unit: 'kWh' }));
    const mwh = mustIngest(validGeneratorIntervalFeed({ quantity: '1', unit: 'MWh', sourceObservationId: 'obs_mwh' }));
    const wh = mustIngest(validGeneratorIntervalFeed({ quantity: '2000', unit: 'Wh', sourceObservationId: 'obs_wh' }));
    assert.equal(kwh.value.canonicalMeasurement?.canonicalUnit, 'Wh');
    assert.equal(kwh.value.canonicalMeasurement?.canonicalQuantity.mantissa, 2_000n);
    assert.equal(mwh.value.canonicalMeasurement?.canonicalQuantity.mantissa, 1_000_000n);
    assert.equal(wh.value.canonicalMeasurement?.canonicalQuantity.mantissa, 2_000n);
    assert.equal(kwh.value.sourceQuantity.originalUnit, 'kWh');
    const asWh = quantityToWh(kwh.value.sourceQuantity);
    assert.equal(asWh.ok, true);
    if (asWh.ok) {
      assert.equal(asWh.value, 2_000n);
    }
  });

  it('10. rejects a stale meter reading', () => {
    const result = ingestEnergyObservation(staleReadingFixture(), NOW);
    assert.equal(result.ok, false);
    if (result.ok) {
      throw new Error('expected stale');
    }
    assert.equal(result.error.code, 'STALE_READING');
  });

  it('11. rejects an invalid time interval', () => {
    const result = ingestEnergyObservation(invalidIntervalFixture(), NOW);
    assert.equal(result.ok, false);
    if (result.ok) {
      throw new Error('expected invalid interval');
    }
    assert.equal(result.error.code, 'END_NOT_AFTER_START');
    const missing = ingestEnergyObservation(validGeneratorIntervalFeed({ measurementStartUnix: null, measurementEndUnix: null }), NOW);
    assert.equal(missing.ok, false);
    if (missing.ok) {
      throw new Error('expected undefined interval');
    }
    assert.equal(missing.error.code, 'UNDEFINED_INTERVAL');
  });

  it('12. rejects same-controller fake quorum', () => {
    const result = ingestEnergyObservation(sameControllerQuorumFixture(), NOW);
    assert.equal(result.ok, false);
    if (result.ok) {
      throw new Error('expected fake quorum refusal');
    }
    assert.equal(result.error.code, 'SAME_CONTROLLER_FAKE_QUORUM');
  });

  it('13. reference price cannot create a productive claim', () => {
    const result = mustIngest(validReferencePriceFeed());
    assert.equal(result.value.factType, 'REFERENCE_PRICE');
    assert.equal(result.value.profile.productiveCategory, null);
    assert.equal(result.value.canCreateProductiveClaim, false);
    assert.equal(energyReferencePriceCannotCreateClaim(), false);
    assert.equal(ENERGY_REFERENCE_PRICE_CREATES_CLAIM, false);
    const mapped = validateSourceFactClaimMapping({
      sourceCategory: 'reference_price',
      factType: 'REFERENCE_PRICE',
      sourceUnit: 'units_produced',
      productiveCategory: null,
      claimType: 'OUTPUT',
    });
    assert.equal(mapped.ok, false);
    if (!mapped.ok) {
      assert.equal(mapped.error.code, 'REFERENCE_DATA_CANNOT_CREATE_CLAIM');
    }
  });

  it('14. reference price cannot mint MoonRey', () => {
    assert.equal(energyReferencePriceCannotMint(), false);
    const result = mustIngest(validReferencePriceFeed());
    assert.equal(result.value.autoMintsMoonRey, false);
    assert.equal(ENERGY_FACT_AUTO_MINTS_MOONREY, false);
  });

  it('15. ENERGY_PRODUCTION follows the source taxonomy', () => {
    const result = mustIngest(validGeneratorIntervalFeed());
    assert.equal(result.value.profile.sourceCategory, 'energy');
    assert.equal(result.value.profile.productiveCategory, 'ENERGY');
    assert.equal(result.value.profile.claimType, 'OUTPUT');
  });

  it('16. ENERGY_CONSUMPTION follows the usage path', () => {
    const result = mustIngest(validUtilityConsumptionFeed());
    assert.equal(result.value.factType, 'ENERGY_CONSUMPTION');
    assert.equal(result.value.profile.claimType, 'USAGE');
    assert.equal(result.value.channel, 'LOCAL_CONSUMPTION');
  });

  it('17. capacity with an unsupported power dimension fails safely', () => {
    const power = ingestEnergyObservation(capacityPowerDimensionFixture(), NOW);
    assert.equal(power.ok, false);
    if (power.ok) {
      throw new Error('expected unit extension');
    }
    assert.equal(power.error.code, 'UNIT_EXTENSION_REQUIRED');
    const fake = ingestEnergyObservation(capacityMwhAsMwFixture(), NOW);
    assert.equal(fake.ok, false);
    if (fake.ok) {
      throw new Error('expected capacity refusal');
    }
    assert.equal(fake.error.code, 'CAPACITY_CANNOT_FAKE_MWH_AS_MW');
  });

  it('18. retains source provenance', () => {
    const result = mustIngest(validGeneratorIntervalFeed());
    assert.ok(result.value.provenanceCommitment.length === 64);
    assert.equal(result.value.independence.controllerId, 'controller_energy_sim');
    assert.equal(result.value.independence.upstreamOrganizationId, 'org_energy_sim');
    assert.equal(result.value.geography.gridZone, 'sim-zone-a');
    assert.equal(result.value.subject.canonicalRef.length, 64);
  });

  it('19. retains device provenance when supplied and does not invent attestation', () => {
    const withDevice = mustIngest(validGeneratorIntervalFeed());
    assert.equal(withDevice.value.deviceProvenance?.deviceId, 'meter.gen.sim.1');
    assert.equal(withDevice.value.deviceProvenance?.firmwareHash, 'fw_energy_sim_v1');
    const without = mustIngest(validGeneratorIntervalFeed({ deviceProvenance: null, sourceObservationId: 'obs_no_device' }));
    assert.equal(without.value.deviceProvenance, null);
  });

  it('20. refuses credentials in the observation', () => {
    const result = ingestEnergyObservation(credentialLeakFixture(), NOW);
    assert.equal(result.ok, false);
    if (result.ok) {
      throw new Error('expected credential refusal');
    }
    assert.equal(result.error.code, 'CREDENTIAL_MATERIAL_FORBIDDEN');
  });

  it('21. never contacts a real network from tests', () => {
    assert.equal(REAL_EXTERNAL_PROVIDER_CONTACTED, false);
    assert.equal(CONSENSUS_CALLED_HTTP, false);
    const transport = new FakeExternalHttpTransport();
    assert.equal(transport.contactsPublicInternet, false);
    transport.on('GET', profileUrl(sandboxEndpointProfile()), {
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        identifier: 'plant_sim_1',
        numericValue: '100',
        unit: 'kWh',
        sourceTimestampUnix: NOW.toString(),
        schemaId: 'energy.resource.v1',
        schemaVersion: 1,
      }),
    });
    const runtime = new EconomicDataConnectorRuntime({
      config: DEFAULT_CONNECTOR_RUNTIME_CONFIG,
      transport,
      clock: createFrozenConnectorClock(NOW),
      random: createDeterministicRandom(),
      sleeper: async () => undefined,
    });
    const adapter = new EnergyProviderFamilyAdapter(runtime, 'API_KEY_REFERENCE');
    assert.equal(adapter.contactsPublicInternet, false);
  });

  it('22. an energy observation does not auto-finalize a fact', () => {
    const result = mustIngest(validGeneratorIntervalFeed());
    assert.equal(result.value.autoFinalizesFact, false);
    assert.equal(energyObservationDoesNotAutoFinalize(), false);
  });

  it('23. a verified energy fact does not auto-mint MoonRey', () => {
    const result = mustIngest(validGeneratorIntervalFeed());
    assert.equal(result.value.autoMintsMoonRey, false);
    assert.equal(energyFactDoesNotAutoMintMoonRey(), false);
    assert.equal(ENERGY_PRODUCTION_ACTIVE, false);
  });

  it('rejects float quantities, wrong units, and missing source timestamps', () => {
    assert.equal(ingestEnergyObservation(floatQuantityFixture(), NOW).ok, false);
    assert.equal(ingestEnergyObservation(wrongUnitFixture(), NOW).ok, false);
    assert.equal(ingestEnergyObservation(missingSourceTimestampFixture(), NOW).ok, false);
    const loneRegister = ingestEnergyObservation(firstCumulativeRegisterReading(), NOW);
    assert.equal(loneRegister.ok, false);
    if (!loneRegister.ok) {
      assert.equal(loneRegister.error.code, 'CUMULATIVE_NOT_PRODUCTION');
    }
  });

  it('maps multiple observations of the same generated interval to one event identity', () => {
    const meter = mustIngest(validGeneratorIntervalFeed());
    const telemetry = mustIngest(plantTelemetrySameEvent());
    assert.ok(meter.value.economicEventRef);
    assert.ok(telemetry.value.economicEventRef);
    assert.equal(meter.value.economicEventRef, telemetry.value.economicEventRef);
    const left = energyEventIdentity({
      subject: meter.value.subject,
      time: meter.value.time,
      geography: meter.value.geography,
      channel: 'LOCAL_PRODUCTION',
      measurementRef: null,
    });
    const right = energyEventIdentity({
      subject: telemetry.value.subject,
      time: telemetry.value.time,
      geography: telemetry.value.geography,
      channel: 'LOCAL_PRODUCTION',
      measurementRef: null,
    });
    assert.equal(energyEventsShareIdentity(left, right), true);
  });

  it('replays unit-alias retransmissions without additional output', () => {
    const store = new EnergyObservationStore();
    const first = mustIngest(validGeneratorIntervalFeed({ sourceObservationId: 'obs_alias' }), store);
    const alias = ingestEnergyObservation(unitAliasRetransmission(validGeneratorIntervalFeed({ sourceObservationId: 'obs_alias' })), NOW, store);
    if (!alias.ok) {
      throw new Error(alias.error.detail);
    }
    assert.equal(alias.idempotentReplay, true);
    assert.equal(alias.value.intervalQuantity?.mantissa, first.value.intervalQuantity?.mantissa);
  });

  it('projects privacy-safe energy descriptors into the Economic Asset Registry', () => {
    const observation = mustIngest(validGeneratorIntervalFeed());
    const onboarding = createOnboardingDraft({
      providerId: 'oracle_sandbox',
      legalEntityReference: null,
      controllerReference: 'controller_energy_sim',
      dataCategories: ['energy'],
      feeds: ['feed_energy_production_sim'],
      authenticationMethod: 'FILE_FIXTURE_TEST_ONLY',
      signingKey: {
        schemaVersion: 1,
        keyId: 'key_energy',
        keyVersion: 1,
        publicKeyHex: '11'.repeat(32),
        cryptoSuite: 'sunrey.oracle.software-dev',
        signerKind: 'SOFTWARE_DEVELOPMENT',
        rotatedFromKeyId: null,
        active: true,
      },
      cryptoSuite: 'sunrey.oracle.software-dev',
      infrastructureRegion: 'sim-west',
      sourceRelationships: [],
      onboardingEvidence: emptyOnboardingEvidence(),
      securityReviewStatus: 'NOT_REVIEWED',
      commercialAgreementEvidenceReference: null,
      status: 'TESTNET_ACTIVE',
    });
    if (!onboarding.ok) {
      throw new Error(onboarding.error.detail);
    }
    const projected = projectEnergyAssets({
      source: sandboxSource(),
      onboarding: onboarding.value,
      observation: observation.value,
    });
    assert.equal(projected.ok, true);
    if (projected.ok) {
      assert.equal(projected.value.sourceAsset.assetClass, 'ORACLE_SOURCE_DATASET');
      assert.equal(projected.value.observationAsset.assetClass, 'ORACLE_OBSERVATION_SET');
      assert.equal(JSON.stringify(projected.value).includes('apiKey'), false);
    }
  });

  it('does not name vendors and keeps production inactive', () => {
    assert.equal(energyProfilesDoNotNameVendors(), true);
    assert.equal(ENERGY_PRODUCTION_ACTIVE, false);
  });
});
