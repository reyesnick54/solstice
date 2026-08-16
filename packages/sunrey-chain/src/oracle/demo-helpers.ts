import { quantity } from './units.ts';
import { SimulationComputeAdapter, SimulationEnergyAdapter } from './adapter.ts';
import {
  defaultOracleCrypto,
  defaultOracleSuiteId,
  deriveOracleKey,
  signObservation,
} from './crypto.ts';
import {
  OracleEngine,
  developmentComputeFeed,
  developmentEnergyFeed,
  developmentProvider,
} from './engine.ts';
import type {
  FixedQuantity,
  OracleObservation,
  OracleProviderRecord,
  VerifiedEconomicFact,
} from './types.ts';

export type MutableClock = {
  now: bigint;
  nowUnix(): bigint;
};

export function mutableClock(start = 1_700_000_000n): MutableClock {
  return {
    now: start,
    nowUnix() {
      return this.now;
    },
  };
}

export type SignedProvider = {
  readonly record: OracleProviderRecord;
  readonly label: string;
};

function mustQuantity(mantissa: bigint, scale: number, unit: FixedQuantity['unit']): FixedQuantity {
  const built = quantity(mantissa, scale, unit);
  if (!built.ok) {
    throw new Error(built.error.detail);
  }
  return built.value;
}

export function registerEnergyProviders(engine: OracleEngine): readonly SignedProvider[] {
  const ports = engine.ports;
  const labels = ['energy-a', 'energy-b', 'energy-c'] as const;
  const types = [
    'INSTITUTIONAL_DATA_PROVIDER',
    'REGULATED_PROVIDER',
    'PUBLIC_DATA_PROVIDER',
  ] as const;
  const out: SignedProvider[] = [];
  for (let i = 0; i < labels.length; i += 1) {
    const key = deriveOracleKey(ports, defaultOracleSuiteId(), labels[i]!);
    if (!key.ok) {
      throw new Error(key.error.detail);
    }
    const record = developmentProvider(
      `oracle_${labels[i]}`,
      types[i]!,
      key.value.publicKey.publicKeyHex,
      ['ENERGY_PRODUCTION', 'COMPUTE_USAGE'],
    );
    const registered = engine.registerProvider(record, key.value.publicKey);
    if (!registered.ok) {
      throw new Error(registered.error.detail);
    }
    out.push({ record, label: labels[i]! });
  }
  return out;
}

export function signDraft(
  engine: OracleEngine,
  label: string,
  draft: Omit<OracleObservation, 'observationId' | 'signatureHex' | 'publicKeyHex' | 'cryptoSuite'> & {
    readonly publicKeyHex?: string;
    readonly cryptoSuite?: string;
  },
): OracleObservation {
  const key = deriveOracleKey(engine.ports, defaultOracleSuiteId(), label);
  if (!key.ok) {
    throw new Error(key.error.detail);
  }
  const unsigned = {
    ...draft,
    publicKeyHex: key.value.publicKey.publicKeyHex,
    cryptoSuite: defaultOracleSuiteId(),
  };
  const signed = signObservation(engine.ports, unsigned, key.value.privateKey, key.value.publicKey, false);
  if (!signed.ok) {
    throw new Error(signed.error.detail);
  }
  return signed.value;
}

