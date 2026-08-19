/**
 * Production-candidate OracleCollector.
 *
 * Retrieves an external source off-chain, authenticates, validates,
 * normalizes, signs, and submits to the existing OracleEngine.
 * Consensus execution never calls this service.
 */

import { err, ok, type Result } from '../../../../domain/src/result.ts';
import type { SecretProvider } from '../../../../security/src/secrets.ts';
import { OracleEngine } from '../engine.ts';
import type { OracleObservation, VerifiedEconomicFact } from '../types.ts';
import type { OracleSourceAdapter } from './adapters.ts';
import { OracleOnboardingRegistry } from './onboarding.ts';
import { normalizeAgainstCanonicalCatalog, normalizeExternalInteger } from './normalize.ts';
import { recordProvenance, provenanceCommitment } from './provenance.ts';
import { validateExternalRecord } from './schema.ts';
import type { OracleSigner } from './signing.ts';
import { EconomicDataSourceRegistry } from './sources.ts';
import type { ProductiveCategory } from '../../productive/types.ts';
import type {
  CanonicalCollectedObservation,
  DataSourceCategory,
  OracleWorkloadIdentity,
  ProductionFeedConfiguration,
  ProductionOracleRejection,
} from './types.ts';
import { COLLECTOR_VERSION, NORMALIZATION_VERSION } from './types.ts';

export type CollectorRunResult = {
  readonly observation: OracleObservation;
  readonly canonical: CanonicalCollectedObservation;
  readonly submitted: true;
  readonly finalized: VerifiedEconomicFact | null;
  readonly collectorVersion: typeof COLLECTOR_VERSION;
};

export type OracleSubmissionPort = {
  submit(observation: OracleObservation): Result<OracleObservation, ProductionOracleRejection>;
};

export function engineSubmissionPort(engine: OracleEngine): OracleSubmissionPort {
  return {
    submit(observation) {
      const result = engine.submitObservation(observation);
      if (!result.ok) {
        return err({ code: 'FACT_NOT_VERIFIED', detail: result.error.detail });
      }
      return ok(result.value);
    },
  };
}

export class OracleCollector {
  private readonly onboarding: OracleOnboardingRegistry;
  private readonly sources: EconomicDataSourceRegistry;
  private readonly adapter: OracleSourceAdapter;
  private readonly signer: OracleSigner;
  private readonly secrets: SecretProvider;
  private readonly port: OracleSubmissionPort;

  constructor(
    onboarding: OracleOnboardingRegistry,
    sources: EconomicDataSourceRegistry,
    adapter: OracleSourceAdapter,
    signer: OracleSigner,
    secrets: SecretProvider,
    port: OracleSubmissionPort,
  ) {
    this.onboarding = onboarding;
    this.sources = sources;
    this.adapter = adapter;
    this.signer = signer;
    this.secrets = secrets;
    this.port = port;
  }

