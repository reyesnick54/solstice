#!/usr/bin/env node
/**
 * Sync Wave 5 travel catalog entries into config/providers/wave5-travel-catalog-entries.yaml
 * and rebuild the merged free-api-catalog.yaml.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringify as stringifyYaml } from 'yaml';
import { WAVE5_TRAVEL_PROVIDERS } from './lib/wave5-catalog-providers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WAVE5_PATH = join(ROOT, 'config/providers/wave5-travel-catalog-entries.yaml');

writeFileSync(
  WAVE5_PATH,
  stringifyYaml({ providers: WAVE5_TRAVEL_PROVIDERS }, { lineWidth: 120 }),
  'utf8',
);
console.log(`Wrote ${WAVE5_TRAVEL_PROVIDERS.length} Wave 5 travel providers to ${WAVE5_PATH}`);

// Rebuild merged catalog
const { spawnSync } = await import('node:child_process');
const result = spawnSync('node', ['scripts/rebuild-provider-catalog.mjs'], { cwd: ROOT, stdio: 'inherit' });
process.exit(result.status ?? 1);
