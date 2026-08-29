import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('ACCESS-08 chain access rights constitution', () => {
  it('extends the canonical chain owner instead of adding a chain, ledger, or coin', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/access-08.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'ACCESS-08');
    assert.ok(declaration.requires.includes('sunrey-chain'));
    assert.ok(declaration.requires.includes('sunrey-productive-capacity'));
    assert.ok(declaration.requires.includes('sunrey-access-rights-commitments'));
    assert.ok(declaration.requires.includes('identity'));
    assert.ok(declaration.requires.includes('evidence'));

    const manifest = loadManifest(REPO_ROOT);
    const capability = evaluateCapability(manifest, 'sunrey-access-rights-commitments');
    assert.equal(capability.status, 'IMPLEMENTED');
    assert.equal(capability.owner, 'packages/sunrey-chain');
    assert.equal(evaluateCapability(manifest, 'sunrey-chain').owner, 'packages/sunrey-chain');
    assert.equal(
      evaluateCapability(manifest, 'sunrey-productive-capacity').owner,
      'packages/sunrey-chain',
    );

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'ACCESS-08',
    );
    assert.ok(declared, 'ACCESS-08 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/access/service.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/access/state.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/access/index.ts')), true);
    assert.equal(
      existsSync(join(REPO_ROOT, 'docs/architecture/access-08-chain-access-rights.md')),
      true,
    );

    for (const forbidden of [
      'packages/access-chain',
      'packages/access-ledger',
      'packages/access-coin',
      'packages/access-token',
      'packages/access-rights-chain',
      'packages/reservation-chain',
      'packages/reservation-ledger',
      'packages/rights-chain',
      'packages/mobility-chain',
      'packages/entitlement-chain',
    ]) {
      assert.equal(existsSync(join(REPO_ROOT, forbidden)), false, forbidden);
      assert.ok(
        manifest.forbiddenWorkspaceRoots.includes(forbidden),
        `${forbidden} must be a forbidden workspace root`,
      );
    }
  });

  it('keeps the deployment posture and simulation flags unchanged', () => {
    const manifest = loadManifest(REPO_ROOT);
    const capability = manifest.capabilities.find(
      (entry) => entry.id === 'sunrey-access-rights-commitments',
    );
    assert.ok(capability);
    assert.equal(capability.protected, true);
    const component = manifest.components.find(
      (entry) => entry.id === 'sunrey-access-rights-commitments',
    );
    assert.ok(component);
    assert.equal(component.financialStateMutation, false);
    assert.equal(component.executionAuthorityRequired, false);
    assert.equal(component.kernelAuthorizationRequired, false);
    assert.equal(component.canonicalOwner, 'packages/sunrey-chain');
  });
});
