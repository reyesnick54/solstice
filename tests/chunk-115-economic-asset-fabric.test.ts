import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  EconomicAssetRegistry,
  FABRIC_AUTHORITY_BOUNDARY,
  FABRIC_PRIVACY_BOUNDARY,
  NATIVE_MONETARY_ASSET_CLASSES,
  REGISTRY_IS_SOURCE_OF_TRUTH,
  SOURCE_OF_TRUTH_BOUNDARY,
  type EconomicAssetDescriptor,
} from '../packages/economic-asset-registry/src/index.ts';
import { HumanContributionRegistry } from '../packages/human-economic-contribution/src/registry.ts';
import { fixtureContribution } from '../packages/human-economic-contribution/src/fixtures.ts';
import { DEFAULT_VERIFICATION_POLICY_VERSION } from '../packages/human-economic-contribution/src/fingerprint.ts';
import { evidenceBundleFromRecord } from '../packages/human-economic-contribution/src/verification/evidence.ts';
import { createHumanContributionEconomicAssetAdapter } from '../packages/human-economic-contribution/src/economic-asset-adapter.ts';
import { HumanInformationNetworkEngine } from '../packages/information-market/src/network/engine.ts';
import { createHinEconomicAssetAdapter } from '../packages/information-market/src/network/economic-asset-adapter.ts';
import { createOracleEconomicAssetAdapter } from '../packages/sunrey-chain/src/oracle/economic-asset-adapter.ts';
import { createOnboardingDraft, emptyOnboardingEvidence } from '../packages/sunrey-chain/src/oracle/production/onboarding.ts';
import type { EconomicDataSource, OracleProviderOnboardingRecord } from '../packages/sunrey-chain/src/oracle/production/types.ts';
import type { OracleObservation, VerifiedEconomicFact } from '../packages/sunrey-chain/src/oracle/types.ts';
import { quantity } from '../packages/sunrey-chain/src/oracle/units.ts';
import { createProductiveEconomicAssetAdapter } from '../packages/sunrey-chain/src/productive/economic-asset-adapter.ts';
import { fixtureClaim, fixtureObject } from '../packages/sunrey-chain/src/productive/fixtures.ts';
import type { VerifiedProductiveContribution } from '../packages/sunrey-chain/src/productive/verification.ts';

const NOW = asUtcInstant('2026-08-19T10:00:00.000Z');
const EXPIRES = asUtcInstant('2026-09-19T10:00:00.000Z');

function unwrap<T>(result: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: { readonly code?: string; readonly message?: string; readonly detail?: string } }): T {
  if (!result.ok) {
    throw new Error(`${result.error.code ?? 'ERR'}: ${result.error.message ?? result.error.detail ?? 'failed'}`);
  }
  return result.value;
}

function assertNoLeak(descriptor: EconomicAssetDescriptor): void {
  const serialized = JSON.stringify(descriptor, (_key, value) => (typeof value === 'bigint' ? value.toString() : value));
  assert.equal(descriptor.automaticValue, null);
  assert.equal(descriptor.automaticSunReyQuantity, null);
  assert.equal(descriptor.automaticMoonReyQuantity, null);
  assert.equal(descriptor.issuanceEligible, false);
  assert.match(serialized, /"containRawSensitiveData":false/);
  assert.equal(/legalName|fullName|"email"|ssn|passport|apiKey|clientSecret|privateKey|rawPdv|cleanRoomRow/i.test(serialized), false);
}

function provisionHin() {
  const engine = new HumanInformationNetworkEngine({ clock: new FrozenClock(NOW) });
  const subject = unwrap(engine.registerSubject({ internalRef: 'synthetic-ada' }));
  const descriptor = unwrap(
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
      allowedOutputClasses: ['AGGREGATE_STATISTIC', 'BOOLEAN_ATTESTATION'],
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
      descriptorId: descriptor.descriptorId,
      processingClass: 'CLEAN_ROOM_COMPUTATION',
      outputClass: 'AGGREGATE_STATISTIC',
      expiresAt: EXPIRES,
    }),
  );
  const receipt = unwrap(
    engine.recordUsage({
      rightId: approved.right.rightId,
      requesterId: 'req_lab',
      computationId: computation.computationId,
      outputClass: 'AGGREGATE_STATISTIC',
      settlementRef: null,
    }),
  );
  return { engine, subject, descriptor, approved, receipt };
}

