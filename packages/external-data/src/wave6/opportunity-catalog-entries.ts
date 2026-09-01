/**
 * Wave 6 Prompt 23 — opportunity provider catalog entries loaded from authoritative YAML.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

import { OPPORTUNITY_ADAPTER_IDS } from './adapters/index.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const OPPORTUNITY_CATALOG_PATH = join(ROOT, 'config/providers/wave6-opportunity-skills-catalog-entries.yaml');

function loadOpportunityCatalogEntries(): readonly Record<string, unknown>[] {
  const doc = parseYaml(readFileSync(OPPORTUNITY_CATALOG_PATH, 'utf8')) as {
    providers?: Record<string, unknown>[];
  };
  return Object.freeze(doc.providers ?? []);
}

export const OPPORTUNITY_CATALOG_ENTRIES = loadOpportunityCatalogEntries();

export const OPPORTUNITY_CATALOG_PROVIDER_IDS = Object.freeze([...OPPORTUNITY_ADAPTER_IDS]);
