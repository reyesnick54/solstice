#!/usr/bin/env node
/**
 * Merge crypto market catalog entries into config/providers/free-api-catalog.yaml.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_PATH = join(ROOT, 'config/providers/free-api-catalog.yaml');

const { CRYPTO_MARKET_CATALOG_ENTRIES } = await import(
  `../packages/sunrey-exchange/src/crypto-market/catalog-entries.ts`
).catch(async () => {
  const { spawnSync } = await import('node:child_process');
  const result = spawnSync(
    'node',
    ['--experimental-strip-types', '--disable-warning=ExperimentalWarning', '-e',
      `import { CRYPTO_MARKET_CATALOG_ENTRIES } from './packages/sunrey-exchange/src/crypto-market/catalog-entries.ts'; console.log(JSON.stringify(CRYPTO_MARKET_CATALOG_ENTRIES));`],
    { cwd: ROOT, encoding: 'utf8' },
  );
  if (result.status !== 0) {
    throw new Error(result.stderr || 'failed to load crypto catalog entries');
  }
  return { CRYPTO_MARKET_CATALOG_ENTRIES: JSON.parse(result.stdout) };
});

const existing = parseYaml(readFileSync(CATALOG_PATH, 'utf8'));
const existingIds = new Set((existing.providers ?? []).map((entry) => entry.provider_id));
const merged = [...(existing.providers ?? [])];
for (const entry of CRYPTO_MARKET_CATALOG_ENTRIES) {
  if (!existingIds.has(entry.provider_id)) {
    merged.push(structuredClone(entry));
    existingIds.add(entry.provider_id);
  }
}

const catalog = {
  ...existing,
  population_status: 'partial',
  source_list: {
    document: 'packages/sunrey-exchange/src/crypto-market/catalog-entries.ts',
    version: 'wave-3-prompt-12',
    verified_at: '2026-08-30',
  },
  notes:
    'Partial population including Wave 3 Prompt 12 cryptocurrency market reference providers. ' +
    'Full 126-provider master list remains pending.',
  providers: merged,
};

writeFileSync(CATALOG_PATH, stringifyYaml(catalog, { lineWidth: 120 }), 'utf8');
console.log(`Merged ${CRYPTO_MARKET_CATALOG_ENTRIES.length} crypto providers into ${CATALOG_PATH} (${merged.length} total)`);