  run(input: {
    readonly identity: OracleWorkloadIdentity;
    readonly sourceId: string;
    readonly feed: ProductionFeedConfiguration;
    readonly subject: string;
    readonly sequence: bigint;
    readonly nowUnix: bigint;
    readonly networkId: string;
    readonly chainId: string;
  }): Result<CollectorRunResult, ProductionOracleRejection> {
    const providerGate = this.onboarding.eligibleForObservation(input.identity.collectorId.replace('collector_', ''));
    const source = this.sources.get(input.sourceId);
    if (!source) {
      return err({ code: 'PROVIDER_NOT_ONBOARDED', detail: input.sourceId });
    }
    const onboarded = this.onboarding.eligibleForObservation(source.providerId);
    if (!onboarded.ok) {
      return onboarded;
    }
    void providerGate;
    const fetched = this.adapter.retrieve(
      { source, identity: input.identity, nowUnix: input.nowUnix },
      this.secrets,
    );
    if (!fetched.ok) {
      return fetched;
    }
    const validated = validateExternalRecord(input.feed.schema, fetched.value);
    if (!validated.ok) {
      return validated;
    }
    const normalized = normalizeExternalInteger({
      sourceValue: validated.value.numericValue,
      sourceUnit: input.feed.measurementUnit,
      targetUnit: input.feed.measurementUnit,
      targetScale: input.feed.quantityScale,
    });
    if (!normalized.ok) {
      return normalized;
    }
    const provenance = recordProvenance({
      providerId: source.providerId,
      sourceId: source.sourceId,
      sourceObservationId: `${source.sourceId}:${validated.value.sourceTimestampUnix}:${input.sequence.toString()}`,
      collectionTimestampUnix: input.nowUnix,
      sourceTimestampUnix: BigInt(validated.value.sourceTimestampUnix),
      schemaVersionRecord: validated.value.schemaVersion,
      unit: input.feed.measurementUnit,
      normalizationVersion: NORMALIZATION_VERSION,
      credentialRefHref: source.credentialRef?.href ?? null,
      authMethod: source.authenticationMethod,
      payload: validated.value,
    });
    const unsigned = {
      schemaVersion: 1 as const,
      oracleId: source.providerId,
      feedId: input.feed.feedId,
      subject: input.subject,
      value: normalized.value,
      measurementStartUnix: input.nowUnix,
      measurementEndUnix: input.nowUnix + 60n,
      observationTimeUnix: input.nowUnix + 30n,
      validUntilUnix: input.nowUnix + BigInt(input.feed.maximumAgeSeconds),
      geography: Object.freeze({
        schemaVersion: 1 as const,
        jurisdiction: 'SIM',
        region: source.infrastructureRegion,
        locality: 'lab',
      }),
      sourceReferenceCommitment: provenanceCommitment(provenance),
      methodologyReference: `method.${source.sourceId}.${NORMALIZATION_VERSION}`,
      confidence: Object.freeze({
        schemaVersion: 1 as const,
        scoreBps: 9_000,
        sampleCount: 1,
        notesRef: COLLECTOR_VERSION,
      }),
      sequence: input.sequence,
      networkId: input.networkId,
      chainId: input.chainId,
      cryptoSuite: onboarded.value.cryptoSuite,
      publicKeyHex: this.signer.publicKey().publicKeyHex,
      deviceProvenance: null,
      weight: 1n,
    };
    const signed = this.signer.sign(unsigned, false);
    if (!signed.ok) {
      return signed;
    }
    const submitted = this.port.submit(signed.value);
    if (!submitted.ok) {
      return submitted;
    }
    const catalog = normalizeAgainstCanonicalCatalog({
      sourceValue: validated.value.numericValue,
      sourceUnit: input.feed.measurementUnit,
      productiveCategory: productiveCategoryForSource(source.category),
      factType: source.factType,
      measurementStart: input.nowUnix,
      measurementEnd: input.nowUnix + 60n,
    });
    const canonical: CanonicalCollectedObservation = Object.freeze({
      schemaVersion: 1,
      observationDraftId: signed.value.observationId,
      providerId: source.providerId,
      sourceId: source.sourceId,
      feedId: input.feed.feedId,
      subject: input.subject,
      value: normalized.value,
      sourceValue: normalized.value,
      ...(catalog.ok ? { canonicalMeasurement: catalog.value.measurement } : {}),
      provenance,
    });
    return ok(
      Object.freeze({
        observation: submitted.value,
        canonical,
        submitted: true as const,
        finalized: null,
        collectorVersion: COLLECTOR_VERSION,
      }),
    );
  }
}

function productiveCategoryForSource(category: DataSourceCategory): ProductiveCategory {
  switch (category) {
    case 'energy':
      return 'ENERGY';
    case 'food_agriculture':
      return 'FOOD_AGRICULTURE';
    case 'water':
      return 'WATER';
    case 'compute':
      return 'COMPUTE';
    case 'ai_usage':
    case 'ai_compute':
      return 'AI_COMPUTE';
    case 'manufacturing':
      return 'MANUFACTURING';
    case 'real_estate_use':
      return 'REAL_ESTATE_USE';
    case 'storage':
      return 'STORAGE';
    case 'logistics':
      return 'LOGISTICS_TRANSPORTATION';
    case 'bandwidth':
      return 'BANDWIDTH_COMMUNICATIONS';
    case 'resources':
    case 'minerals_resources':
      return 'MINERALS_RAW_MATERIALS';
    case 'service_delivery':
    case 'services':
      return 'SERVICES';
    case 'infrastructure':
      return 'INFRASTRUCTURE';
    case 'goods':
      return 'GOODS';
    case 'automated_machine_output':
      return 'AUTOMATED_MACHINE_OUTPUT';
    default:
      return 'ENERGY';
  }
}
