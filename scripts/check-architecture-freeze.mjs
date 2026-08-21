#!/usr/bin/env node
/**
 * Enforce the productization architecture freeze.
 * Agent privilege, forbidden packages, alternate ledgers, deprecated deps.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseJsonStrict } from './check-json-integrity.mjs';
import { checkAuthorityMap } from './check-authority-map.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const ARCHITECTURE_FREEZE_REL = 'docs/productization/sunrey-architecture-freeze.json';

const SKIP_DIR = new Set(['.git', 'node_modules', 'dist', 'target', '__pycache__', 'coverage']);

function walk(dir, out = []) {
  if (!existsSync(dir)) {
    return out;
  }
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIR.has(entry)) continue;
    const full = join(dir, entry);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) walk(full, out);
    else if (stat.isFile() && entry.endsWith('.ts') && !entry.endsWith('.d.ts')) out.push(full);
  }
  return out;
}

function isIsolationOrTest(rel) {
  return (
    rel.endsWith('.test.ts') ||
    rel.endsWith('isolation.ts') ||
    rel.includes('/tests/') ||
    rel.endsWith('demo.ts')
  );
}

export function loadArchitectureFreeze(root = ROOT) {
  const abs = join(root, ARCHITECTURE_FREEZE_REL);
  if (!existsSync(abs)) {
    throw new Error(`${ARCHITECTURE_FREEZE_REL}: missing architecture freeze`);
  }
  return parseJsonStrict(readFileSync(abs, 'utf8'), ARCHITECTURE_FREEZE_REL);
}

export function checkArchitectureFreeze(root = ROOT) {
  const findings = [];
  let freeze;
  try {
    freeze = loadArchitectureFreeze(root);
  } catch (error) {
    return { findings: [error instanceof Error ? error.message : String(error)], freeze: null };
  }

  if (freeze.schemaVersion !== 1) {
    findings.push(`${ARCHITECTURE_FREEZE_REL}: schemaVersion must be 1`);
  }
  if (freeze.status !== 'FROZEN_FOR_PRODUCTIZATION') {
    findings.push(`${ARCHITECTURE_FREEZE_REL}: status must remain FROZEN_FOR_PRODUCTIZATION`);
  }

  const authority = checkAuthorityMap(root);
  findings.push(...authority.findings);

  for (const pkg of freeze.forbiddenPackages ?? []) {
    if (existsSync(join(root, pkg))) {
      findings.push(`${ARCHITECTURE_FREEZE_REL}: prohibited package exists: ${pkg}`);
    }
  }
  for (const pkg of freeze.alternateLedgerOwners ?? []) {
    if (existsSync(join(root, pkg))) {
      findings.push(`${ARCHITECTURE_FREEZE_REL}: unsupported alternate ledger implementation: ${pkg}`);
    }
  }
  for (const dep of freeze.deprecatedDependencies ?? []) {
    if (dep?.id && existsSync(join(root, dep.id))) {
      findings.push(`${ARCHITECTURE_FREEZE_REL}: prohibited deprecated dependency present: ${dep.id}`);
    }
  }

  const agent = freeze.agentPrivilege ?? {};
  const forbiddenImports = agent.forbiddenImportSubstrings ?? [];
  const forbiddenCalls = agent.forbiddenCallPatterns ?? [];
  for (const pkg of agent.packages ?? []) {
    for (const file of walk(join(root, pkg))) {
      const rel = file.slice(root.length + 1).replaceAll('\\', '/');
      if (agent.allowMentionInIsolationFiles && isIsolationOrTest(rel)) {
        continue;
      }
      const source = readFileSync(file, 'utf8');
      const importBlock = source
        .split('\n')
        .filter((line) => /^\s*(import|export)\b/.test(line) || /from ['"]/.test(line))
        .join('\n');
      for (const needle of forbiddenImports) {
        if (importBlock.includes(needle) || source.includes(`from '${needle}`) || source.includes(`from "${needle}`)) {
          findings.push(`${rel}: Agent access to privileged signing internals (${needle})`);
        }
      }
      for (const call of forbiddenCalls) {
        if (source.includes(call)) {
          findings.push(`${rel}: Agent privileged call is forbidden (${call})`);
        }
      }
    }
  }

  return { findings, freeze };
}

function main() {
  const { findings } = checkArchitectureFreeze(ROOT);
  if (findings.length > 0) {
    console.error('[ARCHITECTURE] freeze failed:');
    for (const finding of findings) {
      console.error(`  ${finding}`);
    }
    process.exit(1);
  }
  console.log('[ARCHITECTURE] freeze: ok');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
