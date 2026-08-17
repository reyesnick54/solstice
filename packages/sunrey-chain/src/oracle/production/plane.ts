import { secretRef, InMemorySecretProvider } from '../../../../security/src/secrets.ts';
import { defaultOracleSuiteId } from '../crypto.ts';
import { OracleEngine, developmentEnergyFeed, developmentProvider } from '../engine.ts';
import type { OracleFeedDefinition, OracleProviderRecord, VerifiedEconomicFact } from '../types.ts';
import { createCollectorIdentity } from './credentials.ts';
import { publicFeedMetadata } from './explorer.ts';
import { OracleHealthMonitor } from './health.ts';
import { OracleIncidentControl } from './incident.ts';
import {
  OracleOnboardingRegistry,
  attachOnboardingEvidence,
  createOnboardingDraft,
  emptyOnboardingEvidence,
  transitionOnboarding,
} from './onboarding.ts';
import { scoreQuality } from './quality.ts';
import { productionOracleReadiness } from './readiness.ts';
import { SoftwareDevelopmentSigner } from './signing.ts';
import { ENERGY_FIXTURE, LocalProviderSimulator } from './simulator.ts';
import { EconomicDataSourceRegistry } from './sources.ts';
import type {
  EconomicDataSource,
  OracleProviderOnboardingRecord,
  ProductionFeedConfiguration,
  PublicOracleFeedMetadata,
} from './types.ts';

export type ProductionOraclePlane = {
  readonly engines: readonly OracleEngine[];
  readonly onboarding: OracleOnboardingRegistry;
  readonly sources: EconomicDataSourceRegistry;
  readonly incidents: OracleIncidentControl;
  readonly health: OracleHealthMonitor;
  readonly secrets: InMemorySecretProvider;
  readonly feed: ProductionFeedConfiguration;
  readonly providers: readonly OracleProviderOnboardingRecord[];
};

export function developmentProductionFeed(feedId = 'feed_energy_production_sim'): ProductionFeedConfiguration {
  return Object.freeze({
    schemaVersion: 1,
    feedId,
    schema: Object.freeze({
      schemaVersion: 1,
      schemaId: 'energy.resource.v1',
      version: 1,
      factType: 'ENERGY_PRODUCTION' as const,
      requiredFields: ['identifier', 'numericValue', 'unit', 'sourceTimestampUnix'],
      unit: 'MWh' as const,
      quantityScale: 0,
      identifierPattern: '^[A-Za-z0-9_.:-]+$',
      maxRecordBytes: 2_048,
      maxArrayLength: 8,
      allowFloat: false,
      breakingChangeCreatesNewVersion: true,
    }),
    factType: 'ENERGY_PRODUCTION',
    measurementUnit: 'MWh',
    quantityScale: 0,
    aggregationPolicy: 'MEDIAN',
    minimumProviders: 3,
    minimumIndependentControllers: 3,
    maximumAgeSeconds: 3_600,
    maxObservationSpread: 50n,
    minimumQualityBps: 6_000,
    productionEligible: true,
    version: 1,
  });
}

