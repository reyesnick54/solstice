/**
 * Chunk 150 demo — fixture provider candidate through the existing oracle path.
 *
 * SIMULATION ONLY. Injected fake transport. Stops before minting.
 */

import { ENVIRONMENT, LIVE_BANKING_RAILS, LIVE_DATA_MARKET_ENABLED } from '../../../../../config/src/flags.ts';
import { quantity } from '../../units.ts';
import { OracleEngine, developmentEnergyFeed, developmentProvider } from '../../engine.ts';
import { signDraft } from '../../demo-helpers.ts';
import { defaultOracleSuiteId, deriveOracleKey } from '../../crypto.ts';
import { ConnectorCircuitBreaker, DEFAULT_CIRCUIT_BREAKER_POLICY } from '../circuit-breaker.ts';
import { ConnectorRateLimiter, DEFAULT_RATE_LIMIT_POLICY } from '../rate-limit.ts';
import { createFrozenConnectorClock } from '../runtime.ts';
import { FakeExternalHttpTransport } from '../transport.ts';
import { collectCandidateFeed } from './collection.ts';
import { buildProviderCandidateCoverageReport } from './coverage.ts';
import { fixtureBinding } from './fixtures.ts';
import {
  CANDIDATE_NOW_UNIX,
  FIXTURE_ENERGY_MTLS_ID,
  fixtureEnergyBlueprint,
  fixtureEnergyEndpoint,
  fixtureEnergyFeed,
  fixtureEnergyProfile,
  fixtureSchema,
  vendorEnergyBody,
} from './fixtures.ts';
import { buildOnboardingPacket } from './onboarding.ts';
import { createFixtureTranslator } from './responses.ts';
import {
  CONSENSUS_CALLS_HTTP,
  PRODUCTION_ACTIVE,
  PROVIDER_SUCCESS_MINTS,
  RAW_CREDENTIALS_PRESENT,
  REAL_EXTERNAL_PROVIDER_CONFIGURED,
  REAL_NETWORK_CALLED,
  REFERENCE_PRICE_MINTS,
} from './types.ts';

