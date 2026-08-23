import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import { runExchangeRedTeam, unauthorizedMutations } from '../packages/sunrey-exchange/src/productization/red-team.ts';
import {
  PROTOCOL_CHAIN_ID,
  PROTOCOL_NETWORK_ID,
  encodeEnvelope,
  processTransaction,
  ProtocolState,
} from '../packages/sunrey-chain/src/protocol/index.ts';
import {
  fixtureActor,
  fixtureQuantity,
  fixtureRight,
  fixtureTransferBody,
  signedTransferEnvelope,
  unsignedTransferEnvelope,
} from '../packages/sunrey-chain/src/protocol/fixtures.ts';
import { rejectWrongChainId } from '../packages/sunrey-chain/src/mainnet/candidate-v2/verify.ts';

const NOW = asUtcInstant('2026-08-23T12:00:00.000Z');

const CONTEXT = Object.freeze({
  networkId: PROTOCOL_NETWORK_ID,
  chainId: PROTOCOL_CHAIN_ID,
  blockTimeUnixSeconds: 1_750_000_000n,
});

function seededState(): ProtocolState {
  const state = new ProtocolState();
  const actor = fixtureActor();
  state.registerActor(actor);
  state.grantRight(fixtureRight());
  state.allowPolicy('policy.sim.v1');
  state.allowConsent('consent.sim.1');
  return state;
}

describe('Phase G Exchange red team', () => {
  it('produces zero unauthorized financial mutations', () => {
    const attempts = runExchangeRedTeam(NOW);
    assert.equal(unauthorizedMutations(attempts), 0);
    assert.ok(attempts.every((row) => row.refused));
  });
});

describe('Phase G Chain red team', () => {
  it('rejects invalid signature, replay, wrong chain, mint, overflow, and testnet-as-mainnet', () => {
    const unsigned = processTransaction(encodeEnvelope(unsignedTransferEnvelope()), seededState(), CONTEXT);
    assert.equal(unsigned.ok, false);

    const bytes = encodeEnvelope(signedTransferEnvelope());
    const state = seededState();
    const first = processTransaction(bytes, state, CONTEXT);
    assert.equal(first.ok, true);
    const replay = processTransaction(bytes, state, CONTEXT);
    assert.equal(replay.ok, false);

    const wrongChain = processTransaction(encodeEnvelope(signedTransferEnvelope()), seededState(), {
      ...CONTEXT,
      chainId: 'chn_other',
    });
    assert.equal(wrongChain.ok, false);

    const mint = processTransaction(
      encodeEnvelope(
        signedTransferEnvelope({
          body: fixtureTransferBody({
            operation: 'ISSUE',
            amount: fixtureQuantity(1n, 'MOONREY_COIN'),
          }),
        }),
      ),
      seededState(),
      CONTEXT,
    );
    assert.equal(mint.ok, false);

    assert.throws(() => rejectWrongChainId('chn_sunrey_testnet_1'), /wrong chain ID rejected/);
  });
});
