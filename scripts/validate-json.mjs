#!/usr/bin/env node
/**
 * Validate every tracked *.json file for syntax errors and duplicate keys.
 *
 * JSON.parse alone is insufficient because duplicate property names are
 * silently collapsed. This uses the repository strict parser instead.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseJsonStrict } from './check-json-integrity.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function listTrackedJsonFiles(root = ROOT) {
  try {
    const out = execFileSync('git', ['-C', root, 'ls-files'], { encoding: 'utf8' });
    return out
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.endsWith('.json'));
  } catch {
    return [];
  }
}

export function validateTrackedJsonFiles(root = ROOT) {
  const findings = [];
  for (const rel of listTrackedJsonFiles(root).sort()) {
    const abs = join(root, rel);
    if (!existsSync(abs)) {
      findings.push(`${rel}: tracked JSON file is missing on disk`);
      continue;
    }
    const text = readFileSync(abs, 'utf8');
    try {
      parseJsonStrict(text, rel);
    } catch (error) {
      findings.push(error instanceof Error ? error.message : String(error));
    }
  }
  return findings;
}

function main() {
  const findings = validateTrackedJsonFiles(ROOT);
  if (findings.length > 0) {
    for (const finding of findings) {
      console.error(finding);
    }
    process.exit(1);
  }
  console.log(`validate:json ok (${listTrackedJsonFiles(ROOT).length} tracked files)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
