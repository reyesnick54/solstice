import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import manifest from '../../../../docs/architecture/manifest.json' with { type: 'json' };
import { ACCESS_CANONICAL_INTEGRATIONS } from './ids.ts';

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(MODULE_DIR, '..', '..', '..', '..');

type ManifestPackage = {
  readonly id: string;
  readonly status: string;
  readonly allowedDependencies: readonly string[];
};

type ManifestComponent = {
  readonly id: string;
  readonly canonicalOwner: string;
  readonly canonicalPath: string;
};

type ManifestCapability = {
  readonly id: string;
  readonly owner: string;
  readonly status: string;
};

const packages = manifest.packages as readonly ManifestPackage[];
const components = manifest.components as readonly ManifestComponent[];
const capabilities = manifest.capabilities as readonly ManifestCapability[];

function sourceFiles(): readonly { readonly name: string; readonly text: string }[] {
  return readdirSync(MODULE_DIR)
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    .map((name) => ({ name, text: readFileSync(join(MODULE_DIR, name), 'utf8') }));
}

describe('ACCESS-13 architecture guards', () => {
  it('registers the Access Fabric owner and the Access Economy simulation in the manifest', () => {
    const accessFabric = packages.find((row) => row.id === 'packages/access-fabric');
    assert.notEqual(accessFabric, undefined, 'packages/access-fabric must be registered');
    assert.equal(accessFabric?.status, 'IMPLEMENTED');

    const economics = packages.find((row) => row.id === 'packages/sunrey-economics');
    assert.equal(economics?.allowedDependencies.includes('packages/access-fabric'), true);
    assert.equal(economics?.allowedDependencies.includes('packages/evidence'), true);

    const entitlementEngine = components.find((row) => row.id === 'sunrey-access-entitlement-engine');
    assert.equal(entitlementEngine?.canonicalOwner, 'packages/access-fabric');

    const simulation = components.find((row) => row.id === 'sunrey-access-economy-simulation');
    assert.equal(simulation?.canonicalOwner, 'packages/sunrey-economics');
    assert.equal(
      simulation?.canonicalPath,
      'packages/sunrey-economics/src/access-economy/types.ts',
    );

    for (const id of ['sunrey-access-fabric', 'sunrey-access-economy-simulation']) {
      const capability = capabilities.find((row) => row.id === id);
      assert.equal(capability?.status, 'IMPLEMENTED', `capability ${id} must be registered`);
    }
  });

  it('forbids parallel Access Economy owners in the manifest', () => {
    const forbidden = manifest.forbiddenWorkspaceRoots as readonly string[];
    for (const path of [
      'packages/access-coin',
      'packages/access-core',
      'packages/access-ledger',
      'packages/access-exchange',
      'packages/access-custody',
      'packages/entitlements',
      'packages/access-simulation',
    ]) {
      assert.equal(forbidden.includes(path), true, `${path} must be a forbidden workspace root`);
    }
    assert.equal(forbidden.includes('packages/access-economy'), false);
  });

  it('consumes canonical owners rather than reimplementing them', () => {
    assert.deepEqual(
      { ...ACCESS_CANONICAL_INTEGRATIONS },
      {
        entitlements: 'packages/access-fabric',
        ledger: 'packages/ledger',
        exchange: 'packages/sunrey-exchange',
        custody: 'packages/custody',
        kernel: 'packages/kernel',
        executionAuthority: 'packages/permissions',
        evidence: 'packages/evidence',
        productiveOracle: 'packages/sunrey-chain',
        monetaryConstitution: 'packages/sunrey-chain',
        simulationOwner: 'packages/sunrey-economics',
      },
    );
  });

  it('defines no ledger, Exchange, custody, or authority mutator of its own', () => {
    const banned = [
      'postJournal',
      'writeJournal',
      'appendJournal',
      'commitJournal',
      'openAccount',
      'createAccount',
      'AuthorityIssuer',
      'issueExecutionAuthority',
      'matchOrder',
      'placeOrder',
      'mint',
    ];
    for (const file of sourceFiles()) {
      for (const symbol of banned) {
        assert.equal(
          file.text.includes(`${symbol}(`),
          false,
          `${file.name} must not call or define ${symbol}()`,
        );
      }
    }
  });

  it('never assigns a production or LIVE_* flag', () => {
    const flagPattern = /(LIVE_[A-Z_]+|PRODUCTION_READY|PRODUCTION_ACTIVE|LIVE_CONNECTIVITY_ENABLED)\s*[:=]\s*(true|1)/;
    for (const file of sourceFiles()) {
      assert.equal(flagPattern.test(file.text), false, `${file.name} must not enable a production flag`);
    }
  });

  it('keeps the simulation out of the services layer', () => {
    for (const file of sourceFiles()) {
      assert.equal(file.text.includes('services/'), false, `${file.name} must not import a service`);
    }
  });

  it('does not reach around access-fabric to build entitlement decisions', () => {
    const allocation = readFileSync(join(MODULE_DIR, 'allocation.ts'), 'utf8');
    assert.match(allocation, /AccessEntitlementEngine/);
    assert.equal(allocation.includes('function evaluateEntitlement'), false);
  });

  it('keeps the recorded access chunk documentation in the repository', () => {
    const status = readFileSync(
      join(REPO_ROOT, 'docs', 'architecture', 'ACCESS_FABRIC_STATUS.md'),
      'utf8',
    );
    assert.match(status, /ACCESS_FABRIC_CODE_COMPLETE_CANDIDATE/);
    assert.match(status, /PRODUCTION_READY/);
    assert.match(status, /LIVE_CONNECTIVITY_ENABLED/);
    assert.match(status, /PRODUCTION_ACTIVE/);
  });
});
