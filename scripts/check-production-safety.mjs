#!/usr/bin/env node
/**
 * Fail closed if an ordinary PR activates production posture.
 *
 * Required default repository posture:
 *   PRODUCTION_READY=false
 *   PRODUCTION_ACTIVE=false
 *   LIVE_CONNECTIVITY_ENABLED=false
 *   production_authorized=false
 *
 * These values may change later through an explicit authorized launch
 * process. This gate only blocks accidental activation.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIR = new Set(['.git', 'node_modules', 'dist', 'target', '__pycache__', 'coverage']);
const SCAN_SUFFIXES = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.yml', '.yaml', '.tf', '.env']);

const FLAG_NAMES = [
  'PRODUCTION_READY',
  'PRODUCTION_READY_DEFAULT',
  'PRODUCTION_ACTIVE',
  'LIVE_CONNECTIVITY_ENABLED',
  'production_authorized',
  'productionAuthorized',
];

const ASSIGN_RE = new RegExp(
  String.raw`\b(${FLAG_NAMES.join('|')})\b\s*[:=]\s*([^\n,;}]+)`,
  'g',
);

const REQUIRED_FALSE_DEFAULTS = {
  PRODUCTION_READY: false,
  PRODUCTION_ACTIVE: false,
  LIVE_CONNECTIVITY_ENABLED: false,
  production_authorized: false,
};

function iterFiles(root) {
  const files = [];
  function walk(dir) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      if (SKIP_DIR.has(entry)) continue;
      const full = join(dir, entry);
      let stat;
      try {
        stat = statSync(full);
      } catch {
        continue;
      }
      if (stat.isDirectory()) walk(full);
      else if (stat.isFile() && SCAN_SUFFIXES.has(full.slice(full.lastIndexOf('.')))) {
        files.push(full);
      }
    }
  }
  walk(root);
  return files.sort();
}

function normalize(value) {
  return value.trim().replace(/,$/, '').split(' as ')[0].trim().replace(/^['"]|['"]$/g, '').toLowerCase();
}

function isTruthy(value) {
  return value === 'true' || value === '1' || value === 'yes' || value === 'on';
}

export function checkProductionSafety(root = ROOT) {
  const findings = [];
  const seen = {
    PRODUCTION_READY: 0,
    PRODUCTION_ACTIVE: 0,
    LIVE_CONNECTIVITY_ENABLED: 0,
    production_authorized: 0,
  };

  for (const abs of iterFiles(root)) {
    const rel = abs.slice(root.length + 1).replaceAll('\\', '/');
    if (rel.startsWith('docs/productization/')) {
      // Productization docs declare the required false defaults; scan them
      // only for accidental true.
    }
    let text;
    try {
      text = readFileSync(abs, 'utf8');
    } catch {
      continue;
    }
    ASSIGN_RE.lastIndex = 0;
    let match;
    while ((match = ASSIGN_RE.exec(text))) {
      const name = match[1];
      const raw = match[2];
      const value = normalize(raw);
      const line = text.slice(0, match.index).split('\n').length;
      const canonical =
        name === 'PRODUCTION_READY_DEFAULT'
          ? 'PRODUCTION_READY'
          : name === 'productionAuthorized'
            ? 'production_authorized'
            : name;
      if (canonical in seen) {
        seen[canonical] += 1;
      }
      if (isTruthy(value)) {
        findings.push(
          `${rel}:${line}: ${name} is ${raw.trim()} — ordinary PRs must not activate production posture`,
        );
      }
    }
  }

  for (const [name, expected] of Object.entries(REQUIRED_FALSE_DEFAULTS)) {
    if (seen[name] === 0) {
      findings.push(
        `production safety: no ${name}=${expected} assignment found; flags must exist so they cannot be silently omitted`,
      );
    }
  }

  const flagsPath = join(root, 'packages/config/src/flags.ts');
  if (existsSync(flagsPath)) {
    const flags = readFileSync(flagsPath, 'utf8');
    if (!/export const ENVIRONMENT = 'simulation' as const/.test(flags)) {
      findings.push('packages/config/src/flags.ts: ENVIRONMENT must remain simulation');
    }
    if (!/export const LIVE_MONEY_ENABLED = false as const/.test(flags)) {
      findings.push('packages/config/src/flags.ts: LIVE_MONEY_ENABLED must remain false');
    }
  } else {
    findings.push('packages/config/src/flags.ts: missing capability flags');
  }

  for (const rel of [
    'infra/sunrey-production/environments/production.tfvars.json',
    'infra/sunrey-production/environments/preproduction.tfvars.json',
    'infra/sunrey-production/releases/preproduction-release.json',
  ]) {
    const tfvars = join(root, rel);
    if (existsSync(tfvars)) {
      try {
        const parsed = JSON.parse(readFileSync(tfvars, 'utf8'));
        if (parsed.production_authorized !== false && parsed.productionAuthorized !== false) {
          findings.push(`${rel}: production_authorized default must be false`);
        }
      } catch (error) {
        findings.push(`${rel}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  return { findings, seen };
}

function main() {
  const { findings } = checkProductionSafety(ROOT);
  if (findings.length > 0) {
    console.error('[PRODUCTION SAFETY] failed:');
    for (const finding of findings) {
      console.error(`  ${finding}`);
    }
    process.exit(1);
  }
  console.log('[PRODUCTION SAFETY] default posture: PRODUCTION_READY=false PRODUCTION_ACTIVE=false LIVE_CONNECTIVITY_ENABLED=false production_authorized=false');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
