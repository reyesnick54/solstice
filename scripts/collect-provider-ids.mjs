#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';

let yaml = { providers: [] };
try {
  yaml = parseYaml(readFileSync('config/providers/free-api-catalog.yaml', 'utf8'));
} catch (error) {
  console.error('catalog yaml parse error (expected during wave7 repair):', error.message);
}
const w2 = parseYaml(readFileSync('config/providers/wave2-catalog-entries.yaml', 'utf8'));
const w3 = parseYaml(readFileSync('config/providers/wave3-crypto-catalog-entries.yaml', 'utf8'));
const w4 = parseYaml(readFileSync('config/providers/wave4-catalog-entries.yaml', 'utf8'));
const w5 = parseYaml(readFileSync('config/providers/wave5-energy-resource-catalog-entries.yaml', 'utf8'));

const { WAVE4_CATALOG_ENTRIES, WAVE4_IMPLEMENTED_PROVIDER_IDS } = await import(
  '../packages/external-data/src/wave4/catalog-entries.ts'
);
const { WAVE2_IMPLEMENTED_PROVIDER_IDS } = await import('../packages/external-data/src/adapters.ts');
const { FX_REFERENCE_CATALOG_ENTRIES } = await import(
  '../packages/payments/src/fx-reference/catalog-entries.ts'
);
const { CRYPTO_MARKET_CATALOG_PROVIDER_IDS } = await import(
  '../packages/sunrey-exchange/src/crypto-market/catalog-entries.ts'
);
const { CHAIN_INTELLIGENCE_CATALOG_PROVIDER_IDS } = await import(
  '../packages/sunrey-chain/src/chain-intelligence/catalog-entries.ts'
);
const { ENVIRONMENTAL_CATALOG_PROVIDER_IDS } = await import(
  '../packages/sunrey-chain/src/environmental/catalog-entries.ts'
);
const { WAVE5_ADAPTER_IDS } = await import(
  '../packages/sunrey-chain/src/productive-economy-providers/catalog-entries.ts'
);
const { COMPLIANCE_INTELLIGENCE_CATALOG_ENTRIES } = await import(
  '../packages/kernel/src/compliance-intelligence/catalog-entries.ts'
);

const all = new Map();
function add(ids, src) {
  for (const id of ids) {
    const list = all.get(id) ?? [];
    list.push(src);
    all.set(id, list);
  }
}

add(yaml.providers.map((p) => p.provider_id), 'yaml');
add(w2.providers.map((p) => p.provider_id), 'w2');
add(w3.providers.map((p) => p.provider_id), 'w3');
add(w4.providers.map((p) => p.provider_id), 'w4');
add(w5.providers.map((p) => p.provider_id), 'w5');
add(WAVE4_CATALOG_ENTRIES.map((p) => p.provider_id), 'w4ts');
add(WAVE2_IMPLEMENTED_PROVIDER_IDS, 'w2impl');
add(FX_REFERENCE_CATALOG_ENTRIES.map((p) => p.provider_id), 'fx');
add(CRYPTO_MARKET_CATALOG_PROVIDER_IDS, 'crypto');
add(CHAIN_INTELLIGENCE_CATALOG_PROVIDER_IDS, 'chain');
add(ENVIRONMENTAL_CATALOG_PROVIDER_IDS, 'env');
add(WAVE5_ADAPTER_IDS, 'w5prod');
add(COMPLIANCE_INTELLIGENCE_CATALOG_ENTRIES.map((p) => p.provider_id), 'cmp');

console.log('Unique provider IDs across sources:', all.size);
for (const id of [...all.keys()].sort()) {
  console.log(id, '->', all.get(id).join(', '));
}
console.log('WAVE4 implemented:', WAVE4_IMPLEMENTED_PROVIDER_IDS.length);
