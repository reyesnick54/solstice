import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

import type { Finding } from './linter.ts';

const SKIP_DIR = new Set(['node_modules', '.git', 'dist', 'coverage', '__pycache__']);
const CODE_SUFFIXES = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

export const RULE_PACKAGE_DEEP_IMPORT = 'package-deep-import';
export const RULE_ECONOMIC_AUTHORITY_DAG = 'economic-authority-dag';
export const RULE_PACKAGE_IMPORTS_SERVICE = 'package-imports-service';

const IMPORT_RE =
  /(?:from\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|require\s*\(\s*['"]([^'"]+)['"]\s*\))/g;

const INFORMATION_LAYER_PREFIXES = [
  'packages/economic-awareness-fabric/',
  'packages/sunrey-chain/src/economic-awareness-fabric/',
  'packages/sunrey-chain/src/economic-proof/',
] as const;

const FORBIDDEN_EXECUTION_TARGETS = [
  'packages/ledger/',
  'packages/permissions/',
  'packages/sunrey-coin/',
  'packages/custody/',
  'packages/payments/src/journals',
  'packages/sunrey-chain/src/economics/',
  'packages/sunrey-chain/src/productive/policy-governance/value-settlement/',
  'packages/sunrey-chain/src/productive/policy-governance/value-function/',
  'services/accounts/',
] as const;

export type PackageBoundaryViolation = {
  readonly file: string;
  readonly line: number;
  readonly rule: string;
  readonly message: string;
  readonly sourcePackage: string | null;
  readonly targetPackage: string | null;
  readonly spec: string;
};

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    return out;
  }
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIR.has(entry)) {
      continue;
    }
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, out);
    } else if (CODE_SUFFIXES.has(entry.slice(entry.lastIndexOf('.')))) {
      out.push(full);
    }
  }
  return out;
}

function packageNameFromPath(filePath: string, packagesRoot: string): string | null {
  const rel = relative(packagesRoot, filePath).replaceAll('\\', '/');
  const parts = rel.split('/');
  return parts[0] ?? null;
}

function resolveFileCandidate(candidate: string): string | null {
  if (existsSync(candidate) && statSync(candidate).isFile()) {
    return candidate;
  }
  for (const ext of ['.ts', '.tsx', '.js', '.mjs', '.cjs']) {
    const withExt = `${candidate}${ext}`;
    if (existsSync(withExt) && statSync(withExt).isFile()) {
      return withExt;
    }
  }
  if (existsSync(candidate) && statSync(candidate).isDirectory()) {
    for (const name of ['index.ts', 'index.js', 'index.mjs']) {
      const index = join(candidate, name);
      if (existsSync(index) && statSync(index).isFile()) {
        return index;
      }
    }
  }
  return null;
}

export function resolveImportSpec(
  importingFile: string,
  spec: string,
  root: string,
): string | null {
  const normalized = spec.replaceAll('\\', '/');
  if (normalized.startsWith('node:')) {
    return null;
  }
  const packagesRoot = join(root, 'packages');

  if (normalized.startsWith('@solstice/')) {
    const rest = normalized.slice('@solstice/'.length);
    const parts = rest.split('/');
    const pkg = parts[0];
    if (!pkg) {
      return null;
    }
    if (parts.length === 1) {
      return resolveFileCandidate(join(packagesRoot, pkg, 'src', 'index'));
    }
    if (parts[1] === 'src') {
      const subpath = parts.slice(2).join('/');
      return resolveFileCandidate(join(packagesRoot, pkg, 'src', subpath));
    }
    return resolveFileCandidate(join(packagesRoot, pkg, ...parts.slice(1)));
  }

  if (normalized.startsWith('.')) {
    const raw = resolve(dirname(importingFile), normalized);
    return resolveFileCandidate(raw);
  }

  return null;
}

export function isPublicApiImport(spec: string): boolean {
  if (!spec.startsWith('@solstice/')) {
    return false;
  }
  const rest = spec.slice('@solstice/'.length);
  return !`/${rest}/`.includes('/src/');
}

function isDeepPackageTarget(targetRel: string): boolean {
  return targetRel.startsWith('packages/') && targetRel.includes('/src/');
}

function isInformationLayerFile(fileRel: string): boolean {
  return INFORMATION_LAYER_PREFIXES.some((prefix) => fileRel.startsWith(prefix));
}

function isForbiddenExecutionTarget(targetRel: string): boolean {
  return FORBIDDEN_EXECUTION_TARGETS.some(
    (prefix) => targetRel.startsWith(prefix) || targetRel.includes(prefix),
  );
}

function isTestOrDemo(fileRel: string, fileName: string): boolean {
  const parts = new Set(fileRel.split('/').map((p) => p.toLowerCase()));
  return (
    fileName.endsWith('.test.ts') ||
    fileName.endsWith('.test.tsx') ||
    fileName.endsWith('.test.js') ||
    fileName.endsWith('.spec.ts') ||
    fileName === 'demo.ts' ||
    parts.has('tests')
  );
}

