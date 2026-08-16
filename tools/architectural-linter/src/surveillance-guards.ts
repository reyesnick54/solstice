import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import type { Finding } from './linter.ts';

const COMPETING_PATHS = ['packages/surveillance-v2', 'packages/exchange-compliance-v2'];

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    return out;
  }
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git') {
      continue;
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (entry.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

export function lintSurveillanceBoundary(root: string): Finding[] {
  const findings: Finding[] = [];
  for (const rel of COMPETING_PATHS) {
    if (existsSync(join(root, rel))) {
      findings.push({
        rule: 'duplicate-protected-system',
        file: rel,
        line: 1,
        message: 'competing surveillance path is forbidden; use packages/market-surveillance',
      });
    }
  }
  const files = walk(join(root, 'packages/market-surveillance/src'));
  for (const file of files) {
    if (file.endsWith('.test.ts') || file.endsWith('demo.ts')) {
      continue;
    }
    const source = readFileSync(file, 'utf8');
    if (/postJournal|AuthorityIssuer|ExecutionAuthority/.test(source)) {
      findings.push({
        rule: 'unauthorized-mutator',
        file,
        line: 1,
        message: 'Market surveillance must not post journals or issue Execution Authority',
      });
    }
    if (/from ['"].*services\//.test(source)) {
      findings.push({
        rule: 'illegal-package-dependency',
        file,
        line: 1,
        message: 'Market surveillance must not import services',
      });
    }
  }
  return findings;
}
