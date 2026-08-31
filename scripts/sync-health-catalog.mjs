#!/usr/bin/env node
/**
 * Sync Wave 6 health/HIN catalog entries into config/providers/wave6-health-hin-catalog-entries.yaml
 * and rebuild the merged free-api-catalog.yaml.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringify as stringifyYaml } from 'yaml';
import { WAVE6_HEALTH_PROVIDERS } from './lib/wave6-health-catalog-providers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WAVE6_PATH = join(ROOT, 'config/providers/wave6-health-hin-catalog-entries.yaml');

writeFileSync(
  WAVE6_PATH,
  stringifyYaml({ providers: WAVE6_HEALTH_PROVIDERS }, { lineWidth: 120 }),
  'utf8',
);
console.log(`Wrote ${WAVE6_HEALTH_PROVIDERS.length} Wave 6 health providers to ${WAVE6_PATH}`);

const { spawnSync } = await import('node:child_process');
const result = spawnSync('node', ['scripts/rebuild-provider-catalog.mjs'], { cwd: ROOT, stdio: 'inherit' });
process.exit(result.status ?? 1);
