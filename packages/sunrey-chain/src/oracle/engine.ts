import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { PublicKeyDescriptor } from '../../../security/src/index.ts';
import { commitCanonical } from '../hash.ts';
import { moonreyIssuanceActivated } from '../protocol/assets.ts';
import { admitObservation } from './admission.ts';
import { aggregateObservations } from './aggregation.ts';
import {
  defaultOracleCrypto,
  defaultOracleSuiteId,
  deriveOracleKey,
  type OracleCryptoPorts,
} from './crypto.ts';
import { DEVELOPMENT_ORACLE_RESOURCE_POLICY, type OracleResourcePolicy } from './resources.ts';
import type {
  OracleDispute,
  OracleFeedDefinition,
  OracleMetrics,
  OracleObservation,
  OracleProviderRecord,
  OracleRejection,
  ProviderStatus,
  QualityStatus,
  VerifiedEconomicFact,
} from './types.ts';
import { ORACLE_TYPES, providerClassificationIsNotLegalApproval } from './types.ts';

export type OracleClock = {
  nowUnix(): bigint;
};

export type OracleEngineConfig = {
  readonly networkId: string;
  readonly chainId: string;
  readonly clock: OracleClock;
  readonly ports?: OracleCryptoPorts;
  readonly resourcePolicy?: OracleResourcePolicy;
};

function factIdOf(input: Omit<VerifiedEconomicFact, 'factId' | 'qualityStatus' | 'conflictReason'>): string {
  return `fact_${commitCanonical({
    domain: 'sunrey.oracle.fact.v1',
    feedId: input.feedId,
    subject: input.subject,
    aggregatedValue: {
      mantissa: input.aggregatedValue.mantissa.toString(),
      scale: input.aggregatedValue.scale,
      unit: input.aggregatedValue.unit,
    },
    sourceObservationIds: input.sourceObservationIds,
    aggregationPolicy: input.aggregationPolicy,
    observationWindow: {
      startUnix: input.observationWindow.startUnix.toString(),
      endUnix: input.observationWindow.endUnix.toString(),
    },
    validUntilUnix: input.validUntilUnix.toString(),
    finalizedHeight: input.finalizedHeight,
  })}`;
}

export class OracleEngine {
  readonly networkId: string;
  readonly chainId: string;
  readonly ports: OracleCryptoPorts;
  readonly resourcePolicy: OracleResourcePolicy;
  private readonly clock: OracleClock;
  private height = 1;
  private readonly providers = new Map<string, OracleProviderRecord>();
  private readonly keys = new Map<string, PublicKeyDescriptor>();
  private readonly feeds = new Map<string, OracleFeedDefinition>();
  private readonly observations = new Map<string, OracleObservation>();
  private readonly sequences = new Map<string, bigint>();
  private readonly facts = new Map<string, VerifiedEconomicFact>();
  private readonly factsByFeed = new Map<string, string[]>();
  private readonly disputes = new Map<string, OracleDispute>();
  private readonly metricsState: {
    received: number;
    rejected: number;
    verified: number;
    conflicts: number;
    stale: number;
    quorumFailures: number;
    lastAggregationUnits: number;
  } = {
    received: 0,
    rejected: 0,
    verified: 0,
    conflicts: 0,
    stale: 0,
    quorumFailures: 0,
    lastAggregationUnits: 0,
  };

  constructor(config: OracleEngineConfig) {
    this.networkId = config.networkId;
    this.chainId = config.chainId;
    this.clock = config.clock;
    this.ports = config.ports ?? defaultOracleCrypto();
    this.resourcePolicy = config.resourcePolicy ?? DEVELOPMENT_ORACLE_RESOURCE_POLICY;
  }

  currentHeight(): number {
    return this.height;
  }

  advanceHeight(height: number): void {
    if (!Number.isInteger(height) || height < this.height) {
      throw new TypeError('height must advance monotonically');
    }
    this.height = height;
    this.refreshStaleness();
  }

