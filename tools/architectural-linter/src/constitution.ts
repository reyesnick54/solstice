import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, normalize, relative, resolve } from 'node:path';

import type { Finding } from './linter.ts';
import {
  CHUNKS_RELATIVE_DIR,
  evaluateChunkRequirements,
  loadManifest,
  npmNameToPackageId,
  normalizeCycle,
  type ArchitectureManifest,
  type ChunkDeclaration,
  type ChunkEvaluation,
} from './manifest.ts';

const SKIP_DIR = new Set(['node_modules', '.git', 'dist', 'coverage', '__pycache__', 'target']);
const WORKSPACE_ROOTS = ['packages', 'services', 'tools', 'apps'] as const;

const IMPORT_RE =
  /(?:from\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|require\s*\(\s*['"]([^'"]+)['"]\s*\))/g;

const DEFINITION_EXPORT_RE =
  /^\s*export\s+(?:default\s+)?(?:async\s+)?(?:abstract\s+)?(class|interface|type|const|function)\s+([A-Za-z_][A-Za-z0-9_]*)\b/;

const MUTATOR_DEFINITION_RE =
  /(?:export\s+)?(?:async\s+)?function\s+(postJournal|openAccount|commitJournal|appendJournal|putCustomer|putAccount|createAccount)\s*\(/;

const MUTATOR_METHOD_RE =
  /^\s+(postJournal|openAccount)\s*\(/;

const MONEY_MOVEMENT_METHOD_RE =
  /^\s+(deposit|withdraw|transfer)\s*\(\s*intent\b/;

function walkFiles(dir: string, out: string[] = []): string[] {
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
      walkFiles(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

function isTestOrDemo(rel: string): boolean {
  const posix = rel.replaceAll('\\', '/');
  const name = posix.split('/').pop() ?? '';
  return (
    posix.includes('/tests/') ||
    name.endsWith('.test.ts') ||
    name.endsWith('.test.js') ||
    name.endsWith('.spec.ts') ||
    name === 'demo.ts'
  );
}

function isCodeFile(rel: string): boolean {
  return /\.(ts|tsx|js|mjs|cjs)$/.test(rel) && !rel.endsWith('.d.ts');
}

function packageIdFromRel(rel: string): string | undefined {
  const posix = rel.replaceAll('\\', '/');
  const match = /^(packages|services|tools|apps)\/([^/]+)/.exec(posix);
  if (!match) {
    return undefined;
  }
  return `${match[1]}/${match[2]}`;
}

function listWorkspacePackages(root: string): string[] {
  const found: string[] = [];
  for (const workspace of WORKSPACE_ROOTS) {
    const base = join(root, workspace);
    if (!existsSync(base) || !statSync(base).isDirectory()) {
      continue;
    }
    for (const entry of readdirSync(base)) {
      const dir = join(base, entry);
      if (!statSync(dir).isDirectory()) {
        continue;
      }
      if (existsSync(join(dir, 'package.json'))) {
        found.push(`${workspace}/${entry}`);
      }
    }
  }
  return found.sort();
}

function resolveImportToPackage(
  manifest: ArchitectureManifest,
  fromRel: string,
  spec: string,
): string | undefined {
  if (spec.startsWith('@solstice/')) {
    const remainder = spec.slice('@solstice/'.length);
    const npmName = `@solstice/${remainder.split('/')[0] ?? ''}`;
    return npmNameToPackageId(manifest, npmName);
  }
  if (!spec.startsWith('.')) {
    return undefined;
  }
  const fromDir = dirname(fromRel.replaceAll('\\', '/'));
  let resolved = normalize(`${fromDir}/${spec}`).replaceAll('\\', '/');
  if (resolved.startsWith('..')) {
    return undefined;
  }
  if (!/\.(ts|tsx|js|mjs|cjs)$/.test(resolved)) {
    if (existsSync(resolved) && statSync(resolved).isDirectory()) {
      resolved = `${resolved}/index.ts`;
    } else {
      resolved = `${resolved}.ts`;
    }
  }
  return packageIdFromRel(resolved);
}

function productionCodeFiles(root: string): string[] {
  const files: string[] = [];
  for (const workspace of WORKSPACE_ROOTS) {
    files.push(...walkFiles(join(root, workspace)));
  }
  return files
    .map((file) => relative(root, file).replaceAll('\\', '/'))
    .filter((rel) => isCodeFile(rel) && !isTestOrDemo(rel))
    .sort();
}

function buildImportGraph(
  root: string,
  manifest: ArchitectureManifest,
): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();
  for (const pkg of manifest.packages) {
    graph.set(pkg.id, new Set());
  }
  for (const rel of productionCodeFiles(root)) {
    const fromPkg = packageIdFromRel(rel);
    if (!fromPkg || !graph.has(fromPkg)) {
      continue;
    }
    const source = readFileSync(join(root, rel), 'utf8');
    IMPORT_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = IMPORT_RE.exec(source)) !== null) {
      const spec = match[1] ?? match[2] ?? match[3] ?? '';
      const toPkg = resolveImportToPackage(manifest, rel, spec);
      if (toPkg && toPkg !== fromPkg) {
        graph.get(fromPkg)!.add(toPkg);
      }
    }
  }
  return graph;
}

function findSimpleCycles(graph: Map<string, Set<string>>): string[][] {
  const found = new Map<string, string[]>();

  function rec(start: string, current: string, path: string[], visiting: Set<string>): void {
    for (const next of graph.get(current) ?? []) {
      if (next === start && path.length >= 2) {
        const members = [...new Set(path)].sort();
        const key = members.join('|');
        if (!found.has(key)) {
          found.set(key, members);
        }
      } else if (!visiting.has(next) && path.length < 8) {
        visiting.add(next);
        rec(start, next, [...path, next], visiting);
        visiting.delete(next);
      }
    }
  }

  for (const node of graph.keys()) {
    rec(node, node, [node], new Set([node]));
  }
  return [...found.values()];
}

function finding(
  rule: string,
  file: string,
  line: number,
  message: string,
): Finding {
  return { rule, file, line, message };
}

function checkManifestIntegrity(manifest: ArchitectureManifest): Finding[] {
  const findings: Finding[] = [];
  const packageIds = new Set<string>();
  for (const pkg of manifest.packages) {
    if (packageIds.has(pkg.id)) {
      findings.push(
        finding(
          'duplicate-protected-ownership',
          MANIFEST_FILE,
          1,
          `package id '${pkg.id}' is registered more than once`,
        ),
      );
    }
    packageIds.add(pkg.id);
  }

  const symbolOwners = new Map<string, string>();
  const componentIds = new Set<string>();
  for (const component of manifest.components) {
    if (componentIds.has(component.id)) {
      findings.push(
        finding(
          'duplicate-protected-ownership',
          MANIFEST_FILE,
          1,
          `component id '${component.id}' is registered more than once`,
        ),
      );
    }
    componentIds.add(component.id);
    if (component.protected && !packageIds.has(component.canonicalOwner) && component.status === 'IMPLEMENTED') {
      findings.push(
        finding(
          'missing-canonical-owner',
          MANIFEST_FILE,
          1,
          `protected component '${component.id}' owner '${component.canonicalOwner}' is not a registered package`,
        ),
      );
    }
    for (const symbol of component.protectedSymbols) {
      const key = `${symbol.kind}:${symbol.name}`;
      const existing = symbolOwners.get(key);
      if (existing && existing !== component.id) {
        findings.push(
          finding(
            'duplicate-protected-ownership',
            MANIFEST_FILE,
            1,
            `protected symbol ${symbol.name} is claimed by '${existing}' and '${component.id}'`,
          ),
        );
      }
      symbolOwners.set(key, component.id);
    }
  }

  const capabilityIds = new Set<string>();
  for (const capability of manifest.capabilities) {
    if (capabilityIds.has(capability.id)) {
      findings.push(
        finding(
          'duplicate-protected-ownership',
          MANIFEST_FILE,
          1,
          `capability id '${capability.id}' is registered more than once`,
        ),
      );
    }
    capabilityIds.add(capability.id);
  }
  return findings;
}

const MANIFEST_FILE = 'docs/architecture/manifest.json';

function checkCanonicalPaths(root: string, manifest: ArchitectureManifest): Finding[] {
  const findings: Finding[] = [];
  for (const component of manifest.components) {
    if (component.status !== 'IMPLEMENTED' && component.status !== 'PARTIAL') {
      continue;
    }
    if (!existsSync(join(root, component.canonicalPath))) {
      findings.push(
        finding(
          'missing-canonical-owner',
          component.canonicalPath,
          1,
          `canonical path for '${component.id}' is missing`,
        ),
      );
    }
    if (!existsSync(join(root, component.canonicalOwner))) {
      findings.push(
        finding(
          'missing-canonical-owner',
          component.canonicalOwner,
          1,
          `canonical owner for '${component.id}' is missing`,
        ),
      );
    }
  }
  for (const path of manifest.authorizedMutationPaths) {
    if (!existsSync(join(root, path.file))) {
      findings.push(
        finding(
          'missing-authorized-mutation-path',
          path.file,
          1,
          `authorized mutation path for ${path.symbol} is missing`,
        ),
      );
    }
  }
  return findings;
}

function checkForbiddenAndUnlisted(root: string, manifest: ArchitectureManifest): Finding[] {
  const findings: Finding[] = [];
  const registered = new Set(manifest.packages.map((pkg) => pkg.id));

  for (const id of listWorkspacePackages(root)) {
    if (!registered.has(id)) {
      findings.push(
        finding(
          'unregistered-workspace-package',
          `${id}/package.json`,
          1,
          `workspace package '${id}' is not registered in the architecture manifest`,
        ),
      );
    }
  }

  for (const alias of manifest.forbiddenWorkspaceRoots) {
    if (existsSync(join(root, alias))) {
      findings.push(
        finding(
          'forbidden-competing-path',
          alias,
          1,
          `forbidden competing path '${alias}' exists; use the canonical owner in the manifest`,
        ),
      );
    }
  }

  for (const component of manifest.components) {
    for (const alias of component.forbiddenAliases) {
      if (existsSync(join(root, alias))) {
        findings.push(
          finding(
            'duplicate-protected-system',
            alias,
            1,
            `forbidden alias '${alias}' for '${component.id}' exists; canonical owner is ${component.canonicalOwner}`,
          ),
        );
      }
    }
  }

  for (const context of manifest.boundedContexts) {
    if (context.status !== 'PLANNED') {
      continue;
    }
    for (const reserved of context.reservedPaths) {
      const pkgJson = join(root, reserved, 'package.json');
      const src = join(root, reserved, 'src');
      if (existsSync(pkgJson) || existsSync(src)) {
        findings.push(
          finding(
            'planned-context-silently-implemented',
            reserved,
            1,
            `planned bounded context ${context.id} has files at '${reserved}'; update the manifest to PARTIAL or IMPLEMENTED and keep this reserved path`,
          ),
        );
      }
    }
  }

  return findings;
}

function checkProtectedSymbolExports(root: string, manifest: ArchitectureManifest): Finding[] {
  const findings: Finding[] = [];
  const symbols = manifest.components.flatMap((component) =>
    component.protectedSymbols.map((symbol) => ({ component, symbol })),
  );

  for (const rel of productionCodeFiles(root)) {
    if (rel.startsWith('tools/architectural-linter/')) {
      continue;
    }
    const source = readFileSync(join(root, rel), 'utf8');
    const lines = source.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] ?? '';
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
        continue;
      }
      const def = DEFINITION_EXPORT_RE.exec(line);
      if (!def) {
        continue;
      }
      const exportedKind = def[1];
      const exportedName = def[2];
      if (!exportedKind || !exportedName) {
        continue;
      }
      if (exportedKind === 'type' && /^\s*export\s+type\s+\{/.test(line)) {
        continue;
      }
      for (const { component, symbol } of symbols) {
        if (symbol.name !== exportedName) {
          continue;
        }
        if (rel === component.canonicalPath) {
          continue;
        }
        findings.push(
          finding(
            'duplicate-protected-system',
            rel,
            i + 1,
            `protected ${symbol.kind} '${symbol.name}' is defined outside canonical path ${component.canonicalPath}`,
          ),
        );
      }
    }
  }
  return findings;
}

