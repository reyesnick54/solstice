import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import type { Finding } from './linter.ts';

const COMPETING = [
  'packages/sunrey-protocol',
  'packages/sunrey-tx',
  'packages/moonrey',
  'packages/moonrey-coin',
  'packages/sunrey-chain-v2',
] as const;

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

function finding(file: string, message: string, rule = 'unauthorized-mutator'): Finding {
  return { rule, file, line: 1, message };
}

export function lintSunReyProtocol(root: string): Finding[] {
  const findings: Finding[] = [];
  for (const rel of COMPETING) {
    if (existsSync(join(root, rel))) {
      findings.push(
        finding(rel, 'competing protocol or MoonRey package is forbidden; use packages/sunrey-chain', 'duplicate-protected-system'),
      );
    }
  }

  const proto = join(root, 'packages/sunrey-chain/protocol/v1/sunrey_tx_v1.proto');
  if (!existsSync(proto)) {
    findings.push(finding('packages/sunrey-chain/protocol/v1/sunrey_tx_v1.proto', 'canonical protobuf schema is missing', 'missing-canonical-owner'));
  } else {
    const text = readFileSync(proto, 'utf8');
    if (!text.includes('syntax = "proto3"') || text.includes('map<') || /\b(double|float)\s+/.test(text)) {
      findings.push(finding(proto, 'protocol schema must be proto3 without maps or floating-point fields'));
    }
  }

  const files = walk(join(root, 'packages/sunrey-chain/src/protocol'));
  for (const file of files) {
    if (file.endsWith('.test.ts')) {
      continue;
    }
    const source = readFileSync(file, 'utf8');
    if (/class Money\b/.test(source)) {
      findings.push(finding(file, 'protocol must not introduce a second Money primitive'));
    }
    if (/from ['"].*packages\/(ledger|sunrey-coin)/.test(source) || /postJournal\s*\(/.test(source)) {
      findings.push(finding(file, 'protocol must not become a second SunRey Coin ledger'));
    }
    if (/moonreyIssuanceActivated\(\):\s*true/.test(source) || /ISSUE_MOONREY/.test(source)) {
      findings.push(finding(file, 'MoonRey issuance must remain unavailable'));
    }
    if (/JSON\.stringify/.test(source) && /sha256Hex|domainSeparatedHash/.test(source) && !file.endsWith('json-projection.ts')) {
      findings.push(finding(file, 'consensus hashing must not use JSON.stringify'));
    }
    if (/Date\.now\s*\(|Math\.random\s*\(|fetch\s*\(/.test(source)) {
      findings.push(finding(file, 'state-transition code must not use wall-clock, randomness, or network calls'));
    }
    if (/scaledUnits\s*:\s*number/.test(source)) {
      findings.push(finding(file, 'protocol quantities must not use JavaScript number'));
    }
  }

  return findings;
}