  registerProvider(record: OracleProviderRecord, publicKey: PublicKeyDescriptor): Result<OracleProviderRecord, OracleRejection> {
    if (this.providers.has(record.oracleId)) {
      return err({ code: 'ORACLE_SCHEMA_INVALID', detail: 'oracle already registered' });
    }
    if (record.publicKeyHex.length === 0) {
      return err({ code: 'ORACLE_SCHEMA_INVALID', detail: 'public key required; private keys are never stored' });
    }
    if (record.cryptoSuite.length === 0) {
      return err({ code: 'ORACLE_WRONG_CRYPTO_SUITE', detail: 'provider must declare a CryptoSuite' });
    }
    providerClassificationIsNotLegalApproval(record.oracleType);
    this.providers.set(record.oracleId, record);
    this.keys.set(record.oracleId, publicKey);
    return ok(record);
  }

  suspendProvider(oracleId: string): Result<OracleProviderRecord, OracleRejection> {
    return this.setProviderStatus(oracleId, 'SUSPENDED');
  }

  revokeProvider(oracleId: string): Result<OracleProviderRecord, OracleRejection> {
    return this.setProviderStatus(oracleId, 'REVOKED');
  }

  private setProviderStatus(
    oracleId: string,
    status: Extract<ProviderStatus, 'SUSPENDED' | 'REVOKED'>,
  ): Result<OracleProviderRecord, OracleRejection> {
    const existing = this.providers.get(oracleId);
    if (!existing) {
      return err({ code: 'ORACLE_UNREGISTERED', detail: oracleId });
    }
    const next = Object.freeze({ ...existing, status });
    this.providers.set(oracleId, next);
    return ok(next);
  }

  registerFeed(feed: OracleFeedDefinition): Result<OracleFeedDefinition, OracleRejection> {
    if (this.feeds.has(feed.feedId)) {
      return err({ code: 'ORACLE_SCHEMA_INVALID', detail: 'feed already registered' });
    }
    if (!Number.isInteger(feed.minimumSources) || feed.minimumSources < 1) {
      return err({ code: 'ORACLE_SCHEMA_INVALID', detail: 'minimumSources must be a positive integer' });
    }
    if (feed.allowSingleAuthoritativeProvider && feed.minimumSources !== 1) {
      return err({
        code: 'ORACLE_SCHEMA_INVALID',
        detail: 'single-authoritative model requires minimumSources = 1',
      });
    }
    this.feeds.set(feed.feedId, feed);
    return ok(feed);
  }

  submitObservation(observation: OracleObservation): Result<OracleObservation, OracleRejection> {
    this.metricsState.received += 1;
    const provider = this.providers.get(observation.oracleId) ?? null;
    const feed = this.feeds.get(observation.feedId) ?? null;
    const admitted = admitObservation(
      observation,
      {
        networkId: this.networkId,
        chainId: this.chainId,
        nowUnix: this.clock.nowUnix(),
        height: this.height,
        lastSequence: this.sequences.get(`${observation.oracleId}:${observation.feedId}`) ?? null,
        provider,
        feed,
        publicKey: this.keys.get(observation.oracleId) ?? null,
      },
      this.ports,
      this.resourcePolicy,
    );
    if (!admitted.ok) {
      this.metricsState.rejected += 1;
      return admitted;
    }
    this.observations.set(observation.observationId, observation);
    this.sequences.set(`${observation.oracleId}:${observation.feedId}`, observation.sequence);
    if (provider) {
      this.providers.set(
        provider.oracleId,
        Object.freeze({
          ...provider,
          reputation: Object.freeze({
            ...provider.reputation,
            acceptedObservations: provider.reputation.acceptedObservations + 1,
          }),
        }),
      );
    }
    return ok(observation);
  }

