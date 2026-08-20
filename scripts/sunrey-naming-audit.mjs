#!/usr/bin/env node
/**
 * Scan tracked source/config/docs for legacy Solstice identity tokens,
 * classify each occurrence, and optionally write the inventory.
 *
 * This script does not rewrite protocol history. `naming:audit --check`
 * fails on new public Solstice branding and on protocol-id drift.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import {
  loadPublicSurfaceDebt,
  protocolIdentifiersUnchanged,
  runNamingAudit,
  writeNamingInventory,
  writePublicSurfaceDebt,
} from '../packages/config/src/naming-audit.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const { values } = parseArgs({
  options: {
    write: { type: 'boolean', default: false },
    'write-public-debt': { type: 'boolean', default: false },
    check: { type: 'boolean', default: false },
    json: { type: 'boolean', default: false },
  },
  strict: true,
});

const result = runNamingAudit(root);
const { inventory, publicFindings, ok } = result;

if (values.write) {
  writeNamingInventory(root, inventory);
}

if (values['write-public-debt']) {
  writePublicSurfaceDebt(root, inventory.occurrences);
}

if (values.json) {
  console.log(JSON.stringify({ summary: inventory.summary, publicFindings, ok }, null, 2));
} else {
  console.log(`naming audit: occurrences=${inventory.summary.occurrenceCount}`);
  console.log(`naming audit: public_must_migrate=${inventory.summary.publicLegacyCount}`);
  console.log(`naming audit: allowlisted=${inventory.summary.allowlistedCount}`);
  console.log(`naming audit: protocol_ids_unchanged=${protocolIdentifiersUnchanged(root)}`);
  if (values.check) {
    const debt = loadPublicSurfaceDebt(root);
    console.log(`naming audit: frozen_public_debt=${debt.entries.length}`);
  }
}

if (values.check && !ok) {
  console.error('naming audit failed: new public Solstice branding is forbidden');
  for (const finding of publicFindings) {
    console.error(`${finding.path}:${finding.line}: ${finding.token} — ${finding.reason}`);
  }
  process.exit(1);
}

if (values.check && !protocolIdentifiersUnchanged(root)) {
  console.error('naming audit failed: protocol identifiers must remain unchanged');
  process.exit(1);
}

if (values.check) {
  console.log('naming audit: ok');
}
