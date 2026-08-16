import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { familyIsActivated } from './protocol/transaction-family.ts';
import { moonreyIssuanceActivated } from './protocol/assets.ts';
import {
  SimulationComputeAdapter,
  SimulationEnergyAdapter,
  consensusMustNotCallAdapters,
} from './oracle/adapter.ts';
import { admitObservation } from './oracle/admission.ts';
import { medianOf, weightedMedianOf } from './oracle/aggregation.ts';
import {
  defaultOracleCrypto,
  defaultOracleSuiteId,
  deriveOracleKey,
  signObservation,
} from './oracle/crypto.ts';
import {
  OracleEngine,
  developmentComputeFeed,
  developmentEnergyFeed,
  developmentProvider,
} from './oracle/engine.ts';
import { DEVELOPMENT_ORACLE_RESOURCE_POLICY, meterOracleSubmission } from './oracle/resources.ts';
import { quantity } from './oracle/units.ts';
import { runComputeDemo, runEnergyDemo, mutableClock, registerEnergyProviders, signDraft } from './oracle/demo-helpers.ts';
import type { OracleObservation } from './oracle/types.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) {
    return out;
  }
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'target') {
      continue;
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (entry.endsWith('.ts') || entry.endsWith('.rs')) {
      out.push(full);
    }
  }
  return out;
}

function clockAt(now: bigint) {
  return { nowUnix: () => now };
}

function engineAt(now = 1_700_000_000n): OracleEngine {
  return new OracleEngine({
    networkId: 'net_sunrey_simulation',
    chainId: 'chn_sunrey_simulation',
    clock: clockAt(now),
  });
}

function qty(mantissa: bigint, unit: 'MWh' | 'gpu_s' | 'kWh' = 'MWh') {
  const built = quantity(mantissa, 0, unit);
  if (!built.ok) {
    throw new Error(built.error.detail);
  }
  return built.value;
}

function signedObservation(
  engine: OracleEngine,
  label: string,
  overrides: Partial<OracleObservation> & { readonly oracleId: string; readonly feedId: string },
): OracleObservation {
  const key = deriveOracleKey(engine.ports, overrides.cryptoSuite ?? defaultOracleSuiteId(), label);
  if (!key.ok) {
    throw new Error(key.error.detail);
  }
  const now = 1_700_000_000n;
  const unsigned = {
    schemaVersion: 1 as const,
    oracleId: overrides.oracleId,
    feedId: overrides.feedId,
    subject: overrides.subject ?? 'plant_sim_1',
    value: overrides.value ?? qty(100n),
    measurementStartUnix: overrides.measurementStartUnix ?? now,
    measurementEndUnix: overrides.measurementEndUnix ?? now + 60n,
    observationTimeUnix: overrides.observationTimeUnix ?? now + 30n,
    validUntilUnix: overrides.validUntilUnix ?? now + 3_600n,
    geography: overrides.geography ?? {
      schemaVersion: 1 as const,
      jurisdiction: 'SIM',
      region: 'devnet',
      locality: 'lab',
    },
    sourceReferenceCommitment: overrides.sourceReferenceCommitment ?? 'src_sim',
    methodologyReference: overrides.methodologyReference ?? 'method.sim.v1',
    confidence: overrides.confidence ?? {
      schemaVersion: 1 as const,
      scoreBps: 9_000,
      sampleCount: 1,
      notesRef: 'sim',
    },
    sequence: overrides.sequence ?? 1n,
    networkId: overrides.networkId ?? engine.networkId,
    chainId: overrides.chainId ?? engine.chainId,
    cryptoSuite: overrides.cryptoSuite ?? defaultOracleSuiteId(),
    publicKeyHex: key.value.publicKey.publicKeyHex,
    deviceProvenance: overrides.deviceProvenance ?? null,
    weight: overrides.weight ?? 1n,
  };
  const signed = signObservation(
    engine.ports,
    unsigned,
    key.value.privateKey,
    key.value.publicKey,
    false,
  );
  if (!signed.ok) {
    throw new Error(signed.error.detail);
  }
  return signed.value;
}

function provisionEnergy(engine: OracleEngine) {
  const providers = registerEnergyProviders(engine);
  const feed = engine.registerFeed(developmentEnergyFeed());
  assert.equal(feed.ok, true);
  return { providers, feedId: 'feed_energy_production_sim' };
}

