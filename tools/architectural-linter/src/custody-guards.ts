import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import type { Finding } from './linter.ts';

const COMPETING_PATHS = [
  'packages/custody-ledger',
  'packages/travel-rule-v2',
  'packages/crypto-aml',
  'packages/crypto-custody',
  'packages/wallet-risk-v2',
  'packages/moonrey-custody',
  'packages/sunrey-custody-v2',
  'packages/key-vault',
  'packages/hsm-v2',
  'packages/mpc-v2',
  'packages/custody-provider-v2',
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

export function lintCustodyBoundary(root: string): Finding[] {
  const findings: Finding[] = [];
  for (const rel of COMPETING_PATHS) {
    if (existsSync(join(root, rel))) {
      findings.push({
        rule: 'duplicate-protected-system',
        file: rel,
        line: 1,
        message: 'competing custody / Travel Rule path is forbidden; use packages/custody',
      });
    }
  }
  const files = walk(join(root, 'packages/custody/src'));
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
        message: 'Custody must not issue Execution Authority',
      });
    }
    if (/from ['"].*services\//.test(source)) {
      findings.push({
        rule: 'illegal-package-dependency',
        file,
        line: 1,
        message: 'Custody must not import services',
      });
    }
    if (/mnemonic|seed phrase|xprv|private_key/i.test(source)) {
      findings.push({
        rule: 'secret-material',
        file,
        line: 1,
        message: 'Custody must not store seed phrases or private keys',
      });
    }
  }
  return findings;
}
