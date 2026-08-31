#!/usr/bin/env node
/**
 * Mechanical merge-collision checks.
 *
 * Narrow deterministic detectors only. This is not a general YAML/JSON
 * merger and does not auto-choose between conflicting architecture owners.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkJsonIntegrity, countPackageTestKeys, parseJsonStrict } from './check-json-integrity.mjs';
import { REPOSITORY_TEST_GLOBS } from './run-repository-tests.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const SKIP_DIR = new Set(['.git', 'node_modules', 'dist', 'coverage', 'target', '__pycache__']);
const TEXT_SUFFIXES = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.yml',
  '.yaml',
  '.py',
  '.sh',
  '.toml',
  '.rs',
  '.sql',
  '.txt',
  '.css',
  '.html',
  '.svg',
]);

export const REQUIRED_TEST_FAMILIES = Object.freeze([
  { id: 'security-regulated', needle: 'packages/security/src/regulated/' },
  { id: 'payments-nested', needle: 'packages/payments/src/**/*.test.ts' },
  { id: 'persistence-nested', needle: 'packages/persistence/src/**/*.test.ts' },
  { id: 'economic-rc-nested', needle: 'packages/sunrey-chain/src/release-candidate/economic/' },
  { id: 'native-assets', needle: 'packages/sunrey-chain/src/native-assets/' },
  { id: 'production-ceremony', needle: 'packages/sunrey-chain/src/production-ceremony/' },
  { id: 'mainnet-freeze', needle: 'packages/sunrey-chain/src/release-candidate/mainnet/' },
]);

const CONFLICT_START = /^<<<<<<<($| )/;
const CONFLICT_END = /^>>>>>>>/;
const CONFLICT_SEP = /^=======$/;

function walkFiles(root, dir = root, out = []) {
  if (!existsSync(dir)) {
    return out;
  }
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIR.has(entry)) {
      continue;
    }
    const full = join(dir, entry);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      walkFiles(root, full, out);
    } else if (stat.isFile()) {
      out.push(full.slice(root.length + 1).replaceAll('\\', '/'));
    }
  }
  return out;
}

export function listInspectedFiles(root = ROOT) {
  try {
    const out = execFileSync('git', ['-C', root, 'ls-files'], { encoding: 'utf8' });
    return out
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return walkFiles(root);
  }
}

function isTextPath(rel) {
  const lower = rel.toLowerCase();
  if (lower.endsWith('package-lock.json') || lower.endsWith('cargo.lock')) {
    return true;
  }
  const dot = lower.lastIndexOf('.');
  if (dot < 0) {
    return ['AGENTS.md', 'Dockerfile', 'Makefile'].includes(rel);
  }
  return TEXT_SUFFIXES.has(lower.slice(dot));
}

export function detectConflictMarkers(text) {
  const lines = text.split(/\r?\n/);
  const hits = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    if (CONFLICT_START.test(line) || CONFLICT_END.test(line) || CONFLICT_SEP.test(line)) {
      hits.push({ line: i + 1, text: line.slice(0, 80) });
    }
  }
  return hits;
}

