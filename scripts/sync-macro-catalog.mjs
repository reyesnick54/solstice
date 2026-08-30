#!/usr/bin/env node
/**
 * Sync macro catalog entries into config/providers/free-api-catalog.yaml.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringify as stringifyYaml } from 'yaml';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_PATH = join(ROOT, 'config/providers/free-api-catalog.yaml');

const { MACRO_CATALOG_ENTRIES } = await import(
  '../packages/sunrey-chain/src/macro/catalog-entries.ts'
);

const catalog = {
  schema_version: '1.0.0',
  catalog_id: 'sunrey-free-api-catalog',
  expected_provider_count: 126,
  population_status: 'partial',
  source_list: {
    document: 'packages/sunrey-chain/src/macro/catalog-entries.ts',
    version: 'wave-2-prompt-8',
    verified_at: '2026-08-30',
  },
  notes:
    'Partial population: Wave 2 Prompt 8 macroeconomic and government-economic-data provider subset. ' +
    'Full 126-provider master list remains pending. Macro entries sourced from official provider documentation.',
  providers: MACRO_CATALOG_ENTRIES.map((entry) => structuredClone(entry)),
};

writeFileSync(CATALOG_PATH, stringifyYaml(catalog, { lineWidth: 120 }), 'utf8');
console.log(`Wrote ${MACRO_CATALOG_ENTRIES.length} macro providers to ${CATALOG_PATH}`);
