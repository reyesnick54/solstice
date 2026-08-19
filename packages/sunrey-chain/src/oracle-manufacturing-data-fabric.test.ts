import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { evaluateAttribution, developmentAttributionPolicy, subject } from './productive/policy-governance/attribution/index.ts';
import { ProductiveAttributionBook } from './productive/policy-governance/attribution-accounting/book.ts';
import { ATTRIBUTION_SHARE_SCALE } from './productive/policy-governance/attribution-accounting/types.ts';
import { convertExact } from './units/convert.ts';
import { exactQuantity } from './units/quantity.ts';
import { parseDestination } from './oracle/production/security-policy.ts';
import {
  FORBIDDEN_INDUSTRIAL_CONTROL_METHODS,
  INDUSTRIAL_CONTROL_COMMANDS_AVAILABLE,
  INVALID_MANUFACTURING_CERTIFICATION_CASES,
  MACHINE_RUNTIME_EQUALS_OUTPUT,
  MANUFACTURING_SOURCE_CLASSES,
  ManufacturingDataFabric,
  PRODUCTION_ACTIVE,
  REAL_FACTORY_CONTACTED,
  SAME_BATCH_MULTIPLE_FULL_CREDITS,
  VALID_MANUFACTURING_CERTIFICATION_CASES,
  bindObservationsToEvent,
  evaluateBatchSplit,
  evaluateManufacturingCertificationCase,
  evaluateMassBalance,
  evaluateSourceIndependence,
  factTypesRemainDistinct,
  ingestManufacturingObservation,
  logisticsIsLaterDistinctEvent,
  machineHoursAreNotProductCount,
  manufacturingObservation,
  mergedShipmentDoesNotFabricateProduction,
  noIndustrialControlMethodsExposed,
  noMachineSecretsStored,
  normalizeMassOutput,
  publicInternetIndustrialAccessForbidden,
  qualityAttestationIsLinked,
  readOnlyIndustrialGatewayProfile,
  refuseIndependentCreditsForSameBatch,
  refuseMachineHoursAsUnit,
  sandboxFactoryScenario,
  scheduledOrderAsOutput,
  sourceClassSupported,
  validCumulativeCounter,
  validMesUnitOutput,
  validQualityAttestation,
  validRobotOutput,
} from './oracle/production/provider-families/manufacturing/index.ts';

