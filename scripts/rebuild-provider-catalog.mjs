#!/usr/bin/env node
/**
 * Rebuild config/providers/free-api-catalog.yaml from authoritative partial sources:
 * - Wave 2 YAML entries (macro, markets, filings, commodities, gov data)
 * - FX reference catalog entries (packages/payments)
 * - Crypto market catalog entries (packages/sunrey-exchange)
 * - Compliance intelligence catalog entries (packages/kernel)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_PATH = join(ROOT, 'config/providers/free-api-catalog.yaml');
const WAVE2_PATH = join(ROOT, 'config/providers/wave2-catalog-entries.yaml');
const WAVE3_PATH = join(ROOT, 'config/providers/wave3-crypto-catalog-entries.yaml');

const wave2 = parseYaml(readFileSync(WAVE2_PATH, 'utf8'));
const wave3 = parseYaml(readFileSync(WAVE3_PATH, 'utf8'));

const { FX_REFERENCE_CATALOG_ENTRIES, FX_REFERENCE_BLOCKED_CATALOG_ENTRY } = await import(
  `../packages/payments/src/fx-reference/catalog-entries.ts?fx=${Date.now()}`
).catch(async () => {
  const { spawnSync } = await import('node:child_process');
  const result = spawnSync(
    'node',
    [
      '--experimental-strip-types',
      '--disable-warning=ExperimentalWarning',
      '-e',
      `import { FX_REFERENCE_CATALOG_ENTRIES, FX_REFERENCE_BLOCKED_CATALOG_ENTRY } from './packages/payments/src/fx-reference/catalog-entries.ts'; console.log(JSON.stringify({ FX_REFERENCE_CATALOG_ENTRIES, FX_REFERENCE_BLOCKED_CATALOG_ENTRY }));`,
    ],
    { cwd: ROOT, encoding: 'utf8' },
  );
  if (result.status !== 0) {
    throw new Error(result.stderr || 'failed to load FX catalog entries');
  }
  return JSON.parse(result.stdout);
});

const { COMPLIANCE_INTELLIGENCE_CATALOG_ENTRIES } = await import(
  `../packages/kernel/src/compliance-intelligence/catalog-entries.ts?cmp=${Date.now()}`
).catch(async () => {
  const { spawnSync } = await import('node:child_process');
  const result = spawnSync(
    'node',
    [
      '--experimental-strip-types',
      '--disable-warning=ExperimentalWarning',
      '-e',
      `import { COMPLIANCE_INTELLIGENCE_CATALOG_ENTRIES } from './packages/kernel/src/compliance-intelligence/catalog-entries.ts'; console.log(JSON.stringify({ COMPLIANCE_INTELLIGENCE_CATALOG_ENTRIES }));`,
    ],
    { cwd: ROOT, encoding: 'utf8' },
  );
  if (result.status !== 0) {
    throw new Error(result.stderr || 'failed to load compliance catalog entries');
  }
  return JSON.parse(result.stdout);
});

const byId = new Map();

function addEntries(entries) {
  for (const entry of entries ?? []) {
    byId.set(entry.provider_id, structuredClone(entry));
  }
}

// Wave 2 base entries first; FX and crypto entries override/extend by provider_id.
addEntries(wave2.providers);
addEntries(FX_REFERENCE_CATALOG_ENTRIES);
addEntries([FX_REFERENCE_BLOCKED_CATALOG_ENTRY]);
addEntries(wave3.providers);
addEntries(COMPLIANCE_INTELLIGENCE_CATALOG_ENTRIES);

const catalog = {
  schema_version: '1.0.0',
  catalog_id: 'sunrey-free-api-catalog',
  expected_provider_count: 126,
  population_status: 'partial',
  source_list: {
    document:
      'config/providers/wave2-catalog-entries.yaml + packages/payments/src/fx-reference/catalog-entries.ts + wave3-crypto-catalog-entries.yaml + packages/kernel compliance-intelligence',
    version: 'wave-4-prompt-15',
    verified_at: '2026-08-30',
  },
  notes:
    'Partial population including Wave 2 economics/markets, Wave 3 crypto, and Wave 4 compliance intelligence providers. ' +
    'Full 126-provider master list remains pending.',
  providers: [...byId.values()],
};

writeFileSync(CATALOG_PATH, stringifyYaml(catalog, { lineWidth: 120 }), 'utf8');
console.log(`Wrote ${catalog.providers.length} providers to ${CATALOG_PATH}`);
