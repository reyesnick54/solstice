/**
 * Chunk 148 — production economic constitution candidate cannot live
 * in a competing package and cannot activate production.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import type { Finding } from './linter.ts';

const COMPETING = [
  'packages/economic-constitution',
  'packages/economic-rc-v2',
  'packages/tokenomics-release',
  'packages/dual-economy-release',
] as const;

const OWNER = 'packages/sunrey-chain/src/release-candidate/economic/production-constitution';

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    return out;
  }
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (entry.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

function finding(file: string, message: string): Finding {
  return { rule: 'production-economic-constitution-guard', file, line: 1, message };
}

export function lintProductionEconomicConstitution(root: string): Finding[] {
  const findings: Finding[] = [];
  for (const rel of COMPETING) {
    if (existsSync(join(root, rel))) {
      findings.push(finding(rel, 'competing economic constitution package is forbidden; use packages/sunrey-chain/src/release-candidate/economic/production-constitution'));
    }
  }

  const ownerRoot = join(root, OWNER);
  if (!existsSync(ownerRoot)) {
    findings.push(finding(OWNER, 'production economic constitution candidate is missing'));
    return findings;
  }

  for (const file of walk(ownerRoot)) {
    if (file.endsWith('.test.ts') || file.endsWith('demo.ts') || file.endsWith('fixtures.ts') || file.endsWith('rehearsal.ts')) {
      continue;
    }
    const source = readFileSync(file, 'utf8');
    if (/function\s+activateProduction\s*\(/.test(source)) {
      findings.push(finding(file, 'production activation functions are forbidden in Chunk 148'));
    }
    if (/productionActivated\s*[:=]\s*true/.test(source)) {
      findings.push(finding(file, 'productionActivated must remain false'));
    }
  }

  return findings;
}
