#!/usr/bin/env node
/**
 * Validate SunRey free/public API provider catalog.
 *
 * Usage: node scripts/validate-free-api-catalog.mjs [--strict-count]
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  formatValidationReport,
  loadCatalog,
  validateCatalog,
  EXPECTED_PROVIDER_COUNT,
} from './lib/free-api-catalog-validator.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const strictCount = process.argv.includes('--strict-count');

function main() {
  const { catalog } = loadCatalog(ROOT);
  const result = validateCatalog(catalog);

  console.log(formatValidationReport(result));

  if (!result.ok) {
    process.exit(1);
  }

  if (strictCount && result.stats.total !== EXPECTED_PROVIDER_COUNT) {
    console.error('');
    console.error(
      `[providers:validate] strict count failed: ${result.stats.total} providers, expected ${EXPECTED_PROVIDER_COUNT}`,
    );
    process.exit(1);
  }

  if (result.awaitingMasterList && result.stats.total === 0) {
    console.log('');
    console.log(
      'Authoritative 126 API list not found. Provider catalog framework is ready, but the source list must be supplied before population.',
    );
  }
}

main();
