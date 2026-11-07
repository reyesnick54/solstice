import type { Md13ChaosScenarioId, Md13FeedId, Md13SloDimension, MarketDataCircuitState } from './taxonomy.ts';

export type Md13RawIngressPacket = {
  readonly packetId: string;
  readonly feedId: Md13FeedId;
  readonly sequence: number;
  readonly checksum: string;
  readonly payload: string;
  readonly sentAtMs: number;
};

export type Md13FabricMetrics = {
  readonly availabilityRatio: number;
  readonly freshnessMs: number;
  readonly latenciesMs: readonly number[];
  readonly gapRecoveryMs: number | null;
  readonly snapshotRecoveryMs: number | null;
  readonly desyncDurationMs: number;
};

export type Md13ChaosScenarioExpectation = {
  readonly scenarioId: Md13ChaosScenarioId;
  readonly circuitMayDegrade: boolean;
  readonly circuitMayUntrust: boolean;
  readonly rawPreservationRequired: boolean;
  readonly expectGapRecovery: boolean;
  readonly expectSnapshotRecovery: boolean;
};

export type Md13ChaosScenarioResult = {
  readonly scenarioId: Md13ChaosScenarioId;
  readonly passed: boolean;
  readonly silentRawDrops: number;
  readonly circuit: MarketDataCircuitState;
  readonly metrics: Md13FabricMetrics;
  readonly backpressurePolicies: readonly string[];
  readonly message: string;
};

export type Md13QualificationReport = {
  readonly schema: 'sunrey.helios.market-data-live.md13.v1';
  readonly scenarios: readonly Md13ChaosScenarioResult[];
  readonly sloDimensionsDeclared: readonly Md13SloDimension[];
  readonly feedScopedSlo: boolean;
  readonly allScenariosPassed: boolean;
};