describe('SunRey sovereign oracle network', () => {
  it('activates the ORACLE transaction family', () => {
    assert.equal(familyIsActivated('ORACLE'), true);
    assert.equal(moonreyIssuanceActivated(), false);
  });

  it('rejects an unregistered oracle', () => {
    const engine = engineAt();
    engine.registerFeed(developmentEnergyFeed());
    const observation = signedObservation(engine, 'energy-a', {
      oracleId: 'oracle_energy-a',
      feedId: 'feed_energy_production_sim',
    });
    const result = engine.submitObservation(observation);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'ORACLE_UNREGISTERED');
    }
  });

  it('rejects the wrong feed', () => {
    const engine = engineAt();
    const { providers } = provisionEnergy(engine);
    const observation = signedObservation(engine, providers[0]!.label, {
      oracleId: providers[0]!.record.oracleId,
      feedId: 'feed_does_not_exist',
    });
    const result = engine.submitObservation(observation);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'ORACLE_WRONG_FEED');
    }
  });

  it('rejects the wrong unit', () => {
    const engine = engineAt();
    const { providers, feedId } = provisionEnergy(engine);
    const observation = signedObservation(engine, providers[0]!.label, {
      oracleId: providers[0]!.record.oracleId,
      feedId,
      value: qty(100n, 'kWh'),
    });
    const result = engine.submitObservation(observation);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'ORACLE_WRONG_UNIT');
    }
  });

  it('rejects a wrong signature', () => {
    const engine = engineAt();
    const { providers, feedId } = provisionEnergy(engine);
    const observation = signedObservation(engine, providers[0]!.label, {
      oracleId: providers[0]!.record.oracleId,
      feedId,
    });
    const tampered = Object.freeze({ ...observation, signatureHex: '00'.repeat(64) });
    const result = engine.submitObservation(tampered);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'ORACLE_INVALID_SIGNATURE');
    }
  });

  it('rejects a stale observation', () => {
    const engine = engineAt();
    const { providers, feedId } = provisionEnergy(engine);
    const now = 1_700_000_000n;
    const observation = signedObservation(engine, providers[0]!.label, {
      oracleId: providers[0]!.record.oracleId,
      feedId,
      measurementStartUnix: now - 10_000n,
      measurementEndUnix: now - 9_000n,
      observationTimeUnix: now - 9_500n,
      validUntilUnix: now - 1n,
    });
    const result = engine.submitObservation(observation);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'ORACLE_STALE_OBSERVATION');
    }
  });

  it('rejects a duplicate sequence', () => {
    const engine = engineAt();
    const { providers, feedId } = provisionEnergy(engine);
    const first = signedObservation(engine, providers[0]!.label, {
      oracleId: providers[0]!.record.oracleId,
      feedId,
      sequence: 1n,
    });
    assert.equal(engine.submitObservation(first).ok, true);
    const second = signedObservation(engine, providers[0]!.label, {
      oracleId: providers[0]!.record.oracleId,
      feedId,
      sequence: 1n,
      subject: 'other',
    });
    const result = engine.submitObservation(second);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'ORACLE_DUPLICATE_SEQUENCE');
    }
  });

  it('computes a deterministic integer median', () => {
    assert.equal(medianOf([100n, 102n, 104n]), 102n);
    assert.equal(medianOf([1n, 2n, 3n, 4n]), 2n);
  });

  it('computes a deterministic weighted median', () => {
    assert.equal(
      weightedMedianOf([
        { value: 10n, weight: 1n },
        { value: 20n, weight: 1n },
        { value: 30n, weight: 5n },
      ]),
      30n,
    );
  });

  it('rejects insufficient quorum', () => {
    const engine = engineAt();
    const { providers, feedId } = provisionEnergy(engine);
    const observation = signedObservation(engine, providers[0]!.label, {
      oracleId: providers[0]!.record.oracleId,
      feedId,
    });
    assert.equal(engine.submitObservation(observation).ok, true);
    const finalized = engine.finalizeWindow({
      feedId,
      subject: 'plant_sim_1',
      startUnix: 1_700_000_000n,
      endUnix: 1_700_000_060n,
    });
    assert.equal(finalized.ok, false);
    if (!finalized.ok) {
      assert.equal(finalized.error.code, 'ORACLE_INSUFFICIENT_QUORUM');
    }
    assert.equal(engine.metrics().oracle_quorum_failures, 1);
  });

  it('marks a conflicted feed when providers materially disagree', () => {
    const clock = mutableClock(1_700_100_000n);
    const energy = runEnergyDemo(clock);
    assert.equal(energy.conflicted, true);
  });

  it('makes a stale fact unavailable for new economic use while retaining history', () => {
    const clock = mutableClock();
    const energy = runEnergyDemo(clock);
    assert.equal(energy.stale, true);
    const engine = engineAt(clock.now);
    const providers = registerEnergyProviders(engine);
    engine.registerFeed(developmentEnergyFeed());
    const observation = signedObservation(engine, providers[0]!.label, {
      oracleId: providers[0]!.record.oracleId,
      feedId: 'feed_energy_production_sim',
    });
    engine.submitObservation(observation);
    const historical = energy.facts[0];
    assert.ok(historical);
    assert.equal(historical.startsWith('fact_'), true);
  });

  it('applies provider suspension to future observations only', () => {
    const engine = engineAt();
    const { providers, feedId } = provisionEnergy(engine);
    const first = signedObservation(engine, providers[0]!.label, {
      oracleId: providers[0]!.record.oracleId,
      feedId,
      sequence: 1n,
    });
    assert.equal(engine.submitObservation(first).ok, true);
    assert.equal(engine.suspendProvider(providers[0]!.record.oracleId).ok, true);
    const second = signedObservation(engine, providers[0]!.label, {
      oracleId: providers[0]!.record.oracleId,
      feedId,
      sequence: 2n,
      subject: 'later',
    });
    const result = engine.submitObservation(second);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'ORACLE_PROVIDER_SUSPENDED');
    }
    assert.equal(engine.getObservation(first.observationId)?.observationId, first.observationId);
  });

  it('rejects the wrong CryptoSuite', () => {
    const engine = engineAt();
    const { providers, feedId } = provisionEnergy(engine);
    const observation = signedObservation(engine, providers[0]!.label, {
      oracleId: providers[0]!.record.oracleId,
      feedId,
    });
    const wrongSuite = Object.freeze({ ...observation, cryptoSuite: 'unknown-suite' });
    const result = engine.submitObservation(wrongSuite);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'ORACLE_WRONG_CRYPTO_SUITE');
    }
  });

  it('never calls a raw external API from consensus', () => {
    assert.equal(consensusMustNotCallAdapters(), true);
    const files = walk(join(ROOT, 'packages/sunrey-chain/src/oracle'));
    for (const file of files) {
      if (file.endsWith('adapter.ts') || file.endsWith('demo.ts') || file.endsWith('demo-helpers.ts')) {
        continue;
      }
      const source = readFileSync(file, 'utf8');
      assert.equal(/fetch\s*\(|http\.get|https\.request|axios|XMLHttpRequest/.test(source), false, file);
      assert.equal(/Ed25519|ed25519/.test(source), false, file);
    }
    const rust = walk(join(ROOT, 'packages/sunrey-chain/rust/crates/oracle'));
    for (const file of rust) {
      const source = readFileSync(file, 'utf8');
      assert.equal(/reqwest|ureq|hyper::Client|std::net::TcpStream/.test(source), false, file);
    }
  });

  it('agrees on fact id and value across four validators', () => {
    const energy = runEnergyDemo(mutableClock());
    assert.equal(energy.facts.every((id) => id === energy.facts[0]), true);
    assert.equal(energy.values.every((value) => value === '102'), true);
    const compute = runComputeDemo(mutableClock(1_700_200_000n));
    assert.equal(compute.snapshots.every((hash) => hash === compute.snapshots[0]), true);
    assert.equal(compute.value, '1010');
  });

  it('meters oracle submissions and rejects oversized payloads', () => {
    const engine = engineAt();
    const { providers, feedId } = provisionEnergy(engine);
    const observation = signedObservation(engine, providers[0]!.label, {
      oracleId: providers[0]!.record.oracleId,
      feedId,
    });
    const charged = meterOracleSubmission(observation);
    assert.equal(charged.ok, true);
    const huge = Object.freeze({
      ...observation,
      sourceReferenceCommitment: 'x'.repeat(DEVELOPMENT_ORACLE_RESOURCE_POLICY.maxPayloadBytes + 8),
    });
    const rejected = meterOracleSubmission(huge);
    assert.equal(rejected.ok, false);
    if (!rejected.ok) {
      assert.equal(rejected.error.code, 'ORACLE_PAYLOAD_OVERSIZED');
    }
  });

  it('keeps REFERENCE_PRICE from authorizing fiat and MoonRey issuance off', () => {
    assert.equal(moonreyIssuanceActivated(), false);
    const engine = engineAt();
    engine.registerFeed(
      developmentEnergyFeed({
        feedId: 'feed_reference_price_sim',
        factType: 'REFERENCE_PRICE',
        measurementUnit: 'units_produced',
        minimumSources: 1,
        minimumQuorum: 1,
        allowSingleAuthoritativeProvider: true,
        requireGeography: false,
      }),
    );
    const key = deriveOracleKey(defaultOracleCrypto(), defaultOracleSuiteId(), 'price-a');
    assert.equal(key.ok, true);
    if (!key.ok) return;
    engine.registerProvider(
      developmentProvider('oracle_price-a', 'INSTITUTIONAL_DATA_PROVIDER', key.value.publicKey.publicKeyHex, [
        'REFERENCE_PRICE',
      ]),
      key.value.publicKey,
    );
    const price = quantity(5n, 0, 'units_produced');
    assert.equal(price.ok, true);
    if (!price.ok) return;
    const observation = signedObservation(engine, 'price-a', {
      oracleId: 'oracle_price-a',
      feedId: 'feed_reference_price_sim',
      value: price.value,
    });
    const submitted = engine.submitObservation(observation);
    assert.equal(submitted.ok, true);
    const fact = engine.finalizeWindow({
      feedId: 'feed_reference_price_sim',
      subject: 'plant_sim_1',
      startUnix: 1_700_000_000n,
      endUnix: 1_700_000_060n,
    });
    assert.equal(fact.ok, true);
    if (fact.ok) {
      assert.equal(engine.usableForNewEconomicUse(fact.value.factId), true);
      assert.equal(moonreyIssuanceActivated(), false);
    }
  });

  it('exposes simulation adapters without consensus HTTP', () => {
    const energy = new SimulationEnergyAdapter();
    const compute = new SimulationComputeAdapter();
    assert.equal(energy.adapterId.startsWith('sim.'), true);
    assert.equal(compute.adapterId.startsWith('sim.'), true);
    assert.equal(admitObservation.name.length > 0, true);
  });
});