  finalizeWindow(input: {
    readonly feedId: string;
    readonly subject: string;
    readonly startUnix: bigint;
    readonly endUnix: bigint;
  }): Result<VerifiedEconomicFact, OracleRejection> {
    const started = this.clock.nowUnix();
    const feed = this.feeds.get(input.feedId);
    if (!feed || feed.status !== 'ACTIVE') {
      return err({ code: 'ORACLE_WRONG_FEED', detail: input.feedId });
    }
    const rows = [...this.observations.values()]
      .filter(
        (row) =>
          row.feedId === input.feedId &&
          row.subject === input.subject &&
          row.measurementStartUnix >= input.startUnix &&
          row.measurementEndUnix <= input.endUnix,
      )
      .sort((a, b) => (a.observationId < b.observationId ? -1 : 1));
    const independent = new Set(rows.map((row) => row.oracleId));
    if (independent.size < feed.minimumSources || rows.length < feed.minimumQuorum) {
      this.metricsState.quorumFailures += 1;
      return err({
        code: 'ORACLE_INSUFFICIENT_QUORUM',
        detail: `need ${feed.minimumSources} sources and quorum ${feed.minimumQuorum}`,
      });
    }
    if (feed.requiredSourceClasses.length > 0) {
      const classes = new Set(
        rows
          .map((row) => this.providers.get(row.oracleId)?.oracleType)
          .filter((value): value is NonNullable<typeof value> => value !== undefined),
      );
      for (const required of feed.requiredSourceClasses) {
        if (!classes.has(required)) {
          this.metricsState.quorumFailures += 1;
          return err({
            code: 'ORACLE_INSUFFICIENT_QUORUM',
            detail: `missing required source class ${required}`,
          });
        }
      }
    }
    const aggregated = aggregateObservations(feed, rows);
    if (!aggregated.ok) {
      return aggregated;
    }
    const validUntil = input.endUnix + BigInt(feed.maximumAgeSeconds);
    if (aggregated.value.quality === 'CONFLICTED') {
      this.metricsState.conflicts += 1;
      const fact = this.storeFact({
        schemaVersion: 1,
        feedId: feed.feedId,
        subject: input.subject,
        aggregatedValue: rows[0]!.value,
        sourceObservationIds: aggregated.value.sourceObservationIds,
        aggregationPolicy: feed.aggregationPolicy,
        observationWindow: aggregated.value.window,
        validUntilUnix: validUntil,
        qualityStatus: 'CONFLICTED',
        finalizedHeight: this.height,
        conflictReason: aggregated.value.reason,
      });
      this.metricsState.lastAggregationUnits = Number(this.clock.nowUnix() - started);
      return ok(fact);
    }
    const fact = this.storeFact({
      schemaVersion: 1,
      feedId: feed.feedId,
      subject: input.subject,
      aggregatedValue: aggregated.value.value!,
      sourceObservationIds: aggregated.value.sourceObservationIds,
      aggregationPolicy: feed.aggregationPolicy,
      observationWindow: aggregated.value.window,
      validUntilUnix: validUntil,
      qualityStatus: 'VERIFIED',
      finalizedHeight: this.height,
      conflictReason: null,
    });
    this.metricsState.verified += 1;
    this.metricsState.lastAggregationUnits = Number(this.clock.nowUnix() - started);
    return ok(fact);
  }

  private storeFact(
    input: Omit<VerifiedEconomicFact, 'factId'> & { readonly factId?: string },
  ): VerifiedEconomicFact {
    const previous = (this.factsByFeed.get(`${input.feedId}:${input.subject}`) ?? [])
      .map((id) => this.facts.get(id))
      .filter((row): row is VerifiedEconomicFact => row !== undefined);
    for (const prior of previous) {
      if (prior.qualityStatus === 'VERIFIED') {
        this.facts.set(
          prior.factId,
          Object.freeze({ ...prior, qualityStatus: 'SUPERSEDED' as const }),
        );
      }
    }
    const factId = factIdOf(input);
    const fact: VerifiedEconomicFact = Object.freeze({ ...input, factId });
    this.facts.set(factId, fact);
    const key = `${input.feedId}:${input.subject}`;
    this.factsByFeed.set(key, [...(this.factsByFeed.get(key) ?? []), factId]);
    return fact;
  }

  refreshStaleness(): void {
    const now = this.clock.nowUnix();
    for (const [id, fact] of this.facts) {
      if (fact.qualityStatus === 'VERIFIED' && now > fact.validUntilUnix) {
        this.facts.set(id, Object.freeze({ ...fact, qualityStatus: 'STALE' as const }));
        this.metricsState.stale += 1;
      }
    }
  }

  usableForNewEconomicUse(factId: string): boolean {
    this.refreshStaleness();
    const fact = this.facts.get(factId);
    if (!fact) {
      return false;
    }
    if (moonreyIssuanceActivated()) {
      return false;
    }
    return fact.qualityStatus === 'VERIFIED';
  }

