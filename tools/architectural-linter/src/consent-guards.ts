import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import type { Finding } from './linter.ts';

const COMPETING_PATHS = [
  'packages/privacy-consent',
  'packages/user-consent',
  'packages/permissions-v2',
  'packages/purpose-firewall',
  'packages/consent-v2',
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

export function lintConsentBoundary(root: string): Finding[] {
  const findings: Finding[] = [];
  for (const rel of COMPETING_PATHS) {
    if (existsSync(join(root, rel))) {
      findings.push({
        rule: 'duplicate-protected-system',
        file: rel,
        line: 1,
        message: 'competing Consent path is forbidden; use packages/consent',
      });
    }
  }
  const consentFiles = walk(join(root, 'packages/consent/src'));
  for (const file of consentFiles) {
    if (file.endsWith('.test.ts') || file.endsWith('demo.ts')) {
      continue;
    }
    const source = readFileSync(file, 'utf8');
    if (/postJournal\s*\(/.test(source) || /AuthorityIssuer/.test(source) || /ExecutionAuthority/.test(source)) {
      findings.push({
        rule: 'unauthorized-mutator',
        file,
        line: 1,
        message: 'Consent Ledger must not post financial journals or issue Execution Authority',
      });
    }
  }
  const agentFiles = walk(join(root, 'packages/agent/src'));
  for (const file of agentFiles) {
    const source = readFileSync(file, 'utf8');
    if (source.includes('personal-data-vault') || /pg\.|CREATE TABLE/.test(source)) {
      findings.push({
        rule: 'illegal-package-dependency',
        file,
        line: 1,
        message: 'Personal Economy Agent must not import the Personal Data Vault or access vault SQL',
      });
    }
  }
  return findings;
}
