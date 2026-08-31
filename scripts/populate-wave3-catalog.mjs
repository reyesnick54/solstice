#!/usr/bin/env node
/**
 * Populate free-api-catalog.yaml with Wave 3 blockchain intelligence providers.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringify } from 'yaml';
import { WAVE3_PROVIDERS } from './lib/wave3-catalog-providers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const catalog = {
  schema_version: '1.0.0',
  catalog_id: 'sunrey-free-api-catalog',
  expected_provider_count: 126,
  population_status: 'partial',
  source_list: {
    document: 'scripts/lib/wave3-catalog-providers.mjs',
    version: 'wave3-prompt-14',
    verified_at: '2026-08-30',
  },
  notes:
    'Partial Wave 3 population (crypto/blockchain intelligence). Full 126-provider master list still pending.',
  providers: WAVE3_PROVIDERS,
};

writeFileSync(join(ROOT, 'config/providers/free-api-catalog.yaml'), stringify(catalog));
console.log(`catalog updated with ${WAVE3_PROVIDERS.length} Wave 3 providers`);