  historicalFact(factId: string): VerifiedEconomicFact | undefined {
    return this.facts.get(factId);
  }

  fileDispute(dispute: OracleDispute): Result<OracleDispute, OracleRejection> {
    if (this.disputes.has(dispute.disputeId)) {
      return err({ code: 'ORACLE_SCHEMA_INVALID', detail: 'dispute already exists' });
    }
    this.disputes.set(dispute.disputeId, dispute);
    return ok(dispute);
  }

  resolveDispute(
    disputeId: string,
    status: Extract<OracleDispute['status'], 'UPHELD' | 'REJECTED' | 'WITHDRAWN'>,
    resolution: string,
    governanceReference: string,
  ): Result<OracleDispute, OracleRejection> {
    const existing = this.disputes.get(disputeId);
    if (!existing) {
      return err({ code: 'ORACLE_SCHEMA_INVALID', detail: 'unknown dispute' });
    }
    const next = Object.freeze({
      ...existing,
      status,
      resolution,
      governanceReference,
    });
    this.disputes.set(disputeId, next);
    if (status === 'UPHELD' && existing.factId) {
      const fact = this.facts.get(existing.factId);
      if (fact && fact.qualityStatus === 'VERIFIED') {
        this.facts.set(fact.factId, Object.freeze({ ...fact, qualityStatus: 'CONFLICTED' as const }));
        this.metricsState.conflicts += 1;
      }
    }
    return ok(next);
  }

  listProviders(): readonly OracleProviderRecord[] {
    return [...this.providers.values()].sort((a, b) => (a.oracleId < b.oracleId ? -1 : 1));
  }

  listFeeds(): readonly OracleFeedDefinition[] {
    return [...this.feeds.values()].sort((a, b) => (a.feedId < b.feedId ? -1 : 1));
  }

  getObservation(id: string): OracleObservation | undefined {
    return this.observations.get(id);
  }

  listObservations(feedId?: string): readonly OracleObservation[] {
    return [...this.observations.values()]
      .filter((row) => (feedId ? row.feedId === feedId : true))
      .sort((a, b) => (a.observationId < b.observationId ? -1 : 1));
  }

  getFact(id: string): VerifiedEconomicFact | undefined {
    this.refreshStaleness();
    return this.facts.get(id);
  }

  listFacts(feedId?: string): readonly VerifiedEconomicFact[] {
    this.refreshStaleness();
    return [...this.facts.values()]
      .filter((fact) => (feedId ? fact.feedId === feedId : true))
      .sort((a, b) => (a.factId < b.factId ? -1 : 1));
  }

  listDisputes(): readonly OracleDispute[] {
    return [...this.disputes.values()].sort((a, b) => (a.disputeId < b.disputeId ? -1 : 1));
  }

  qualityReport(): Readonly<Record<QualityStatus, number>> {
    this.refreshStaleness();
    const counts: Record<QualityStatus, number> = {
      PENDING: 0,
      VERIFIED: 0,
      CONFLICTED: 0,
      STALE: 0,
      REVOKED_SOURCE: 0,
      SUPERSEDED: 0,
    };
    for (const fact of this.facts.values()) {
      counts[fact.qualityStatus] += 1;
    }
    return Object.freeze(counts);
  }

  metrics(): OracleMetrics {
    const providerStatus: Record<string, number> = {};
    for (const status of ['REGISTERED', 'ACTIVE', 'SUSPENDED', 'REVOKED', 'EXPIRED'] as const) {
      providerStatus[status] = 0;
    }
    for (const provider of this.providers.values()) {
      providerStatus[provider.status] = (providerStatus[provider.status] ?? 0) + 1;
    }
    return Object.freeze({
      oracle_observations_received: this.metricsState.received,
      oracle_observations_rejected: this.metricsState.rejected,
      oracle_verified_facts: this.metricsState.verified,
      oracle_conflicts: this.metricsState.conflicts,
      oracle_stale_facts: this.metricsState.stale,
      oracle_quorum_failures: this.metricsState.quorumFailures,
      oracle_provider_status: Object.freeze(providerStatus),
      oracle_aggregation_latency: this.metricsState.lastAggregationUnits,
    });
  }

