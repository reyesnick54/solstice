import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from './constitution.ts';
import { evaluateCapability, loadManifest } from './manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

describe('CHUNK-98 user-controlled agent mandates constitution', () => {
  it('implements bounded financial agent mandates without a second authority system', () => {
    const declarationPath = join(REPO_ROOT, 'docs/architecture/chunks/chunk-98-agent-mandates.json');
    assert.equal(existsSync(declarationPath), true);
    const declaration = JSON.parse(readFileSync(declarationPath, 'utf8')) as {
      readonly chunk: string;
      readonly requires: readonly string[];
    };
    assert.equal(declaration.chunk, 'CHUNK-98');
    assert.ok(declaration.requires.includes('sunrey-user-agent-mandates'));

    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-user-agent-mandates').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-user-agent-mandates').protected, true);
    assert.equal(evaluateCapability(manifest, 'sunrey-user-agent-mandates').owner, 'packages/sunrey-agent');
    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find((evaluation) => evaluation.chunk === 'CHUNK-98');
    assert.ok(declared, 'CHUNK-98 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-98-agent-mandates.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/agents/chunk-98-agent-mandates.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/agents/agent-permissions.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/agents/agent-financial-execution.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/agents/agent-human-approval.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/agents/agent-risk-controls.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/runbooks/agent-security-incident.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-agent/src/index.ts')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/ai-authority')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/agent-authority')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/user-agent-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/agent-execution')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/financial-automation')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/mandate-v2')), false);
  });
});
