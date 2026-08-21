import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Finding } from './linter.ts';

const AUTHORITY_MAP = 'docs/productization/sunrey-authority-map.json';
const ARCHITECTURE_FREEZE = 'docs/productization/sunrey-architecture-freeze.json';

function finding(rule: string, file: string, message: string): Finding {
  return { rule, file, line: 1, message };
}

export function lintProductizationFreeze(root: string): Finding[] {
  const findings: Finding[] = [];
  const mapPath = join(root, AUTHORITY_MAP);
  const freezePath = join(root, ARCHITECTURE_FREEZE);
  if (!existsSync(mapPath)) {
    findings.push(finding('productization-authority-map', AUTHORITY_MAP, 'authority map is required'));
    return findings;
  }
  if (!existsSync(freezePath)) {
    findings.push(finding('productization-architecture-freeze', ARCHITECTURE_FREEZE, 'architecture freeze is required'));
    return findings;
  }

  const map = JSON.parse(readFileSync(mapPath, 'utf8')) as {
    authorities?: { id?: string; unique?: boolean }[];
    productionPosture?: Record<string, unknown>;
  };
  const freeze = JSON.parse(readFileSync(freezePath, 'utf8')) as {
    forbiddenPackages?: string[];
    alternateLedgerOwners?: string[];
    productionPosture?: Record<string, unknown>;
  };

  const ids = new Set<string>();
  for (const row of map.authorities ?? []) {
    if (!row.id) {
      findings.push(finding('productization-authority-map', AUTHORITY_MAP, 'authority row missing id'));
      continue;
    }
    if (ids.has(row.id)) {
      findings.push(finding('productization-authority-map', AUTHORITY_MAP, `duplicate canonical authority ${row.id}`));
    }
    ids.add(row.id);
  }

  for (const [name, expected] of [
    ['PRODUCTION_READY', false],
    ['PRODUCTION_ACTIVE', false],
    ['LIVE_CONNECTIVITY_ENABLED', false],
    ['production_authorized', false],
  ] as const) {
    if (map.productionPosture?.[name] !== expected || freeze.productionPosture?.[name] !== expected) {
      findings.push(
        finding(
          'productization-production-posture',
          AUTHORITY_MAP,
          `${name} must remain ${String(expected)} on the productization freeze`,
        ),
      );
    }
  }

  for (const pkg of [...(freeze.forbiddenPackages ?? []), ...(freeze.alternateLedgerOwners ?? [])]) {
    if (existsSync(join(root, pkg))) {
      findings.push(finding('productization-forbidden-package', pkg, `prohibited package or alternate ledger exists: ${pkg}`));
    }
  }

  return findings;
}
