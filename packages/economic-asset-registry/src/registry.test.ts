import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../../domain/src/time.ts';
import { assetIdFor, valuationMethodRefFor } from './ids.ts';
import { fixtureAsset, FIXTURE_NOW } from './fixtures.ts';
import { assertAcyclicLineage } from './lineage.ts';
import { EconomicAssetRegistry } from './registry.ts';
import { InMemoryEconomicAssetRegistryStore } from './store.ts';
import { NATIVE_MONETARY_ASSET_CLASSES, REGISTRY_NOT_MINT } from './taxonomy.ts';
import type { EconomicAssetDescriptor, RegisterAssetInput } from './types.ts';

function unwrap<T>(result: { ok: true; value: T } | { ok: false; error: { code: string; message: string } }): T {
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.value;
}

function assertMetadataOnly(descriptor: EconomicAssetDescriptor): void {
  assert.equal(descriptor.automaticValue, null);
  assert.equal(descriptor.automaticSunReyQuantity, null);
  assert.equal(descriptor.automaticMoonReyQuantity, null);
  assert.equal(descriptor.issuanceEligible, false);
  assert.equal(descriptor.privacyBoundary.containRawSensitiveData, false);
  assert.equal(descriptor.privacyBoundary.isBlobStore, false);
  assert.equal(descriptor.privacyBoundary.isPersonalDataVault, false);
  assert.equal(descriptor.privacyBoundary.isHumanInformationNetwork, false);
  assert.equal(descriptor.privacyBoundary.isPersonalEconomicGraph, false);
  assert.equal(descriptor.privacyBoundary.isProductiveEngine, false);
  assert.equal(descriptor.privacyBoundary.isOracleConsensus, false);
  assert.equal(descriptor.privacyBoundary.isMonetarySupply, false);
  assert.equal(descriptor.privacyBoundary.automaticValuation, false);
  assert.equal(descriptor.privacyBoundary.humanWorthScore, false);
  assert.equal(descriptor.authorityBoundary.authorizesSunReyIssuance, false);
  assert.equal(descriptor.authorityBoundary.authorizesMoonReyIssuance, false);
  assert.equal(descriptor.authorityBoundary.authorizesSettlement, false);
  assert.equal(descriptor.authorityBoundary.isNativeMonetarySupply, false);
  assert.equal(descriptor.roles.controllerIsLegalOwner, false);
  assert.equal(descriptor.roles.subjectIsLegalOwner, false);
  assert.equal(descriptor.roles.operatorIsLegalOwner, false);
  assert.equal('rawDataset' in descriptor, false);
  assert.equal('legalName' in descriptor, false);
  assert.equal('email' in descriptor, false);
}

