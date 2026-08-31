#!/usr/bin/env node
/**
 * Append Wave 4 catalog entries to config/providers/free-api-catalog.yaml.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_PATH = join(ROOT, 'config/providers/free-api-catalog.yaml');
const WAVE4_PATH = join(ROOT, 'config/providers/wave4-catalog-entries.yaml');

let catalog;
try {
  const raw = readFileSync(CATALOG_PATH, 'utf8');
  catalog = parseYaml(raw);
  if (!catalog?.providers || !Array.isArray(catalog.providers)) {
    throw new Error('invalid catalog structure');
  }
} catch {
  const wave2 = parseYaml(readFileSync(join(ROOT, 'config/providers/wave2-catalog-entries.yaml'), 'utf8'));
  catalog = {
    schema_version: '1.0.0',
    catalog_id: 'sunrey-free-api-catalog',
    expected_provider_count: 126,
    population_status: 'partial',
    providers: [...(wave2.providers ?? [])],
  };
}

const wave4 = parseYaml(readFileSync(WAVE4_PATH, 'utf8'));
const existingIds = new Set((catalog.providers ?? []).map((p) => p.provider_id));
let added = 0;
for (const entry of wave4.providers ?? []) {
  if (!existingIds.has(entry.provider_id)) {
    catalog.providers.push(structuredClone(entry));
    existingIds.add(entry.provider_id);
    added++;
  }
}

catalog.source_list = {
  document: 'config/providers/wave4-catalog-entries.yaml',
  version: 'wave-4-prompt-17',
  verified_at: '2026-08-30',
};
catalog.notes =
  'Partial population: Wave 2 economics/markets + Wave 4 compliance/KYB/fraud/cybersecurity. ' +
  'Full 126-provider master list remains pending.';

writeFileSync(CATALOG_PATH, stringifyYaml(catalog, { lineWidth: 120 }), 'utf8');
console.log(`Added ${added} Wave 4 providers (${catalog.providers.length} total) to ${CATALOG_PATH}`);
