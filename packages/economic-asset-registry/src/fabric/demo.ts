import { asUtcInstant } from '../../../domain/src/time.ts';
import { FrozenClock } from '../../../config/src/clock.ts';
import { HumanContributionRegistry } from '../../../human-economic-contribution/src/registry.ts';
import { fixtureContribution } from '../../../human-economic-contribution/src/fixtures.ts';
import { DEFAULT_VERIFICATION_POLICY_VERSION } from '../../../human-economic-contribution/src/fingerprint.ts';
import { evidenceBundleFromRecord } from '../../../human-economic-contribution/src/verification/evidence.ts';
import { createHumanContributionEconomicAssetAdapter } from '../../../human-economic-contribution/src/economic-asset-adapter.ts';
import { HumanInformationNetworkEngine } from '../../../information-market/src/network/engine.ts';
import { createHinEconomicAssetAdapter } from '../../../information-market/src/network/economic-asset-adapter.ts';
import { createOracleEconomicAssetAdapter } from '../../../sunrey-chain/src/oracle/economic-asset-adapter.ts';
import { createOnboardingDraft, emptyOnboardingEvidence } from '../../../sunrey-chain/src/oracle/production/onboarding.ts';
import { quantity } from '../../../sunrey-chain/src/oracle/units.ts';
import { createProductiveEconomicAssetAdapter } from '../../../sunrey-chain/src/productive/economic-asset-adapter.ts';
import { fixtureClaim, fixtureObject } from '../../../sunrey-chain/src/productive/fixtures.ts';
import {
  FABRIC_AUTHORITY_BOUNDARY,
  FABRIC_PRIVACY_BOUNDARY,
  REGISTRY_IS_SOURCE_OF_TRUTH,
  SOURCE_OF_TRUTH_BOUNDARY,
} from '../source-of-truth.ts';
import { EconomicAssetRegistry } from '../registry.ts';
import type { EconomicAssetDescriptor } from '../types.ts';

const NOW = asUtcInstant('2026-08-19T10:34:00.000Z');
const EXPIRES = asUtcInstant('2026-09-19T10:34:00.000Z');

function unwrap<T>(result: { ok: true; value: T } | { ok: false; error: { code?: string; message?: string; detail?: string } }): T {
  if (!result.ok) {
    throw new Error(`${result.error.code ?? 'ERR'}: ${result.error.message ?? result.error.detail ?? 'failed'}`);
  }
  return result.value;
}

function lineageOf(descriptor: EconomicAssetDescriptor): string {
  return descriptor.lineage.map((edge) => `${edge.kind}->${edge.toAssetId}`).join(' ');
}

