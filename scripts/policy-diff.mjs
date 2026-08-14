#!/usr/bin/env node
/**
 * Compare two persisted or bundled policy versions.
 * Usage:
 *   node scripts/policy-diff.mjs --from gb-sim-v1 --to gb-sim-v1
 */
import { loadBundledPacks } from '../packages/kernel/src/policy/packs/load.ts';
import { diffPolicyVersions, formatPolicyDiff } from '../packages/kernel/src/policy/diff.ts';

const args = process.argv.slice(2);
const fromId = args[args.indexOf('--from') + 1];
const toId = args[args.indexOf('--to') + 1];
if (!fromId || !toId || fromId.startsWith('--') || toId.startsWith('--')) {
  console.error('usage: npm run policy:diff -- --from <versionId> --to <versionId>');
  process.exit(1);
}

const versions = loadBundledPacks().flatMap((pack) => pack.versions);
const from = versions.find((row) => row.versionId === fromId);
const to = versions.find((row) => row.versionId === toId);
if (!from || !to) {
  console.error('unknown version id; bundled versions:', versions.map((row) => row.versionId).join(', '));
  process.exit(1);
}

console.log(formatPolicyDiff(diffPolicyVersions(from, to)));
