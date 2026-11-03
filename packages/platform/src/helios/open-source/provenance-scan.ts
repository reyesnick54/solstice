/**
 * Third-party / open-source provenance scan for HELIOS integration paths.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const BINARY_EXTENSIONS = new Set([
  '.so',
  '.dll',
  '.dylib',
  '.exe',
  '.bin',
  '.wasm',
  '.jar',
  '.class',
  '.pyc',
  '.zip',
  '.tar',
  '.gz',
  '.7z',
]);

const CREDENTIAL_PATTERNS: readonly RegExp[] = Object.freeze([
  /AKIA[0-9A-Z]{16}/,
  /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/,
  /ghp_[A-Za-z0-9]{20,}/,
  /xox[baprs]-[A-Za-z0-9-]{10,}/,
]);

export type UpstreamProvenanceRecord = {
  readonly packageId: string;
  readonly upstreamRepository: string | null;
  readonly upstreamSha: string | null;
  readonly license: string | null;
  readonly copiedOrAdaptedPaths: readonly string[];
  readonly attributionRequired: boolean;
  readonly noticeRequired: boolean;
  readonly notices: readonly string[];
};

export type ProvenanceScanFinding = {
  readonly severity: 'ERROR' | 'WARN' | 'INFO';
  readonly code: string;
  readonly path: string;
  readonly detail: string;
};

export type OpenSourceProvenanceManifest = {
  readonly schema: 'sunrey.helios.open-source-provenance.v1';
  readonly scannedAt: string;
  readonly repositoryRoot: string;
  readonly gitSha: string;
  readonly upstreamPackages: readonly UpstreamProvenanceRecord[];
  readonly scanRoots: readonly string[];
  readonly findings: readonly ProvenanceScanFinding[];
  readonly binaryFilesFound: readonly string[];
  readonly credentialPatternHits: readonly string[];
  readonly pass: boolean;
};

function walkFiles(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    return out;
  }
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git') {
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

function loadUpstreamRegistry(root: string): UpstreamProvenanceRecord[] {
  const registryPath = join(
    root,
    'packages/platform/src/helios/open-source/provenance/upstream-registry.ts',
  );
  if (!existsSync(registryPath)) {
    return [];
  }
  const source = readFileSync(registryPath, 'utf8');
  const records: UpstreamProvenanceRecord[] = [];
  const blockRe =
    /packageId:\s*'([^']+)'[\s\S]*?upstreamRepository:\s*'([^']+)'[\s\S]*?upstreamSha:\s*'([^']+)'[\s\S]*?license:\s*'([^']+)'/g;
  let match: RegExpExecArray | null;
  while ((match = blockRe.exec(source)) !== null) {
    records.push(
      Object.freeze({
        packageId: match[1] ?? 'unknown',
        upstreamRepository: match[2] ?? null,
        upstreamSha: match[3] ?? null,
        license: match[4] ?? null,
        copiedOrAdaptedPaths: Object.freeze([]),
        attributionRequired: true,
        noticeRequired: true,
        notices: Object.freeze([]),
      }),
    );
  }
  return records;
}

export function scanOpenSourceProvenance(input: {
  readonly root: string;
  readonly gitSha: string;
  readonly scannedAt: string;
}): OpenSourceProvenanceManifest {
  const scanRoots = Object.freeze([
    'packages/platform/src/helios/open-source',
    'docs/helios/open-source',
  ]);
  const findings: ProvenanceScanFinding[] = [];
  const binaryFilesFound: string[] = [];
  const credentialPatternHits: string[] = [];

  for (const relRoot of scanRoots) {
    const abs = join(input.root, relRoot);
    if (!existsSync(abs)) {
      findings.push({
        severity: 'INFO',
        code: 'SCAN_ROOT_ABSENT',
        path: relRoot,
        detail: 'Scan root not present (expected until OS00–OS14 land)',
      });
      continue;
    }
    for (const file of walkFiles(abs)) {
      const rel = relative(input.root, file).replaceAll('\\', '/');
      const ext = rel.slice(rel.lastIndexOf('.')).toLowerCase();
      if (BINARY_EXTENSIONS.has(ext)) {
        binaryFilesFound.push(rel);
        findings.push({
          severity: 'ERROR',
          code: 'BINARY_IN_SOURCE_TREE',
          path: rel,
          detail: 'Binary artifact must not be committed in open-source integration tree',
        });
      }
      if (rel.endsWith('.ts') || rel.endsWith('.md') || rel.endsWith('.json')) {
        const text = readFileSync(file, 'utf8');
        for (const pattern of CREDENTIAL_PATTERNS) {
          if (pattern.test(text)) {
            credentialPatternHits.push(rel);
            findings.push({
              severity: 'ERROR',
              code: 'POSSIBLE_SECRET',
              path: rel,
              detail: 'Credential-like pattern detected; remove secrets from repository',
            });
          }
        }
      }
    }
  }

  const upstreamPackages = loadUpstreamRegistry(input.root);
  if (upstreamPackages.length === 0) {
    findings.push({
      severity: 'WARN',
      code: 'NO_UPSTREAM_REGISTRY',
      path: 'packages/platform/src/helios/open-source/provenance/upstream-registry.ts',
      detail: 'OS00 upstream registry not present; third-party provenance cannot be verified',
    });
  }

  for (const pkg of upstreamPackages) {
    if (!pkg.license?.trim()) {
      findings.push({
        severity: 'ERROR',
        code: 'MISSING_LICENSE',
        path: pkg.packageId,
        detail: 'Upstream package missing license declaration',
      });
    }
    if (!pkg.upstreamSha?.trim() || pkg.upstreamSha.length < 7) {
      findings.push({
        severity: 'ERROR',
        code: 'MISSING_UPSTREAM_SHA',
        path: pkg.packageId,
        detail: 'Upstream SHA must be pinned',
      });
    }
  }

  const pass =
    binaryFilesFound.length === 0 &&
    credentialPatternHits.length === 0 &&
    !findings.some((row) => row.severity === 'ERROR');

  const manifest: OpenSourceProvenanceManifest = Object.freeze({
    schema: 'sunrey.helios.open-source-provenance.v1',
    scannedAt: input.scannedAt,
    repositoryRoot: input.root,
    gitSha: input.gitSha,
    upstreamPackages: Object.freeze(upstreamPackages),
    scanRoots,
    findings: Object.freeze(findings),
    binaryFilesFound: Object.freeze(binaryFilesFound),
    credentialPatternHits: Object.freeze(credentialPatternHits),
    pass,
  });

  void createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
  return manifest;
}