function toFinding(v: PackageBoundaryViolation): Finding {
  return {
    rule: v.rule,
    file: v.file,
    line: v.line,
    message: v.message,
  };
}

export function lintPackageBoundarySource(
  root: string,
  fileAbs: string,
  source: string,
): PackageBoundaryViolation[] {
  const packagesRoot = join(root, 'packages');
  const fileRel = relative(root, fileAbs).replaceAll('\\', '/');
  const sourcePkg = packageNameFromPath(fileAbs, packagesRoot);
  if (sourcePkg === null || !fileRel.startsWith('packages/')) {
    return [];
  }

  const violations: PackageBoundaryViolation[] = [];
  const isTest = isTestOrDemo(fileRel, fileAbs.split('/').pop() ?? '');

  for (const match of source.matchAll(IMPORT_RE)) {
    const spec = (match[1] ?? match[2] ?? match[3] ?? '').replaceAll('\\', '/');
    if (!spec) {
      continue;
    }
    const index = match.index ?? 0;
    const line = source.slice(0, index).split('\n').length;

    if (!isTest && (spec.startsWith('services/') || spec.includes('/services/'))) {
      violations.push({
        file: fileRel,
        line,
        rule: RULE_PACKAGE_IMPORTS_SERVICE,
        message: `package '${sourcePkg}' imports service module '${spec}'`,
        sourcePackage: sourcePkg,
        targetPackage: null,
        spec,
      });
    }

    if (isPublicApiImport(spec)) {
      continue;
    }

    const targetAbs = resolveImportSpec(fileAbs, spec, root);
    if (targetAbs === null) {
      continue;
    }
    const targetRel = relative(root, targetAbs).replaceAll('\\', '/');

    if (isInformationLayerFile(fileRel) && isForbiddenExecutionTarget(targetRel)) {
      violations.push({
        file: fileRel,
        line,
        rule: RULE_ECONOMIC_AUTHORITY_DAG,
        message: `information layer '${fileRel}' must not import execution authority target '${targetRel}'`,
        sourcePackage: sourcePkg,
        targetPackage: packageNameFromPath(targetAbs, packagesRoot),
        spec,
      });
    }

    if (!isDeepPackageTarget(targetRel)) {
      continue;
    }

    const targetPkg = packageNameFromPath(targetAbs, packagesRoot);
    if (targetPkg === null || targetPkg === sourcePkg) {
      continue;
    }

    violations.push({
      file: fileRel,
      line,
      rule: RULE_PACKAGE_DEEP_IMPORT,
      message: `package '${sourcePkg}' deep-imports '${targetPkg}' internals via '${spec}'`,
      sourcePackage: sourcePkg,
      targetPackage: targetPkg,
      spec,
    });
  }

  const deduped = new Map<string, PackageBoundaryViolation>();
  for (const v of violations) {
    const key = `${v.file}:${v.line}:${v.rule}:${v.spec}`;
    deduped.set(key, v);
  }
  return [...deduped.values()];
}

export function lintPackageBoundary(root: string): Finding[] {
  const packagesRoot = join(root, 'packages');
  if (!existsSync(packagesRoot)) {
    return [];
  }

  const baselinePath = join(root, 'docs/architecture/package-boundary-baseline.json');
  const baselineKeys = new Set<string>();
  if (existsSync(baselinePath)) {
    const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as {
      violations?: Array<{ file: string; line: number; rule: string; spec: string }>;
    };
    for (const item of baseline.violations ?? []) {
      baselineKeys.add(`${item.file}:${item.line}:${item.rule}:${item.spec}`);
    }
  }

  const findings: Finding[] = [];
  let nonDagKeys = new Set<string>();

  for (const file of walk(packagesRoot)) {
    const fileRel = relative(root, file).replaceAll('\\', '/');
    if (fileRel.startsWith('tools/architectural-linter/')) {
      continue;
    }
    const source = readFileSync(file, 'utf8');
    const violations = lintPackageBoundarySource(root, file, source);
    for (const v of violations) {
      if (v.rule === RULE_ECONOMIC_AUTHORITY_DAG) {
        findings.push(toFinding(v));
        continue;
      }
      const key = `${v.file}:${v.line}:${v.rule}:${v.spec}`;
      nonDagKeys.add(key);
      if (!baselineKeys.has(key)) {
        findings.push(toFinding(v));
      }
    }
  }

  if (nonDagKeys.size > baselineKeys.size) {
    findings.push({
      rule: 'package-boundary-baseline-count',
      file: 'docs/architecture/package-boundary-baseline.json',
      line: 1,
      message: `package boundary violation count increased (${nonDagKeys.size} > baseline ${baselineKeys.size})`,
    });
  }

  return findings;
}
