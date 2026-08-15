import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import type { Finding } from './linter.ts';

const COMPETING_PATHS = [
  'packages/user-data',
  'packages/data-wallet',
  'packages/data-ownership',
  'packages/privacy-vault',
  'packages/personal-data-v2',
  'packages/data-vault',
  'packages/pii-store',
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

export function lintPersonalDataVaultBoundary(root: string): Finding[] {
  const findings: Finding[] = [];
  for (const rel of COMPETING_PATHS) {
    if (existsSync(join(root, rel))) {
      findings.push({
        rule: 'duplicate-protected-system',
        file: rel,
        line: 1,
        message: 'competing Personal Data Vault path is forbidden; use packages/personal-data-vault',
      });
    }
  }
  const agentFiles = walk(join(root, 'packages/agent/src'));
  for (const file of agentFiles) {
    const source = readFileSync(file, 'utf8');
    if (source.includes('personal-data-vault') || source.includes('EncryptedPayloadStore')) {
      findings.push({
        rule: 'illegal-package-dependency',
        file,
        line: 1,
        message: 'Personal Economy Agent must not import the Personal Data Vault or its payload store',
      });
    }
  }
  return findings;
}