function fixtureOnboarding(status: OracleProviderOnboardingRecord['status'] = 'TESTNET_ACTIVE'): OracleProviderOnboardingRecord {
  return unwrap(
    createOnboardingDraft({
      providerId: 'prov.energy.sim',
      legalEntityReference: 'org.energy.sim',
      controllerReference: 'ctl.energy.sim',
      dataCategories: ['energy'],
      feeds: ['feed.energy.sim'],
      authenticationMethod: 'FILE_FIXTURE_TEST_ONLY',
      signingKey: {
        schemaVersion: 1,
        keyId: 'key.energy.sim',
        keyVersion: 1,
        publicKeyHex: 'pub-sim-not-a-secret',
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
          sourceId: 'src.energy.sim',
          controllerId: 'ctl.energy.sim',
          upstreamOrganizationId: 'org.energy.sim',
          infrastructureRegion: 'REGION_A',
          sharedControlGroup: null,
        },
      ],
      onboardingEvidence: {
        ...emptyOnboardingEvidence(),
        dataLicenseRef: 'license.energy.sim',
        usageRightsRef: 'usage.energy.sim',
      },
      securityReviewStatus: 'ENGINEERING_REVIEWED',
      commercialAgreementEvidenceReference: null,
      status,
    }),
  );
}

function fixtureOracleSource(version = 1, retired = false): EconomicDataSource {
  return {
    schemaVersion: 1,
    sourceId: 'src.energy.sim',
    version,
    providerId: 'prov.energy.sim',
    category: 'energy',
    factType: 'ENERGY_PRODUCTION',
    feedId: 'feed.energy.sim',
    unit: 'MWh',
    schemaId: 'energy.resource.v1',
    sourceSchemaVersion: version,
    normalizationVersion: 'oracle.normalize.v1',
    authenticationMethod: 'FILE_FIXTURE_TEST_ONLY',
    credentialRef: null,
    controllerId: 'ctl.energy.sim',
    upstreamOrganizationId: 'org.energy.sim',
    infrastructureRegion: 'REGION_A',
    retired,
  };
}

function fixtureObservation(source: EconomicDataSource): OracleObservation {
  const value = unwrap(quantity(100n, 0, 'MWh'));
  return {
    schemaVersion: 1,
    observationId: 'obs.energy.1',
    oracleId: source.providerId,
    feedId: source.feedId,
    subject: 'plant_sim_1',
    value,
    measurementStartUnix: 1_700_000_000n,
    measurementEndUnix: 1_700_003_600n,
    observationTimeUnix: 1_700_001_800n,
    validUntilUnix: 1_700_007_200n,
    geography: { schemaVersion: 1, jurisdiction: 'US', region: 'REGION_A', locality: 'sim' },
    sourceReferenceCommitment: 'commit.obs.energy.1',
    methodologyReference: 'method.energy.v1',
    confidence: { schemaVersion: 1, scoreBps: 9000, sampleCount: 1, notesRef: 'sim' },
    sequence: 1n,
    networkId: 'net_sunrey_simulation',
    chainId: 'chn_sunrey_simulation',
    cryptoSuite: 'ed25519',
    signatureHex: 'sig-sim',
    publicKeyHex: 'pub-sim-not-a-secret',
    deviceProvenance: null,
    weight: 1n,
  };
}

function fixtureFact(): VerifiedEconomicFact {
  return {
    schemaVersion: 1,
    factId: 'fact.energy.1',
    feedId: 'feed.energy.sim',
    subject: 'plant_sim_1',
    aggregatedValue: unwrap(quantity(100n, 0, 'MWh')),
    sourceObservationIds: ['obs.energy.1'],
    aggregationPolicy: 'MEDIAN',
    observationWindow: { startUnix: 1_700_000_000n, endUnix: 1_700_003_600n },
    validUntilUnix: 1_700_007_200n,
    qualityStatus: 'VERIFIED',
    finalizedHeight: 42,
    conflictReason: null,
  };
}

