#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const baselinePath = join(ROOT, 'scripts/typecheck-baseline.json');
const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
const maxErrors = Number(baseline.maxErrors);

if (!Number.isInteger(maxErrors) || maxErrors < 0) {
  console.error('[typecheck] invalid maxErrors baseline');
  process.exit(2);
}

const result = spawnSync('npx', ['tsc', '--noEmit', '-p', 'tsconfig.json', '--pretty', 'false'], {
  cwd: ROOT,
  encoding: 'utf8',
  shell: false,
});

if (result.error) {
  console.error(result.error);
  process.exit(2);
}

const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
const errorCount = (output.match(/error TS\d+:/g) ?? []).length;

if ((result.status ?? 0) !== 0 && errorCount === 0) {
  process.stdout.write(output);
  console.error('[typecheck] compiler failed without countable TypeScript diagnostics');
  process.exit(result.status ?? 2);
}

const delta = errorCount - maxErrors;
const message = `[typecheck] ${errorCount} errors; baseline ${maxErrors}; delta ${delta >= 0 ? '+' : ''}${delta}`;
console.log(message);

if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import('node:fs');
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### TypeScript debt gate\n\n${message}\n\nStrict typecheck remains available as \`npm run typecheck\`.\n`);
}

if (errorCount > maxErrors) {
  process.stdout.write(output);
  console.error('[typecheck] regression detected: new TypeScript errors were introduced');
  process.exit(1);
}

process.exit(0);
