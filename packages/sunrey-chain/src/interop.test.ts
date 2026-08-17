import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  InteropEngine,
  InteropFailure,
  createExternalDevChain,
  developmentExternalChain,
  finalizeForeignHeader,
  isolatedRelayer,
  makePacket,
  membershipProof,
  packetStateKey,
  putForeignState,
  refuseAutomaticIdentityTrust,
  refuseFiatLedgerMutation,
  refuseForeignEconomicTruth,
  refuseWrappedFiat,
  relayerCannotGovern,
  relayerCannotVote,
} from './interop/index.ts';
import { DEV_INTEROP_TEST_ASSET, EXTERNAL_DEV_CHAIN_ID } from './interop/types.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');

function readyEngine() {
  const foreign = createExternalDevChain();
  const engine = new InteropEngine();
  engine.registerChain(developmentExternalChain(foreign.genesisHash), 'GOVERNANCE');
  engine.activateChain(EXTERNAL_DEV_CHAIN_ID, 'GOVERNANCE');
  const clientId = engine.initializeClient(foreign);
  return { foreign, engine, clientId, honest: isolatedRelayer('relayer-honest') };
}

describe('sunrey interop gateway', () => {
  it('rejects an unregistered chain and a supplied endpoint string', () => {
    const engine = new InteropEngine();
    assert.throws(() => engine.activateChain('https://example.invalid/endpoint', 'GOVERNANCE'), (err: unknown) => {
      return err instanceof InteropFailure && err.code === 'UNREGISTERED_CHAIN';
    });
  });

  it('rejects AI and relayer activation', () => {
    const foreign = createExternalDevChain();
    const engine = new InteropEngine();
    assert.throws(() => engine.registerChain(developmentExternalChain(foreign.genesisHash), 'AI'), (err: unknown) => {
      return err instanceof InteropFailure && err.code === 'AI_CANNOT_ACTIVATE';
    });
    assert.throws(
      () => engine.registerChain(developmentExternalChain(foreign.genesisHash), 'RELAYER'),
      (err: unknown) => err instanceof InteropFailure && err.code === 'RELAYER_FORBIDDEN',
    );
  });

  it('rejects the wrong genesis and wrong external chain id', () => {
    const { engine, clientId, honest } = readyEngine();
    const other = { ...createExternalDevChain(), genesisHash: 'not-the-registered-genesis' };
    assert.throws(() => engine.initializeClient(other), (err: unknown) => {
      return err instanceof InteropFailure && err.code === 'WRONG_GENESIS';
    });
    const header = finalizeForeignHeader(createExternalDevChain());
    const forged = { ...header, chainId: 'chn_other_network' };
    assert.throws(() => engine.submitHeader(clientId, forged, honest), (err: unknown) => {
      return err instanceof InteropFailure && err.code === 'WRONG_EXTERNAL_CHAIN_ID';
    });
  });

  it('rejects invalid headers, finality, membership, modified packets, and replay', () => {
    const { foreign, engine, clientId, honest } = readyEngine();
    putForeignState(foreign, 'note', 'hello');
    const header = finalizeForeignHeader(foreign);
    assert.throws(
      () => engine.submitHeader(clientId, { ...header, height: 9, finality: header.finality }, honest),
      (err: unknown) => err instanceof InteropFailure && err.code === 'INVALID_HEADER',
    );
    assert.throws(
      () => engine.submitHeader(clientId, { ...header, finality: 'x' }, honest),
      (err: unknown) => err instanceof InteropFailure && err.code === 'INVALID_FINALITY_PROOF',
    );
    engine.submitHeader(clientId, header, honest);
    const packet = makePacket('hello');
    putForeignState(foreign, packetStateKey(packet), JSON.stringify(packet));
    const header2 = finalizeForeignHeader(foreign);
    engine.submitHeader(clientId, header2, honest);
    const proof = membershipProof(foreign, packetStateKey(packet));
    assert.throws(
      () => engine.recvPacket(clientId, packet, { ...proof, value: 'tampered' }, header2),
      (err: unknown) => err instanceof InteropFailure && err.code === 'MODIFIED_PACKET',
    );
    const ack = engine.recvPacket(clientId, packet, proof, header2);
    assert.throws(
      () => engine.recvPacket(clientId, packet, proof, header2),
      (err: unknown) => err instanceof InteropFailure && err.code === 'PACKET_REPLAY',
    );
    engine.acknowledge(`pkt/${packet.sourceChain}/${packet.destinationChain}/${packet.protocolVersion}/${packet.sourceChannel}/${packet.sequence}`, ack);
    assert.throws(
      () => engine.acknowledge('dup', ack),
      (err: unknown) => err instanceof InteropFailure && err.code === 'ACK_REPLAY',
    );
  });

  it('accepts duplicate relayer header submissions safely', () => {
    const { foreign, engine, clientId } = readyEngine();
    putForeignState(foreign, 'k', 'v');
    const header = finalizeForeignHeader(foreign);
    engine.submitHeader(clientId, header, isolatedRelayer('a'));
    engine.submitHeader(clientId, header, isolatedRelayer('b'));
    assert.equal(engine.clients.get(clientId)?.latestHeight, 1);
    assert.equal(engine.metrics.interopVerifiedHeaders, 1);
  });

  it('times out deterministically and freezes on conflicting trust', () => {
    const { engine, clientId, honest, foreign } = readyEngine();
    const packet = makePacket('pending');
    const id = engine.sendPacket(packet);
    engine.timeout(id);
    assert.equal(engine.packets.get(id)?.lifecycle, 'TIMED_OUT');
    putForeignState(foreign, 'k', 'v');
    const header = finalizeForeignHeader(foreign);
    engine.freeze(clientId);
    assert.throws(() => engine.submitHeader(clientId, header, honest), (err: unknown) => {
      return err instanceof InteropFailure && err.code === 'CLIENT_FROZEN';
    });
  });

  it('keeps relayers out of consensus and governance', () => {
    const relayer = isolatedRelayer('r1');
    assert.throws(() => relayerCannotVote(relayer), (err: unknown) => {
      return err instanceof InteropFailure && err.code === 'RELAYER_FORBIDDEN';
    });
    assert.throws(() => relayerCannotGovern(relayer), (err: unknown) => {
      return err instanceof InteropFailure && err.code === 'RELAYER_FORBIDDEN';
    });
  });

  it('does not treat foreign values as economic truth or wrap fiat', () => {
    assert.throws(() => refuseForeignEconomicTruth(), (err: unknown) => {
      return err instanceof InteropFailure && err.code === 'FOREIGN_VALUE_NOT_ECONOMIC_TRUTH';
    });
    assert.throws(() => refuseFiatLedgerMutation(), (err: unknown) => {
      return err instanceof InteropFailure && err.code === 'FIAT_LEDGER_MUTATION_FORBIDDEN';
    });
    assert.throws(() => refuseWrappedFiat('USD'), (err: unknown) => {
      return err instanceof InteropFailure && err.code === 'WRAPPED_FIAT_FORBIDDEN';
    });
    assert.throws(() => refuseWrappedFiat('SUNREY_COIN'), (err: unknown) => {
      return err instanceof InteropFailure && err.code === 'PRODUCTION_ASSET_UNAVAILABLE';
    });
    refuseWrappedFiat(DEV_INTEROP_TEST_ASSET);
    assert.throws(() => refuseAutomaticIdentityTrust(), (err: unknown) => {
      return err instanceof InteropFailure && err.code === 'IDENTITY_NOT_AUTOMATICALLY_TRUSTED';
    });
  });

  it('maintains the DEV_INTEROP_TEST_ASSET supply invariant', () => {
    const { foreign, engine, clientId, honest } = readyEngine();
    engine.escrow(250n);
    const packet = makePacket(`${DEV_INTEROP_TEST_ASSET}:250`, 'ASSET_TRANSFER_RESERVED');
    putForeignState(foreign, packetStateKey(packet), JSON.stringify(packet));
    const header = finalizeForeignHeader(foreign);
    engine.submitHeader(clientId, header, honest);
    engine.recvPacket(clientId, packet, membershipProof(foreign, packetStateKey(packet)), header);
    engine.assertSupply();
    assert.equal(engine.assets.authorizedRemote, 250n);
    assert.equal(engine.assets.escrowed, 0n);
  });

  it('rejects a malicious relayer and continues honest traffic', () => {
    const { foreign, engine, clientId } = readyEngine();
    const honest = isolatedRelayer('honest');
    const malicious = isolatedRelayer('malicious');
    putForeignState(foreign, 'k', 'v');
    const header = finalizeForeignHeader(foreign);
    assert.throws(
      () => engine.submitHeader(clientId, { ...header, finality: 'x' }, malicious),
      (err: unknown) => err instanceof InteropFailure && err.code === 'INVALID_FINALITY_PROOF',
    );
    engine.submitHeader(clientId, header, honest);
    const packet = makePacket('honest-value');
    putForeignState(foreign, packetStateKey(packet), JSON.stringify(packet));
    const header2 = finalizeForeignHeader(foreign);
    engine.submitHeader(clientId, header2, honest);
    const proof = membershipProof(foreign, packetStateKey(packet));
    assert.throws(
      () => engine.recvPacket(clientId, { ...packet, payload: 'evil' }, proof, header2),
      (err: unknown) => err instanceof InteropFailure && err.code === 'MODIFIED_PACKET',
    );
    engine.recvPacket(clientId, packet, proof, header2);
    assert.equal(engine.metrics.interopPacketsReceived, 1);
  });

  it('derives identical interchain state across four SunRey validators and two relayers', () => {
    const foreign = createExternalDevChain();
    const def = developmentExternalChain(foreign.genesisHash);
    const engines = [0, 1, 2, 3].map(() => {
      const engine = new InteropEngine();
      engine.registerChain({ ...def }, 'GOVERNANCE');
      engine.activateChain(EXTERNAL_DEV_CHAIN_ID, 'GOVERNANCE');
      return engine;
    });
    const clients = engines.map((engine) => engine.initializeClient(foreign));
    const packet = makePacket('four-validator-demo');
    putForeignState(foreign, packetStateKey(packet), JSON.stringify(packet));
    const header = finalizeForeignHeader(foreign);
    const proof = membershipProof(foreign, packetStateKey(packet));
    for (const [index, engine] of engines.entries()) {
      const clientId = clients[index];
      if (!clientId) {
        throw new Error('missing client');
      }
      engine.submitHeader(clientId, header, isolatedRelayer('a'));
      engine.submitHeader(clientId, header, isolatedRelayer('b'));
      engine.recvPacket(clientId, packet, proof, header);
    }
    const roots = engines.map((engine) => engine.stateRoot());
    const firstRoot = roots[0];
    assert.equal(roots.every((root) => root === firstRoot), true);
    const firstEngine = engines[0];
    if (!firstEngine) {
      throw new Error('missing engine');
    }
    assert.equal(firstEngine.metrics.interopPacketsReceived, 1);
  });

  it('exposes the PQ / weakest-domain security boundary without an absolute claim', () => {
    const { engine, clientId } = readyEngine();
    const profile = engine.securityProfile(clientId);
    assert.equal(profile.absoluteSecurityClaim, false);
    assert.equal(profile.trustedMultisigBridge, false);
    assert.equal(profile.interopCannotExceedWeakestDomain, true);
    assert.equal(profile.foreignCryptoClassification, 'CLASSICAL');
    assert.equal(profile.productionReady, false);
  });

  it('keeps interoperability inside packages/sunrey-chain', () => {
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-chain/rust/crates/interop/src/lib.rs')), true);
    assert.equal(existsSync(join(ROOT, 'packages/ibc')), false);
    assert.equal(existsSync(join(ROOT, 'packages/bridge')), false);
    assert.equal(existsSync(join(ROOT, 'packages/interop')), false);
    assert.equal(existsSync(join(ROOT, 'packages/light-client')), false);
    assert.equal(existsSync(join(ROOT, 'packages/relayer')), false);
    assert.equal(existsSync(join(ROOT, 'docs/architecture/chunk-50-interoperability.md')), true);
  });
});