function checkDependencies(root: string, manifest: ArchitectureManifest): Finding[] {
  const findings: Finding[] = [];
  const graph = buildImportGraph(root, manifest);
  const allowed = new Map(
    manifest.packages.map((pkg) => [pkg.id, new Set(pkg.allowedDependencies)]),
  );

  for (const [from, dests] of graph) {
    const permit = allowed.get(from) ?? new Set();
    for (const dest of dests) {
      if (!permit.has(dest)) {
        findings.push(
          finding(
            'illegal-package-dependency',
            from,
            1,
            `'${from}' imports '${dest}', which is not an allowed dependency`,
          ),
        );
      }
    }
  }

  const allowedCycleKeys = new Set(manifest.allowedCycles.map((cycle) => normalizeCycle(cycle)));
  for (const cycle of findSimpleCycles(graph)) {
    const key = normalizeCycle(cycle);
    if (!allowedCycleKeys.has(key)) {
      findings.push(
        finding(
          'circular-protected-dependency',
          MANIFEST_FILE,
          1,
          `circular dependency between ${cycle.join(' → ')} is not in allowedCycles`,
        ),
      );
    }
  }

  return findings;
}

function checkMutationDefinitions(root: string, manifest: ArchitectureManifest): Finding[] {
  const findings: Finding[] = [];
  const authorized = new Set(manifest.authorizedMutationPaths.map((path) => path.file));
  const authorizedBySymbol = new Map<string, string[]>();
  for (const path of manifest.authorizedMutationPaths) {
    const list = authorizedBySymbol.get(path.symbol) ?? [];
    list.push(path.file);
    authorizedBySymbol.set(path.symbol, list);
  }

  for (const rel of productionCodeFiles(root)) {
    if (rel.startsWith('tools/architectural-linter/') || rel.startsWith('scripts/')) {
      continue;
    }
    const source = readFileSync(join(root, rel), 'utf8');
    const lines = source.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] ?? '';
      const fn = MUTATOR_DEFINITION_RE.exec(line);
      if (fn) {
        const symbol = fn[1] ?? '';
        const allowedFiles = authorizedBySymbol.get(symbol) ?? [];
        if (!allowedFiles.includes(rel)) {
          findings.push(
            finding(
              'financial-mutation-bypass',
              rel,
              i + 1,
              `state-changing symbol ${symbol} is defined outside authorized paths`,
            ),
          );
        }
      }
      if (MUTATOR_METHOD_RE.test(line) && !authorized.has(rel)) {
        const symbol = line.trim().split('(')[0]?.trim() ?? '';
        findings.push(
          finding(
            'financial-mutation-bypass',
            rel,
            i + 1,
            `state-changing method ${symbol} is defined outside authorized paths`,
          ),
        );
      }
      if (MONEY_MOVEMENT_METHOD_RE.test(line) && !authorized.has(rel)) {
        findings.push(
          finding(
            'financial-mutation-bypass',
            rel,
            i + 1,
            'money-movement method defined outside services/accounts/src/money-movement.ts',
          ),
        );
      }
    }
  }
  return findings;
}

