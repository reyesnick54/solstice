#!/usr/bin/env node
/**
 * Merge chain intelligence catalog entries into config/providers/free-api-catalog.yaml.
 * Preserves existing Wave 2 entries; adds or updates Wave 3 blockchain providers.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_PATH = join(ROOT, 'config/providers/free-api-catalog.yaml');

const { CHAIN_INTELLIGENCE_CATALOG_ENTRIES } = await import(
  '../packages/sunrey-chain/src/chain-intelligence/catalog-entries.ts'
);

let catalog;
try {
  const text = readFileSync(CATALOG_PATH, 'utf8');
  catalog = parseYaml(text);
  if (!catalog || !Array.isArray(catalog.providers)) {
    throw new Error('invalid catalog');
  }
} catch {
  catalog = {
    schema_version: '1.0.0',
    catalog_id: 'sunrey-free-api-catalog',
    expected_provider_count: 126,
    population_status: 'partial',
    providers: [],
  };
}

const byId = new Map();
for (const entry of catalog.providers ?? []) {
  if (entry?.provider_id) {
    byId.set(entry.provider_id, entry);
  }
}
for (const entry of CHAIN_INTELLIGENCE_CATALOG_ENTRIES) {
  byId.set(entry.provider_id, structuredClone(entry));
}

catalog.providers = [...byId.values()];
catalog.population_status = 'partial';
catalog.source_list = {
  ...(catalog.source_list ?? {}),
  document: 'packages/sunrey-chain/src/chain-intelligence/catalog-entries.ts',
  version: 'wave-3-prompt-13',
  verified_at: '2026-08-30',
};
catalog.notes =
  'Partial catalog: Wave 2 macro/FX/market + Wave 3 blockchain network intelligence. Full 126-provider master list pending.';

writeFileSync(CATALOG_PATH, stringifyYaml(catalog, { lineWidth: 120 }), 'utf8');
console.log(`Merged ${CHAIN_INTELLIGENCE_CATALOG_ENTRIES.length} chain intelligence providers; total ${catalog.providers.length}`);
