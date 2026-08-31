#!/usr/bin/env node
/**
 * Detect tracked repository paths that differ only by case.
 *
 * Case-insensitive filesystems (macOS default, Windows) cannot hold both
 * variants; this gate fails closed when collisions exist.
 */
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export class CaseCollisionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CaseCollisionError';
  }
}

export function listTrackedPaths(cwd = ROOT) {
  const output = execFileSync('git', ['ls-files', '-z'], { cwd, encoding: 'utf8' });
  return output.split('\0').filter(Boolean);
}

export function findCaseCollisions(paths = listTrackedPaths()) {
  const byNormalized = new Map();
  const collisions = [];

  for (const path of paths) {
    const key = path.toLowerCase();
    const existing = byNormalized.get(key);
    if (existing === undefined) {
      byNormalized.set(key, [path]);
      continue;
    }
    existing.push(path);
    byNormalized.set(key, existing);
  }

  for (const [normalized, variants] of byNormalized.entries()) {
    if (variants.length > 1) {
      collisions.push(Object.freeze({ normalized, variants: Object.freeze([...variants].sort()) }));
    }
  }

  return Object.freeze(collisions.sort((a, b) => a.normalized.localeCompare(b.normalized)));
}

export function formatCaseCollisionReport(collisions) {
  if (collisions.length === 0) {
    return 'case-collisions: ok (0 collisions)';
  }

  const lines = ['case-collisions: FAIL', ''];
  for (const collision of collisions) {
    lines.push(`normalized=${collision.normalized}`);
    for (const variant of collision.variants) {
      lines.push(`  - ${variant}`);
    }
    lines.push('');
  }
  lines.push('Resolve by keeping one canonical path and removing or renaming the others.');
  return lines.join('\n');
}

export function checkCaseCollisions(cwd = ROOT) {
  const collisions = findCaseCollisions(listTrackedPaths(cwd));
  if (collisions.length > 0) {
    throw new CaseCollisionError(formatCaseCollisionReport(collisions));
  }
  return { ok: true, collisionCount: 0 };
}

function main() {
  try {
    const collisions = findCaseCollisions();
    if (collisions.length > 0) {
      console.error(formatCaseCollisionReport(collisions));
      process.exit(1);
    }
    console.log('case-collisions: ok (0 collisions)');
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
