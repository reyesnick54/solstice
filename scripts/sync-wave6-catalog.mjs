#!/usr/bin/env node
/**
 * Append Wave 6 catalog metadata notes to config/providers/free-api-catalog.yaml.
 * Wave 6 integrates existing catalog providers; does not invent missing master-list providers.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_PATH = join(ROOT, 'config/providers/free-api-catalog.yaml');

const catalog = parseYaml(readFileSync(CATALOG_PATH, 'utf8'));
catalog.source_list = {
  document: 'packages/external-data/src/wave6/catalog-entries.ts',
  version: 'wave-6-prompt-24',
  verified_at: '2026-08-31',
};
catalog.notes =
  'Partial population including Waves 2–5 providers and Wave 6 knowledge-intelligence wiring for ' +
  'catalog-present research/food/open-data providers. Full 126-provider master list remains pending.';

writeFileSync(CATALOG_PATH, stringifyYaml(catalog, { lineWidth: 120 }), 'utf8');
console.log(`Updated Wave 6 catalog metadata on ${CATALOG_PATH}`);
