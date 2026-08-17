import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import type { Finding } from './linter.ts';

const COMPETING_PATHS = [
  'packages/sunrey-chain-v2',
  'packages/blockchain',
  'packages/reyn-chain',
  'packages/on-chain-ledger',
  'packages/crypto-chain',
  'packages/wallet-v2',
  'packages/blockchain-wallet',
  'packages/crypto-wallet',
  'packages/sunrey-wallet-ledger',
  'packages/sunrey-testnet',
  'packages/sunrey-faucet',
  'packages/testnet',
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

export function lintSunReyChainBoundary(root: string): Finding[] {
  const findings: Finding[] = [];
  for (const rel of COMPETING_PATHS) {
    if (existsSync(join(root, rel))) {
      findings.push({
        rule: 'duplicate-protected-system',
        file: rel,
        line: 1,
        message: 'competing SunRey Chain path is forbidden; use packages/sunrey-chain',
      });
    }
  }
  const files = walk(join(root, 'packages/sunrey-chain/src'));
  for (const file of files) {
    if (file.endsWith('.test.ts') || file.endsWith('demo.ts')) {
      continue;
    }
    const source = readFileSync(file, 'utf8');
    if (/postJournal\s*\(/.test(source) || /AuthorityIssuer/.test(source) || /ExecutionAuthority/.test(source)) {
      findings.push({
        rule: 'unauthorized-mutator',
        file,
        line: 1,
        message: 'SunRey Chain must not post financial journals or issue Execution Authority',
      });
    }
    if (/from ['"].*packages\/(ledger|permissions|kernel|sunrey-coin)/.test(source)) {
      findings.push({
        rule: 'illegal-package-dependency',
        file,
        line: 1,
        message: 'SunRey Chain must not import ledger posting, Kernel, or coin mint',
      });
    }
    if (/from ['"].*services\//.test(source)) {
      findings.push({
        rule: 'illegal-package-dependency',
        file,
        line: 1,
        message: 'SunRey Chain must not import services',
      });
    }
  }
  const agentFiles = walk(join(root, 'packages/agent/src'));
  for (const file of agentFiles) {
    const source = readFileSync(file, 'utf8');
    if (source.includes('packages/sunrey-chain')) {
      findings.push({
        rule: 'illegal-package-dependency',
        file,
        line: 1,
        message: 'Personal Economy Agent must not import SunRey Chain',
      });
    }
  }
  return findings;
}
