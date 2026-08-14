import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { lintConstitution } from './constitution.ts';
import {
  evaluateChunkRequirements,
  evaluateCapability,
  loadManifest,
  type ArchitectureManifest,
} from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

function writeJson(path: string, value: unknown): void {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function write(path: string, contents: string): void {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, contents);
}

function baseManifest(overrides: Record<string, unknown> = {}): ArchitectureManifest {
  const moneyPackage = {
    id: 'packages/money',
    npmName: '@solstice/money',
    path: 'packages/money',
    kind: 'package' as const,
    status: 'IMPLEMENTED' as const,
    protected: true,
    financialStateMutation: false,
    executionAuthorityRequired: false,
    kernelAuthorizationRequired: false,
    allowedDependencies: [] as string[],
    codeowners: ['@reyesnick54'],
  };
  const kernelPackage = {
    id: 'packages/kernel',
    npmName: '@solstice/kernel',
    path: 'packages/kernel',
    kind: 'package' as const,
    status: 'IMPLEMENTED' as const,
    protected: true,
    financialStateMutation: false,
    executionAuthorityRequired: false,
    kernelAuthorizationRequired: false,
    allowedDependencies: ['packages/money'],
    codeowners: ['@reyesnick54'],
  };
  return {
    schemaVersion: 1,
    name: 'fixture',
    purpose: 'test',
    codeownerDefault: '@reyesnick54',
    packages: [moneyPackage, kernelPackage],
    components: [
      {
        id: 'money',
        name: 'Money primitive',
        canonicalOwner: 'packages/money',
        canonicalPath: 'packages/money/src/money.ts',
        publicInterface: 'packages/money/src/index.ts',
        status: 'IMPLEMENTED',
        protected: true,
        financialStateMutation: false,
        executionAuthorityRequired: false,
        kernelAuthorizationRequired: false,
        protectedSymbols: [{ name: 'Money', kind: 'class' }],
        forbiddenAliases: ['packages/money-v2'],
        codeowners: ['@reyesnick54'],
      },
      {
        id: 'compliance-kernel',
        name: 'Compliance Kernel',
        canonicalOwner: 'packages/kernel',
        canonicalPath: 'packages/kernel/src/kernel.ts',
        publicInterface: 'packages/kernel/src/index.ts',
        status: 'IMPLEMENTED',
        protected: true,
        financialStateMutation: false,
        executionAuthorityRequired: false,
        kernelAuthorizationRequired: false,
        protectedSymbols: [{ name: 'ComplianceKernel', kind: 'class' }],
        forbiddenAliases: ['packages/compliance-kernel'],
        codeowners: ['@reyesnick54'],
      },
    ],
    authorizedMutationPaths: [
      {
        symbol: 'postJournal',
        file: 'packages/ledger/src/journal.ts',
        requiresExecutionAuthority: true,
        requiresKernel: true,
      },
    ],
    allowedCycles: [],
    forbiddenWorkspaceRoots: ['packages/compliance-kernel', 'src/kernel'],
    capabilities: [
      {
        id: 'money',
        status: 'IMPLEMENTED',
        owner: 'packages/money',
        protected: true,
      },
      {
        id: 'kernel',
        status: 'IMPLEMENTED',
        owner: 'packages/kernel',
        protected: true,
      },
      {
        id: 'persistence',
        status: 'PLANNED',
        owner: null,
        protected: true,
        adr: 'ADR-0008',
      },
    ],
    boundedContexts: [
      {
        id: 'IDENTITY',
        status: 'PLANNED',
        reservedPaths: ['packages/identity'],
        protected: true,
      },
    ],
    liveFlags: [],
    ...overrides,
  } as ArchitectureManifest;
}

function seedCanonicalTree(dir: string, manifest: ArchitectureManifest = baseManifest()): void {
  writeJson(join(dir, 'docs/architecture/manifest.json'), manifest);
  write(join(dir, 'packages/money/package.json'), '{"name":"@solstice/money"}\n');
  write(
    join(dir, 'packages/money/src/money.ts'),
    'export class Money {\n  readonly minorUnits: bigint = 0n;\n}\n',
  );
  write(join(dir, 'packages/money/src/index.ts'), "export { Money } from './money.ts';\n");
  write(join(dir, 'packages/kernel/package.json'), '{"name":"@solstice/kernel"}\n');
  write(
    join(dir, 'packages/kernel/src/kernel.ts'),
    'export class ComplianceKernel {\n  submit(): void {}\n}\n',
  );
  write(
    join(dir, 'packages/kernel/src/index.ts'),
    "export { ComplianceKernel } from './kernel.ts';\n",
  );
}