export async function runExternalOracleProviderCandidateDemo(): Promise<{
  readonly profileId: string;
  readonly endpointProfileId: string;
  readonly recordCount: number;
  readonly fabricAdmitted: number;
  readonly observationId: string;
  readonly REAL_EXTERNAL_PROVIDER_CONFIGURED: false;
  readonly REAL_NETWORK_CALLED: false;
  readonly CONSENSUS_CALLS_HTTP: false;
  readonly RAW_CREDENTIALS_PRESENT: false;
  readonly REFERENCE_PRICE_MINTS: false;
  readonly PROVIDER_SUCCESS_MINTS: false;
  readonly PRODUCTION_ACTIVE: false;
}> {
  const transport = new FakeExternalHttpTransport();
  transport.on('GET', 'https://fixture-energy-mtls.oracle.test/v1/energy', {
    status: 200,
    body: vendorEnergyBody(),
  });
  const clock = createFrozenConnectorClock(CANDIDATE_NOW_UNIX);
  const collected = await collectCandidateFeed({
    profile: fixtureEnergyProfile,
    feed: fixtureEnergyFeed,
    endpoint: fixtureEnergyEndpoint,
    blueprint: fixtureEnergyBlueprint,
    binding: fixtureBinding(FIXTURE_ENERGY_MTLS_ID, 'MTLS'),
    translator: createFixtureTranslator('translator.energy.mtls'),
    schema: fixtureSchema(fixtureEnergyFeed),
    transport,
    rateLimiter: new ConnectorRateLimiter(DEFAULT_RATE_LIMIT_POLICY, clock),
    circuitBreaker: new ConnectorCircuitBreaker(DEFAULT_CIRCUIT_BREAKER_POLICY, clock),
    nowUnix: CANDIDATE_NOW_UNIX,
  });
  if (!collected.ok) {
    throw new Error(collected.error.detail);
  }

  const engine = new OracleEngine({
    networkId: 'net_sunrey_simulation',
    chainId: 'chn_sunrey_simulation',
    clock: { nowUnix: () => CANDIDATE_NOW_UNIX },
  });
  const key = deriveOracleKey(engine.ports, defaultOracleSuiteId(), 'energy-a');
  if (!key.ok) {
    throw new Error(key.error.detail);
  }
  const provider = developmentProvider('oracle_energy-a', 'INSTITUTIONAL_DATA_PROVIDER', key.value.publicKey.publicKeyHex, [
    'ENERGY_PRODUCTION',
  ]);
  const registered = engine.registerProvider(provider, key.value.publicKey);
  if (!registered.ok) {
    throw new Error(registered.error.detail);
  }
  const feed = engine.registerFeed(
    developmentEnergyFeed({
      feedId: 'feed_chunk150_energy',
      factType: 'ENERGY_PRODUCTION',
      measurementUnit: 'MWh',
      maxObservationSpread: 10_000n,
    }),
  );
  if (!feed.ok) {
    throw new Error(feed.error.detail);
  }
  const value = quantity(100n, 0, 'MWh');
  if (!value.ok) {
    throw new Error(value.error.detail);
  }
  const submitted = engine.submitObservation(
    signDraft(engine, 'energy-a', {
      schemaVersion: 1,
      oracleId: provider.oracleId,
      feedId: feed.value.feedId,
      subject: 'ns.fixture-energy-mtls:plant_sim_1',
      value: value.value,
      measurementStartUnix: CANDIDATE_NOW_UNIX - 3_600n,
      measurementEndUnix: CANDIDATE_NOW_UNIX,
      observationTimeUnix: CANDIDATE_NOW_UNIX,
      validUntilUnix: CANDIDATE_NOW_UNIX + 3_600n,
      geography: { schemaVersion: 1, jurisdiction: 'US', region: 'sim-east', locality: 'zone-a' },
      sourceReferenceCommitment: collected.value.fabricEnvelopes[0]?.contentCommitment ?? 'chunk150.demo',
      methodologyReference: 'method.external-provider-candidate.v1',
      confidence: { schemaVersion: 1, scoreBps: 9_000, sampleCount: 1, notesRef: 'chunk150' },
      sequence: 1n,
      networkId: engine.networkId,
      chainId: engine.chainId,
      deviceProvenance: null,
      weight: 1n,
    }),
  );
  if (!submitted.ok) {
    throw new Error(submitted.error.detail);
  }

  buildOnboardingPacket({
    profile: fixtureEnergyProfile,
    endpoints: [fixtureEnergyEndpoint],
    technicalTestEvidenceRef: 'tech.sandbox.chunk150',
  });
  buildProviderCandidateCoverageReport([fixtureEnergyProfile]);

  if (ENVIRONMENT !== 'simulation' || LIVE_BANKING_RAILS !== false || LIVE_DATA_MARKET_ENABLED !== false) {
    throw new Error('LIVE flags must remain false');
  }

  return Object.freeze({
    profileId: fixtureEnergyProfile.profileId,
    endpointProfileId: fixtureEnergyEndpoint.endpointProfileId,
    recordCount: collected.value.records.length,
    fabricAdmitted: collected.value.fabricEnvelopes.length,
    observationId: submitted.value.observationId,
    REAL_EXTERNAL_PROVIDER_CONFIGURED,
    REAL_NETWORK_CALLED,
    CONSENSUS_CALLS_HTTP,
    RAW_CREDENTIALS_PRESENT,
    REFERENCE_PRICE_MINTS,
    PROVIDER_SUCCESS_MINTS,
    PRODUCTION_ACTIVE,
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await runExternalOracleProviderCandidateDemo();
  console.log('CHUNK-150 external economic provider candidate demo');
  console.log(`profile=${result.profileId}`);
  console.log(`endpoint=${result.endpointProfileId}`);
  console.log(`records=${result.recordCount} fabricAdmitted=${result.fabricAdmitted}`);
  console.log(`observation=${result.observationId}`);
  console.log(`REAL_EXTERNAL_PROVIDER_CONFIGURED=${result.REAL_EXTERNAL_PROVIDER_CONFIGURED}`);
  console.log(`REAL_NETWORK_CALLED=${result.REAL_NETWORK_CALLED}`);
  console.log(`CONSENSUS_CALLS_HTTP=${result.CONSENSUS_CALLS_HTTP}`);
  console.log(`RAW_CREDENTIALS_PRESENT=${result.RAW_CREDENTIALS_PRESENT}`);
  console.log(`REFERENCE_PRICE_MINTS=${result.REFERENCE_PRICE_MINTS}`);
  console.log(`PROVIDER_SUCCESS_MINTS=${result.PROVIDER_SUCCESS_MINTS}`);
  console.log(`PRODUCTION_ACTIVE=${result.PRODUCTION_ACTIVE}`);
}
