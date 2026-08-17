import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { classifyPackage, loadCryptoInventory, loadDependencyPolicy, loadJson } from './policy.ts';
import {
  LICENSES_REQUIRING_REVIEW,
  type AuditFinding,
  type LicenseRecord,
  type SoftwareComponent,
} from './types.ts';

export function sha256Text(text: string | Buffer): string {
  return createHash('sha256').update(text).digest('hex');
}

export function sha256File(root: string, rel: string): string | null {
  const path = join(root, rel);
  if (!existsSync(path)) {
    return null;
  }
  return sha256Text(readFileSync(path));
}

export function walkFiles(root: string, rel: string, out: string[] = []): string[] {
  const full = join(root, rel);
  if (!existsSync(full)) {
    return out;
  }
  const stat = statSync(full);
  if (stat.isDirectory()) {
    for (const entry of readdirSync(full).sort()) {
      if (entry === 'target' || entry === 'node_modules' || entry === '.git') {
        continue;
      }
      walkFiles(root, join(rel, entry), out);
    }
  } else {
    out.push(rel);
  }
  return out;
}

export function canonicalArtifactDigest(root: string, paths: readonly string[]): string {
  const hash = createHash('sha256');
  for (const rel of [...paths].sort()) {
    const bytes = existsSync(join(root, rel)) ? readFileSync(join(root, rel)) : Buffer.alloc(0);
    hash.update(rel);
    hash.update('\0');
    hash.update(bytes);
    hash.update('\n');
  }
  return hash.digest('hex');
}

type NpmLock = {
  readonly packages?: Record<string, { readonly version?: string; readonly license?: string; readonly resolved?: string; readonly integrity?: string; readonly dev?: boolean }>;
};

type CargoLock = {
  readonly package?: readonly { readonly name: string; readonly version: string; readonly source?: string; readonly checksum?: string }[];
};

function parseCargoLock(text: string): CargoLock['package'] {
  const packages: { name: string; version: string; source?: string; checksum?: string }[] = [];
  let current: { name: string; version: string; source?: string; checksum?: string } | null = null;
  for (const line of text.split('\n')) {
    if (line.trim() === '[[package]]') {
      if (current) {
        packages.push(current);
      }
      current = { name: '', version: '' };
      continue;
    }
    if (!current) {
      continue;
    }
    const match = /^(name|version|source|checksum) = "(.+)"$/.exec(line.trim());
    if (match) {
      const key = match[1] as 'name' | 'version' | 'source' | 'checksum';
      current[key] = match[2]!;
    }
  }
  if (current?.name) {
    packages.push(current);
  }
  return packages;
}

