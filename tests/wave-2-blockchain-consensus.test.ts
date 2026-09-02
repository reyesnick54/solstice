import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const REPO_ROOT = join(import.meta.dirname, '..');

describe('Wave 2 Prompt 5 — validator and BFT consensus', () => {
  it('documents the consensus architecture decision', () => {
    const doc = join(REPO_ROOT, 'docs/architecture/WAVE2_VALIDATOR_CONSENSUS.md');
    assert.equal(existsSync(doc), true);
    const text = readFileSync(doc, 'utf8');
    assert.match(text, /Tendermint-family BFT/);
    assert.match(text, /ExecutionConsensusAdapter/);
    assert.match(text, /not mainnet/i);
    assert.match(text, /Consensus agreement alone/);
  });

  it('implements ConsensusAdapter on the sunrey-chain consensus owner', () => {
    const adapter = join(
      REPO_ROOT,
      'packages/sunrey-chain/rust/crates/consensus/src/adapter.rs',
    );
    assert.equal(existsSync(adapter), true);
    const source = readFileSync(adapter, 'utf8');
    assert.match(source, /trait ConsensusAdapter/);
    assert.match(source, /struct ExecutionConsensusAdapter/);
    assert.match(source, /ConsensusApplication/);
    assert.equal(/AuthorityIssuer|postJournal|LIVE_CHAIN_ENABLED/.test(source), false);
  });

  it('includes Wave 2 failure and authority boundary tests', () => {
    assert.equal(
      existsSync(
        join(REPO_ROOT, 'packages/sunrey-chain/rust/crates/consensus/tests/wave2_failures.rs'),
      ),
      true,
    );
    assert.equal(
      existsSync(
        join(REPO_ROOT, 'packages/sunrey-chain/rust/crates/consensus/tests/wave2_authority.rs'),
      ),
      true,
    );
  });

  it('keeps four-validator local devnet tooling without claiming production', () => {
    assert.equal(existsSync(join(REPO_ROOT, 'scripts/sunrey-validator-devnet.sh')), true);
    assert.equal(
      existsSync(join(REPO_ROOT, 'packages/sunrey-chain/node/tests/consensus_network.rs')),
      true,
    );
    const script = readFileSync(join(REPO_ROOT, 'scripts/sunrey-validator-devnet.sh'), 'utf8');
    assert.match(script, /development validators/i);
    const protocol = JSON.parse(
      readFileSync(join(REPO_ROOT, 'docs/architecture/sunrey-blockchain-protocol.json'), 'utf8'),
    ) as { consensus: { productionConsensusImplemented: boolean } };
    assert.equal(protocol.consensus.productionConsensusImplemented, false);
  });
});
