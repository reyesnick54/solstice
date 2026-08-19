/**
 * Chunk 129 energy certification scenarios on top of Chunk 128.
 *
 * Certification remains an admission control. It does not finalize an
 * oracle fact or mint MoonRey.
 */

import { emptyEvidenceStates, feedSchemaFor, runCertificationSuite, sandboxSubject } from '../../certification/index.ts';
import type { CertificationSuiteResult } from '../../certification/suite.ts';
import { energyFeedSchema } from './schemas.ts';
import { ingestEnergyObservation } from './adapter.ts';
import {
  capacityPowerDimensionFixture,
  credentialLeakFixture,
  duplicateIntervalFixture,
  ENERGY_NOW_UNIX,
  floatQuantityFixture,
  meterResetFixture,
  missingSourceTimestampFixture,
  negativeProductionFixture,
  referencePricePretendingProduction,
  sameControllerQuorumFixture,
  schemaDriftFixture,
  staleReadingFixture,
  validCumulativeMeterFeed,
  validGeneratorIntervalFeed,
  validReferencePriceFeed,
  validUtilityConsumptionFeed,
  wrongFactTypeFixture,
  wrongUnitFixture,
} from './fixtures.ts';
import type { EnergyIngestResult, EnergyObservationInput } from './types.ts';

export const ENERGY_CERTIFICATION_SUITE_ID = 'sunrey.energy-provider-certification.v1' as const;

export type EnergyCertificationScenario =
  | 'VALID_GENERATOR_INTERVAL'
  | 'VALID_UTILITY_CONSUMPTION'
  | 'VALID_CUMULATIVE_METER'
  | 'VALID_REFERENCE_PRICE'
  | 'METER_RESET'
  | 'DUPLICATE_INTERVAL'
  | 'STALE_READING'
  | 'WRONG_UNIT'
  | 'FLOAT_QUANTITY'
  | 'NEGATIVE_PRODUCTION'
  | 'MISSING_SOURCE_TIMESTAMP'
  | 'SAME_CONTROLLER_FAKE_QUORUM'
  | 'SCHEMA_DRIFT'
  | 'WRONG_FACT_TYPE'
  | 'REFERENCE_PRICE_AS_PRODUCTION'
  | 'CAPACITY_UNSUPPORTED'
  | 'CREDENTIAL_LEAK';

const SCENARIO_FIXTURES: Readonly<Record<EnergyCertificationScenario, () => EnergyObservationInput>> = Object.freeze({
  VALID_GENERATOR_INTERVAL: () => validGeneratorIntervalFeed(),
  VALID_UTILITY_CONSUMPTION: () => validUtilityConsumptionFeed(),
  VALID_CUMULATIVE_METER: () => validCumulativeMeterFeed(),
  VALID_REFERENCE_PRICE: () => validReferencePriceFeed(),
  METER_RESET: () => meterResetFixture(),
  DUPLICATE_INTERVAL: () => duplicateIntervalFixture(),
  STALE_READING: () => staleReadingFixture(),
  WRONG_UNIT: () => wrongUnitFixture(),
  FLOAT_QUANTITY: () => floatQuantityFixture(),
  NEGATIVE_PRODUCTION: () => negativeProductionFixture(),
  MISSING_SOURCE_TIMESTAMP: () => missingSourceTimestampFixture(),
  SAME_CONTROLLER_FAKE_QUORUM: () => sameControllerQuorumFixture(),
  SCHEMA_DRIFT: () => schemaDriftFixture(),
  WRONG_FACT_TYPE: () => wrongFactTypeFixture(),
  REFERENCE_PRICE_AS_PRODUCTION: () => referencePricePretendingProduction(),
  CAPACITY_UNSUPPORTED: () => capacityPowerDimensionFixture(),
  CREDENTIAL_LEAK: () => credentialLeakFixture(),
});

export type EnergyCertificationResult = {
  readonly scenario: EnergyCertificationScenario;
  readonly ingest: EnergyIngestResult;
  readonly suite: CertificationSuiteResult | null;
  readonly productionAuthorized: false;
  readonly mintsMoonRey: false;
};

export function certifyEnergyScenario(scenario: EnergyCertificationScenario, nowUnix = ENERGY_NOW_UNIX): EnergyCertificationResult {
  const fixture = SCENARIO_FIXTURES[scenario]();
  const ingest = ingestEnergyObservation(fixture, nowUnix);
  const sandboxClass = fixture.factType === 'ENERGY_CONSUMPTION' ? 'energy' : 'energy';
  const subject = sandboxSubject(sandboxClass, ingest.ok ? 'VALID' : mapFailureScenario(scenario), emptyEvidenceStates(), nowUnix);
  const suite =
    fixture.factType === 'REFERENCE_PRICE'
      ? null
      : runCertificationSuite(subject, fixture.schemaId === 'ENERGY_INTERVAL_V1' ? feedSchemaFor({
          classId: 'energy',
          sourceCategory: 'energy',
          factType: 'ENERGY_PRODUCTION',
          productiveCategory: 'ENERGY',
          claimType: 'OUTPUT',
          unit: 'kWh',
          schemaId: 'energy.sandbox.v1',
          identifier: 'plant_sandbox_1',
          value: '1000',
        }) : energyFeedSchema(fixture.schemaId === 'ENERGY_CONSUMPTION_INTERVAL_V1' ? 'ENERGY_CONSUMPTION_INTERVAL_V1' : 'ENERGY_INTERVAL_V1', 'kWh', fixture.factType === 'ENERGY_CONSUMPTION' ? 'ENERGY_CONSUMPTION' : 'ENERGY_PRODUCTION'));
  return Object.freeze({
    scenario,
    ingest,
    suite,
    productionAuthorized: false,
    mintsMoonRey: false,
  });
}

export function runEnergyCertificationSuite(nowUnix = ENERGY_NOW_UNIX): readonly EnergyCertificationResult[] {
  return Object.freeze((Object.keys(SCENARIO_FIXTURES) as EnergyCertificationScenario[]).map((scenario) => certifyEnergyScenario(scenario, nowUnix)));
}

function mapFailureScenario(scenario: EnergyCertificationScenario): Parameters<typeof sandboxSubject>[1] {
  switch (scenario) {
    case 'STALE_READING':
      return 'STALE';
    case 'WRONG_UNIT':
      return 'UNIT_MISMATCH';
    case 'FLOAT_QUANTITY':
      return 'FLOAT_VALUE';
    case 'MISSING_SOURCE_TIMESTAMP':
      return 'TIMESTAMP_CHANGE';
    case 'SAME_CONTROLLER_FAKE_QUORUM':
      return 'SAME_CONTROLLER';
    case 'SCHEMA_DRIFT':
      return 'SCHEMA_MISMATCH';
    case 'WRONG_FACT_TYPE':
      return 'SEMANTIC_MISMATCH';
    case 'CREDENTIAL_LEAK':
      return 'CREDENTIAL_LEAK';
    default:
      return 'VALID';
  }
}