export function inventoryNpm(root: string): SoftwareComponent[] {
  const policy = loadDependencyPolicy(root);
  const lockPath = join(root, 'package-lock.json');
  if (!existsSync(lockPath)) {
    return [];
  }
  let lock: NpmLock;
  try {
    lock = JSON.parse(readFileSync(lockPath, 'utf8')) as NpmLock;
  } catch {
    return [];
  }
  const rows: SoftwareComponent[] = [];
  for (const [key, value] of Object.entries(lock.packages ?? {})) {
    if (!key || key === '') {
      continue;
    }
    const name = key.replace(/^node_modules\//, '');
    const classified = classifyPackage(policy, name, 'npm');
    rows.push({
      name,
      version: value.version ?? 'unknown',
      source: value.resolved ?? 'registry.npmjs.org',
      integrity: value.integrity ?? null,
      license: value.license ?? 'UNKNOWN',
      direct: !key.includes('/node_modules/'),
      role: value.dev ? 'dev' : 'runtime',
      ecosystem: 'npm',
      criticality: classified.criticality ?? null,
      classification: classified.classification,
    });
  }
  return rows;
}

export function inventoryCargo(root: string, lockRel: string): SoftwareComponent[] {
  const policy = loadDependencyPolicy(root);
  const path = join(root, lockRel);
  if (!existsSync(path)) {
    return [];
  }
  const packages = parseCargoLock(readFileSync(path, 'utf8')) ?? [];
  return packages.map((row) => {
    const classified = classifyPackage(policy, row.name, 'crates.io');
    return {
      name: row.name,
      version: row.version,
      source: row.source ?? 'crates.io',
      integrity: row.checksum ?? null,
      license: 'UNKNOWN',
      direct: !row.source,
      role: 'runtime' as const,
      ecosystem: 'crates.io' as const,
      criticality: classified.criticality ?? null,
      classification: classified.classification,
    };
  });
}

export function inventoryActions(root: string): SoftwareComponent[] {
  const pins = loadJson<{ actions: readonly { uses: string; version: string; commit: string }[] }>(
    root,
    'packages/sunrey-chain/supply-chain/action-pins.json',
  );
  return pins.actions.map((row) => ({
    name: row.uses,
    version: row.version,
    source: 'github.com',
    integrity: row.commit,
    license: 'UNKNOWN',
    direct: true,
    role: 'build' as const,
    ecosystem: 'github-actions' as const,
    criticality: null,
    classification: 'APPROVED' as const,
  }));
}

export function inventoryImages(root: string): SoftwareComponent[] {
  const pins = loadJson<{
    images: readonly { id: string; name: string; tag: string; digest: string | null }[];
  }>(root, 'packages/sunrey-chain/supply-chain/image-pins.json');
  return pins.images.map((row) => ({
    name: row.name,
    version: row.tag,
    source: row.name,
    integrity: row.digest,
    license: 'UNKNOWN',
    direct: true,
    role: 'build' as const,
    ecosystem: 'container' as const,
    criticality: null,
    classification: row.digest ? 'APPROVED' : 'REVIEW_REQUIRED',
  }));
}

export function inventoryToolchains(root: string): SoftwareComponent[] {
  const pins = loadJson<{
    pins: {
      rustWorkspace: { channel: string };
      rustNodeWorkspace: { channel: string };
      nodeRuntime: { version: string };
    };
  }>(root, 'packages/sunrey-chain/supply-chain/toolchain-pins.json');
  return [
    {
      name: 'rustc',
      version: pins.pins.rustWorkspace.channel,
      source: 'rust-lang.org',
      integrity: sha256File(root, 'packages/sunrey-chain/rust/rust-toolchain.toml'),
      license: 'Apache-2.0 OR MIT',
      direct: true,
      role: 'build',
      ecosystem: 'toolchain',
      criticality: null,
      classification: 'APPROVED',
    },
    {
      name: 'rustc-node-workspace',
      version: pins.pins.rustNodeWorkspace.channel,
      source: 'rust-lang.org',
      integrity: sha256File(root, 'packages/sunrey-chain/node/rust-toolchain.toml'),
      license: 'Apache-2.0 OR MIT',
      direct: true,
      role: 'build',
      ecosystem: 'toolchain',
      criticality: null,
      classification: 'APPROVED',
    },
    {
      name: 'node',
      version: pins.pins.nodeRuntime.version,
      source: 'nodejs.org',
      integrity: null,
      license: 'MIT',
      direct: true,
      role: 'runtime',
      ecosystem: 'toolchain',
      criticality: null,
      classification: 'APPROVED',
    },
  ];
}

export function inventoryFirstParty(): SoftwareComponent[] {
  return [
    {
      name: 'sunrey-crypto',
      version: '0.1.0',
      source: 'packages/sunrey-chain/rust/crates/crypto',
      integrity: null,
      license: 'UNLICENSED',
      direct: true,
      role: 'runtime',
      ecosystem: 'first-party',
      criticality: 'cryptography',
      classification: 'APPROVED',
    },
    {
      name: 'sunrey-consensus',
      version: '0.1.0',
      source: 'packages/sunrey-chain/rust/crates/consensus',
      integrity: null,
      license: 'UNLICENSED',
      direct: true,
      role: 'runtime',
      ecosystem: 'first-party',
      criticality: 'consensus',
      classification: 'APPROVED',
    },
    {
      name: 'sunrey-wallet',
      version: '0.1.0',
      source: 'packages/sunrey-chain/src/wallet',
      integrity: null,
      license: 'UNLICENSED',
      direct: true,
      role: 'runtime',
      ecosystem: 'first-party',
      criticality: 'wallet-signing',
      classification: 'APPROVED',
    },
    {
      name: 'sunrey-interop',
      version: '0.1.0',
      source: 'packages/sunrey-chain/src/interop',
      integrity: null,
      license: 'UNLICENSED',
      direct: true,
      role: 'runtime',
      ecosystem: 'first-party',
      criticality: 'interop-proofs',
      classification: 'APPROVED',
    },
    {
      name: 'solstice-security',
      version: '0.1.0',
      source: 'packages/security',
      integrity: null,
      license: 'UNLICENSED',
      direct: true,
      role: 'runtime',
      ecosystem: 'first-party',
      criticality: 'hsm-kms',
      classification: 'APPROVED',
    },
    {
      name: 'sunrey-chain-store',
      version: '0.1.0',
      source: 'packages/sunrey-chain/src/store.ts',
      integrity: null,
      license: 'UNLICENSED',
      direct: true,
      role: 'runtime',
      ecosystem: 'first-party',
      criticality: 'storage',
      classification: 'APPROVED',
    },
  ];
}

export function collectSoftwareInventory(root: string): SoftwareComponent[] {
  return [
    ...inventoryNpm(root),
    ...inventoryCargo(root, 'packages/sunrey-chain/rust/Cargo.lock'),
    ...inventoryCargo(root, 'packages/sunrey-chain/node/Cargo.lock'),
    ...inventoryActions(root),
    ...inventoryImages(root),
    ...inventoryToolchains(root),
    ...inventoryFirstParty(),
  ];
}

export function criticalDependencies(inventory: readonly SoftwareComponent[]): SoftwareComponent[] {
  return inventory.filter((row) => row.criticality !== null);
}

export function licenseInventory(components: readonly SoftwareComponent[]): LicenseRecord[] {
  return components.map((row) => {
    const reviewFlag = (LICENSES_REQUIRING_REVIEW as readonly string[]).includes(row.license);
    return {
      name: row.name,
      version: row.version,
      license: row.license,
      reviewFlag,
      reviewReason: reviewFlag ? 'license listed for human/legal review; no legal conclusion is made' : null,
      legalConclusion: null,
    };
  });
}

export function lockfileEnforcement(root: string): AuditFinding[] {
  const required = ['package-lock.json', 'packages/sunrey-chain/rust/Cargo.lock', 'packages/sunrey-chain/node/Cargo.lock'];
  return required.flatMap((rel) =>
    existsSync(join(root, rel))
      ? []
      : [
          {
            kind: 'unlocked_dependency' as const,
            name: rel,
            severity: 'fail' as const,
            detail: 'required lockfile is missing',
          },
        ],
  );
}

export function generatedSourceLock(root: string): { readonly sources: readonly string[]; readonly expectedDigest: string } {
  return loadJson(root, 'packages/sunrey-chain/supply-chain/generated-source-lock.json');
}

export function generatedSourceDigest(root: string): string {
  return canonicalArtifactDigest(root, generatedSourceLock(root).sources);
}

export function generatedSourceDrift(root: string, expected?: string): AuditFinding | null {
  const actual = generatedSourceDigest(root);
  const want = expected ?? generatedSourceLock(root).expectedDigest;
  if (actual === want) {
    return null;
  }
  return {
    kind: 'tampered_artifact',
    name: 'generated-source',
    severity: 'fail',
    detail: `generated-source digest ${actual} does not match lock ${want}`,
  };
}

export function inventoryUnsafeRust(root: string): { readonly crate: string; readonly unsafeBlocks: number; readonly forbidUnsafe: boolean }[] {
  const declared = loadJson<{
    crates: readonly { crate: string; path: string; forbidUnsafe: boolean }[];
  }>(root, 'packages/sunrey-chain/supply-chain/unsafe-rust-inventory.json');
  return declared.crates.map((row) => {
    const files = walkFiles(root, row.path).filter((path) => path.endsWith('.rs'));
    let unsafeBlocks = 0;
    for (const file of files) {
      const text = readFileSync(join(root, file), 'utf8');
      unsafeBlocks += (text.match(/\bunsafe\s*(?:\{|fn|impl|trait)\b/g) ?? []).length;
    }
    return { crate: row.crate, unsafeBlocks, forbidUnsafe: row.forbidUnsafe };
  });
}

export function networkDependencyPolicyFindings(root: string): AuditFinding[] {
  const forbidden = ['runtime' + ' remote plugin', 'eval' + '(fetch(', 'download' + 'MutableCode'];
  const scanRoots = ['packages/sunrey-chain/src/testnet', 'packages/sunrey-chain/src/ops', 'packages/sunrey-chain/node/src'];
  const findings: AuditFinding[] = [];
  for (const rel of scanRoots) {
    for (const file of walkFiles(root, rel)) {
      if (!file.endsWith('.ts') && !file.endsWith('.rs')) {
        continue;
      }
      const text = readFileSync(join(root, file), 'utf8');
      for (const token of forbidden) {
        if (text.includes(token)) {
          findings.push({
            kind: 'known_advisory',
            name: relative(root, join(root, file)),
            severity: 'fail',
            detail: `release builds must not download mutable code at execution time (${token})`,
          });
        }
      }
    }
  }
  return findings;
}

export function registeredCryptoNames(root: string): readonly string[] {
  return loadCryptoInventory(root).entries.map((row) => row.name);
}