  snapshotHash(): string {
    return commitCanonical({
      providers: this.listProviders().map((row) => row.oracleId),
      feeds: this.listFeeds().map((row) => row.feedId),
      observations: [...this.observations.keys()].sort(),
      facts: this.listFacts().map((row) => ({
        factId: row.factId,
        quality: row.qualityStatus,
        value: row.aggregatedValue.mantissa.toString(),
      })),
    });
  }
}

export function developmentOracleEngine(clock: OracleClock): OracleEngine {
  return new OracleEngine({
    networkId: 'net_sunrey_simulation',
    chainId: 'chn_sunrey_simulation',
    clock,
  });
}

export function developmentProvider(
  oracleId: string,
  oracleType: (typeof ORACLE_TYPES)[number],
  publicKeyHex: string,
  authorized: OracleProviderRecord['authorizedFeedTypes'],
): OracleProviderRecord {
  return Object.freeze({
    schemaVersion: 1,
    oracleId,
    controllerActor: `actor_${oracleId}`,
    legalEntityReference: null,
    oracleType,
    publicKeyHex,
    cryptoSuite: defaultOracleSuiteId(),
    authorizedFeedTypes: authorized,
    jurisdictions: ['SIM'],
    geographicScope: Object.freeze({
      schemaVersion: 1,
      jurisdiction: 'SIM',
      region: 'devnet',
      locality: 'lab',
    }),
    methodologyReference: 'method.sim.energy.v1',
    status: 'ACTIVE',
    activationHeight: 1,
    expirationHeight: null,
    reputation: Object.freeze({
      schemaVersion: 1,
      acceptedObservations: 0,
      rejectedObservations: 0,
      conflictsParticipated: 0,
    }),
    schemaVersionRecord: 1,
  });
}

export function developmentEnergyFeed(overrides: Partial<OracleFeedDefinition> = {}): OracleFeedDefinition {
  return Object.freeze({
    schemaVersion: 1,
    feedId: overrides.feedId ?? 'feed_energy_production_sim',
    factType: overrides.factType ?? 'ENERGY_PRODUCTION',
    measurementUnit: overrides.measurementUnit ?? 'MWh',
    quantityScale: overrides.quantityScale ?? 0,
    geographicScope: overrides.geographicScope ??
      Object.freeze({ schemaVersion: 1 as const, jurisdiction: 'SIM', region: 'devnet', locality: 'lab' }),
    subjectSchema: overrides.subjectSchema ?? 'energy.resource.v1',
    aggregationPolicy: overrides.aggregationPolicy ?? 'MEDIAN',
    minimumSources: overrides.minimumSources ?? 3,
    minimumQuorum: overrides.minimumQuorum ?? 3,
    requiredSourceClasses: overrides.requiredSourceClasses ?? [],
    maximumAgeSeconds: overrides.maximumAgeSeconds ?? 3_600,
    outlierPolicy: overrides.outlierPolicy ?? 'REJECT_OUTSIDE_SPREAD',
    maxObservationSpread: overrides.maxObservationSpread ?? 50n,
    trimCount: overrides.trimCount ?? 0,
    confidenceMinBps: overrides.confidenceMinBps ?? 0,
    allowSingleAuthoritativeProvider: overrides.allowSingleAuthoritativeProvider ?? false,
    requireHybridSignature: overrides.requireHybridSignature ?? false,
    minValue: overrides.minValue ?? 0n,
    maxValue: overrides.maxValue ?? 1_000_000n,
    requireGeography: overrides.requireGeography ?? true,
    activationHeight: overrides.activationHeight ?? 1,
    status: overrides.status ?? 'ACTIVE',
  });
}

export function developmentComputeFeed(): OracleFeedDefinition {
  return developmentEnergyFeed({
    feedId: 'feed_compute_usage_sim',
    factType: 'COMPUTE_USAGE',
    measurementUnit: 'gpu_s',
    subjectSchema: 'compute.resource.v1',
    maxObservationSpread: 200n,
  });
}

export { deriveOracleKey, defaultOracleSuiteId };
