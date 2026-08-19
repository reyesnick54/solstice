import { fixtureAsset } from './fixtures.ts';
import { assetIdFor } from './ids.ts';
import { EconomicAssetRegistry } from './registry.ts';
import {
  REGISTRY_NOT_BLOB_STORE,
  REGISTRY_NOT_MINT,
  REGISTRY_NOT_MONETARY_SUPPLY,
  REGISTRY_NOT_VALUATION,
  ROLES_ARE_NOT_OWNERSHIP,
} from './taxonomy.ts';
import type { EconomicAssetDescriptor } from './types.ts';

function unwrap<T>(result: { ok: true; value: T } | { ok: false; error: { message: string } }): T {
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.value;
}

function summarize(descriptor: EconomicAssetDescriptor): string {
  return [
    descriptor.assetClass,
    `id=${descriptor.assetId}`,
    `domain=${descriptor.domain}`,
    `ownerSystem=${descriptor.canonicalOwnerSystem}`,
    `source=${descriptor.sourceClass}`,
    `sensitivity=${descriptor.sensitivityClass}`,
    `storage=${descriptor.storageClass}`,
    `quality=${descriptor.qualityClass}`,
    `freshness=${descriptor.freshness}`,
    `category=${descriptor.economicCategory}`,
    `status=${descriptor.status}`,
    `commitment=${descriptor.contentCommitment}`,
    `rawData=false`,
    `automaticValue=${String(descriptor.automaticValue)}`,
    `sunRey=${String(descriptor.automaticSunReyQuantity)}`,
    `moonRey=${String(descriptor.automaticMoonReyQuantity)}`,
  ].join(' | ');
}

export function runEconomicAssetRegistryDemo(): {
  readonly descriptors: readonly EconomicAssetDescriptor[];
  readonly RAW_DATA_STORED: false;
  readonly AUTOMATIC_VALUATION: false;
  readonly AUTOMATIC_SUNREY_MINT: false;
  readonly AUTOMATIC_MOONREY_MINT: false;
} {
  const registry = new EconomicAssetRegistry();

  const hin = unwrap(registry.register(fixtureAsset('hin-information', 'demo-hin')));
  const contribution = unwrap(registry.register(fixtureAsset('human-contribution', 'demo-hec')));
  const oracle = unwrap(registry.register(fixtureAsset('oracle-source', 'demo-oracle')));
  const fact = unwrap(
    registry.register({
      ...fixtureAsset('verified-fact', 'demo-fact'),
      lineage: [{ kind: 'DERIVED_FROM', fromAssetId: assetIdFor('demo-fact-edge'), toAssetId: oracle.assetId }],
    }),
  );
  const productive = unwrap(
    registry.register({
      ...fixtureAsset('productive-contribution', 'demo-energy'),
      lineage: [{ kind: 'CONTRIBUTED_TO', fromAssetId: assetIdFor('demo-energy-edge'), toAssetId: fact.assetId }],
    }),
  );
  const aiCompute = unwrap(registry.register(fixtureAsset('ai-compute', 'demo-ai')));

  const snapshot = registry.snapshot();
  const descriptors = [hin, contribution, oracle, fact, productive, aiCompute];

  console.log('SunRey Dataset & Economic Asset Registry — Chunk 113');
  console.log(REGISTRY_NOT_BLOB_STORE);
  console.log(REGISTRY_NOT_VALUATION);
  console.log(REGISTRY_NOT_MINT);
  console.log(REGISTRY_NOT_MONETARY_SUPPLY);
  console.log(ROLES_ARE_NOT_OWNERSHIP);
  console.log('');
  for (const descriptor of descriptors) {
    console.log(summarize(descriptor));
  }
  console.log('');
  console.log(`lineage fact<-oracle=${fact.lineage.map((edge) => `${edge.kind}:${edge.toAssetId}`).join(',')}`);
  console.log(`lineage energy<-fact=${productive.lineage.map((edge) => `${edge.kind}:${edge.toAssetId}`).join(',')}`);
  console.log(`RAW_DATA_STORED=${String(snapshot.rawDataStored)}`);
  console.log(`AUTOMATIC_VALUATION=${String(snapshot.automaticValuation)}`);
  console.log(`AUTOMATIC_SUNREY_MINT=${String(snapshot.automaticSunReyMint)}`);
  console.log(`AUTOMATIC_MOONREY_MINT=${String(snapshot.automaticMoonReyMint)}`);

  return {
    descriptors,
    RAW_DATA_STORED: false,
    AUTOMATIC_VALUATION: false,
    AUTOMATIC_SUNREY_MINT: false,
    AUTOMATIC_MOONREY_MINT: false,
  };
}

runEconomicAssetRegistryDemo();
