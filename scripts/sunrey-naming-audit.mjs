#!/usr/bin/env node
/**
 * Combined SunRey naming audit.
 *
 * Default invocation is the Chunk 142 public-surface check
 * (`sunrey-naming-audit: ok`). `--check` / `--write` run the Chunk 141
 * inventory guard. The two modes stay distinct so callers without
 * TypeScript strip-types still work.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { spawnSync } from 'node:child_process';

const ROOT = dirname(fileURLToPath(new URL('.', import.meta.url)));
const HERE = fileURLToPath(import.meta.url);

const { values } = parseArgs({
  options: {
    write: { type: 'boolean', default: false },
    'write-public-debt': { type: 'boolean', default: false },
    check: { type: 'boolean', default: false },
    json: { type: 'boolean', default: false },
  },
  strict: true,
});

const wantsInventory = values.write || values['write-public-debt'] || values.check || values.json;

if (wantsInventory) {
  if (!process.execArgv.some((flag) => flag.includes('strip-types'))) {
    const result = spawnSync(
      process.execPath,
      ['--experimental-strip-types', '--disable-warning=ExperimentalWarning', HERE, ...process.argv.slice(2)],
      { stdio: 'inherit' },
    );
    process.exit(result.status ?? 1);
  }

  const {
    loadPublicSurfaceDebt,
    protocolIdentifiersUnchanged,
    runNamingAudit,
    writeNamingInventory,
    writePublicSurfaceDebt,
  } = await import('../packages/config/src/naming-audit.ts');

  const result = runNamingAudit(ROOT);
  const { inventory, publicFindings, ok } = result;

  if (values.write) {
    writeNamingInventory(ROOT, inventory);
  }
  if (values['write-public-debt']) {
    writePublicSurfaceDebt(ROOT, inventory.occurrences);
  }
  if (values.json) {
    console.log(JSON.stringify({ summary: inventory.summary, publicFindings, ok }, null, 2));
  } else {
    console.log(`naming audit: occurrences=${inventory.summary.occurrenceCount}`);
    console.log(`naming audit: public_must_migrate=${inventory.summary.publicLegacyCount}`);
    console.log(`naming audit: allowlisted=${inventory.summary.allowlistedCount}`);
    console.log(`naming audit: protocol_ids_unchanged=${protocolIdentifiersUnchanged(ROOT)}`);
    if (values.check) {
      const debt = loadPublicSurfaceDebt(ROOT);
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
  if (values.check && !protocolIdentifiersUnchanged(ROOT)) {
    console.error('naming audit failed: protocol identifiers must remain unchanged');
    process.exit(1);
  }
  if (values.check) {
    console.log('naming audit: ok');
  }
  process.exit(0);
}

function read(rel) {
  return readFileSync(join(ROOT, rel), 'utf8');
}

function publicViolations() {
  const violations = [];
  const rootPkg = JSON.parse(read('package.json'));
  if (rootPkg.name !== 'sunrey') {
    violations.push({ path: 'package.json', detail: `name=${rootPkg.name}` });
  }
  if (!String(rootPkg.description ?? '').includes('SunRey')) {
    violations.push({ path: 'package.json', detail: 'description missing SunRey' });
  }
  if (String(rootPkg.description ?? '').includes('Solstice')) {
    violations.push({ path: 'package.json', detail: 'description still says Solstice' });
  }
  const agents = read('AGENTS.md').split(/\r?\n/)[0] ?? '';
  if (agents !== '# SunRey agent rules') {
    violations.push({ path: 'AGENTS.md', detail: agents });
  }
  const readme = read('README.md').split(/\r?\n/)[0] ?? '';
  if (readme !== '# SunRey') {
    violations.push({ path: 'README.md', detail: readme });
  }
  const constitution = read('docs/architecture/constitution.md').split(/\r?\n/)[0] ?? '';
  if (constitution !== '# SunRey canonical architecture constitution') {
    violations.push({ path: 'docs/architecture/constitution.md', detail: constitution });
  }
  const sdk = JSON.parse(read('packages/sunrey-sdk/package.json'));
  if (!String(sdk.description ?? '').includes('SunRey SDK')) {
    violations.push({ path: 'packages/sunrey-sdk/package.json', detail: 'SDK description' });
  }
  const explorer = JSON.parse(read('packages/sunrey-explorer/package.json'));
  if (!String(explorer.description ?? '').includes('SunRey Explorer')) {
    violations.push({ path: 'packages/sunrey-explorer/package.json', detail: 'Explorer description' });
  }
  return violations;
}

const violations = publicViolations();

if (violations.length > 0) {
  console.error('PUBLIC_LEGACY_DISPLAY_REMAINING');
  for (const item of violations) {
    console.error(`${item.path}: ${item.detail}`);
  }
  process.exit(1);
}

console.log('sunrey-naming-audit: ok');
console.log('CURRENT_MASTER_BRAND=SunRey');
console.log('publicLegacyDisplayNamesRemaining=0');
