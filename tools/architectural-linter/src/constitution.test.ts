import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
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

  it('CHUNK-26 implements SunRey Coin after Consent and Clean Room', () => {
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
    assert.equal(evaluateCapability(manifest, 'sunrey-coin').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-coin').protected, true);
    assert.equal(evaluateCapability(manifest, 'sunrey-coin').owner, 'packages/sunrey-coin');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-26',
    );
    assert.ok(declared, 'CHUNK-26 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    const coin = manifest.boundedContexts.find((context) => context.id === 'SUNREY_COIN');
    assert.ok(coin);
    assert.equal(coin.status, 'IMPLEMENTED');
    assert.deepEqual(coin.reservedPaths, ['packages/sunrey-coin']);

    const exchange = manifest.boundedContexts.find((context) => context.id === 'SUNREY_EXCHANGE');
    assert.ok(exchange);
    assert.equal(exchange.status, 'IMPLEMENTED');
    assert.deepEqual(exchange.reservedPaths, ['packages/sunrey-exchange']);

    const chain = manifest.boundedContexts.find((context) => context.id === 'SUNREY_CHAIN');
    assert.ok(chain);
    assert.equal(chain.status, 'IMPLEMENTED');
    assert.deepEqual(chain.reservedPaths, ['packages/sunrey-chain']);

    assert.equal(
      manifest.boundedContexts.some((context) => context.id === 'PYRAMID_DATA_EXCHANGE'),
      false,
    );
    const informationMarket = manifest.boundedContexts.find(
      (context) => context.id === 'SUNREY_INFORMATION_MARKET',
    );
    assert.ok(informationMarket);
    assert.equal(informationMarket.status, 'IMPLEMENTED');
    assert.deepEqual(informationMarket.reservedPaths, ['packages/information-market']);

    assert.equal(
      manifest.boundedContexts.some((context) => context.id === 'PYRAMID'),
      false,
    );
    assert.equal(
      manifest.boundedContexts.some((context) => context.id === 'PYRAMID_EXCHANGE'),
      false,
    );
    assert.equal(
      manifest.boundedContexts.some((context) => context.id === 'REYN_COIN'),
      false,
    );
    assert.equal(
      manifest.boundedContexts.some((context) => context.id === 'REYN_EXCHANGE'),
      false,
    );

    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-coin')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/reyn-coin')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/reyn-exchange')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-exchange')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/reyn-ledger')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-ledger')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/token-ledger')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/crypto-ledger-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/consent')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/clean-room')), true);
  });

  it('CHUNK-27 implements the Human Information Network marketplace after Clean Room and SunRey Coin', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'personal-data-vault').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'consent').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'purpose-firewall').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'clean-room').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-coin').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'information-market').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'information-market').protected, true);
    assert.equal(evaluateCapability(manifest, 'information-market').owner, 'packages/information-market');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-27',
    );
    assert.ok(declared, 'CHUNK-27 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    const market = manifest.boundedContexts.find(
      (context) => context.id === 'SUNREY_INFORMATION_MARKET',
    );
    assert.ok(market);
    assert.equal(market.status, 'IMPLEMENTED');
    assert.deepEqual(market.reservedPaths, ['packages/information-market']);
    assert.equal(
      manifest.boundedContexts.some((context) => context.id === 'PYRAMID_DATA_EXCHANGE'),
      false,
    );

    const exchange = manifest.boundedContexts.find((context) => context.id === 'SUNREY_EXCHANGE');
    assert.ok(exchange);
    assert.equal(exchange.status, 'IMPLEMENTED');
    const chain = manifest.boundedContexts.find((context) => context.id === 'SUNREY_CHAIN');
    assert.ok(chain);
    assert.equal(chain.status, 'IMPLEMENTED');

    assert.equal(existsSync(join(REPO_ROOT, 'packages/information-market')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/pyramid-data-exchange')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/data-exchange')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-data-exchange')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/personal-oracle')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/information-market-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/proof-of-contribution')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-exchange')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain')), true);
  });

  it('CHUNK-28 implements SunRey Chain after Clean Room, Coin, and the information market', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'personal-data-vault').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'consent').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'purpose-firewall').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'clean-room').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-coin').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'information-market').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-chain').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-chain').protected, true);
    assert.equal(evaluateCapability(manifest, 'sunrey-chain').owner, 'packages/sunrey-chain');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-28',
    );
    assert.ok(declared, 'CHUNK-28 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    const chain = manifest.boundedContexts.find((context) => context.id === 'SUNREY_CHAIN');
    assert.ok(chain);
    assert.equal(chain.status, 'IMPLEMENTED');
    assert.deepEqual(chain.reservedPaths, ['packages/sunrey-chain']);

    const exchange = manifest.boundedContexts.find((context) => context.id === 'SUNREY_EXCHANGE');
    assert.ok(exchange);
    assert.equal(exchange.status, 'IMPLEMENTED');

    const chainPackage = manifest.packages.find((pkg) => pkg.id === 'packages/sunrey-chain');
    assert.ok(chainPackage);
    assert.equal(chainPackage.financialStateMutation, false);
    assert.equal(chainPackage.executionAuthorityRequired, false);

    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/blockchain')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/reyn-chain')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/on-chain-ledger')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/crypto-chain')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-exchange')), true);
  });

  it('CHUNK-29 implements SunRey Exchange after Clean Room, Coin, information market, and Chain', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'clean-room').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-coin').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'information-market').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-chain').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-exchange').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-exchange').protected, true);
    assert.equal(evaluateCapability(manifest, 'sunrey-exchange').owner, 'packages/sunrey-exchange');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-29',
    );
    assert.ok(declared, 'CHUNK-29 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    const exchange = manifest.boundedContexts.find((context) => context.id === 'SUNREY_EXCHANGE');
    assert.ok(exchange);
    assert.equal(exchange.status, 'IMPLEMENTED');
    assert.deepEqual(exchange.reservedPaths, ['packages/sunrey-exchange']);

    const exchangePackage = manifest.packages.find((pkg) => pkg.id === 'packages/sunrey-exchange');
    assert.ok(exchangePackage);
    assert.equal(exchangePackage.financialStateMutation, true);
    assert.equal(exchangePackage.executionAuthorityRequired, true);

    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-exchange')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/exchange-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/orderbook')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/matching-engine-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/crypto-exchange')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/reyn-exchange')), false);
  });

  it('CHUNK-30 implements custody and market-surveillance on reserved owners', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'identity').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'security').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'compliance-screening').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'regulatory-digital-twin').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'ledger').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'events').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'evidence').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'consent').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'clean-room').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-coin').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-exchange').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-chain').status, 'IMPLEMENTED');

    assert.equal(evaluateCapability(manifest, 'custody').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'custody').protected, true);
    assert.equal(evaluateCapability(manifest, 'custody').owner, 'packages/custody');
    assert.equal(evaluateCapability(manifest, 'market-surveillance').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'market-surveillance').protected, true);
    assert.equal(
      evaluateCapability(manifest, 'market-surveillance').owner,
      'packages/market-surveillance',
    );

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-30',
    );
    assert.ok(declared, 'CHUNK-30 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    const custody = manifest.boundedContexts.find((context) => context.id === 'CUSTODY');
    assert.ok(custody);
    assert.equal(custody.status, 'IMPLEMENTED');
    assert.deepEqual(custody.reservedPaths, ['packages/custody']);

    const surveillance = manifest.boundedContexts.find(
      (context) => context.id === 'MARKET_SURVEILLANCE',
    );
    assert.ok(surveillance);
    assert.equal(surveillance.status, 'IMPLEMENTED');
    assert.deepEqual(surveillance.reservedPaths, ['packages/market-surveillance']);

    const custodyPackage = manifest.packages.find((pkg) => pkg.id === 'packages/custody');
    assert.ok(custodyPackage);
    assert.equal(custodyPackage.financialStateMutation, true);
    assert.equal(custodyPackage.executionAuthorityRequired, true);

    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-exchange')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-coin')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/custody')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/market-surveillance')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/exchange-compliance-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/travel-rule-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/crypto-aml')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/surveillance-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/custody-ledger')), false);
  });

  it('CHUNK-35R implements P2P, mempool, and sync on the sunrey-chain owner', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-chain').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-local-node').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-local-node').protected, true);
    assert.equal(evaluateCapability(manifest, 'sunrey-local-node').owner, 'packages/sunrey-chain');
    assert.equal(evaluateCapability(manifest, 'sunrey-p2p').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-p2p').protected, true);
    assert.equal(evaluateCapability(manifest, 'sunrey-p2p').owner, 'packages/sunrey-chain');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-35',
    );
    assert.ok(declared, 'CHUNK-35 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/node/src/lib.rs')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-node')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-p2p')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/p2p')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/mempool')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/consensus')), false);
  });

  it('CHUNK-36R implements the validator control plane on the sunrey-chain owner', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-chain').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-blockchain-architecture').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-local-node').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-p2p').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-validators').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-validators').protected, true);
    assert.equal(evaluateCapability(manifest, 'sunrey-validators').owner, 'packages/sunrey-chain');
    assert.equal(evaluateCapability(manifest, 'sunrey-validator-accountability').status, 'IMPLEMENTED');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-36',
    );
    assert.ok(declared, 'CHUNK-36 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-36-stop.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-36-resume.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-36-validator-lifecycle.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/validators/index.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/rust/crates/validators/src/lib.rs')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/validators')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/staking')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/validator-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/consensus-engine')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/tendermint')), false);
  });

  it('CHUNK-40 implements protocol governance on the sunrey-chain owner', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-protocol-governance').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-protocol-governance').protected, true);
    assert.equal(evaluateCapability(manifest, 'sunrey-protocol-governance').owner, 'packages/sunrey-chain');
    assert.equal(evaluateCapability(manifest, 'sunrey-validators').status, 'IMPLEMENTED');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-40',
    );
    assert.ok(declared, 'CHUNK-40 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-40-protocol-governance.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/governance/engine.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/rust/crates/governance/src/lib.rs')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/governance')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-governance')), false);
  });

  it('CHUNK-49 extends sunrey-exchange with four universal market families', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-exchange').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-exchange').owner, 'packages/sunrey-exchange');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-49',
    );
    assert.ok(declared, 'CHUNK-49 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-49-universal-economic-exchange.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/exchange-market-families.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/information-right-market.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/compute-capacity-market.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/productive-capacity-market.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/runbooks/universal-exchange-development.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-exchange/src/universal.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/exchange-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/orderbook')), false);
  });

  it('CHUNK-45 implements machine economic identity on the sunrey-chain owner', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-machine-economy').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-machine-economy').protected, true);
    assert.equal(evaluateCapability(manifest, 'sunrey-machine-economy').owner, 'packages/sunrey-chain');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-45',
    );
    assert.ok(declared, 'CHUNK-45 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-45-machine-economy.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/machine-economic-identity.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/machine-commerce-protocol.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/runbooks/machine-key-compromise.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/runbooks/machine-commerce-development.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/machine-economy/engine.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/machine-economy')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/machine-identity')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/moonrey-coin')), false);
  });

  it('CHUNK-46 implements sovereign wallets on the sunrey-chain owner', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-sovereign-wallets').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-sovereign-wallets').protected, true);
    assert.equal(evaluateCapability(manifest, 'sunrey-sovereign-wallets').owner, 'packages/sunrey-chain');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-46',
    );
    assert.ok(declared, 'CHUNK-46 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-46-sovereign-wallets.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/sunrey-address-spec.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/blockchain-account-authorization.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/runbooks/wallet-recovery.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/runbooks/wallet-key-rotation.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/runbooks/development-wallet.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/wallet/engine.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/rust/crates/wallet/src/lib.rs')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/wallet-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/blockchain-wallet')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/crypto-wallet')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-wallet-ledger')), false);
  });

  it('CHUNK-44 implements productive capacity and MoonRey issuance on the sunrey-chain owner', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-productive-capacity').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-productive-capacity').owner, 'packages/sunrey-chain');
    assert.equal(evaluateCapability(manifest, 'moonrey-issuance-engine').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'moonrey-issuance-engine').owner, 'packages/sunrey-chain');
    assert.equal(evaluateCapability(manifest, 'moonrey-coin').status, 'PLANNED');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-44',
    );
    assert.ok(declared, 'CHUNK-44 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-44-productive-capacity-moonrey.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/global-productive-capacity-graph.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/moonrey-issuance-model.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/runbooks/moonrey-economic-verification.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/productive/engine.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/rust/crates/productive/src/lib.rs')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/moonrey')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/moonrey-coin')), false);
  });

  it('CHUNK-43 implements the oracle network on the sunrey-chain owner', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-oracle-network').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-oracle-network').protected, true);
    assert.equal(evaluateCapability(manifest, 'sunrey-oracle-network').owner, 'packages/sunrey-chain');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-43',
    );
    assert.ok(declared, 'CHUNK-43 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-43-oracle-network.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/oracle-economic-fact-spec.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/oracle/engine.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/rust/crates/oracle/src/lib.rs')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/oracle')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-oracle')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/oracle-network')), false);
  });

  it('CHUNK-50 implements the interoperability gateway on the sunrey-chain owner', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-interop').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-interop').protected, true);
    assert.equal(evaluateCapability(manifest, 'sunrey-interop').owner, 'packages/sunrey-chain');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-50',
    );
    assert.ok(declared, 'CHUNK-50 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-50-interoperability.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/sunrey-light-client-protocol.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/interchain-packet-protocol.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/interoperability-security-model.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/runbooks/interoperability-development.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/runbooks/light-client-freeze.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/runbooks/relayer-operations.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/interop/engine.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/rust/crates/interop/src/lib.rs')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/ibc')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/bridge')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/interop')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/light-client')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/relayer')), false);
  });

  it('CHUNK-55 implements multi-failure-domain resilience on the sunrey-chain owner', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-ops-resilience').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-ops-resilience').protected, true);
    assert.equal(evaluateCapability(manifest, 'sunrey-ops-resilience').owner, 'packages/sunrey-chain');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-55',
    );
    assert.ok(declared, 'CHUNK-55 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-55-resilience-observability.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/operations/observability.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/operations/alerts.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/operations/backups.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/operations/disaster-recovery.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/operations/failure-domain-loss.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/operations/database-recovery.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/operations/chain-state-recovery.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/operations/signer-failover.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/ops/platform.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/rust/crates/ops/src/lib.rs')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-ops')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/observability')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/disaster-recovery')), false);
  });

  it('CHUNK-58 implements performance engineering on the sunrey-chain owner', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-performance-engineering').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-performance-engineering').protected, true);
    assert.equal(evaluateCapability(manifest, 'sunrey-performance-engineering').owner, 'packages/sunrey-chain');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-58',
    );
    assert.ok(declared, 'CHUNK-58 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-58-performance.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/performance/chunk-58-performance.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/performance/benchmark-methodology.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/performance/capacity-report.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/performance/soak-testing.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/perf/runner.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-bench')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/performance')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/load-test')), false);
  });

  it('CHUNK-57 implements the SunRey adversarial cyber-economic range', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-adversarial-range').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-adversarial-range').protected, true);
    assert.equal(evaluateCapability(manifest, 'sunrey-adversarial-range').owner, 'packages/sunrey-range');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-57',
    );
    assert.ok(declared, 'CHUNK-57 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-57-adversarial-range.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/assurance/chunk-57-adversarial-range.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/assurance/attack-matrix.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/assurance/security-invariants.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/assurance/range-operations.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-range/src/index.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/red-team')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/attack-sim')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-pentest')), false);
  });

  it('CHUNK-51 implements the developer platform at packages/sunrey-sdk', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-developer-sdk').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-developer-sdk').protected, true);
    assert.equal(evaluateCapability(manifest, 'sunrey-developer-sdk').owner, 'packages/sunrey-sdk');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-51',
    );
    assert.ok(declared, 'CHUNK-51 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-51-developer-platform.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/developers/README.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'api/sunrey-chain-v1.openapi.yaml')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-sdk/src/index.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/rust/crates/sdk/src/lib.rs')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/blockchain-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain-sdk-ledger')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sdk-ledger')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/exchange-v2')), false);
  });

  it('CHUNK-42 implements native fees on the sunrey-chain owner', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-native-fees').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-native-fees').protected, true);
    assert.equal(evaluateCapability(manifest, 'sunrey-native-fees').owner, 'packages/sunrey-chain');
    assert.equal(evaluateCapability(manifest, 'sunrey-protocol-governance').status, 'IMPLEMENTED');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-42',
    );
    assert.ok(declared, 'CHUNK-42 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-42-native-fees.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/sunrey-resource-metering.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/runbooks/fee-policy-development.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/fees/engine.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/rust/crates/fees/src/lib.rs')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/fees')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-fees')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/gas')), false);
  });

  it('CHUNK-73 extends native fees with FeePolicyV2 on the sunrey-chain owner', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-adaptive-fee-market').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-adaptive-fee-market').protected, true);
    assert.equal(evaluateCapability(manifest, 'sunrey-adaptive-fee-market').owner, 'packages/sunrey-chain');
    assert.equal(evaluateCapability(manifest, 'sunrey-native-fees').status, 'IMPLEMENTED');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-73',
    );
    assert.ok(declared, 'CHUNK-73 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-73-adaptive-fee-market.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/economics/chunk-73-fee-market.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/fees/v2/policy.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/rust/crates/fees/src/v2.rs')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/fees')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-fees')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/gas')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/fee-market')), false);
  });

  it('CHUNK-48 implements native-chain exchange settlement on the exchange owner', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-exchange-native-settlement').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-exchange-native-settlement').protected, true);
    assert.equal(evaluateCapability(manifest, 'sunrey-exchange-native-settlement').owner, 'packages/sunrey-exchange');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-48',
    );
    assert.ok(declared, 'CHUNK-48 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-48-exchange-native-settlement.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/exchange-dvp-protocol.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/runbooks/exchange-native-deposit.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/runbooks/exchange-native-withdrawal.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/runbooks/exchange-settlement-reconciliation.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-exchange/src/native-clearing/engine.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/rust/crates/native-assets/src/settlement.rs')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-exchange-ledger')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/exchange-settlement-v2')), false);
  });

  it('CHUNK-34R implements the local development node inside packages/sunrey-chain', () => {
    const manifest = loadManifest(REPO_ROOT);
    const declaredChunks = evaluateDeclaredChunks(REPO_ROOT, manifest);
    assert.equal(declaredChunks.some((evaluation) => evaluation.chunk === 'CHUNK-31'), true);
    assert.equal(declaredChunks.some((evaluation) => evaluation.chunk === 'CHUNK-32'), true);
    assert.equal(declaredChunks.some((evaluation) => evaluation.chunk === 'CHUNK-33'), true);
    const declared = declaredChunks.find((evaluation) => evaluation.chunk === 'CHUNK-34');
    assert.ok(declared, 'CHUNK-34 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-34-stop.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-34-resume.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-34-sovereign-node-core.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/runbooks/local-sunrey-node.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/rust/Cargo.toml')), true);

    assert.equal(evaluateCapability(manifest, 'sunrey-chain').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-local-node').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'security').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'crypto-suite-registry').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'blockchain-protocol').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'ledger').status, 'IMPLEMENTED');
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain')), true);

    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-blockchain')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-node')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/blockchain-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/new-chain')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/l1')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/ledger-chain')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/web3-chain')), false);
  });

  it('CHUNK-33R implements the CryptoSuite registry without a competing crypto root', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'security').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-chain').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'crypto-suite-registry').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'crypto-suite-registry').owner, 'packages/security');
    assert.equal(evaluateCapability(manifest, 'blockchain-protocol').status, 'IMPLEMENTED');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-33',
    );
    assert.ok(declared, 'CHUNK-33 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    const chunkFiles = readdirSync(join(REPO_ROOT, 'docs/architecture/chunks'));
    assert.equal(
      chunkFiles.some((name) => name.startsWith('chunk-31-') && name.endsWith('.json')),
      true,
    );
    assert.equal(
      chunkFiles.some((name) => name.startsWith('chunk-32-') && name.endsWith('.json')),
      true,
    );

    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-33-stop.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-33-crypto-agility.md')), true);
    assert.equal(
      existsSync(join(REPO_ROOT, 'docs/architecture/chunk-33-post-quantum-security.md')),
      false,
    );
    assert.equal(existsSync(join(REPO_ROOT, 'docs/security/cryptographic-inventory.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/quantum-security')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/crypto-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/pqc-core')), false);
  });

  it('CHUNK-32R implements the canonical SunRey transaction protocol', () => {
    const manifest = loadManifest(REPO_ROOT);
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest);

    const chunk31 = declared.find((evaluation) => evaluation.chunk === 'CHUNK-31');
    assert.ok(chunk31, 'CHUNK-31 architecture must be declared');
    assert.equal(chunk31.mustStop, false);

    const chunk32 = declared.find((evaluation) => evaluation.chunk === 'CHUNK-32');
    assert.ok(chunk32, 'CHUNK-32 declaration must exist under docs/architecture/chunks/');
    assert.equal(chunk32.mustStop, false);
    assert.deepEqual(chunk32.missing, []);

    assert.equal(evaluateCapability(manifest, 'blockchain-protocol').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'blockchain-protocol').owner, 'packages/sunrey-chain');
    assert.equal(evaluateCapability(manifest, 'moonrey-coin').status, 'PLANNED');

    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-32-stop.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-32-resume.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/protocol')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/protocol/v1/sunrey_tx_v1.proto')), true);
    assert.equal(
      existsSync(join(REPO_ROOT, 'packages/sunrey-chain/protocol/test-vectors/v1/vectors.json')),
      true,
    );

    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-protocol')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-tx')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/moonrey')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/moonrey-coin')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/blockchain')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/reyn-chain')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/on-chain-ledger')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/crypto-chain')), false);
  });

  it('CHUNK-31 freezes one SunRey Blockchain architecture without a production node', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-chain').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-chain').owner, 'packages/sunrey-chain');
    assert.equal(evaluateCapability(manifest, 'sunrey-blockchain-architecture').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-blockchain-architecture').owner, 'packages/sunrey-chain');
    assert.equal(evaluateCapability(manifest, 'moonrey-coin').status, 'PLANNED');
    assert.equal(evaluateCapability(manifest, 'blockchain-node').status, 'PLANNED');
    assert.equal(evaluateCapability(manifest, 'blockchain-consensus').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'blockchain-runtime').status, 'PARTIAL');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-31',
    );
    assert.ok(declared, 'CHUNK-31 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    const chain = manifest.boundedContexts.find((context) => context.id === 'SUNREY_CHAIN');
    assert.ok(chain);
    assert.equal(chain.status, 'IMPLEMENTED');
    assert.deepEqual(chain.reservedPaths, ['packages/sunrey-chain']);

    const chainPackage = manifest.packages.find((pkg) => pkg.id === 'packages/sunrey-chain');
    assert.ok(chainPackage);
    assert.equal(chainPackage.financialStateMutation, false);

    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/sunrey-blockchain-protocol.json')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/sunrey-chain-authority-matrix.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/blockchain-node')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-blockchain')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/moonrey-coin')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/blockchain-consensus')), false);
  });

  it('CHUNK-47 implements institutional custody on the custody owner', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'custody').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-institutional-custody').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-institutional-custody').protected, true);
    assert.equal(evaluateCapability(manifest, 'sunrey-institutional-custody').owner, 'packages/custody');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-47',
    );
    assert.ok(declared, 'CHUNK-47 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-47-institutional-custody.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/native-custody-signing.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/runbooks/custody-withdrawal.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/runbooks/custody-key-compromise.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/runbooks/cold-signing.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/runbooks/custody-reconciliation.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/custody/src/institutional/service.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/security/src/hsm-kms.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/native-custody/port.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/custody-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/blockchain-custody')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/institutional-custody-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/hsm-security-v2')), false);
  });

  it('CHUNK-54 implements validator operator infrastructure on the sunrey-chain owner', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-validator-operations').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-validator-operations').protected, true);
    assert.equal(evaluateCapability(manifest, 'sunrey-validator-operations').owner, 'packages/sunrey-chain');
    assert.equal(evaluateCapability(manifest, 'sunrey-validators').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'blockchain-consensus').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-protocol-governance').status, 'IMPLEMENTED');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-54',
    );
    assert.ok(declared, 'CHUNK-54 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-54-validator-operations.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/operators/validator.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/operators/sentry.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/operators/remote-signer.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/ops/index.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/node/src/ops.rs')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-ops')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/validator-ops')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sentry')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/remote-signer')), false);
  });

  it('CHUNK-53 implements the public testnet package on the sunrey-chain owner', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-public-testnet').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-public-testnet').protected, true);
    assert.equal(evaluateCapability(manifest, 'sunrey-public-testnet').owner, 'packages/sunrey-chain');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-53',
    );
    assert.ok(declared, 'CHUNK-53 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-53-public-testnet.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/testnet/README.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/testnet/genesis.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'deploy/sunrey-testnet/k8s/namespace.yaml')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-testnet')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-faucet')), false);
  });

  it('CHUNK-52 implements the SunRey explorer as a rebuildable projection', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-explorer').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-explorer').protected, true);
    assert.equal(evaluateCapability(manifest, 'sunrey-explorer').owner, 'packages/sunrey-explorer');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-52',
    );
    assert.ok(declared, 'CHUNK-52 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-52-explorer.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/explorer-index-model.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/explorer-privacy-policy.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/runbooks/explorer-rebuild.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/runbooks/explorer-integrity.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-explorer/src/indexer.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'apps/explorer/index.html')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'db/explorer/migrations/V001__explorer.sql')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/block-explorer')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/chain-indexer')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/explorer')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-indexer')), false);
  });

  it('CHUNK-60 integrates standardized PQC on the security owner for testnet', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-pqc-testnet').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-pqc-testnet').protected, true);
    assert.equal(evaluateCapability(manifest, 'sunrey-pqc-testnet').owner, 'packages/security');
    assert.equal(evaluateCapability(manifest, 'crypto-suite-registry').status, 'IMPLEMENTED');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-60',
    );
    assert.ok(declared, 'CHUNK-60 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/security/chunk-60-post-quantum-integration.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/security/pqc-provider-selection.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/security/hybrid-signature-protocol.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/security/pqc-testnet-migration.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/security/pqc-performance.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/runbooks/pqc-key-rotation.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/runbooks/pqc-provider-failure.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/security/src/pq-provider.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/pqc/hybrid-rehearsal.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/post-quantum')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/pqc-core')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/quantum-security')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/crypto-v2')), false);
  });

  it('CHUNK-64 implements root-of-trust ceremony architecture on the security owner', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-root-of-trust').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-root-of-trust').protected, true);
    assert.equal(evaluateCapability(manifest, 'sunrey-root-of-trust').owner, 'packages/security');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-64',
    );
    assert.ok(declared, 'CHUNK-64 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/security/chunk-64-root-of-trust.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/security/key-purpose-matrix.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/security/hsm-provider-requirements.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/security/key-ceremony-protocol.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/security/genesis-signing-ceremony.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/runbooks/root-key-compromise.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/runbooks/key-rotation-ceremony.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/runbooks/ceremony-verification.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/security/src/ceremony/index.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/ceremony')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/hsm-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/root-of-trust')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/key-ceremony')), false);
  });

  it('CHUNK-59 implements software supply-chain security on the sunrey-chain owner', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-supply-chain').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-supply-chain').protected, true);
    assert.equal(evaluateCapability(manifest, 'sunrey-supply-chain').owner, 'packages/sunrey-chain');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-59',
    );
    assert.ok(declared, 'CHUNK-59 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-59-supply-chain.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/security/chunk-59-supply-chain.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/supply-chain/index.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/supply-chain')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-release')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sbom')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/reproducible-builds')), false);
  });

  it('CHUNK-56 implements SunRey fuzzing and property assurance on sunrey-chain', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-assurance').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-assurance').protected, true);
    assert.equal(evaluateCapability(manifest, 'sunrey-assurance').owner, 'packages/sunrey-chain');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-56',
    );
    assert.ok(declared, 'CHUNK-56 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-56-assurance-fuzzing.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/assurance/chunk-56-fuzzing.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/assurance/index.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/rust/crates/assurance/src/lib.rs')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-test')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/fuzz')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/assurance')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'tools/sunrey-test')), false);
  });

  it('CHUNK-65 implements mainnet readiness and genesis-candidate controls', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-mainnet-readiness').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-mainnet-readiness').protected, true);
    assert.equal(evaluateCapability(manifest, 'sunrey-mainnet-readiness').owner, 'packages/sunrey-chain');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-65',
    );
    assert.ok(declared, 'CHUNK-65 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-65-mainnet-readiness.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/mainnet/chunk-65-readiness.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/mainnet/readiness-framework.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/mainnet/genesis-candidate.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/mainnet/index.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/mainnet')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-mainnet')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/genesis-candidate')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/readiness-registry')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/activation-control')), false);
  });

  it('CHUNK-70 implements the SunRey full mainnet launch rehearsal', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-launch-rehearsal').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-launch-rehearsal').protected, true);
    assert.equal(evaluateCapability(manifest, 'sunrey-launch-rehearsal').owner, 'packages/sunrey-chain');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-70',
    );
    assert.ok(declared, 'CHUNK-70 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-70-launch-rehearsal.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/mainnet/chunk-70-launch-rehearsal.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/mainnet/launch-sequence.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/runbooks/mainnet-rehearsal.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/launch-rehearsal/index.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-launch')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/launch-rehearsal')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/mainnet-rehearsal')), false);
  });

  it('CHUNK-75 implements the SunRey MoonRey dual-economy simulator', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-dual-economy-simulator').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-dual-economy-simulator').protected, true);
    assert.equal(evaluateCapability(manifest, 'sunrey-dual-economy-simulator').owner, 'packages/sunrey-economics');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-75',
    );
    assert.ok(declared, 'CHUNK-75 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-75-dual-economy.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/economics/chunk-75-dual-economy-simulator.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-economics/src/index.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/dual-economy')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/moonrey-macro')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/economic-bridge')), false);
  });

  it('CHUNK-72 implements SunRey validator bonding and rewards', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-validator-economics').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-validator-economics').protected, true);
    assert.equal(evaluateCapability(manifest, 'sunrey-validator-economics').owner, 'packages/sunrey-chain');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-72',
    );
    assert.ok(declared, 'CHUNK-72 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-72-validator-economics.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/economics/chunk-72-validator-economics.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/economics/validator-bonding.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/economics/validator-rewards.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/economics/validator-accountability.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/economics/validator-economic-simulation.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/validator-economics/index.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/validator-economics')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/staking')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/liquid-staking')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/slashing')), false);
  it('CHUNK-71 implements the SunRey dual-asset monetary constitution', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-monetary-constitution').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-monetary-constitution').protected, true);
    assert.equal(evaluateCapability(manifest, 'sunrey-monetary-constitution').owner, 'packages/sunrey-chain');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-71',
    );
    assert.ok(declared, 'CHUNK-71 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/economics/chunk-71-monetary-constitution.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunks/chunk-71-monetary-constitution.json')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/economics/index.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-economics')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/monetary-policy')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/tokenomics')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/genesis-economy')), false);
  });

  it('CHUNK-68 implements production-candidate oracle onboarding on sunrey-chain', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-production-oracles').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-production-oracles').protected, true);
    assert.equal(evaluateCapability(manifest, 'sunrey-production-oracles').owner, 'packages/sunrey-chain');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-68',
    );
    assert.ok(declared, 'CHUNK-68 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-68-production-oracles.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/oracle/chunk-68-production-oracles.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/oracle/production/index.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/production-oracles')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/oracle-onboarding')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/oracle-collector')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-oracle')), false);
  });

  it('CHUNK-63 implements Testnet release-candidate control on the sunrey-chain owner', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-testnet-rc').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-testnet-rc').protected, true);
    assert.equal(evaluateCapability(manifest, 'sunrey-testnet-rc').owner, 'packages/sunrey-chain');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-63',
    );
    assert.ok(declared, 'CHUNK-63 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-63-testnet-rc.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/releases/chunk-63-testnet-rc.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/releases/rc-qualification.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/releases/rc-freeze-policy.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/releases/rc-upgrade-rehearsal.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/releases/rc-known-limitations.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/release-candidate/index.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-rc')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/release-candidate')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/testnet-rc')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-qualification')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/rc-control')), false);
  });

  it('CHUNK-62 prepares an independent security-review bundle on sunrey-chain', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-audit-readiness').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-audit-readiness').protected, true);
    assert.equal(evaluateCapability(manifest, 'sunrey-audit-readiness').owner, 'packages/sunrey-chain');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-62',
    );
    assert.ok(declared, 'CHUNK-62 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-62-audit-readiness.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/audit/README.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/audit/reviewer-guide.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/audit/index.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-audit')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/audit')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/security-review')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/audit-evidence')), false);
  });

  it('CHUNK-61 implements formal SunRey protocol models on sunrey-chain', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-formal-assurance').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-formal-assurance').protected, true);
    assert.equal(evaluateCapability(manifest, 'sunrey-formal-assurance').owner, 'packages/sunrey-chain');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-61',
    );
    assert.ok(declared, 'CHUNK-61 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-61-formal-models.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/assurance/chunk-61-formal-models.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/formal/index.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/formal/registry/formal-model-registry.json')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/formal')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/tla')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/model-checker')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-formal')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'tools/formal')), false);
  });

  it('CHUNK-69 implements Exchange and custody regulated adapters on existing owners', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-regulated-integration').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-regulated-integration').protected, true);
    assert.equal(evaluateCapability(manifest, 'sunrey-regulated-integration').owner, 'packages/sunrey-exchange');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-69',
    );
    assert.ok(declared, 'CHUNK-69 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-69-regulated-integration.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/regulated/chunk-69-exchange-custody-integration.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-exchange/src/regulated/index.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/custody/src/regulated/index.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/kernel/src/regulated/index.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/security/src/regulated/index.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/regulated-exchange')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/provider-registry')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/travel-rule-production')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/custody-activation')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/exchange-kyc')), false);
  });

  it('CHUNK-67 implements production-candidate storage on sunrey-chain', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-production-storage').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-production-storage').protected, true);
    assert.equal(evaluateCapability(manifest, 'sunrey-production-storage').owner, 'packages/sunrey-chain');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-67',
    );
    assert.ok(declared, 'CHUNK-67 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-67-production-storage.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/storage/chunk-67-production-storage.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/storage/blockchain-storage-engine.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/rust/crates/storage/src/lib.rs')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/persistence/src/production/profile.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/blockchain-db')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/chain-storage-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-ledger-db')), false);
  });

  it('CHUNK-66 implements production infrastructure on the sunrey-chain owner', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-production-infrastructure').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-production-infrastructure').protected, true);
    assert.equal(evaluateCapability(manifest, 'sunrey-production-infrastructure').owner, 'packages/sunrey-chain');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-66',
    );
    assert.ok(declared, 'CHUNK-66 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-66-production-infrastructure.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/infrastructure/chunk-66-production-infrastructure.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/infra/index.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-infra')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/infrastructure')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/production-infrastructure')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/cloud-adapters')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-cloud')), false);
  });

  it('CHUNK-74 implements MoonRey productive issuance policy on sunrey-chain', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'moonrey-policy-governance').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'moonrey-policy-governance').protected, true);
    assert.equal(evaluateCapability(manifest, 'moonrey-policy-governance').owner, 'packages/sunrey-chain');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-74',
    );
    assert.ok(declared, 'CHUNK-74 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-74-moonrey-issuance-policy.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/economics/chunk-74-moonrey-issuance-policy.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/productive/policy-governance/index.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/moonrey-policy')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/moonrey-economics')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/issuance-policy')), false);
  });

  it('CHUNK-79 implements SunRey production governance operations', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-governance-operations').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-governance-operations').protected, true);
    assert.equal(evaluateCapability(manifest, 'sunrey-governance-operations').owner, 'packages/sunrey-chain');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-79',
    );
    assert.ok(declared, 'CHUNK-79 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-79-governance-operations.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/governance/chunk-79-production-governance-operations.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/governance-ops/index.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/governance-ops')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-governance')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/governance-token')), false);
  });
});