function fixtureVerifiedContribution(claimId: string, objectId: string): VerifiedProductiveContribution {
  return {
    schemaVersion: 1,
    contributionId: 'contrib.energy.1',
    claimId,
    objectId,
    claimType: 'OUTPUT',
    category: 'ENERGY',
    quantity: 100n,
    unit: 'kWh',
    normalizedQuantity: 100n,
    baseUnitId: 'kWh',
    measurementPeriod: {
      validFromUnixSeconds: 1_799_000_000n,
      validUntilUnixSeconds: 1_800_000_000n,
      epoch: 1,
    },
    geography: { geographyId: 'geo.dev.sim', jurisdiction: 'SIMULATION' },
    oracleFactIds: ['fact.energy.1'],
    rightsReferences: [`right.${objectId}`],
    controller: `ctl.${objectId}`,
    fingerprint: 'fp.energy.1',
    fingerprintVersion: 'PRODUCTIVE_FINGERPRINT_V1',
    upstreamContributionIds: [],
    downstreamContributionIds: [],
    status: 'ELIGIBLE',
    qualityFactor: 1_000_000n,
  };
}

describe('CHUNK-115 cross-domain economic asset fabric', () => {
  it('1-4. projects HIN descriptors, rights, verified contributions, and valuation reference metadata', () => {
    const registry = new EconomicAssetRegistry();
    const hin = createHinEconomicAssetAdapter(registry);
    const hec = createHumanContributionEconomicAssetAdapter(registry);
    const world = provisionHin();
    const information = unwrap(
      hin.projectInformationAsset({
        descriptor: world.descriptor,
        subject: world.subject,
        consent: world.approved.grant,
        at: NOW,
      }),
    );
    assert.equal(information.assetClass, 'INFORMATION_ASSET');
    assert.equal(information.chainAnchor?.finalityState, 'UNANCHORED');
    assert.ok(information.consentRefs.length > 0);
    assert.ok(information.subjectRef);
    assertNoLeak(information);

    const right = unwrap(
      hin.projectInformationRight({
        right: world.approved.right,
        descriptor: world.descriptor,
        subject: world.subject,
        consent: world.approved.grant,
        usage: world.receipt,
        informationAssetId: information.assetId,
        at: NOW,
      }),
    );
    assert.equal(right.assetClass, 'INFORMATION_RIGHT');
    assert.equal(right.usageRestrictionRefs.length > 0, true);
    assert.equal(right.lineage.some((edge) => edge.kind === 'DERIVED_FROM' && edge.toAssetId === information.assetId), true);
    assertNoLeak(right);

    const contributionRegistry = new HumanContributionRegistry();
    const submitted = unwrap(contributionRegistry.submit(fixtureContribution('INFORMATION_RIGHT_CONTRIBUTION', 'fabric-hec')));
    const verified = unwrap(
      contributionRegistry.verify({
        contributionId: submitted.contributionId,
        verificationTimestamp: NOW,
        verificationPolicyVersion: DEFAULT_VERIFICATION_POLICY_VERSION,
      }),
    );
    const evidence = evidenceBundleFromRecord(verified);
    const evidenceAsset = unwrap(hec.projectEvidence(evidence, NOW));
    assert.equal(evidenceAsset.assetClass, 'HUMAN_CONTRIBUTION_EVIDENCE');
    unwrap(hec.linkRightToEvidence(right.assetId, evidenceAsset.assetId, NOW));
    const recordAsset = unwrap(hec.projectRecord(verified, NOW, evidenceAsset.assetId));
    assert.equal(recordAsset.assetClass, 'HUMAN_CONTRIBUTION_RECORD');
    assert.equal(recordAsset.automaticValue, null);
    assert.equal(recordAsset.lineage.some((edge) => edge.kind === 'VERIFIED_BY'), true);
    assertNoLeak(recordAsset);

    const valuationRef = {
      referenceId: 'hcref_fabric_valref',
      sourceClass: 'APPROVED_MARKET_REFERENCE',
      observedAt: NOW,
      effectiveAt: NOW,
      jurisdiction: 'GB',
      provenanceDigest: 'digest:fabric-valref',
      quality: 'APPROVED' as const,
      valuationMethod: 'ENGINEERING_SIMULATION_MEASUREMENT_SCALE',
    };
    const referenceAsset = unwrap(hec.projectValuationReference(valuationRef, NOW, recordAsset.assetId));
    assert.equal(referenceAsset.assetClass, 'ECONOMIC_REFERENCE_DATA');
    assert.equal(referenceAsset.automaticValue, null);
    assertNoLeak(referenceAsset);
  });

  it('5-10. projects oracle sources, observation sets, facts, and productive objects/claims/contributions', () => {
    const registry = new EconomicAssetRegistry();
    const oracle = createOracleEconomicAssetAdapter(registry);
    const productive = createProductiveEconomicAssetAdapter(registry);
    const source = fixtureOracleSource();
    const sourceAsset = unwrap(oracle.projectSource(source, fixtureOnboarding(), NOW));
    assert.equal(sourceAsset.assetClass, 'ORACLE_SOURCE_DATASET');
    assert.equal(JSON.stringify(sourceAsset).includes('apiKey'), false);
    assertNoLeak(sourceAsset);

    const observationAsset = unwrap(
      oracle.projectObservationSet({
        observations: [fixtureObservation(source)],
        source,
        sourceAssetId: sourceAsset.assetId,
        at: NOW,
      }),
    );
    assert.equal(observationAsset.assetClass, 'ORACLE_OBSERVATION_SET');
    assert.equal(observationAsset.lineage.some((edge) => edge.kind === 'DERIVED_FROM'), true);
    assertNoLeak(observationAsset);

    const factAsset = unwrap(
      oracle.projectVerifiedFact({
        fact: fixtureFact(),
        observationAssetId: observationAsset.assetId,
        at: NOW,
      }),
    );
    assert.equal(factAsset.assetClass, 'VERIFIED_ECONOMIC_FACT');
    assert.equal(factAsset.lineage.some((edge) => edge.kind === 'VERIFIED_BY'), true);
    assertNoLeak(factAsset);

    const object = fixtureObject({ objectId: 'obj.solar.fabric', category: 'ENERGY', unitSchema: 'kWh' });
    const objectAsset = unwrap(productive.projectObject(object, NOW));
    assert.equal(objectAsset.assetClass, 'PRODUCTIVE_ECONOMIC_OBJECT');
    const claim = fixtureClaim({
      claimId: 'claim.solar.fabric',
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
        factAssetId: factAsset.assetId,
        at: NOW,
      }),
    );
    assert.equal(claimAsset.assetClass, 'PRODUCTIVE_CLAIM');
    const contributionAsset = unwrap(
      productive.projectContribution({
        contribution: fixtureVerifiedContribution(claim.claimId, object.objectId),
        claimAssetId: claimAsset.assetId,
        at: NOW,
      }),
    );
    assert.equal(contributionAsset.assetClass, 'VERIFIED_PRODUCTIVE_CONTRIBUTION');
    assertNoLeak(contributionAsset);
  });

  it('11. records complete oracle → productive lineage', () => {
    const registry = new EconomicAssetRegistry();
    const oracle = createOracleEconomicAssetAdapter(registry);
    const productive = createProductiveEconomicAssetAdapter(registry);
    const source = fixtureOracleSource();
    const sourceAsset = unwrap(oracle.projectSource(source, fixtureOnboarding(), NOW));
    const observationAsset = unwrap(
      oracle.projectObservationSet({
        observations: [fixtureObservation(source)],
        source,
        sourceAssetId: sourceAsset.assetId,
        at: NOW,
      }),
    );
    const factAsset = unwrap(
      oracle.projectVerifiedFact({ fact: fixtureFact(), observationAssetId: observationAsset.assetId, at: NOW }),
    );
    const object = fixtureObject({ objectId: 'obj.lineage', category: 'ENERGY', unitSchema: 'kWh' });
    const objectAsset = unwrap(productive.projectObject(object, NOW));
    const claim = fixtureClaim({
      claimId: 'claim.lineage',
      objectId: object.objectId,
      claimType: 'OUTPUT',
      category: 'ENERGY',
      quantity: 40n,
      unit: 'kWh',
    });
    const claimAsset = unwrap(
      productive.projectClaim({ claim, objectAssetId: objectAsset.assetId, factAssetId: factAsset.assetId, at: NOW }),
    );
    const contributionAsset = unwrap(
      productive.projectContribution({
        contribution: fixtureVerifiedContribution(claim.claimId, object.objectId),
        claimAssetId: claimAsset.assetId,
        at: NOW,
      }),
    );
    const kinds = new Set(contributionAsset.lineage.map((edge) => edge.kind));
    assert.equal(kinds.has('CONTRIBUTED_TO'), true);
    assert.equal(claimAsset.lineage.some((edge) => edge.kind === 'VERIFIED_BY' && edge.toAssetId === factAsset.assetId), true);
    assert.equal(factAsset.lineage.some((edge) => edge.kind === 'AGGREGATED_FROM'), true);
    assert.equal(observationAsset.lineage.some((edge) => edge.kind === 'NORMALIZED_FROM'), true);
    assert.equal(observationAsset.lineage.some((edge) => edge.kind === 'DERIVED_FROM' && edge.toAssetId === sourceAsset.assetId), true);
  });

  it('12. records complete HIN → human-contribution lineage', () => {
    const registry = new EconomicAssetRegistry();
    const hin = createHinEconomicAssetAdapter(registry);
    const hec = createHumanContributionEconomicAssetAdapter(registry);
    const world = provisionHin();
    const information = unwrap(
      hin.projectInformationAsset({ descriptor: world.descriptor, subject: world.subject, consent: world.approved.grant, at: NOW }),
    );
    const right = unwrap(
      hin.projectInformationRight({
        right: world.approved.right,
        descriptor: world.descriptor,
        subject: world.subject,
        consent: world.approved.grant,
        usage: world.receipt,
        informationAssetId: information.assetId,
        at: NOW,
      }),
    );
    const contributionRegistry = new HumanContributionRegistry();
    const submitted = unwrap(contributionRegistry.submit(fixtureContribution('INFORMATION_RIGHT_CONTRIBUTION', 'lineage-hec')));
    const verified = unwrap(
      contributionRegistry.verify({
        contributionId: submitted.contributionId,
        verificationTimestamp: NOW,
        verificationPolicyVersion: DEFAULT_VERIFICATION_POLICY_VERSION,
      }),
    );
    const evidenceAsset = unwrap(hec.projectEvidence(evidenceBundleFromRecord(verified), NOW));
    const linkedEvidence = unwrap(hec.linkRightToEvidence(right.assetId, evidenceAsset.assetId, NOW));
    const recordAsset = unwrap(hec.projectRecord(verified, NOW, evidenceAsset.assetId));
    assert.equal(linkedEvidence.lineage.some((edge) => edge.kind === 'CONTRIBUTED_TO' && edge.toAssetId === right.assetId), true);
    assert.equal(recordAsset.lineage.some((edge) => edge.kind === 'VERIFIED_BY' && edge.toAssetId === evidenceAsset.assetId), true);
    assert.equal(right.lineage.some((edge) => edge.kind === 'DERIVED_FROM' && edge.toAssetId === information.assetId), true);
  });

  it('13. repeats the same projection without creating duplicates', () => {
    const registry = new EconomicAssetRegistry();
    const oracle = createOracleEconomicAssetAdapter(registry);
    const source = fixtureOracleSource();
    const first = unwrap(oracle.projectSource(source, fixtureOnboarding(), NOW));
    const second = unwrap(oracle.projectSource(source, fixtureOnboarding(), NOW));
    assert.equal(first.assetId, second.assetId);
    assert.equal(registry.queryDescriptors({ sourceRecordId: source.sourceId }).filter((row) => row.status !== 'SUPERSEDED').length, 1);
  });

  it('14-16. propagates supersession, correction, and suspended sources', () => {
    const registry = new EconomicAssetRegistry();
    const oracle = createOracleEconomicAssetAdapter(registry);
    const hec = createHumanContributionEconomicAssetAdapter(registry);
    const productive = createProductiveEconomicAssetAdapter(registry);
    const firstSource = unwrap(oracle.projectSource(fixtureOracleSource(1), fixtureOnboarding(), NOW));
    const nextSource = unwrap(oracle.projectSource(fixtureOracleSource(2), fixtureOnboarding(), NOW));
    assert.equal(registry.getDescriptor(firstSource.assetId)?.status, 'SUPERSEDED');
    assert.equal(nextSource.supersedes, firstSource.assetId);

    const contributionRegistry = new HumanContributionRegistry();
    const submitted = unwrap(contributionRegistry.submit(fixtureContribution('RESEARCH_PARTICIPATION', 'corr-hec')));
    const verified = unwrap(
      contributionRegistry.verify({
        contributionId: submitted.contributionId,
        verificationTimestamp: NOW,
        verificationPolicyVersion: DEFAULT_VERIFICATION_POLICY_VERSION,
      }),
    );
    const original = unwrap(hec.projectRecord(verified, NOW));
    const correctedRecord = unwrap(
      contributionRegistry.correct(verified.contributionId, {
        ...fixtureContribution('RESEARCH_PARTICIPATION', 'corr-hec-2'),
        createdAt: asUtcInstant('2026-08-19T11:00:00.000Z'),
      }),
    );
    const corrected = unwrap(hec.reflectCorrection(verified, correctedRecord, NOW));
    assert.equal(corrected.corrects, original.assetId);

    const suspended = unwrap(oracle.projectSource(fixtureOracleSource(2, true), fixtureOnboarding('SUSPENDED'), NOW));
    assert.equal(suspended.status, 'SUSPENDED');
    const claim = fixtureClaim({
      claimId: 'claim.super',
      objectId: 'obj.super',
      claimType: 'OUTPUT',
      category: 'ENERGY',
      quantity: 1n,
      unit: 'kWh',
    });
    unwrap(productive.projectObject(fixtureObject({ objectId: 'obj.super', category: 'ENERGY', unitSchema: 'kWh' }), NOW));
    unwrap(productive.projectClaim({ claim, at: NOW }));
    const restricted = unwrap(productive.reflectClaimSupersession(claim.claimId, NOW));
    assert.equal(restricted.status, 'RESTRICTED');
  });

  it('17-18. keeps raw personal information and provider credentials out of descriptors', () => {
    const registry = new EconomicAssetRegistry();
    const hin = createHinEconomicAssetAdapter(registry);
    const oracle = createOracleEconomicAssetAdapter(registry);
    const world = provisionHin();
    const information = unwrap(
      hin.projectInformationAsset({ descriptor: world.descriptor, subject: world.subject, at: NOW }),
    );
    const source = unwrap(oracle.projectSource(fixtureOracleSource(), fixtureOnboarding(), NOW));
    for (const descriptor of [information, source]) {
      const text = JSON.stringify(descriptor);
      assert.equal(/raw personal|ssn|passport|apiKey|clientSecret|oauth|privateKey/i.test(text), false);
      assert.equal('credentialRef' in descriptor, false);
    }
  });

  it('19-21. cannot change source verification, mint coins, or own native supply', () => {
    const registry = new EconomicAssetRegistry();
    const fact = fixtureFact();
    const oracle = createOracleEconomicAssetAdapter(registry);
    const factAsset = unwrap(oracle.projectVerifiedFact({ fact, at: NOW }));
    registry.verifyDescriptor(factAsset.assetId, NOW);
    assert.equal(fact.qualityStatus, 'VERIFIED');
    assert.equal(SOURCE_OF_TRUTH_BOUNDARY.oracleFactValidity, false);
    assert.equal(SOURCE_OF_TRUTH_BOUNDARY.contributionVerification, false);
    assert.equal(FABRIC_AUTHORITY_BOUNDARY.registryCanChangeSourceVerification, false);
    const mint = registry.authorizeMint(factAsset);
    assert.equal(mint.authorized, false);
    assert.equal(FABRIC_AUTHORITY_BOUNDARY.registryCanMintEitherCoin, false);
    assert.equal(REGISTRY_IS_SOURCE_OF_TRUTH, false);
    assert.equal(SOURCE_OF_TRUTH_BOUNDARY.nativeAssetSupply, false);
    for (const native of NATIVE_MONETARY_ASSET_CLASSES) {
      const refused = registry.registerDescriptor({
        assetClass: native as never,
        domain: 'SHARED_REFERENCE',
        canonicalOwnerSystem: 'packages/sunrey-chain/src/economics',
        sourceClass: 'EXTERNAL_REFERENCE',
        sourceSystem: 'packages/sunrey-chain/src/economics',
        jurisdiction: 'US',
        sensitivityClass: 'PUBLIC',
        qualityClass: 'AUTHORITATIVE',
        validFrom: NOW,
        economicCategory: 'SHARED_ECONOMIC_REFERENCE',
        contentCommitmentMaterial: `native:${native}`,
        provenanceMaterial: `native-prov:${native}`,
        createdAt: NOW,
        sourceRecordId: native,
      });
      assert.equal(refused.ok, false);
    }
    assert.equal(FABRIC_PRIVACY_BOUNDARY.credentialsExposed, false);
    assert.equal(FABRIC_AUTHORITY_BOUNDARY.automaticIssuance, false);
  });
});
