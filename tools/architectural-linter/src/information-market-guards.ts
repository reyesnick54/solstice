import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import type { Finding } from './linter.ts';

const COMPETING_PATHS = [
  'packages/pyramid-data-exchange',
  'packages/data-exchange',
  'packages/sunrey-data-exchange',
  'packages/personal-oracle',
  'packages/information-market-v2',
  'packages/proof-of-contribution',
  'packages/human-information-network',
  'packages/data-marketplace',
];

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

export function lintInformationMarketBoundary(root: string): Finding[] {
  const findings: Finding[] = [];
  for (const rel of COMPETING_PATHS) {
    if (existsSync(join(root, rel))) {
      findings.push({
        rule: 'duplicate-protected-system',
        file: rel,
        line: 1,
        message: 'competing information-market path is forbidden; use packages/information-market',
      });
    }
  }
  const files = walk(join(root, 'packages/information-market/src'));
  for (const file of files) {
    if (file.endsWith('.test.ts') || file.endsWith('demo.ts')) {
      continue;
    }
    const source = readFileSync(file, 'utf8');
    if (/AuthorityIssuer\.issue|this\.issuer\.issue\(/.test(source)) {
      findings.push({
        rule: 'unauthorized-mutator',
        file,
        line: 1,
        message: 'Information market must not issue Execution Authority',
      });
    }
    if (/from ['"].*services\//.test(source)) {
      findings.push({
        rule: 'illegal-package-dependency',
        file,
        line: 1,
        message: 'Information market must not import services',
      });
    }
  }
  const agentFiles = walk(join(root, 'packages/agent/src'));
  for (const file of agentFiles) {
    const source = readFileSync(file, 'utf8');
    if (source.includes('packages/information-market')) {
      findings.push({
        rule: 'illegal-package-dependency',
        file,
        line: 1,
        message: 'Personal Economy Agent must not import the information market',
      });
    }
  }
  return findings;
}
