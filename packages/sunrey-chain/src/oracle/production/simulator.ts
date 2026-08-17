import { err, ok, type Result } from '../../../../domain/src/result.ts';
import type { SecretProvider } from '../../../../security/src/secrets.ts';
import type { OracleSourceAdapter, SourceFetchRequest } from './adapters.ts';
import { authenticateSource } from './adapters.ts';
import type { ExternalSourceRecord } from './schema.ts';
import type { ProductionOracleRejection } from './types.ts';

export const SIMULATOR_SCENARIOS = [
  'HEALTHY',
  'STALE',
  'OUTLIER',
  'AUTH_FAILURE',
  'SCHEMA_CHANGE',
  'PROVIDER_OUTAGE',
] as const;
export type SimulatorScenario = (typeof SIMULATOR_SCENARIOS)[number];

export type SimulatorFixture = {
  readonly category: 'energy' | 'compute' | 'manufacturing';
  readonly identifier: string;
  readonly healthyValue: string;
  readonly unit: string;
  readonly schemaId: string;
  readonly schemaVersion: number;
};

export const ENERGY_FIXTURE: SimulatorFixture = Object.freeze({
  category: 'energy',
  identifier: 'plant_sim_1',
  healthyValue: '100',
  unit: 'MWh',
  schemaId: 'energy.resource.v1',
  schemaVersion: 1,
});

export const COMPUTE_FIXTURE: SimulatorFixture = Object.freeze({
  category: 'compute',
  identifier: 'cluster_sim_1',
  healthyValue: '1000',
  unit: 'gpu_s',
  schemaId: 'compute.resource.v1',
  schemaVersion: 1,
});

export const MANUFACTURING_FIXTURE: SimulatorFixture = Object.freeze({
  category: 'manufacturing',
  identifier: 'factory_sim_1',
  healthyValue: '40',
  unit: 'units_produced',
  schemaId: 'manufacturing.resource.v1',
  schemaVersion: 1,
});

export class LocalProviderSimulator implements OracleSourceAdapter {
  readonly adapterId = 'oracle.source.local-simulator';
  readonly authenticationClass = 'FILE_FIXTURE_TEST_ONLY' as const;

  readonly fixture: SimulatorFixture;
  readonly scenario: SimulatorScenario;
  readonly nowUnix: bigint;

  constructor(
    fixture: SimulatorFixture,
    scenario: SimulatorScenario = 'HEALTHY',
    nowUnix = 1_700_000_000n,
  ) {
    this.fixture = fixture;
    this.scenario = scenario;
    this.nowUnix = nowUnix;
  }

  retrieve(request: SourceFetchRequest, secrets: SecretProvider): Result<ExternalSourceRecord, ProductionOracleRejection> {
    if (this.scenario === 'AUTH_FAILURE') {
      return err({ code: 'AUTH_FAILED', detail: `${this.fixture.category} simulator authentication failure` });
    }
    if (this.scenario === 'PROVIDER_OUTAGE') {
      return err({ code: 'FABRICATED_DATA_FORBIDDEN', detail: `${this.fixture.category} simulator outage; no fabricated value` });
    }
    const auth = authenticateSource(request, secrets);
    if (!auth.ok && request.source.authenticationMethod !== 'FILE_FIXTURE_TEST_ONLY') {
      return auth;
    }
    if (this.scenario === 'SCHEMA_CHANGE') {
      return ok(
        Object.freeze({
          identifier: this.fixture.identifier,
          numericValue: this.fixture.healthyValue,
          unit: this.fixture.unit,
          sourceTimestampUnix: this.nowUnix.toString(),
          schemaId: `${this.fixture.schemaId}.changed`,
          schemaVersion: this.fixture.schemaVersion + 1,
        }),
      );
    }
    const value =
      this.scenario === 'OUTLIER' ? (BigInt(this.fixture.healthyValue) * 50n).toString() : this.fixture.healthyValue;
    const timestamp = this.scenario === 'STALE' ? (this.nowUnix - 86_400n).toString() : this.nowUnix.toString();
    return ok(
      Object.freeze({
        identifier: this.fixture.identifier,
        numericValue: value,
        unit: this.fixture.unit,
        sourceTimestampUnix: timestamp,
        schemaId: this.fixture.schemaId,
        schemaVersion: this.fixture.schemaVersion,
      }),
    );
  }
}

export function simulatorForCategory(
  category: SimulatorFixture['category'],
  scenario: SimulatorScenario = 'HEALTHY',
  nowUnix = 1_700_000_000n,
): LocalProviderSimulator {
  const fixture =
    category === 'energy' ? ENERGY_FIXTURE : category === 'compute' ? COMPUTE_FIXTURE : MANUFACTURING_FIXTURE;
  return new LocalProviderSimulator(fixture, scenario, nowUnix);
}
