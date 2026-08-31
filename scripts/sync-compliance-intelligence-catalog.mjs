#!/usr/bin/env node
/**
 * Merge compliance intelligence catalog entries into config/providers/free-api-catalog.yaml.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_PATH = join(ROOT, 'config/providers/free-api-catalog.yaml');

const { COMPLIANCE_INTELLIGENCE_CATALOG_ENTRIES } = await import(
  `../packages/kernel/src/compliance-intelligence/catalog-entries.ts?sync=${Date.now()}`
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

let catalog;
try {
  catalog = parseYaml(readFileSync(CATALOG_PATH, 'utf8'));
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
  if (entry?.provider_id) byId.set(entry.provider_id, entry);
}
for (const entry of COMPLIANCE_INTELLIGENCE_CATALOG_ENTRIES) {
  byId.set(entry.provider_id, structuredClone(entry));
}

catalog.providers = [...byId.values()];
catalog.population_status = 'partial';
catalog.source_list = {
  ...(catalog.source_list ?? {}),
  document:
    (catalog.source_list?.document ?? '') +
    ' + packages/kernel/src/compliance-intelligence/catalog-entries.ts',
  version: 'wave-4-prompt-15',
  verified_at: '2026-08-30',
};
catalog.notes =
  'Partial catalog including Wave 2–3 providers and Wave 4 compliance intelligence providers. ' +
  'Full 126-provider master list remains pending.';

writeFileSync(CATALOG_PATH, stringifyYaml(catalog, { lineWidth: 120 }), 'utf8');
console.log(
  `Merged ${COMPLIANCE_INTELLIGENCE_CATALOG_ENTRIES.length} compliance providers; total ${catalog.providers.length}`,
);
