import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { capabilitySupersessionResolved, loadManifest } from './manifest.ts';
import type { Finding } from './linter.ts';

const FORBIDDEN_SUPER_PACKAGES = [
  'packages/sunrey-core',
  'packages/platform-v2',
  'packages/final-architecture',
  'packages/super-app',
  'packages/everything',
  'packages/production-v2',
] as const;

export function parseCapabilityTable(markdown: string): readonly string[] {
  const section = markdown.split('## Current capabilities')[1] ?? '';
  const match = section.match(/(\| Capability \| Status \| Owner \|\n\| --- \| --- \| --- \|\n(?:\|.+\n)+)/);
  if (!match) {
    return [];
  }
  const ids: string[] = [];
  for (const line of match[1].split('\n').slice(2)) {
    if (!line.startsWith('|')) continue;
    const id = line.split('|')[1]?.trim();
    if (id && id !== '---' && id !== 'Capability') {
      ids.push(id);
    }
  }
  return ids;
}

export function lintEngineeringClosure(root: string): Finding[] {
  const findings: Finding[] = [];
  const manifest = loadManifest(root);
  const capabilityIds = manifest.capabilities.map((row) => row.id);
  const seen = new Set<string>();
  for (const id of capabilityIds) {
    if (seen.has(id)) {
      findings.push({
        rule: 'duplicate-protected-ownership',
        file: 'docs/architecture/manifest.json',
        line: 1,
        message: `duplicate capability id ${id}`,
      });
    }
    seen.add(id);
  }

  const tablePath = join(root, 'docs/architecture/chunk-dependencies.md');
  const tableIds = parseCapabilityTable(readFileSync(tablePath, 'utf8'));
  const tableSeen = new Set<string>();
  for (const id of tableIds) {
    if (tableSeen.has(id)) {
      findings.push({
        rule: 'duplicate-dependency-table-row',
        file: 'docs/architecture/chunk-dependencies.md',
        line: 1,
        message: `duplicate capability-table row ${id}`,
      });
    }
    tableSeen.add(id);
  }
  for (const id of capabilityIds) {
    if (!tableSeen.has(id)) {
      findings.push({
        rule: 'capability-table-drift',
        file: 'docs/architecture/chunk-dependencies.md',
        line: 1,
        message: `capability ${id} missing from current capability table`,
      });
    }
  }

  const moonrey = manifest.capabilities.find((row) => row.id === 'moonrey-coin');
  if (!moonrey?.supersededBy?.includes('sunrey-native-assets') || !moonrey.supersededBy.includes('moonrey-issuance-engine')) {
    findings.push({
      rule: 'moonrey-capability-debt',
      file: 'docs/architecture/manifest.json',
      line: 1,
      message: 'moonrey-coin must be classified SUPERSEDED by sunrey-native-assets + moonrey-issuance-engine',
    });
  }
  if (!capabilitySupersessionResolved(manifest, 'moonrey-coin')) {
    findings.push({
      rule: 'moonrey-capability-debt',
      file: 'docs/architecture/manifest.json',
      line: 1,
      message: 'moonrey-coin supersession is unresolved',
    });
  }
  if (existsSync(join(root, 'packages/moonrey-coin'))) {
    findings.push({
      rule: 'forbidden-competing-path',
      file: 'packages/moonrey-coin',
      line: 1,
      message: 'do not create packages/moonrey-coin',
    });
  }

  for (const path of FORBIDDEN_SUPER_PACKAGES) {
    if (existsSync(join(root, path))) {
      findings.push({
        rule: 'forbidden-competing-path',
        file: path,
        line: 1,
        message: `Chunk 168 forbids ${path}`,
      });
    }
  }

  if (!existsSync(join(root, 'packages/sunrey-chain/src/production-handoff/engineering-closure/types.ts'))) {
    findings.push({
      rule: 'missing-canonical-owner',
      file: 'packages/sunrey-chain/src/production-handoff/engineering-closure/types.ts',
      line: 1,
      message: 'engineering closure must live under the existing production-handoff owner',
    });
  }

  return findings;
}