describe('architecture constitution', () => {
  it('accepts the current repository tree', () => {
    const findings = lintConstitution(REPO_ROOT);
    assert.deepEqual(findings, []);
  });

  it('fails when a second Money implementation is registered', () => {
    const dir = mkdtempSync(join(tmpdir(), 'solstice-const-money-'));
    try {
      seedCanonicalTree(dir);
      write(join(dir, 'packages/kernel/src/fake-money.ts'), 'export class Money {\n  n = 1n;\n}\n');
      const hit = lintConstitution(dir).find((f) => f.rule === 'duplicate-protected-system');
      assert.ok(hit);
      assert.match(hit.file, /fake-money\.ts$/);
      assert.match(hit.message, /Money/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('fails when a second Compliance Kernel is registered', () => {
    const dir = mkdtempSync(join(tmpdir(), 'solstice-const-kernel-'));
    try {
      seedCanonicalTree(dir);
      write(
        join(dir, 'packages/money/src/other-kernel.ts'),
        'export class ComplianceKernel {\n  decide(): void {}\n}\n',
      );
      const hit = lintConstitution(dir).find((f) => f.rule === 'duplicate-protected-system');
      assert.ok(hit);
      assert.match(hit.message, /ComplianceKernel/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('fails a prohibited package dependency', () => {
    const dir = mkdtempSync(join(tmpdir(), 'solstice-const-dep-fail-'));
    try {
      seedCanonicalTree(dir);
      write(
        join(dir, 'packages/money/src/money.ts'),
        "import { ComplianceKernel } from '../../kernel/src/kernel.ts';\nexport class Money {}\n",
      );
      const hit = lintConstitution(dir).find((f) => f.rule === 'illegal-package-dependency');
      assert.ok(hit);
      assert.match(hit.message, /packages\/money.*packages\/kernel/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('passes a permitted package dependency', () => {
    const dir = mkdtempSync(join(tmpdir(), 'solstice-const-dep-pass-'));
    try {
      seedCanonicalTree(dir);
      write(
        join(dir, 'packages/kernel/src/kernel.ts'),
        "import { Money } from '../../money/src/money.ts';\nexport class ComplianceKernel {\n  readonly sample = Money;\n}\n",
      );
      const findings = lintConstitution(dir).filter((f) => f.rule === 'illegal-package-dependency');
      assert.deepEqual(findings, []);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('fails a protected financial mutation path bypass', () => {
    const dir = mkdtempSync(join(tmpdir(), 'solstice-const-mut-'));
    try {
      const manifest = baseManifest();
      seedCanonicalTree(dir, manifest);
      write(
        join(dir, 'packages/money/src/evil.ts'),
        'export function postJournal(request: unknown): void {\n  void request;\n}\n',
      );
      const hit = lintConstitution(dir).find((f) => f.rule === 'financial-mutation-bypass');
      assert.ok(hit);
      assert.match(hit.message, /postJournal/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('passes a planned bounded context that is only declared', () => {
    const dir = mkdtempSync(join(tmpdir(), 'solstice-const-planned-'));
    try {
      seedCanonicalTree(dir);
      const findings = lintConstitution(dir).filter(
        (f) => f.rule === 'planned-context-silently-implemented',
      );
      assert.deepEqual(findings, []);
      const manifest = loadManifest(dir);
      const identity = manifest.boundedContexts.find((ctx) => ctx.id === 'IDENTITY');
      assert.equal(identity?.status, 'PLANNED');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('fails duplicated protected ownership in the manifest', () => {
    const dir = mkdtempSync(join(tmpdir(), 'solstice-const-dup-own-'));
    try {
      const manifest = baseManifest({
        components: [
          ...baseManifest().components,
          {
            id: 'money-fork',
            name: 'Competing money',
            canonicalOwner: 'packages/money',
            canonicalPath: 'packages/money/src/other.ts',
            publicInterface: 'packages/money/src/index.ts',
            status: 'IMPLEMENTED',
            protected: true,
            financialStateMutation: false,
            executionAuthorityRequired: false,
            kernelAuthorizationRequired: false,
            protectedSymbols: [{ name: 'Money', kind: 'class' }],
            forbiddenAliases: [],
            codeowners: ['@reyesnick54'],
          },
        ],
      });
      seedCanonicalTree(dir, manifest);
      const hit = lintConstitution(dir).find((f) => f.rule === 'duplicate-protected-ownership');
      assert.ok(hit);
      assert.match(hit.message, /Money/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('fails an unregistered workspace package', () => {
    const dir = mkdtempSync(join(tmpdir(), 'solstice-const-unreg-'));
    try {
      seedCanonicalTree(dir);
      write(join(dir, 'packages/shadow-kernel/package.json'), '{"name":"@solstice/shadow-kernel"}\n');
      write(join(dir, 'packages/shadow-kernel/src/index.ts'), 'export const x = 1;\n');
      const hit = lintConstitution(dir).find((f) => f.rule === 'unregistered-workspace-package');
      assert.ok(hit);
      assert.match(hit.file, /shadow-kernel/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('evaluates chunk requirements and requires stop when a protected dependency is not IMPLEMENTED', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'money').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'persistence').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'no-such-capability').status, 'ABSENT');

    const implemented = evaluateChunkRequirements(manifest, ['money', 'kernel'], 'CHUNK-1');
    assert.equal(implemented.mustStop, false);
    assert.deepEqual(implemented.missing, []);

    const planned = evaluateChunkRequirements(manifest, ['persistence', 'no-such-capability'], 'CHUNK-9');
    assert.equal(planned.mustStop, true);
    assert.equal(planned.missing.includes('persistence'), false);
    assert.ok(planned.missing.includes('no-such-capability'));
  });
});
