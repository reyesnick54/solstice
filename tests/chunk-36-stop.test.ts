import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { evaluateDeclaredChunks } from '../tools/architectural-linter/src/constitution.ts';
import { evaluateCapability, loadManifest } from '../tools/architectural-linter/src/manifest.ts';

const REPO_ROOT = join(import.meta.dirname, '..');

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) {
    return out;
  }
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git') {
      continue;
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (entry.endsWith('.ts') || entry.endsWith('.md') || entry.endsWith('.json')) {
      out.push(full);
    }
  }
  return out;
}

const FORBIDDEN_VALIDATOR_ROOTS = [
  'packages/validators',
  'packages/staking',
  'packages/validator-v2',
  'packages/consensus-engine',
  'packages/tendermint',
  'packages/sunrey-node',
  'packages/sunrey-p2p',
  'packages/sunrey-consensus',
] as const;

describe('CHUNK-36 validator registry / lifecycle stop', () => {
  it('stops while the local node, P2P plane, and validator capability are PLANNED', () => {
    const manifest = loadManifest(REPO_ROOT);
    assert.equal(evaluateCapability(manifest, 'sunrey-chain').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-blockchain-architecture').status, 'IMPLEMENTED');
    assert.equal(evaluateCapability(manifest, 'sunrey-local-node').status, 'PLANNED');
    assert.equal(evaluateCapability(manifest, 'sunrey-local-node').protected, true);
    assert.equal(evaluateCapability(manifest, 'sunrey-local-node').owner, 'packages/sunrey-chain');
    assert.equal(evaluateCapability(manifest, 'sunrey-p2p').status, 'PLANNED');
    assert.equal(evaluateCapability(manifest, 'sunrey-p2p').protected, true);
    assert.equal(evaluateCapability(manifest, 'sunrey-p2p').owner, 'packages/sunrey-chain');
    assert.equal(evaluateCapability(manifest, 'sunrey-validators').status, 'PLANNED');
    assert.equal(evaluateCapability(manifest, 'sunrey-validators').protected, true);
    assert.equal(evaluateCapability(manifest, 'sunrey-validators').owner, 'packages/sunrey-chain');

    const declared = evaluateDeclaredChunks(REPO_ROOT, manifest).find(
      (evaluation) => evaluation.chunk === 'CHUNK-36',
    );
    assert.ok(declared, 'CHUNK-36 declaration must exist under docs/architecture/chunks/');
    assert.equal(declared.mustStop, true);
    assert.deepEqual(declared.missing, ['sunrey-local-node', 'sunrey-p2p', 'sunrey-validators']);
  });

  it('does not invent a validator, staking, or consensus-engine package', () => {
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain')), true);
    for (const rel of FORBIDDEN_VALIDATOR_ROOTS) {
      assert.equal(existsSync(join(REPO_ROOT, rel)), false, rel);
    }
    assert.equal(existsSync(join(REPO_ROOT, 'docs/architecture/chunk-36-stop.md')), true);
    assert.equal(
      existsSync(join(REPO_ROOT, 'docs/architecture/chunk-36-validator-lifecycle.md')),
      false,
      'implementation doc must not exist on a stop',
    );
    assert.equal(existsSync(join(REPO_ROOT, 'docs/runbooks/validator-development.md')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/runbooks/validator-key-compromise.md')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/runbooks/validator-double-sign-prevention.md')), false);
  });

  it('does not implement validator registry, signer, or epoch code in sunrey-chain', () => {
    const chainFiles = walk(join(REPO_ROOT, 'packages/sunrey-chain/src'));
    for (const file of chainFiles) {
      if (file.endsWith('.test.ts') || file.endsWith('demo.ts')) {
        continue;
      }
      const source = readFileSync(file, 'utf8');
      assert.equal(/ValidatorRecord|ValidatorSetHash|BondDescriptor/i.test(source), false, file);
      assert.equal(/signProposal|signPrevote|signPrecommit|SignerSafety/i.test(source), false, file);
      assert.equal(/DOUBLE_PROPOSAL|DOUBLE_PREVOTE|DOUBLE_PRECOMMIT/.test(source), false, file);
      assert.equal(/PENDING_ACTIVATION|TOMBSTONED|PENDING_EXIT/.test(source), false, file);
      assert.equal(/AuthorityIssuer\.issue|this\.issuer\.issue\(/.test(source), false, file);
      assert.equal(/postJournal\s*\(/.test(source), false, file);
      assert.equal(/from ['"].*packages\/ledger/.test(source), false, file);
      assert.equal(/from ['"].*packages\/sunrey-coin/.test(source), false, file);
      assert.equal(/MoonRey|moonrey/i.test(source), false, file);
    }

    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/validator.ts')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/validators')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/sunrey-chain/src/consensus')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'Cargo.toml')), false);
  });
});