export function createProductionPlane(nowUnix = 1_700_000_000n): ProductionOraclePlane {
  const engines = Array.from({ length: 7 }, () =>
    new OracleEngine({
      networkId: 'net_sunrey_simulation',
      chainId: 'chn_sunrey_simulation',
      clock: { nowUnix: () => nowUnix },
    }),
  );
  const onboarding = new OracleOnboardingRegistry();
  const sources = new EconomicDataSourceRegistry();
  const secrets = new InMemorySecretProvider('simulation');
  const labels = ['energy-a', 'energy-b', 'energy-c'] as const;
  const types = ['INSTITUTIONAL_DATA_PROVIDER', 'REGULATED_PROVIDER', 'PUBLIC_DATA_PROVIDER'] as const;
  const providers: OracleProviderOnboardingRecord[] = [];
  const feed = developmentProductionFeed();
  const engineFeed: OracleFeedDefinition = developmentEnergyFeed({ feedId: feed.feedId });

  for (let i = 0; i < labels.length; i += 1) {
    const label = labels[i]!;
    const signer = SoftwareDevelopmentSigner.fromLabel(label, defaultOracleSuiteId());
    if (!signer.ok) {
      throw new Error(signer.error.detail);
    }
    const providerId = `oracle_${label}`;
    const sourceId = `src_${label}`;
    secrets.put(`oracle/${sourceId}`, `sim-token-${label}`);
    const credential = secretRef('simulation', `oracle/${sourceId}`);
    let record = createOnboardingDraft({
      providerId,
      legalEntityReference: `legal.${label}`,
      controllerReference: `controller_${label}`,
      dataCategories: ['energy'],
      feeds: [feed.feedId],
      authenticationMethod: 'FILE_FIXTURE_TEST_ONLY',
      signingKey: {
        schemaVersion: 1,
        keyId: `key_${label}`,
        keyVersion: 1,
        publicKeyHex: signer.value.publicKey().publicKeyHex,
        cryptoSuite: defaultOracleSuiteId(),
        signerKind: 'SOFTWARE_DEVELOPMENT',
        rotatedFromKeyId: null,
        active: true,
      },
      cryptoSuite: defaultOracleSuiteId(),
      infrastructureRegion: i === 0 ? 'sim-east' : i === 1 ? 'sim-west' : 'sim-north',
      sourceRelationships: [
        {
          schemaVersion: 1,
          sourceId,
          controllerId: `controller_${label}`,
          upstreamOrganizationId: `org_${label}`,
          infrastructureRegion: i === 0 ? 'sim-east' : i === 1 ? 'sim-west' : 'sim-north',
          sharedControlGroup: null,
        },
      ],
      onboardingEvidence: emptyOnboardingEvidence(),
      securityReviewStatus: 'NOT_REVIEWED',
      commercialAgreementEvidenceReference: null,
    });
    if (!record.ok) {
      throw new Error(record.error.detail);
    }
    record = { ok: true, value: attachOnboardingEvidence(record.value, {
      technicalValidationRef: `tech.${label}`,
      securityReviewRef: `sec.${label}`,
      securityReviewStatus: 'REVIEWED_WITH_EVIDENCE',
      commercialAgreementRef: `agreement.${label}`,
      commercialAgreementState: 'CONFIRMED',
      dataLicenseRef: `license.${label}`,
      jurisdictionReviewRef: `jur.${label}`,
      usageRightsRef: `rights.${label}`,
    }) };
    for (const next of ['TECHNICALLY_VALIDATED', 'TESTNET_ACTIVE', 'PRODUCTION_CANDIDATE'] as const) {
      const moved = transitionOnboarding(record.value, next);
      if (!moved.ok) {
        throw new Error(moved.error.detail);
      }
      record = moved;
    }
    onboarding.put(record.value);
    providers.push(record.value);
    const source: EconomicDataSource = Object.freeze({
      schemaVersion: 1,
      sourceId,
      version: 1,
      providerId,
      category: 'energy',
      factType: 'ENERGY_PRODUCTION',
      feedId: feed.feedId,
      unit: 'MWh',
      schemaId: ENERGY_FIXTURE.schemaId,
      sourceSchemaVersion: 1,
      normalizationVersion: 'oracle.normalize.v1',
      authenticationMethod: 'FILE_FIXTURE_TEST_ONLY',
      credentialRef: credential,
      controllerId: `controller_${label}`,
      upstreamOrganizationId: `org_${label}`,
      infrastructureRegion: record.value.infrastructureRegion,
      retired: false,
    });
    const registered = sources.register(source);
    if (!registered.ok) {
      throw new Error(registered.error.detail);
    }
    const chainRecord: OracleProviderRecord = developmentProvider(
      providerId,
      types[i]!,
      signer.value.publicKey().publicKeyHex,
      ['ENERGY_PRODUCTION'],
    );
    for (const engine of engines) {
      const put = engine.registerProvider(chainRecord, signer.value.publicKey());
      if (!put.ok) {
        throw new Error(put.error.detail);
      }
      if (i === 0) {
        const feedPut = engine.registerFeed(engineFeed);
        if (!feedPut.ok) {
          throw new Error(feedPut.error.detail);
        }
      }
    }
  }

  return Object.freeze({
    engines,
    onboarding,
    sources,
    incidents: new OracleIncidentControl(onboarding),
    health: new OracleHealthMonitor(),
    secrets,
    feed,
    providers,
  });
}

export function planePublicFeeds(
  plane: ProductionOraclePlane,
  fact: VerifiedEconomicFact | undefined,
  nowUnix: bigint,
): readonly PublicOracleFeedMetadata[] {
  return [
    publicFeedMetadata({
      feed: plane.feed,
      providerCount: plane.providers.length,
      fact,
      nowUnix,
      qualityClass: 'PRODUCTION_CANDIDATE',
    }),
  ];
}

export function planeQuality(sourceId: string) {
  return scoreQuality({
    sourceId,
    freshnessBps: 9_000,
    availabilityBps: 9_500,
    historicalConflictRateBps: 200,
    schemaValidityBps: 10_000,
    sourceIndependenceBps: 10_000,
    attestationLevelBps: 8_000,
    qualityClass: 'PRODUCTION_CANDIDATE',
  });
}

export function planeReadiness() {
  return productionOracleReadiness();
}

export function collectorIdentityFor(plane: ProductionOraclePlane, sourceId: string, nowUnix: bigint) {
  const source = plane.sources.get(sourceId);
  if (!source || !source.credentialRef) {
    throw new Error(`source ${sourceId} is not configured`);
  }
  const identity = createCollectorIdentity({
    collectorId: `collector_${source.providerId}`,
    assignedSourceIds: [sourceId],
    credentialRefs: { [sourceId]: source.credentialRef },
    expiresAtUnix: nowUnix + 86_400n,
  });
  if (!identity.ok) {
    throw new Error(identity.error.detail);
  }
  return identity.value;
}

export { LocalProviderSimulator };