export function extractWorkflowJobIds(text) {
  const ids = [];
  let inJobs = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\t/g, '  ');
    if (/^jobs:\s*(#.*)?$/.test(line)) {
      inJobs = true;
      continue;
    }
    if (!inJobs) {
      continue;
    }
    if (/^[A-Za-z]/.test(line)) {
      inJobs = false;
      continue;
    }
    const match = line.match(/^  ([A-Za-z0-9_-]+):\s*(#.*)?$/);
    if (match) {
      ids.push(match[1]);
    }
  }
  return ids;
}

function duplicateValues(values) {
  const seen = new Map();
  const dupes = [];
  for (const value of values) {
    if (seen.has(value)) {
      dupes.push(value);
    } else {
      seen.set(value, true);
    }
  }
  return dupes;
}

function uniqueCount(items) {
  const seen = new Set();
  let collisions = 0;
  for (const item of items ?? []) {
    const id = item && typeof item === 'object' ? item.id : undefined;
    if (typeof id !== 'string') {
      continue;
    }
    if (seen.has(id)) {
      collisions += 1;
    }
    seen.add(id);
  }
  return { unique: seen.size, collisions, total: [...seen].length + collisions };
}

export function detectAgentsLayoutCollisions(text) {
  const after = text.split(/## Layout[^\n]*/)[1];
  if (!after) {
    return [];
  }
  const section = after.split(/\n## /)[0] ?? '';
  const bullets = section.split(/\r?\n/).filter((line) => line.startsWith('- '));
  const findings = [];
  const seenExact = new Set();
  const byPath = new Map();
  for (const bullet of bullets) {
    if (seenExact.has(bullet)) {
      findings.push(`duplicate AGENTS layout bullet: ${bullet.slice(0, 120)}`);
    }
    seenExact.add(bullet);
    const pathMatch = bullet.match(/^- `([^`]+)`/);
    if (!pathMatch) {
      continue;
    }
    const path = pathMatch[1];
    const list = byPath.get(path) ?? [];
    list.push(bullet);
    byPath.set(path, list);
  }
  for (const [path, list] of byPath) {
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i];
        const b = list[j];
        if (a === b) {
          continue;
        }
        if (a.startsWith(b) || b.startsWith(a) || `${b}.`.startsWith(a) || `${a}.`.startsWith(b)) {
          findings.push(`AGENTS.md layout leftover for ${path}: a shorter bullet is a prefix of a longer one`);
        }
      }
    }
  }
  return findings;
}

function liveFlagsChanged(root, manifest) {
  const flagsPath = join(root, 'packages/config/src/flags.ts');
  if (!existsSync(flagsPath) || !manifest?.liveFlags) {
    return false;
  }
  const text = readFileSync(flagsPath, 'utf8');
  for (const flag of manifest.liveFlags) {
    if (!flag || typeof flag.name !== 'string') {
      continue;
    }
    const required =
      typeof flag.requiredValue === 'string' ? `'${flag.requiredValue}'` : String(flag.requiredValue);
    const assignment = new RegExp(`export const ${flag.name} = ${required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} as const`);
    if (!assignment.test(text)) {
      return true;
    }
  }
  return false;
}

export function resolveRepositoryTestCoverage(testCommand) {
  if (typeof testCommand !== 'string' || testCommand.length === 0) {
    return '';
  }
  if (
    testCommand === 'node scripts/run-repository-tests.mjs' ||
    testCommand.startsWith('node scripts/run-repository-tests.mjs ')
  ) {
    return REPOSITORY_TEST_GLOBS.join(' ');
  }
  return testCommand;
}

export function checkCanonicalTestCommand(testCommand) {
  const findings = [];
  if (typeof testCommand !== 'string' || testCommand.length === 0) {
    findings.push('package.json scripts.test is missing');
    return findings;
  }
  const coverage = resolveRepositoryTestCoverage(testCommand);
  for (const family of REQUIRED_TEST_FAMILIES) {
    if (!coverage.includes(family.needle)) {
      findings.push(`canonical test command missing ${family.id} coverage (${family.needle})`);
    }
  }
  return findings;
}

export function checkMergeIntegrity(root = ROOT) {
  const findings = [];
  const json = checkJsonIntegrity(root);
  findings.push(...json.findings);

  const pkgPath = join(root, 'package.json');
  let packageText = '';
  let testCommand = json.packageJson?.scripts?.test;
  let testKeyCount = 0;
  if (existsSync(pkgPath)) {
    packageText = readFileSync(pkgPath, 'utf8');
    testKeyCount = countPackageTestKeys(packageText);
    if (testKeyCount !== 1) {
      findings.push(`package.json has ${testKeyCount} "test" keys; exactly one is required`);
    }
    findings.push(...checkCanonicalTestCommand(testCommand));
  } else {
    findings.push('package.json is missing');
  }

  const agentsPath = join(root, 'AGENTS.md');
  if (existsSync(agentsPath)) {
    findings.push(...detectAgentsLayoutCollisions(readFileSync(agentsPath, 'utf8')));
  }

  const inspected = listInspectedFiles(root);
  let mergeMarkersPresent = false;
  for (const rel of inspected) {
    if (!isTextPath(rel)) {
      continue;
    }
    const abs = join(root, rel);
    if (!existsSync(abs)) {
      continue;
    }
    let text;
    try {
      text = readFileSync(abs, 'utf8');
    } catch {
      continue;
    }
    const hits = detectConflictMarkers(text);
    if (hits.length > 0) {
      mergeMarkersPresent = true;
      for (const hit of hits) {
        findings.push(`${rel}:${hit.line}: merge conflict marker ${hit.text}`);
      }
    }
  }

  const workflowDir = join(root, '.github/workflows');
  if (existsSync(workflowDir)) {
    for (const entry of readdirSync(workflowDir).sort()) {
      if (!entry.endsWith('.yml') && !entry.endsWith('.yaml')) {
        continue;
      }
      const rel = `.github/workflows/${entry}`;
      const ids = extractWorkflowJobIds(readFileSync(join(root, rel), 'utf8'));
      const dupes = duplicateValues(ids);
      for (const id of new Set(dupes)) {
        findings.push(`${rel}: duplicate workflow job id "${id}"`);
      }
    }
  }

  const capabilityStats = uniqueCount(json.manifest?.capabilities);
  const componentStats = uniqueCount(json.manifest?.components);
  const ownerCollisions = capabilityStats.collisions + componentStats.collisions;
  if (capabilityStats.collisions > 0) {
    findings.push(`manifest capabilities have ${capabilityStats.collisions} duplicate id(s)`);
  }
  if (componentStats.collisions > 0) {
    findings.push(`manifest components have ${componentStats.collisions} duplicate id(s)`);
  }

  const chunkDir = join(root, 'docs/architecture/chunks');
  const chunkIds = [];
  if (existsSync(chunkDir)) {
    for (const entry of readdirSync(chunkDir).sort()) {
      if (!entry.endsWith('.json')) {
        continue;
      }
      const rel = `docs/architecture/chunks/${entry}`;
      try {
        const parsed = parseJsonStrict(readFileSync(join(root, rel), 'utf8'), rel);
        if (parsed && typeof parsed.chunk === 'string') {
          chunkIds.push(parsed.chunk);
        }
      } catch (error) {
        findings.push(error instanceof Error ? error.message : String(error));
      }
    }
  }
  const duplicateChunks = duplicateValues(chunkIds);
  for (const id of new Set(duplicateChunks)) {
    findings.push(`duplicate chunk identifier "${id}"`);
  }

  const flagsChanged = liveFlagsChanged(root, json.manifest);
  if (flagsChanged) {
    findings.push('LIVE_* / ENVIRONMENT assignment drifted from manifest liveFlags');
  }

  const baselinePath = join(root, 'docs/architecture/integrity-baseline.json');
  let baseline;
  if (existsSync(baselinePath)) {
    try {
      baseline = parseJsonStrict(readFileSync(baselinePath, 'utf8'), 'docs/architecture/integrity-baseline.json');
    } catch (error) {
      findings.push(error instanceof Error ? error.message : String(error));
    }
  }

  const counts = {
    canonicalPackageCount: json.manifest?.packages?.length ?? 0,
    canonicalCapabilityCount: json.manifest?.capabilities?.length ?? 0,
    canonicalComponentCount: json.manifest?.components?.length ?? 0,
    chunkDeclarationCount: chunkIds.length,
    architectureSchemaVersion: json.manifest?.schemaVersion ?? null,
  };
  if (baseline && typeof baseline === 'object') {
    for (const key of [
      'canonicalPackageCount',
      'canonicalCapabilityCount',
      'canonicalComponentCount',
      'chunkDeclarationCount',
    ]) {
      const expected = baseline[key];
      const actual = counts[key];
      if (typeof expected === 'number' && actual < expected) {
        findings.push(
          `integrity baseline regression: ${key} dropped from ${expected} to ${actual}; repair the merge explicitly`,
        );
      }
    }
    if (baseline.singleTestScriptInvariant === true && testKeyCount !== 1) {
      findings.push('integrity baseline requires exactly one package.json test script');
    }
    if (
      typeof baseline.architectureSchemaVersion === 'number' &&
      counts.architectureSchemaVersion !== baseline.architectureSchemaVersion
    ) {
      findings.push(
        `architecture schemaVersion ${String(counts.architectureSchemaVersion)} does not match baseline ${baseline.architectureSchemaVersion}`,
      );
    }
  }

  const report = {
    JSON_INTEGRITY: json.findings.length === 0,
    MERGE_MARKERS_PRESENT: mergeMarkersPresent,
    PACKAGE_TEST_KEY_COUNT: testKeyCount,
    ARCHITECTURE_CAPABILITY_IDS_UNIQUE: capabilityStats.collisions === 0 && Boolean(json.manifest),
    ARCHITECTURE_COMPONENT_IDS_UNIQUE: componentStats.collisions === 0 && Boolean(json.manifest),
    CHUNK_IDS_UNIQUE: duplicateChunks.length === 0,
    CANONICAL_OWNER_COLLISIONS: ownerCollisions,
    LIVE_FLAGS_CHANGED: flagsChanged,
    ...counts,
  };

  return { findings: [...new Set(findings)], report, json };
}

function main() {
  const { findings } = checkMergeIntegrity(ROOT);
  if (findings.length > 0) {
    for (const finding of findings) {
      console.error(finding);
    }
    process.exit(1);
  }
  console.log('merge integrity: ok');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
