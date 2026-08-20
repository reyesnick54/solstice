import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../../domain/src/time.ts';
import { fixtureAsset, FIXTURE_NOW } from './fixtures.ts';
import { NATIVE_MONETARY_ASSET_CLASSES } from './taxonomy.ts';
import {
  FABRIC_AUTHORITY_BOUNDARY,
  FABRIC_PRIVACY_BOUNDARY,
  REGISTRY_IS_SOURCE_OF_TRUTH,
  SOURCE_OF_TRUTH_BOUNDARY,
} from './source-of-truth.ts';
import { projectDescriptor, reflectSourceLifecycle } from './port.ts';
import { EconomicAssetRegistry } from './registry.ts';

function unwrap<T>(result: { ok: true; value: T } | { ok: false; error: { code: string; message: string } }): T {
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.value;
}

describe('CHUNK-115 economic asset registry port', () => {
  it('exposes a narrow port without becoming source of truth', () => {
    const registry = new EconomicAssetRegistry();
    const first = unwrap(
      registry.registerDescriptor({
        ...fixtureAsset('oracle-source', 'port-src'),
        sourceRecordId: 'src.port.1',
      }),
    );
    assert.equal(registry.getDescriptor(first.assetId)?.assetId, first.assetId);
    assert.equal(registry.findBySourceRecord(first.canonicalOwnerSystem, 'src.port.1')?.assetId, first.assetId);
    assert.equal(registry.queryDescriptors({ sourceRecordId: 'src.port.1' }).length, 1);
    assert.equal(REGISTRY_IS_SOURCE_OF_TRUTH, false);
    assert.equal(SOURCE_OF_TRUTH_BOUNDARY.oracleFactValidity, false);
    assert.equal(SOURCE_OF_TRUTH_BOUNDARY.nativeAssetSupply, false);
    assert.equal(FABRIC_PRIVACY_BOUNDARY.rawPersonalData, false);
    assert.equal(FABRIC_AUTHORITY_BOUNDARY.registryCanMintEitherCoin, false);
  });

  it('projects the same source version idempotently', () => {
    const registry = new EconomicAssetRegistry();
    const input = { ...fixtureAsset('hin-information', 'idem-hin'), sourceRecordId: 'hin.idem.1' };
    const first = unwrap(projectDescriptor(registry, input));
    const second = unwrap(projectDescriptor(registry, input));
    assert.equal(first.assetId, second.assetId);
    assert.equal(registry.queryDescriptors({ sourceRecordId: 'hin.idem.1' }).length, 1);
  });

  it('supersedes when the canonical version changes', () => {
    const registry = new EconomicAssetRegistry();
    const first = unwrap(
      projectDescriptor(registry, {
        ...fixtureAsset('oracle-source', 'ver-src'),
        sourceRecordId: 'src.ver.1',
        sourceSchemaVersion: '1',
      }),
    );
    const next = unwrap(
      projectDescriptor(registry, {
        ...fixtureAsset('oracle-source', 'ver-src-2'),
        sourceRecordId: 'src.ver.1',
        sourceSchemaVersion: '2',
        contentCommitmentMaterial: 'commit:oracle-source:ver-src-2',
      }),
    );
    assert.notEqual(first.assetId, next.assetId);
    assert.equal(registry.getDescriptor(first.assetId)?.status, 'SUPERSEDED');
    assert.equal(next.supersedes, first.assetId);
    assert.equal(next.lineage.some((edge) => edge.kind === 'SUPERSEDES'), true);
  });

  it('records corrections without deleting historical lineage', () => {
    const registry = new EconomicAssetRegistry();
    const first = unwrap(
      projectDescriptor(registry, {
        ...fixtureAsset('human-contribution', 'corr-1'),
        sourceRecordId: 'hec.corr.1',
      }),
    );
    const corrected = unwrap(
      projectDescriptor(registry, {
        ...fixtureAsset('human-contribution', 'corr-2'),
        sourceRecordId: 'hec.corr.1',
        sourceSchemaVersion: first.sourceSchemaVersion,
        contentCommitmentMaterial: 'commit:human-contribution:corr-2',
      }),
    );
    assert.equal(corrected.corrects, first.assetId);
    assert.equal(registry.getDescriptor(first.assetId)?.correctedBy, corrected.assetId);
    assert.ok(registry.getDescriptor(first.assetId));
  });

  it('reflects suspended sources without mutating commitments', () => {
    const registry = new EconomicAssetRegistry();
    const first = unwrap(
      projectDescriptor(registry, {
        ...fixtureAsset('oracle-source', 'susp-src'),
        sourceRecordId: 'src.susp.1',
      }),
    );
    const commitment = first.contentCommitment;
    const suspended = unwrap(reflectSourceLifecycle(registry, first.canonicalOwnerSystem, 'src.susp.1', 'SUSPENDED', FIXTURE_NOW));
    assert.equal(suspended.status, 'SUSPENDED');
    assert.equal(suspended.contentCommitment, commitment);
  });

  it('adds lineage through the port and refuses native supply', () => {
    const registry = new EconomicAssetRegistry();
    const source = unwrap(registry.registerDescriptor({ ...fixtureAsset('oracle-source', 'lin-a'), sourceRecordId: 'lin-a' }));
    const fact = unwrap(registry.registerDescriptor({ ...fixtureAsset('verified-fact', 'lin-b'), sourceRecordId: 'lin-b' }));
    const linked = unwrap(
      registry.addLineage({
        fromAssetId: fact.assetId,
        toAssetId: source.assetId,
        kind: 'DERIVED_FROM',
        at: asUtcInstant('2026-08-19T13:00:00.000Z'),
      }),
    );
    assert.equal(linked.lineage.some((edge) => edge.kind === 'DERIVED_FROM' && edge.toAssetId === source.assetId), true);
    for (const native of NATIVE_MONETARY_ASSET_CLASSES) {
      const refused = registry.registerDescriptor({
        ...fixtureAsset('reference-dataset', native),
        assetClass: native as never,
        sourceRecordId: native,
      });
      assert.equal(refused.ok, false);
    }
    const mint = registry.authorizeMint(source);
    assert.equal(mint.authorized, false);
    assert.equal(mint.sunReyQuantity, null);
    assert.equal(mint.moonReyQuantity, null);
  });
});