describe('CHUNK-113 economic asset registry', () => {
  it('registers representative human and productive descriptors', () => {
    const registry = new EconomicAssetRegistry();
    const kinds = [
      'hin-information',
      'human-contribution',
      'reference-dataset',
      'oracle-source',
      'verified-fact',
      'productive-object',
      'productive-contribution',
    ] as const;
    const registered = kinds.map((kind) => unwrap(registry.register(fixtureAsset(kind, kind))));
    assert.equal(registered.length, 7);
    assert.equal(registered[0]?.assetClass, 'INFORMATION_ASSET');
    assert.equal(registered[1]?.assetClass, 'HUMAN_CONTRIBUTION_RECORD');
    assert.equal(registered[2]?.assetClass, 'REFERENCE_DATASET');
    assert.equal(registered[3]?.assetClass, 'ORACLE_SOURCE_DATASET');
    assert.equal(registered[4]?.assetClass, 'VERIFIED_ECONOMIC_FACT');
    assert.equal(registered[5]?.assetClass, 'PRODUCTIVE_ECONOMIC_OBJECT');
    assert.equal(registered[6]?.assetClass, 'VERIFIED_PRODUCTIVE_CONTRIBUTION');
    for (const descriptor of registered) {
      assertMetadataOnly(descriptor);
      assert.ok(descriptor.rights.rightsPolicyRef.startsWith('earp_'));
      assert.ok(descriptor.contentCommitment.startsWith('eacc_'));
      assert.ok(descriptor.chainAnchor);
    }
  });

  it('records rights, sensitivity, retention, quality, and freshness metadata', () => {
    const registry = new EconomicAssetRegistry();
    const hin = unwrap(registry.register(fixtureAsset('hin-information', 'rights-hin')));
    assert.equal(hin.sensitivityClass, 'PERSONAL');
    assert.equal(hin.storageClass, 'OFF_CHAIN_PROTECTED');
    assert.ok(hin.consentRefs.length > 0);
    assert.ok(hin.usageRestrictionRefs.length > 0);
    assert.ok(hin.retentionPolicyRef);
    assert.equal(hin.qualityClass, 'ATTESTED');
    assert.equal(hin.freshness, 'CURRENT');
    assert.deepEqual([...hin.rights.concepts], ['SUBJECT_RIGHTS', 'CONTROLLER_RIGHTS', 'USAGE_RIGHTS', 'MODEL_TRAINING_RIGHTS']);
  });

  it('keeps lineage cycle-safe and queryable by parent', () => {
    const registry = new EconomicAssetRegistry();
    const source = unwrap(registry.register(fixtureAsset('oracle-source', 'lin-src')));
    const factId = assetIdFor('lin-fact-known');
    const fact = unwrap(
      registry.register({
        ...fixtureAsset('verified-fact', 'lin-fact'),
        assetId: factId,
        lineage: [{ kind: 'DERIVED_FROM', fromAssetId: factId, toAssetId: source.assetId }],
      }),
    );
    assert.equal(fact.lineage[0]?.kind, 'DERIVED_FROM');
    assert.equal(registry.query({ lineageParent: source.assetId }).some((item) => item.assetId === fact.assetId), true);

    const cycle = assertAcyclicLineage(fact.lineage, [
      { kind: 'DERIVED_FROM', fromAssetId: source.assetId, toAssetId: fact.assetId },
    ]);
    assert.equal(cycle.ok, false);
    if (!cycle.ok) {
      assert.equal(cycle.error.code, 'LINEAGE_CYCLE');
    }

    const loop = registry.register({
      ...fixtureAsset('reference-dataset', 'self-loop'),
      lineage: [
        {
          kind: 'DERIVED_FROM',
          fromAssetId: assetIdFor('self-loop-asset'),
          toAssetId: assetIdFor('self-loop-asset'),
        },
      ],
    });
    assert.equal(loop.ok, false);
    if (!loop.ok) {
      assert.equal(loop.error.code, 'LINEAGE_CYCLE');
    }
  });

  it('supersedes and corrects without destructive mutation', () => {
    const registry = new EconomicAssetRegistry();
    const original = unwrap(registry.register(fixtureAsset('reference-dataset', 'hist-1')));
    const superseded = unwrap(
      registry.supersede(original.assetId, {
        ...fixtureAsset('reference-dataset', 'hist-2'),
        createdAt: asUtcInstant('2026-08-19T13:00:00.000Z'),
      }),
    );
    const prior = registry.get(original.assetId);
    assert.equal(prior?.status, 'SUPERSEDED');
    assert.equal(prior?.supersededBy, superseded.assetId);
    assert.equal(superseded.supersedes, original.assetId);
    assert.ok(registry.get(original.assetId));

    const corrected = unwrap(
      registry.correct(superseded.assetId, {
        ...fixtureAsset('reference-dataset', 'hist-3'),
        createdAt: asUtcInstant('2026-08-19T14:00:00.000Z'),
      }),
    );
    assert.equal(corrected.corrects, superseded.assetId);
    assert.equal(registry.get(superseded.assetId)?.status, 'SUPERSEDED');
    assert.equal(registry.get(superseded.assetId)?.correctedBy, corrected.assetId);
    const replay = registry.supersede(original.assetId, fixtureAsset('reference-dataset', 'hist-4'));
    assert.equal(replay.ok, false);
    if (!replay.ok) {
      assert.equal(replay.error.code, 'ALREADY_SUPERSEDED');
    }
  });

  it('stores chain-anchor metadata without new transaction types', () => {
    const registry = new EconomicAssetRegistry();
    const fact = unwrap(registry.register(fixtureAsset('verified-fact', 'anchor-1')));
    assert.equal(fact.chainAnchor?.anchorType, 'DESCRIPTOR_COMMITMENT');
    assert.equal(fact.chainAnchor?.finalityState, 'ANCHORED');
    assert.equal(typeof fact.chainAnchor?.blockHeight, 'bigint');
    assert.ok(fact.chainAnchor?.contentCommitment);
    assert.equal(registry.query({ chainAnchor: fact.chainAnchor?.contentCommitment }).length, 1);
  });

  it('queries by the published indexes', () => {
    const registry = new EconomicAssetRegistry();
    const hin = unwrap(registry.register(fixtureAsset('hin-information', 'q-hin')));
    unwrap(registry.register(fixtureAsset('productive-contribution', 'q-prod')));
    assert.equal(registry.query({ assetId: hin.assetId })[0]?.assetId, hin.assetId);
    assert.equal(registry.query({ assetClass: 'INFORMATION_ASSET' }).length, 1);
    assert.equal(registry.query({ domain: 'HUMAN_ECONOMY' }).length, 1);
    assert.equal(registry.query({ canonicalOwner: hin.canonicalOwner }).length, 1);
    assert.equal(registry.query({ controller: hin.controllerRef }).length, 1);
    assert.equal(registry.query({ jurisdiction: 'GB' }).length, 1);
    assert.equal(registry.query({ economicCategory: 'HUMAN_INFORMATION' }).length, 1);
    assert.equal(registry.query({ sensitivity: 'PERSONAL' }).length, 1);
    assert.equal(registry.query({ quality: 'ATTESTED' }).length, 1);
    assert.equal(registry.query({ freshness: 'CURRENT' }).length, 2);
    assert.equal(registry.query({ sourceClass: 'HUMAN_INFORMATION_NETWORK' }).length, 1);
    assert.equal(registry.query({ status: 'REGISTERED' }).length, 2);
    assert.equal(registry.query({ permittedValuationMethod: hin.permittedValuationMethodRefs[0] }).length, 2);
    registry.clearProjections();
    assert.equal(registry.query({ domain: 'PRODUCTIVE_ECONOMY' }).length, 1);
    registry.rebuildProjections();
    assert.equal(registry.query({ domain: 'PRODUCTIVE_ECONOMY' }).length, 1);
  });

  it('snapshots and rebuilds from the store without raw data', () => {
    const store = new InMemoryEconomicAssetRegistryStore();
    const registry = new EconomicAssetRegistry(store);
    unwrap(registry.register(fixtureAsset('ai-compute', 'snap-ai')));
    registry.persist();
    const snapshot = store.load();
    assert.ok(snapshot);
    assert.equal(snapshot?.rawDataStored, false);
    assert.equal(snapshot?.automaticValuation, false);
    assert.equal(snapshot?.automaticSunReyMint, false);
    assert.equal(snapshot?.automaticMoonReyMint, false);
    const restored = new EconomicAssetRegistry(store);
    restored.loadFromStore();
    assert.equal(restored.query({ economicCategory: 'AI_COMPUTE' }).length, 1);
    assertMetadataOnly(restored.query({ economicCategory: 'AI_COMPUTE' })[0]!);
  });

  it('refuses raw sensitive data, automatic valuation, mint authority, and native supply', () => {
    const registry = new EconomicAssetRegistry();
    const raw = registry.register({
      ...fixtureAsset('hin-information', 'raw-1'),
      contentCommitmentMaterial: 'raw dataset ssn 123-45-6789',
    } as RegisterAssetInput);
    assert.equal(raw.ok, false);
    if (!raw.ok) {
      assert.equal(raw.error.code, 'RAW_SENSITIVE_DATA_FORBIDDEN');
    }

    const longBlob = registry.register({
      ...fixtureAsset('reference-dataset', 'blob-1'),
      contentCommitmentMaterial: 'x'.repeat(300),
    });
    assert.equal(longBlob.ok, false);
    if (!longBlob.ok) {
      assert.equal(longBlob.error.code, 'BLOB_STORE_FORBIDDEN');
    }

    const onChainPersonal = registry.register({
      ...fixtureAsset('hin-information', 'pub-1'),
      storageClass: 'ON_CHAIN_PUBLIC_METADATA',
    });
    assert.equal(onChainPersonal.ok, false);
    if (!onChainPersonal.ok) {
      assert.equal(onChainPersonal.error.code, 'PROTECTED_CONTENT_ON_CHAIN_FORBIDDEN');
    }

    for (const assetClass of NATIVE_MONETARY_ASSET_CLASSES) {
      const refused = registry.register({
        ...fixtureAsset('reference-dataset', assetClass),
        assetClass: assetClass as RegisterAssetInput['assetClass'],
      });
      assert.equal(refused.ok, false);
      if (!refused.ok) {
        assert.equal(refused.error.code, 'NATIVE_MONETARY_ASSET_FORBIDDEN');
      }
    }

    const hin = unwrap(registry.register(fixtureAsset('hin-information', 'auth-1')));
    const execution = registry.authorizeExecution(hin);
    const mint = registry.authorizeMint(hin);
    assert.equal(execution.authorized, false);
    assert.equal(mint.authorized, false);
    assert.equal(mint.sunReyQuantity, null);
    assert.equal(mint.moonReyQuantity, null);
    assert.equal(registry.audit().valuationTotals, null);
    assert.equal(registry.audit().sunReyTotals, null);
    assert.equal(registry.audit().moonReyTotals, null);
    assert.match(REGISTRY_NOT_MINT, /does not authorize/);
    assert.ok(valuationMethodRefFor('later-policy'));
    const verified = unwrap(registry.verify(hin.assetId, asUtcInstant('2026-08-19T12:30:00.000Z')));
    assert.equal(verified.status, 'VERIFIED');
    assert.equal(verified.issuanceEligible, false);
    assert.equal(verified.createdAt, FIXTURE_NOW);
  });

  it('does not infer legal ownership from controller or subject', () => {
    const registry = new EconomicAssetRegistry();
    const hin = unwrap(registry.register(fixtureAsset('hin-information', 'roles-1')));
    assert.equal(hin.roles.legalOwnershipEstablished, false);
    assert.equal(hin.roles.legalOwnershipRightsRef, null);
    assert.notEqual(hin.controllerRef, undefined);
    assert.notEqual(hin.subjectRef, undefined);
    assert.equal(hin.roles.controllerIsLegalOwner, false);
    assert.equal(hin.roles.subjectIsLegalOwner, false);
  });
});