function loadChunkDeclarations(root: string): ChunkDeclaration[] {
  const dir = join(root, CHUNKS_RELATIVE_DIR);
  if (!existsSync(dir)) {
    return [];
  }
  const declarations: ChunkDeclaration[] = [];
  for (const entry of readdirSync(dir)) {
    if (!entry.endsWith('.json')) {
      continue;
    }
    const parsed = JSON.parse(readFileSync(join(dir, entry), 'utf8')) as ChunkDeclaration;
    if (typeof parsed.chunk !== 'string' || !Array.isArray(parsed.requires)) {
      continue;
    }
    declarations.push(parsed);
  }
  return declarations;
}

export function evaluateDeclaredChunks(
  root: string,
  manifest: ArchitectureManifest,
): ChunkEvaluation[] {
  return loadChunkDeclarations(root).map((declaration) =>
    evaluateChunkRequirements(manifest, declaration.requires, declaration.chunk),
  );
}

export function lintConstitution(root: string): Finding[] {
  let manifest: ArchitectureManifest;
  try {
    manifest = loadManifest(root);
  } catch (error) {
    return [
      finding(
        'missing-architecture-manifest',
        MANIFEST_FILE,
        1,
        error instanceof Error ? error.message : 'unable to load architecture manifest',
      ),
    ];
  }

  return [
    ...checkManifestIntegrity(manifest),
    ...checkCanonicalPaths(root, manifest),
    ...checkForbiddenAndUnlisted(root, manifest),
    ...checkProtectedSymbolExports(root, manifest),
    ...checkDependencies(root, manifest),
    ...checkMutationDefinitions(root, manifest),
  ];
}

export function lintConstitutionAt(root: string): {
  readonly findings: Finding[];
  readonly manifest: ArchitectureManifest | null;
  readonly chunks: ChunkEvaluation[];
} {
  try {
    const manifest = loadManifest(resolve(root));
    return {
      findings: lintConstitution(root),
      manifest,
      chunks: evaluateDeclaredChunks(root, manifest),
    };
  } catch {
    return { findings: lintConstitution(root), manifest: null, chunks: [] };
  }
}