describe('CHUNK-131 manufacturing and robotics data fabric', () => {
  it('1. accepts valid manufacturing output', () => {
    const result = ingestManufacturingObservation(validMesUnitOutput());
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.periodQuantity, 100n);
      assert.equal(result.value.mintsMoonRey, false);
      assert.equal(result.value.observation.factType, 'MANUFACTURING_OUTPUT');
    }
  });

  it('2. accepts a valid machine-output event', () => {
    const result = ingestManufacturingObservation(validRobotOutput());
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.observation.factType, 'AUTOMATED_MACHINE_OUTPUT');
      assert.ok(result.value.observation.identities.machineRef || result.value.observation.identities.robotRef);
      assert.ok(result.value.observation.measurementPeriod);
      assert.equal(result.value.periodQuantity, 100n);
    }
  });

  it('3. rejects a production order alone as output', () => {
    const result = ingestManufacturingObservation(scheduledOrderAsOutput());
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'PRODUCTION_ORDER_IS_NOT_OUTPUT');
    }
  });

  it('4. does not treat machine runtime alone as output', () => {
    const result = ingestManufacturingObservation(
      manufacturingObservation({
        observationId: 'obs.runtime.only',
        sourceClass: 'ROBOT_CONTROLLER_TELEMETRY',
        factType: 'AUTOMATED_MACHINE_OUTPUT',
        productiveCategory: 'AUTOMATED_MACHINE_OUTPUT',
        numericValue: '3',
        unit: 'machine_h',
        realizedEvidenceKind: 'OUTPUT_MEASUREMENT',
        machineActivityKind: 'RUNTIME',
      }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'MACHINE_RUNTIME_IS_NOT_OUTPUT');
    }
    assert.equal(MACHINE_RUNTIME_EQUALS_OUTPUT, false);
  });

  it('5. rejects machine_h → UNIT', () => {
    const refused = refuseMachineHoursAsUnit(3n);
    assert.equal(refused.ok, false);
    assert.equal(refused.error.code, 'MACHINE_TIME_CANNOT_BECOME_UNIT');
    assert.equal(machineHoursAreNotProductCount(), true);
    const source = exactQuantity({ mantissa: 3n, scale: 0, unitId: 'machine_h' });
    assert.equal(source.ok, true);
    if (source.ok) {
      const converted = convertExact({ source: source.value, targetUnitId: 'UNIT' });
      assert.equal(converted.ok, false);
    }
  });

  it('6. derives period production from a cumulative machine counter delta', () => {
    const result = ingestManufacturingObservation(validCumulativeCounter());
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.periodQuantity, 12n);
    }
  });

  it('7. rejects an undocumented counter reset', () => {
    const result = ingestManufacturingObservation(
      manufacturingObservation({
        observationId: 'obs.counter.reset',
        sourceClass: 'MACHINE_DATA_HISTORIAN',
        numericValue: '4',
        realizedEvidenceKind: 'OUTPUT_MEASUREMENT',
        counter: { kind: 'CUMULATIVE_LIFETIME', reading: 4n, previousReading: 1_100n },
      }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'COUNTER_RESET');
    }
  });

  it('8. recognizes MES and robot observations of the same event', () => {
    const scenario = sandboxFactoryScenario();
    const bound = bindObservationsToEvent([scenario.mes, scenario.robot]);
    assert.equal(bound.ok, true);
    if (bound.ok) {
      assert.equal(bound.value.fullAttributionClaimCount, 1);
      assert.equal(bound.value.observationIds.length, 2);
    }
    const policy = developmentAttributionPolicy();
    const eventId = bound.ok ? bound.value.eventId : 'missing';
    const evaluation = evaluateAttribution({
      height: 1,
      policy,
      subjects: [
        subject({
          claimId: 'claim.mes',
          economicEventId: eventId,
          category: 'MANUFACTURING',
          controllerId: scenario.mes.controllerId,
          quantity: 100n,
          batchIdentity: 'batch.sandbox.B1',
        }),
        subject({
          claimId: 'claim.robot',
          economicEventId: eventId,
          category: 'AUTOMATED_MACHINE_OUTPUT',
          controllerId: scenario.robot.controllerId,
          quantity: 100n,
          batchIdentity: 'batch.sandbox.B1',
        }),
      ],
    });
    const shares = evaluation.decisions.reduce((sum, row) => sum + row.attributionShare, 0n);
    assert.ok(shares <= policy.maximumAggregateShare);
    assert.equal(evaluation.decisions.filter((row) => row.decision === 'FULL_ATTRIBUTION').length <= 1, true);
  });

  it('9. protects manufacturing plus goods from duplicate production', () => {
    const scenario = sandboxFactoryScenario();
    const bound = bindObservationsToEvent([scenario.mes, scenario.erp]);
    assert.equal(bound.ok, true);
    if (bound.ok) {
      assert.equal(bound.value.fullAttributionClaimCount, 1);
      assert.ok(bound.value.goodsAssetRef);
    }
    const policy = developmentAttributionPolicy();
    const eventId = bound.ok ? bound.value.eventId : 'missing';
    const evaluation = evaluateAttribution({
      height: 1,
      policy,
      subjects: [
        subject({
          claimId: 'claim.mfg',
          economicEventId: eventId,
          category: 'MANUFACTURING',
          controllerId: scenario.mes.controllerId,
          batchIdentity: 'batch.sandbox.B1',
        }),
        subject({
          claimId: 'claim.goods',
          economicEventId: eventId,
          category: 'GOODS',
          controllerId: scenario.erp.controllerId,
          batchIdentity: 'batch.sandbox.B1',
        }),
      ],
    });
    assert.equal(evaluation.decisions.filter((row) => row.decision === 'FULL_ATTRIBUTION').length <= 1, true);
  });

  it('10. preserves aggregate amount across a batch split', () => {
    const split = evaluateBatchSplit({
      parentBatchRef: 'B1',
      parentQuantity: 100n,
      children: [
        { batchRef: 'B1A', quantity: 40n },
        { batchRef: 'B1B', quantity: 60n },
      ],
    });
    assert.equal(split.ok, true);
    if (split.ok) {
      assert.equal(split.value.aggregate, 100n);
    }
    const over = evaluateBatchSplit({
      parentBatchRef: 'B1',
      parentQuantity: 100n,
      children: [
        { batchRef: 'B1A', quantity: 80n },
        { batchRef: 'B1B', quantity: 40n },
      ],
    });
    assert.equal(over.ok, false);
    assert.equal(mergedShipmentDoesNotFabricateProduction([40n, 60n], 100n), true);
    assert.equal(mergedShipmentDoesNotFabricateProduction([40n, 60n], 120n), false);
    const book = new ProductiveAttributionBook();
    assert.equal(book.isMonetaryLedger, false);
    assert.ok(ATTRIBUTION_SHARE_SCALE > 0n);
  });

  it('11. excludes scrap from completed production', () => {
    const result = ingestManufacturingObservation(
      manufacturingObservation({
        observationId: 'obs.scrap',
        sourceClass: 'MES',
        outputState: 'SCRAP',
      }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'SCRAP_IS_NOT_ACCEPTED_OUTPUT');
    }
  });

  it('12. excludes rework until completed', () => {
    const result = ingestManufacturingObservation(
      manufacturingObservation({
        observationId: 'obs.rework',
        sourceClass: 'MES',
        outputState: 'REWORK',
      }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'REWORK_IS_NOT_COMPLETED_OUTPUT');
    }
  });

  it('13. links quality attestation without mint authority', () => {
    const observation = validQualityAttestation();
    const result = ingestManufacturingObservation(observation);
    assert.equal(result.ok, true);
    assert.equal(qualityAttestationIsLinked(observation, observation.quality ?? null), true);
    assert.equal(observation.quality?.authorizesMint, false);
  });

  it('14. normalizes mass output to canonical grams', () => {
    const mass = normalizeMassOutput(2n, 'tonne');
    assert.equal(mass.ok, true);
    if (mass.ok) {
      assert.equal(mass.value.canonicalG, 2_000_000n);
      assert.equal(mass.value.unit, 'g');
    }
    const balance = evaluateMassBalance({
      inputMassCanonicalG: 2_050_000n,
      outputMassCanonicalG: 2_000_000n,
      scrapOrWasteCanonicalG: 40_000n,
      toleranceCanonicalG: 20_000n,
      requiresPerfectEquality: false,
    });
    assert.equal(balance.ok, true);
    if (balance.ok) {
      assert.equal(balance.value.withinTolerance, true);
    }
  });

  it('15. enforces PRIVATE_NETWORK industrial gateway policy', () => {
    const profile = readOnlyIndustrialGatewayProfile({
      profileId: 'gw.factory.read',
      providerId: 'provider.sandbox.mfg',
      sourceId: 'src.mes.1',
      sourceClass: 'MES',
      hostname: '10.40.12.8',
    });
    assert.equal(profile.networkClass, 'PRIVATE_NETWORK');
    assert.equal(profile.authenticationClass, 'PRIVATE_NETWORK');
    assert.equal(profile.readOnly, true);
    assert.deepEqual(profile.allowedMethods, ['GET']);
    const publicDest = parseDestination('https://factory.example.com/oracle/manufacturing/read');
    assert.equal(publicDest.ok, true);
    if (publicDest.ok) {
      const refused = publicInternetIndustrialAccessForbidden(profile, publicDest.value);
      assert.equal(refused.ok, false);
    }
    const privateDest = parseDestination('https://10.40.12.8/oracle/manufacturing/read');
    assert.equal(privateDest.ok, true);
    if (privateDest.ok) {
      const allowed = publicInternetIndustrialAccessForbidden(profile, privateDest.value);
      assert.equal(allowed.ok, true);
    }
  });

  it('16. exposes no industrial control methods', () => {
    const fabric = new ManufacturingDataFabric();
    assert.equal(noIndustrialControlMethodsExposed(fabric), true);
    assert.equal(INDUSTRIAL_CONTROL_COMMANDS_AVAILABLE, false);
    for (const method of FORBIDDEN_INDUSTRIAL_CONTROL_METHODS) {
      assert.equal(method in fabric, false);
    }
  });

  it('17. does not store machine secrets', () => {
    const leaked = ingestManufacturingObservation(
      manufacturingObservation({
        observationId: 'obs.secret',
        sourceClass: 'MES',
        extras: { accessToken: 'sandbox-not-a-real-secret' },
      }),
    );
    assert.equal(leaked.ok, false);
    if (!leaked.ok) {
      assert.ok(leaked.error.code === 'CREDENTIAL_LEAK' || leaked.error.code === 'RAW_INDUSTRIAL_CONTROL_PAYLOAD');
    }
    assert.equal(noMachineSecretsStored(validMesUnitOutput()), true);
  });

  it('18. rejects same-controller fake quorum', () => {
    const mes = validMesUnitOutput();
    const erp = manufacturingObservation({
      observationId: 'obs.erp.same-ctl',
      sourceClass: 'ERP_PRODUCTION_LEDGER',
      factType: 'MANUFACTURING_OUTPUT',
      controllerId: mes.controllerId,
      upstreamOrganizationId: mes.upstreamOrganizationId,
    });
    const independence = evaluateSourceIndependence([mes, erp]);
    assert.equal(independence.ok, false);
    if (!independence.ok) {
      assert.equal(independence.error.code, 'SAME_CONTROLLER_FAKE_QUORUM');
    }
    const independent = refuseIndependentCreditsForSameBatch([mes, erp]);
    assert.equal(independent.ok, false);
  });

  it('19. makes no live network calls', () => {
    const fabric = new ManufacturingDataFabric();
    assert.equal(fabric.realFactoryContacted, false);
    assert.equal(REAL_FACTORY_CONTACTED, false);
    assert.equal(PRODUCTION_ACTIVE, false);
    const result = fabric.ingest(validMesUnitOutput());
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.contactedRealFactory, false);
    }
  });

  it('20. cannot auto-mint from a manufacturing fact', () => {
    const fabric = new ManufacturingDataFabric();
    assert.equal(fabric.manufacturingFactCannotAutoMint(), true);
    const result = fabric.ingest(validMesUnitOutput());
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.mintsMoonRey, false);
    }
    assert.equal(factTypesRemainDistinct('MANUFACTURING_OUTPUT', 'AUTOMATED_MACHINE_OUTPUT', 'GOODS_OUTPUT'), true);
    assert.equal(logisticsIsLaterDistinctEvent(), true);
    assert.equal(SAME_BATCH_MULTIPLE_FULL_CREDITS, false);
    for (const sourceClass of MANUFACTURING_SOURCE_CLASSES) {
      assert.equal(sourceClassSupported(sourceClass), true);
    }
    for (const row of VALID_MANUFACTURING_CERTIFICATION_CASES) {
      const evaluated = evaluateManufacturingCertificationCase(row.caseId);
      assert.equal(evaluated.ok, true, row.caseId);
    }
    for (const row of INVALID_MANUFACTURING_CERTIFICATION_CASES) {
      const evaluated = evaluateManufacturingCertificationCase(row.caseId);
      assert.equal(evaluated.ok, false, row.caseId);
    }
  });
});
