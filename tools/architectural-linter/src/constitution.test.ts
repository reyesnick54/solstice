import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks, lintConstitution } from './constitution.ts';
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

    const policyReady = evaluateChunkRequirements(manifest, ['persistence', 'policy-engine'], 'CHUNK-8');
    assert.equal(policyReady.mustStop, false);
    assert.deepEqual(policyReady.missing, []);

    const planned = evaluateChunkRequirements(
      {
        ...manifest,
        capabilities: [
          ...manifest.capabilities,
          {
            id: 'future-protected-rail',
            status: 'PLANNED',
            protected: true,
            owner: 'test-fixture',
          },
        ],
      },
      ['persistence', 'future-protected-rail'],
      'CHUNK-TEST',
    );
    assert.equal(planned.mustStop, true);
    assert.equal(planned.missing.includes('persistence'), false);
    assert.ok(planned.missing.includes('future-protected-rail'));
  });

  it('CHUNK-12 capability gate is clear now that cards is IMPLEMENTED', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'cards').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'cards').owner, 'packages/cards');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-12',
    );
    assert.ok(declared, 'CHUNK-12 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.equal(declared.missing.includes('cards'), false);
    assert.equal(declared.missing.includes('identity'), false);
    assert.equal(declared.missing.includes('payments'), false);
    assert.equal(declared.missing.includes('security'), false);
    assert.deepEqual(declared.missing, []);
  });

  it('CHUNK-13 treasury owner is implemented at the reserved paths', () => {
    const manifest = loadManifest(REPO_ROOT);
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-13',
    );
    assert.ok(declared, 'CHUNK-13 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);
    assert.equal(evaluateCapability(manifest, 'treasury').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'cards').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'payments').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'fx').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'rail-adapters').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'personal-economic-graph').status, 'IMPLEMENTED');

    const treasury = manifest.boundedContexts.find((context) => context.id === 'TREASURY');
    assert.ok(treasury);
    assert.equal(treasury.status, 'PARTIAL');
    assert.deepEqual(treasury.reservedPaths, ['packages/treasury', 'services/treasury']);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/treasury')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'services/treasury')), true);
  });

  it('CHUNK-14 Personal Economic Graph requirements are IMPLEMENTED', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'personal-economic-graph').status, 'IMPLEMENTED');
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-14',
    );
    assert.ok(declared, 'CHUNK-14 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
  });

  it('CHUNK-15 capability gate is clear now that treasury and the agent are IMPLEMENTED', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'treasury').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'treasury').protected, true);
    assert.equal(evaluateCapability(manifest, 'treasury').owner, 'packages/treasury');
    assert.equal(evaluateCapability(manifest, 'personal-economic-graph').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'personal-economy-agent').status, 'IMPLEMENTED');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-15',
    );
    assert.ok(declared, 'CHUNK-15 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    const treasury = manifest.boundedContexts.find((context) => context.id === 'TREASURY');
    assert.ok(treasury);
    assert.equal(treasury.status, 'PARTIAL');
    assert.deepEqual(treasury.reservedPaths, ['packages/treasury', 'services/treasury']);

    const agent = manifest.boundedContexts.find((context) => context.id === 'PERSONAL_ECONOMY_AGENT');
    assert.ok(agent);
    assert.equal(agent.status, 'IMPLEMENTED');
    assert.deepEqual(agent.reservedPaths, ['packages/agent']);

    assert.equal(existsSync(join(REPO_ROOT, 'packages/treasury')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'services/treasury')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/agent')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'services/agent')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/personal-agent')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/financial-agent')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/economy-ai')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/growth-agent')), false);
  });

  it('CHUNK-20 investment risk and model registry capabilities are IMPLEMENTED', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'risk').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'model-registry').status, 'IMPLEMENTED');
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-20',
    );
    assert.ok(declared, 'CHUNK-20 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/risk')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/model-registry')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/investment-risk')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/risk-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/portfolio-risk')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/models')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/model-governance-v2')), false);
  });

  it('CHUNK-19 investment portfolio core capabilities are IMPLEMENTED', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'investments').status, 'IMPLEMENTED');
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-19',
    );
    assert.ok(declared, 'CHUNK-19 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/investments')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'services/investments')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/brokerage')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/portfolio')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/trading')), false);
  });

  it('CHUNK-16 mandate and Growth Orchestrator capabilities are IMPLEMENTED', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'personal-economy-agent').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'growth-orchestrator').status, 'IMPLEMENTED');
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-16',
    );
    assert.ok(declared, 'CHUNK-16 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
  });

  it('CHUNK-18 Regulatory Digital Twin capabilities are IMPLEMENTED', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'regulatory-digital-twin').status, 'IMPLEMENTED');
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-18',
    );
    assert.ok(declared, 'CHUNK-18 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/policy-engine-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/compliance-simulator-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/kernel-sandbox')), false);
  });

  it('CHUNK-17 Personal Economic Value Engine is IMPLEMENTED on packages/platform', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'personal-economic-value-engine').status, 'IMPLEMENTED');
    const peve = manifest.boundedContexts.find((context) => context.id === 'PERSONAL_ECONOMIC_VALUE_ENGINE');
    assert.ok(peve);
    assert.equal(peve.status, 'IMPLEMENTED');
    assert.deepEqual(peve.reservedPaths, ['packages/platform']);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/value-engine')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/peve')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/economic-score')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/personal-value')), false);
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-17',
    );
    assert.ok(declared, 'CHUNK-17 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
  });

  it('CHUNK-21 Agentic Capital Mesh is IMPLEMENTED after the historical stop', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'risk').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'risk').owner, 'packages/risk');
    assert.equal(evaluateCapability(manifest, 'model-registry').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'model-registry').owner, 'packages/model-registry');
    assert.equal(evaluateCapability(manifest, 'agentic-capital-mesh').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'agentic-capital-mesh').owner, 'packages/agentic-capital-mesh');
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-21',
    );
    assert.ok(declared, 'CHUNK-21 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    const risk = manifest.boundedContexts.find((context) => context.id === 'RISK');
    assert.ok(risk);
    assert.equal(risk.status, 'IMPLEMENTED');
    assert.deepEqual(risk.reservedPaths, ['packages/risk']);

    const registry = manifest.boundedContexts.find((context) => context.id === 'MODEL_REGISTRY');
    assert.ok(registry);
    assert.equal(registry.status, 'IMPLEMENTED');
    assert.deepEqual(registry.reservedPaths, ['packages/model-registry']);

    const mesh = manifest.boundedContexts.find((context) => context.id === 'AGENTIC_CAPITAL_MESH');
    assert.ok(mesh);
    assert.equal(mesh.status, 'IMPLEMENTED');
    assert.deepEqual(mesh.reservedPaths, ['packages/agentic-capital-mesh']);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/risk')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/model-registry')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/agentic-capital-mesh')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/trading-agents')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/investment-agents')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/hedge-agent')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/capital-ai')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/autonomous-trader')), false);
  });

  it('CHUNK-22 Strategy Lab is IMPLEMENTED at the reserved owners', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'strategy-lab').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'strategy-lab').owner, 'packages/strategy-lab');
    assert.equal(evaluateCapability(manifest, 'risk').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'model-registry').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'investments').status, 'IMPLEMENTED');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-22',
    );
    assert.ok(declared, 'CHUNK-22 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    const lab = manifest.boundedContexts.find((context) => context.id === 'STRATEGY_LAB');
    assert.ok(lab);
    assert.equal(lab.status, 'PARTIAL');
    assert.deepEqual(lab.reservedPaths, ['packages/strategy-lab', 'services/strategy-lab']);

    assert.equal(existsSync(join(REPO_ROOT, 'packages/strategy-lab')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'services/strategy-lab')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/backtest')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/trading-lab')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/quant')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/strategy-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/algo-trading')), false);
  });

  it('CHUNK-23 Personal Data Vault is IMPLEMENTED at the reserved path', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'personal-data-vault').status, 'IMPLEMENTED');
    const context = manifest.boundedContexts.find((row) => row.id === 'PERSONAL_DATA_VAULT');
    assert.ok(context);
    assert.equal(context.status, 'IMPLEMENTED');
    assert.deepEqual(context.reservedPaths, ['packages/personal-data-vault']);
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-23',
    );
    assert.ok(declared, 'CHUNK-23 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/personal-data-vault')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/user-data')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/data-wallet')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/privacy-compute')), false);
  });

  it('CHUNK-24 Consent Ledger is IMPLEMENTED at the reserved path', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'consent').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'consent').owner, 'packages/consent');
    const context = manifest.boundedContexts.find((row) => row.id === 'CONSENT');
    assert.ok(context);
    assert.equal(context.status, 'IMPLEMENTED');
    assert.deepEqual(context.reservedPaths, ['packages/consent']);
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-24',
    );
    assert.ok(declared, 'CHUNK-24 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/consent')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/privacy-consent')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/user-consent')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/purpose-firewall')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/consent-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/privacy-compute')), false);
  });

  it('CHUNK-25R Privacy Clean Room is IMPLEMENTED at the reserved path', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'personal-data-vault').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'identity').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'security').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'persistence').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'events').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'evidence').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'consent').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'consent').protected, true);
    assert.equal(evaluateCapability(manifest, 'consent').owner, 'packages/consent');
    assert.equal(evaluateCapability(manifest, 'purpose-firewall').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'clean-room').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'clean-room').owner, 'packages/clean-room');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-25',
    );
    assert.ok(declared, 'CHUNK-25 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    const consent = manifest.boundedContexts.find((context) => context.id === 'CONSENT');
    assert.ok(consent);
    assert.equal(consent.status, 'IMPLEMENTED');
    assert.deepEqual(consent.reservedPaths, ['packages/consent']);

    const cleanRoom = manifest.boundedContexts.find((context) => context.id === 'CLEAN_ROOM');
    assert.ok(cleanRoom);
    assert.equal(cleanRoom.status, 'IMPLEMENTED');
    assert.deepEqual(cleanRoom.reservedPaths, ['packages/clean-room']);

    assert.equal(existsSync(join(REPO_ROOT, 'packages/consent')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/clean-room')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/privacy-compute')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/data-clean-room')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/secure-data-room')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/research-room')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/clean-room-v2')), false);
  });

  it('CHUNK-26 remains unbuilt: coin package absent after Consent and Clean Room', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'personal-data-vault').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'consent').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'consent').protected, true);
    assert.equal(evaluateCapability(manifest, 'consent').owner, 'packages/consent');
    assert.equal(evaluateCapability(manifest, 'purpose-firewall').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'purpose-firewall').protected, true);
    assert.equal(evaluateCapability(manifest, 'clean-room').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'clean-room').protected, true);
    assert.equal(evaluateCapability(manifest, 'clean-room').owner, 'packages/clean-room');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-26',
    );
    assert.ok(declared, 'CHUNK-26 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);
    assert.equal(declared.missing.includes('personal-data-vault'), false);

    const coin = manifest.boundedContexts.find((context) => context.id === 'REYN_COIN');
    assert.ok(coin);
    assert.equal(coin.status, 'PLANNED');
    assert.deepEqual(coin.reservedPaths, ['packages/reyn-coin']);

    const exchange = manifest.boundedContexts.find((context) => context.id === 'REYN_EXCHANGE');
    assert.ok(exchange);
    assert.equal(exchange.status, 'PLANNED');
    assert.deepEqual(exchange.reservedPaths, ['packages/reyn-exchange']);

    const historicalExchange = manifest.boundedContexts.find(
      (context) => context.id === 'PYRAMID_DATA_EXCHANGE',
    );
    assert.ok(historicalExchange);
    assert.equal(historicalExchange.status, 'PLANNED');
    assert.match(historicalExchange.notes ?? '', /naming remains unresolved/i);

    assert.equal(
      manifest.boundedContexts.some((context) => context.id === 'PYRAMID'),
      false,
    );
    assert.equal(
      manifest.boundedContexts.some((context) => context.id === 'PYRAMID_EXCHANGE'),
      false,
    );

    assert.equal(existsSync(join(REPO_ROOT, 'packages/reyn-coin')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/reyn-exchange')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/reyn-ledger')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/token-ledger')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/crypto-ledger-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/consent')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/clean-room')), true);
  });
});