export function runEconomicAssetFabricDemo(): {
  readonly REGISTRY_IS_SOURCE_OF_TRUTH: false;
  readonly RAW_PERSONAL_DATA: false;
  readonly RAW_INDUSTRIAL_PAYLOAD: false;
  readonly CREDENTIALS_EXPOSED: false;
  readonly AUTOMATIC_ISSUANCE: false;
} {
  const registry = new EconomicAssetRegistry();
  const hin = createHinEconomicAssetAdapter(registry);
  const hec = createHumanContributionEconomicAssetAdapter(registry);
  const oracle = createOracleEconomicAssetAdapter(registry);
  const productive = createProductiveEconomicAssetAdapter(registry);

  const engine = new HumanInformationNetworkEngine({ clock: new FrozenClock(NOW) });
  const subject = unwrap(engine.registerSubject({ internalRef: 'synthetic-ada' }));
  const hinDescriptor = unwrap(
    engine.registerDescriptor({
      subjectId: subject.subjectId,
      category: 'FINANCIAL_ACTIVITY_METADATA',
      schema: 'activity-metadata-v1',
      sourceClass: 'PERSONAL_DATA_VAULT',
      freshness: 'P30D',
      sensitivityClass: 'SENSITIVE',
      permittedComputationClasses: ['CLEAN_ROOM_COMPUTATION'],
    }),
  );
  unwrap(
    engine.registerRequester({
      requesterId: 'req_lab',
      organization: 'Synthetic Lab',
      requesterClass: 'RESEARCH_INSTITUTION',
      jurisdiction: 'GB',
    }),
  );
  const computation = unwrap(
    engine.registerApprovedComputation({
      codeVersion: 'agg-v1',
      queryDefinition: 'AGGREGATE_MEAN',
      artifactDigest: 'sha256:agg',
      allowedOutputClasses: ['AGGREGATE_STATISTIC'],
    }),
  );
  const request = unwrap(
    engine.submitInformationRequest({
      requesterId: 'req_lab',
      requestedRight: 'ONE_TIME_COMPUTATION',
      purpose: 'AGGREGATED_RESEARCH',
      computationId: computation.computationId,
      duration: 'P30D',
      compensationAsset: 'APPROVED_FIAT',
      compensationMinor: 1000n,
      jurisdiction: 'GB',
    }),
  );
  const approved = unwrap(
    engine.approveInformationConsent({
      requestId: request.requestId,
      subjectId: subject.subjectId,
      descriptorId: hinDescriptor.descriptorId,
      processingClass: 'CLEAN_ROOM_COMPUTATION',
      outputClass: 'AGGREGATE_STATISTIC',
      expiresAt: EXPIRES,
    }),
  );
  const usage = unwrap(
    engine.recordUsage({
      rightId: approved.right.rightId,
      requesterId: 'req_lab',
      computationId: computation.computationId,
      outputClass: 'AGGREGATE_STATISTIC',
      settlementRef: null,
    }),
  );

  const information = unwrap(
    hin.projectInformationAsset({
      descriptor: hinDescriptor,
      subject,
      consent: approved.grant,
      at: NOW,
    }),
  );
  const right = unwrap(
    hin.projectInformationRight({
      right: approved.right,
      descriptor: hinDescriptor,
      subject,
      consent: approved.grant,
      usage,
      informationAssetId: information.assetId,
      at: NOW,
    }),
  );
  const contributionRegistry = new HumanContributionRegistry();
  const submitted = unwrap(contributionRegistry.submit(fixtureContribution('INFORMATION_RIGHT_CONTRIBUTION', 'fabric-demo')));
  const verified = unwrap(
    contributionRegistry.verify({
      contributionId: submitted.contributionId,
      verificationTimestamp: NOW,
      verificationPolicyVersion: DEFAULT_VERIFICATION_POLICY_VERSION,
    }),
  );
  const evidence = unwrap(hec.projectEvidence(evidenceBundleFromRecord(verified), NOW));
  unwrap(hec.linkRightToEvidence(right.assetId, evidence.assetId, NOW));
  const record = unwrap(hec.projectRecord(verified, NOW, evidence.assetId));

  const onboarding = unwrap(
    createOnboardingDraft({
      providerId: 'prov.energy.demo',
      legalEntityReference: 'org.energy.demo',
      controllerReference: 'ctl.energy.demo',
      dataCategories: ['energy'],
      feeds: ['feed.energy.demo'],
      authenticationMethod: 'FILE_FIXTURE_TEST_ONLY',
      signingKey: {
        schemaVersion: 1,
        keyId: 'key.energy.demo',
        keyVersion: 1,
        publicKeyHex: 'pub-demo',
        cryptoSuite: 'ed25519',
        signerKind: 'SOFTWARE_DEVELOPMENT',
        rotatedFromKeyId: null,
        active: true,
      },
      cryptoSuite: 'ed25519',
      infrastructureRegion: 'REGION_A',
      sourceRelationships: [
        {
          schemaVersion: 1,
          sourceId: 'src.energy.demo',
          controllerId: 'ctl.energy.demo',
          upstreamOrganizationId: 'org.energy.demo',
          infrastructureRegion: 'REGION_A',
          sharedControlGroup: null,
        },
      ],
      onboardingEvidence: {
        ...emptyOnboardingEvidence(),
        dataLicenseRef: 'license.energy.demo',
        usageRightsRef: 'usage.energy.demo',
      },
      securityReviewStatus: 'ENGINEERING_REVIEWED',
      commercialAgreementEvidenceReference: null,
      status: 'TESTNET_ACTIVE',
    }),
  );
  const source = {
    schemaVersion: 1 as const,
    sourceId: 'src.energy.demo',
    version: 1,
    providerId: 'prov.energy.demo',
    category: 'energy' as const,
    factType: 'ENERGY_PRODUCTION' as const,
    feedId: 'feed.energy.demo',
    unit: 'MWh' as const,
    schemaId: 'energy.resource.v1',
    sourceSchemaVersion: 1,
    normalizationVersion: 'oracle.normalize.v1',
    authenticationMethod: 'FILE_FIXTURE_TEST_ONLY' as const,
    credentialRef: null,
    controllerId: 'ctl.energy.demo',
    upstreamOrganizationId: 'org.energy.demo',
    infrastructureRegion: 'REGION_A',
    retired: false,
  };
  const sourceAsset = unwrap(oracle.projectSource(source, onboarding, NOW));
  const observation = unwrap(
    oracle.projectObservationSet({
      observations: [
        {
          schemaVersion: 1,
          observationId: 'obs.energy.demo',
          oracleId: source.providerId,
          feedId: source.feedId,
          subject: 'plant_demo_1',
          value: unwrap(quantity(100n, 0, 'MWh')),
          measurementStartUnix: 1_700_000_000n,
          measurementEndUnix: 1_700_003_600n,
          observationTimeUnix: 1_700_001_800n,
          validUntilUnix: 1_700_007_200n,
          geography: { schemaVersion: 1, jurisdiction: 'US', region: 'REGION_A', locality: 'demo' },
          sourceReferenceCommitment: 'commit.obs.energy.demo',
          methodologyReference: 'method.energy.v1',
          confidence: { schemaVersion: 1, scoreBps: 9000, sampleCount: 1, notesRef: 'demo' },
          sequence: 1n,
          networkId: 'net_sunrey_simulation',
          chainId: 'chn_sunrey_simulation',
          cryptoSuite: 'ed25519',
          signatureHex: 'sig-demo',
          publicKeyHex: 'pub-demo',
          deviceProvenance: null,
          weight: 1n,
        },
      ],
      source,
      sourceAssetId: sourceAsset.assetId,
      at: NOW,
    }),
  );
  const fact = unwrap(
    oracle.projectVerifiedFact({
      fact: {
        schemaVersion: 1,
        factId: 'fact.energy.demo',
        feedId: source.feedId,
        subject: 'plant_demo_1',
        aggregatedValue: unwrap(quantity(100n, 0, 'MWh')),
        sourceObservationIds: ['obs.energy.demo'],
        aggregationPolicy: 'MEDIAN',
        observationWindow: { startUnix: 1_700_000_000n, endUnix: 1_700_003_600n },
        validUntilUnix: 1_700_007_200n,
        qualityStatus: 'VERIFIED',
        finalizedHeight: 42,
        conflictReason: null,
      },
      observationAssetId: observation.assetId,
      at: NOW,
    }),
  );
  const object = fixtureObject({ objectId: 'obj.solar.demo', category: 'ENERGY', unitSchema: 'kWh' });
  const objectAsset = unwrap(productive.projectObject(object, NOW));
  const claim = fixtureClaim({
    claimId: 'claim.solar.demo',
    objectId: object.objectId,
    claimType: 'OUTPUT',
    category: 'ENERGY',
    quantity: 100n,
    unit: 'kWh',
  });
  const claimAsset = unwrap(
    productive.projectClaim({
      claim,
      objectAssetId: objectAsset.assetId,
      factAssetId: fact.assetId,
      at: NOW,
    }),
  );
  const contribution = unwrap(
    productive.projectContribution({
      contribution: {
        schemaVersion: 1,
        contributionId: 'contrib.energy.demo',
        claimId: claim.claimId,
        objectId: object.objectId,
        claimType: 'OUTPUT',
        category: 'ENERGY',
        quantity: 100n,
        unit: 'kWh',
        normalizedQuantity: 100n,
        baseUnitId: 'kWh',
        measurementPeriod: claim.measurementPeriod,
        geography: object.geography,
        oracleFactIds: ['fact.energy.demo'],
        rightsReferences: [object.rightsReference],
        controller: object.controller,
        fingerprint: 'fp.energy.demo',
        fingerprintVersion: 'PRODUCTIVE_FINGERPRINT_V1',
        upstreamContributionIds: [],
        downstreamContributionIds: [],
        status: 'ELIGIBLE',
        qualityFactor: 1_000_000n,
      },
      claimAssetId: claimAsset.assetId,
      at: NOW,
    }),
  );

  console.log('SunRey Economic Asset Registry Integration Fabric — Chunk 115');
  console.log(FABRIC_DIRECTION_LINE);
  console.log('');
  console.log('HUMAN lineage');
  console.log(`  INFORMATION_ASSET ${information.assetId} ${lineageOf(information)}`);
  console.log(`  INFORMATION_RIGHT ${right.assetId} ${lineageOf(right)}`);
  console.log(`  HUMAN_CONTRIBUTION_EVIDENCE ${evidence.assetId} ${lineageOf(evidence)}`);
  console.log(`  HUMAN_CONTRIBUTION_RECORD ${record.assetId} ${lineageOf(record)}`);
  console.log('');
  console.log('PRODUCTIVE lineage');
  console.log(`  ORACLE_SOURCE_DATASET ${sourceAsset.assetId} ${lineageOf(sourceAsset)}`);
  console.log(`  ORACLE_OBSERVATION_SET ${observation.assetId} ${lineageOf(observation)}`);
  console.log(`  VERIFIED_ECONOMIC_FACT ${fact.assetId} ${lineageOf(fact)}`);
  console.log(`  PRODUCTIVE_ECONOMIC_OBJECT ${objectAsset.assetId} ${lineageOf(objectAsset)}`);
  console.log(`  PRODUCTIVE_CLAIM ${claimAsset.assetId} ${lineageOf(claimAsset)}`);
  console.log(`  VERIFIED_PRODUCTIVE_CONTRIBUTION ${contribution.assetId} ${lineageOf(contribution)}`);
  console.log('');
  console.log(`REGISTRY_IS_SOURCE_OF_TRUTH=${String(REGISTRY_IS_SOURCE_OF_TRUTH)}`);
  console.log(`RAW_PERSONAL_DATA=${String(FABRIC_PRIVACY_BOUNDARY.rawPersonalData)}`);
  console.log(`RAW_INDUSTRIAL_PAYLOAD=${String(FABRIC_PRIVACY_BOUNDARY.industrialRawPayloads)}`);
  console.log(`CREDENTIALS_EXPOSED=${String(FABRIC_PRIVACY_BOUNDARY.credentialsExposed)}`);
  console.log(`AUTOMATIC_ISSUANCE=${String(FABRIC_AUTHORITY_BOUNDARY.automaticIssuance)}`);
  console.log(`consentStatusAuthoritative=${String(SOURCE_OF_TRUTH_BOUNDARY.consentStatus)}`);
  console.log(`nativeSupplyOwnedByRegistry=${String(SOURCE_OF_TRUTH_BOUNDARY.nativeAssetSupply)}`);

  return {
    REGISTRY_IS_SOURCE_OF_TRUTH: false,
    RAW_PERSONAL_DATA: false,
    RAW_INDUSTRIAL_PAYLOAD: false,
    CREDENTIALS_EXPOSED: false,
    AUTOMATIC_ISSUANCE: false,
  };
}

const FABRIC_DIRECTION_LINE =
  'Canonical Source Domain → privacy-safe metadata adapter → EconomicAssetRegistryPort → master descriptor';

runEconomicAssetFabricDemo();
