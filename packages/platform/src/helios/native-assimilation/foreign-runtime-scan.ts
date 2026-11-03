/**
 * Detect forbidden foreign application runtimes and upstream dependency pins.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { FORBIDDEN_FOREIGN_RUNTIME_LABELS } from './taxonomy.ts';

export type ForeignRuntimeScanCheck = {
  readonly id: string;
  readonly passed: boolean;
  readonly message: string;
};

export type ForeignRuntimeScanResult = {
  readonly checks: readonly ForeignRuntimeScanCheck[];
  readonly pass: boolean;
  readonly blockers: readonly string[];
};

/** Runtime package paths — not legal README stubs under vendor/assimilation (see vendor audit). */
const FORBIDDEN_VENDORED_PATHS = Object.freeze([
  'packages/trading-agents',
  'packages/tradingagents',
  'packages/bytex-runtime',
  'packages/openchart-server',
  'packages/seris-runtime',
] as const);

const PACKAGE_JSON_FORBIDDEN = Object.freeze([
  /github\.com\/BYTEX-TRADE\/bytex/i,
  /github\.com\/longsurf-ai\/openchart/i,
  /github\.com\/TauricResearch\/TradingAgents/i,
  /github\.com\/aowang-ai\/seris/i,
  /github\.com\/semrincaballero\/Polymarket-Prediction-Bot/i,
  /"bytex"/i,
  /"openchart"/i,
  /"tradingagents"/i,
  /"seris"/i,
  /"polymarket-prediction-bot"/i,
]);

const UPDATER_PATTERNS: readonly RegExp[] = Object.freeze([
  /vendor\/assimilation.*(?:git\s+pull|git\s+submodule\s+update)/i,
  /git\s+submodule\s+update.*vendor\/assimilation/i,
]);

function walkJsonFiles(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkJsonFiles(full, out);
    else if (entry === 'package.json') out.push(full);
  }
  return out;
}

export function scanForeignRuntimeIndependence(root: string): ForeignRuntimeScanResult {
  const checks: ForeignRuntimeScanCheck[] = [];
  const blockers: string[] = [];

  const gitmodules = join(root, '.gitmodules');
  const submodulesPresent = existsSync(gitmodules);
  checks.push({
    id: 'foreign.no_git_submodules',
    passed: !submodulesPresent,
    message: submodulesPresent ? '.gitmodules present' : 'no git submodules',
  });
  if (submodulesPresent) blockers.push('git submodules configured (.gitmodules)');

  for (const rel of FORBIDDEN_VENDORED_PATHS) {
    const present = existsSync(join(root, rel));
    checks.push({
      id: `foreign.path.${rel.replaceAll('/', '_')}`,
      passed: !present,
      message: present ? `forbidden path present: ${rel}` : `${rel} absent`,
    });
    if (present) blockers.push(`forbidden vendored runtime path: ${rel}`);
  }

  const csprojHits: string[] = [];
  const vendorRoot = join(root, 'vendor');
  if (existsSync(vendorRoot)) {
    const stack = [vendorRoot];
    while (stack.length > 0) {
      const current = stack.pop()!;
      for (const entry of readdirSync(current)) {
        const full = join(current, entry);
        if (statSync(full).isDirectory()) stack.push(full);
        else if (entry.endsWith('.csproj') || entry.endsWith('.sln')) {
          csprojHits.push(relative(root, full));
        }
      }
    }
  }
  checks.push({
    id: 'foreign.no_dotnet_vendor_tree',
    passed: csprojHits.length === 0,
    message:
      csprojHits.length === 0
        ? 'no .NET project files under vendor/'
        : `.NET artifacts: ${csprojHits.join(', ')}`,
  });
  if (csprojHits.length > 0) blockers.push('.NET BYTEX-style project files under vendor/');

  const requirementsUnderVendor: string[] = [];
  if (existsSync(vendorRoot)) {
    const stack = [vendorRoot];
    while (stack.length > 0) {
      const current = stack.pop()!;
      for (const entry of readdirSync(current)) {
        const full = join(current, entry);
        if (statSync(full).isDirectory()) stack.push(full);
        else if (entry === 'requirements.txt' || entry === 'pyproject.toml') {
          requirementsUnderVendor.push(relative(root, full));
        }
      }
    }
  }
  checks.push({
    id: 'foreign.no_python_vendor_app',
    passed: requirementsUnderVendor.length === 0,
    message:
      requirementsUnderVendor.length === 0
        ? 'no Python app manifests under vendor/'
        : requirementsUnderVendor.join(', '),
  });
  if (requirementsUnderVendor.length > 0) {
    blockers.push('Python foreign runtime manifests under vendor/');
  }

  const packageJsonFiles = walkJsonFiles(root).filter(
    (p) => !p.includes('node_modules') && !p.includes('/vendor/'),
  );
  const badDeps: string[] = [];
  for (const file of packageJsonFiles) {
    const text = readFileSync(file, 'utf8');
    for (const pattern of PACKAGE_JSON_FORBIDDEN) {
      if (pattern.test(text)) {
        badDeps.push(relative(root, file));
        break;
      }
    }
  }
  checks.push({
    id: 'foreign.no_github_package_deps',
    passed: badDeps.length === 0,
    message:
      badDeps.length === 0
        ? 'no GitHub package dependencies on OS00 upstream repos'
        : badDeps.join(', '),
  });
  if (badDeps.length > 0) blockers.push('package.json references upstream GitHub packages');

  const updaterHits: string[] = [];
  for (const rel of ['scripts', 'tools']) {
    const dir = join(root, rel);
    if (!existsSync(dir)) continue;
    const stack = [dir];
    while (stack.length > 0) {
      const current = stack.pop()!;
      for (const entry of readdirSync(current)) {
        if (entry === 'node_modules') continue;
        const full = join(current, entry);
        if (statSync(full).isDirectory()) stack.push(full);
        else if (/\.(ts|js|mjs|sh|md)$/.test(entry)) {
          const text = readFileSync(full, 'utf8');
          for (const pattern of UPDATER_PATTERNS) {
            if (pattern.test(text)) {
              updaterHits.push(relative(root, full));
            }
          }
        }
      }
    }
  }
  checks.push({
    id: 'foreign.no_assimilation_updater',
    passed: updaterHits.length === 0,
    message:
      updaterHits.length === 0
        ? 'no assimilation updater scripts detected'
        : updaterHits.join(', '),
  });
  if (updaterHits.length > 0) blockers.push('assimilation updater process referenced in repo');

  checks.push({
    id: 'foreign.runtime.labels',
    passed: true,
    message: `retired runtimes: ${FORBIDDEN_FOREIGN_RUNTIME_LABELS.join('; ')}`,
  });

  const pass = blockers.length === 0;
  return Object.freeze({ checks: Object.freeze(checks), pass, blockers: Object.freeze(blockers) });
}