export function runEnergyDemo(clock: MutableClock): {
  readonly facts: readonly string[];
  readonly values: readonly string[];
  readonly stale: boolean;
  readonly conflicted: boolean;
  readonly snapshot: string;
} {
  const engines = [0, 1, 2, 3].map(() => new OracleEngine({
    networkId: 'net_sunrey_simulation',
    chainId: 'chn_sunrey_simulation',
    clock,
    ports: defaultOracleCrypto(),
  }));
  const adapter = new SimulationEnergyAdapter();
  const values = [100n, 102n, 104n];
  let fact: VerifiedEconomicFact | null = null;
  for (const engine of engines) {
    const providers = registerEnergyProviders(engine);
    const feed = engine.registerFeed(developmentEnergyFeed());
    if (!feed.ok) {
      throw new Error(feed.error.detail);
    }
    for (let i = 0; i < providers.length; i += 1) {
      const provider = providers[i]!;
      const draft = adapter.collect(
        {
          oracleId: provider.record.oracleId,
          feedId: feed.value.feedId,
          subject: 'plant_sim_1',
          networkId: engine.networkId,
          chainId: engine.chainId,
          sequence: 1n,
          measurementStartUnix: clock.now,
          measurementEndUnix: clock.now + 60n,
          observationTimeUnix: clock.now + 30n,
          validUntilUnix: clock.now + 3_600n,
        },
        mustQuantity(values[i]!, 0, 'MWh'),
      );
      const submitted = engine.submitObservation(signDraft(engine, provider.label, draft));
      if (!submitted.ok) {
        throw new Error(submitted.error.detail);
      }
    }
    const finalized = engine.finalizeWindow({
      feedId: feed.value.feedId,
      subject: 'plant_sim_1',
      startUnix: clock.now,
      endUnix: clock.now + 60n,
    });
    if (!finalized.ok) {
      throw new Error(finalized.error.detail);
    }
    fact = finalized.value;
  }
  if (!fact) {
    throw new Error('energy fact missing');
  }
  const facts = engines.map((engine) => engine.listFacts()[0]!.factId);
  const factValues = engines.map((engine) => engine.listFacts()[0]!.aggregatedValue.mantissa.toString());
  clock.now += 10_000n;
  for (const engine of engines) {
    engine.refreshStaleness();
  }
  const stale = engines.every((engine) => engine.listFacts()[0]!.qualityStatus === 'STALE');
  const usable = engines.every((engine) => engine.usableForNewEconomicUse(facts[0]!) === false);
  clock.now = 1_700_100_000n;
  let conflicted = false;
  for (const engine of engines) {
    const providers = engine.listProviders();
    const adapterLocal = new SimulationEnergyAdapter();
    const divergent = [10n, 500n, 12n];
    for (let i = 0; i < providers.length; i += 1) {
      const draft = adapterLocal.collect(
        {
          oracleId: providers[i]!.oracleId,
          feedId: 'feed_energy_production_sim',
          subject: 'plant_sim_conflict',
          networkId: engine.networkId,
          chainId: engine.chainId,
          sequence: 2n,
          measurementStartUnix: clock.now,
          measurementEndUnix: clock.now + 60n,
          observationTimeUnix: clock.now + 30n,
          validUntilUnix: clock.now + 3_600n,
        },
        mustQuantity(divergent[i]!, 0, 'MWh'),
      );
      const label = providers[i]!.oracleId.replace('oracle_', '');
      const submitted = engine.submitObservation(signDraft(engine, label, draft));
      if (!submitted.ok) {
        throw new Error(submitted.error.detail);
      }
    }
    const finalized = engine.finalizeWindow({
      feedId: 'feed_energy_production_sim',
      subject: 'plant_sim_conflict',
      startUnix: clock.now,
      endUnix: clock.now + 60n,
    });
    if (!finalized.ok) {
      throw new Error(finalized.error.detail);
    }
    conflicted = finalized.value.qualityStatus === 'CONFLICTED';
  }
  return {
    facts,
    values: factValues,
    stale: stale && usable,
    conflicted,
    snapshot: engines[0]!.snapshotHash(),
  };
}

export function runComputeDemo(clock: MutableClock): {
  readonly factId: string;
  readonly value: string;
  readonly snapshots: readonly string[];
} {
  const engines = [0, 1, 2, 3].map(() => new OracleEngine({
    networkId: 'net_sunrey_simulation',
    chainId: 'chn_sunrey_simulation',
    clock,
    ports: defaultOracleCrypto(),
  }));
  const adapter = new SimulationComputeAdapter();
  const values = [1_000n, 1_010n, 1_020n];
  for (const engine of engines) {
    const providers = registerEnergyProviders(engine);
    const feed = engine.registerFeed(developmentComputeFeed());
    if (!feed.ok) {
      throw new Error(feed.error.detail);
    }
    for (let i = 0; i < providers.length; i += 1) {
      const draft = adapter.collect(
        {
          oracleId: providers[i]!.record.oracleId,
          feedId: feed.value.feedId,
          subject: 'cluster_sim_1',
          networkId: engine.networkId,
          chainId: engine.chainId,
          sequence: 1n,
          measurementStartUnix: clock.now,
          measurementEndUnix: clock.now + 60n,
          observationTimeUnix: clock.now + 30n,
          validUntilUnix: clock.now + 3_600n,
        },
        mustQuantity(values[i]!, 0, 'gpu_s'),
      );
      const submitted = engine.submitObservation(signDraft(engine, providers[i]!.label, draft));
      if (!submitted.ok) {
        throw new Error(submitted.error.detail);
      }
    }
    const finalized = engine.finalizeWindow({
      feedId: feed.value.feedId,
      subject: 'cluster_sim_1',
      startUnix: clock.now,
      endUnix: clock.now + 60n,
    });
    if (!finalized.ok) {
      throw new Error(finalized.error.detail);
    }
  }
  return {
    factId: engines[0]!.listFacts()[0]!.factId,
    value: engines[0]!.listFacts()[0]!.aggregatedValue.mantissa.toString(),
    snapshots: engines.map((engine) => engine.snapshotHash()),
  };
}
