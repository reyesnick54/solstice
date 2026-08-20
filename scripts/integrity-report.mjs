#!/usr/bin/env node
/**
 * Prints safe structural integrity counts.
 *
 * Informational only. docs/architecture/manifest.json remains architecture
 * authority. This report does not repair conflicts.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkMergeIntegrity } from './check-merge-integrity.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function formatIntegrityReport(report) {
  return [
    `JSON_INTEGRITY=${report.JSON_INTEGRITY}`,
    `MERGE_MARKERS_PRESENT=${report.MERGE_MARKERS_PRESENT}`,
    `PACKAGE_TEST_KEY_COUNT=${report.PACKAGE_TEST_KEY_COUNT}`,
    `ARCHITECTURE_CAPABILITY_IDS_UNIQUE=${report.ARCHITECTURE_CAPABILITY_IDS_UNIQUE}`,
    `ARCHITECTURE_COMPONENT_IDS_UNIQUE=${report.ARCHITECTURE_COMPONENT_IDS_UNIQUE}`,
    `CHUNK_IDS_UNIQUE=${report.CHUNK_IDS_UNIQUE}`,
    `CANONICAL_OWNER_COLLISIONS=${report.CANONICAL_OWNER_COLLISIONS}`,
    `LIVE_FLAGS_CHANGED=${report.LIVE_FLAGS_CHANGED}`,
  ].join('\n');
}

function main() {
  const { report } = checkMergeIntegrity(ROOT);
  console.log(formatIntegrityReport(report));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
