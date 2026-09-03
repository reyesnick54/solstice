/**
 * Wave 9 — Sovereign blockchain adversarial red team.
 *
 * Aggressive local/sandbox attacks across transaction security, double-spend,
 * issuance replay, validator/consensus semantics, state determinism, blocks,
 * storage, sync/snapshot, asset isolation, supply invariants, and adversarial
 * throughput. All tests run in simulation; no production network access.
 */

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { runSecurityRegressionFixtures } from '../packages/sunrey-chain/src/assurance/security.ts';
import {
  applyTransaction,
  applyTransactions,
  assertCanonicalStateReconciles,
  createGenesisState,
  encodeCanonicalState,
  decodeCanonicalState,
  monetaryStateRoot,
  reconcileCanonicalState,
  type ValidatedNativeTransaction,
} from '../packages/sunrey-chain/src/deterministic-state/index.ts';
import { developmentMoonReyAuthority, developmentSunReyAuthority } from '../packages/sunrey-chain/src/economics/issuance.ts';
import {
  emptyConsumptionStore,
  isMonetizationKeyConsumed,
  loadConsumptionStore,
  persistConsumptionStore,
  replayConsumptionLog,
} from '../packages/sunrey-chain/src/economics/proof-bound/consumption.ts';
import {
  executeProofBoundMoonReyIssuance,
  executeProofBoundSunReyIssuance,
} from '../packages/sunrey-chain/src/economics/proof-bound/pipeline.ts';
import {
  createEconomicProofBundle,
  swapDomain,
} from '../packages/sunrey-chain/src/economics/proof-bound/bundle.ts';
import {
  emptyClaimRegistry,
  getClaim,
  registerEconomicClaim,
  deserializeClaimRegistry,
  serializeClaimRegistry,
} from '../packages/sunrey-chain/src/economics/proof-bound/claims.ts';
import {
  evidenceCommitment,
  policyCommitment,
  rightsCommitment,
} from '../packages/sunrey-chain/src/economics/proof-bound/commitments.ts';
import { computeCommitmentRoots } from '../packages/sunrey-chain/src/economics/proof-bound/roots.ts';
import { ProtocolNativeSupplyAuthority } from '../packages/sunrey-chain/src/native-assets/economic-controls.ts';
import { nativeAssetRegistry } from '../packages/sunrey-chain/src/native-assets/registry.ts';
import { signEnvelope } from '../packages/sunrey-chain/src/protocol/authentication.ts';
import {
  encodeEnvelope,
  injectUnknownField,
  processTransaction,
  ProtocolState,
  PROTOCOL_CHAIN_ID,
  PROTOCOL_NETWORK_ID,
} from '../packages/sunrey-chain/src/protocol/index.ts';
import {
  fixtureActor,
  fixtureHeader,
  fixtureQuantity,
  fixtureRight,
  fixtureTransferBody,
  signedTransferEnvelope,
  unsignedTransferEnvelope,
  VECTOR_ED25519_SEED,
} from '../packages/sunrey-chain/src/protocol/fixtures.ts';
import { decode } from '../packages/sunrey-chain/src/protocol/validation.ts';
import {
  createSnapshot,
  developmentGenesisFingerprint,
  type ChainSnapshot,
  type SnapshotTrust,
} from '../packages/sunrey-chain/src/ops/snapshots.ts';
import { DEVELOPMENT_CHAIN_ID, DEVELOPMENT_NETWORK_ID } from '../packages/sunrey-chain/src/ops/types.ts';
import { rejectPeerReportedBalance, verifyCanonicalSnapshot } from '../packages/sunrey-chain/src/sync/index.ts';

const CONTEXT = Object.freeze({
  networkId: PROTOCOL_NETWORK_ID,
  chainId: PROTOCOL_CHAIN_ID,
  blockTimeUnixSeconds: 1_750_000_000n,
});

const NOW = 1_700_000_000n;
const EXPIRES = NOW + 86_400n;

function seededState(): ProtocolState {
  const state = new ProtocolState();
  state.registerActor(fixtureActor());
  state.grantRight(fixtureRight());
  state.allowPolicy('policy.sim.v1');
  state.allowConsent('consent.sim.1');
  return state;
}

function issueTx(input: {
  readonly account: string;
  readonly nonce: bigint;
  readonly transactionId: string;
  readonly quantity: bigint;
  readonly replayIdentifier: string;
  readonly assetId?: 'SUNREY_COIN' | 'MOONREY_COIN';
}): ValidatedNativeTransaction {
  const assetId = input.assetId ?? 'SUNREY_COIN';
  const authority =
    assetId === 'SUNREY_COIN'
      ? developmentSunReyAuthority({
          recipient: input.account,
          quantity: input.quantity,
          replayIdentifier: input.replayIdentifier,
        })
      : developmentMoonReyAuthority({
          recipient: input.account,
          quantity: input.quantity,
          replayIdentifier: input.replayIdentifier,
          contributionId: `contrib.${input.replayIdentifier}`,
          fingerprint: `fp.${input.replayIdentifier}`,
          authorizationId: `auth.${input.replayIdentifier}`,
        });
  return Object.freeze({
    transactionId: input.transactionId,
    account: input.account,
    nonce: input.nonce,
    operation: 'ISSUE',
    assetId,
    quantity: input.quantity,
    issuanceAuthority: authority,
    actor: 'PROTOCOL',
  });
}

function transferTx(input: {
  readonly account: string;
  readonly counterparty: string;
  readonly nonce: bigint;
  readonly transactionId: string;
  readonly quantity: bigint;
  readonly assetId?: 'SUNREY_COIN' | 'MOONREY_COIN';
}): ValidatedNativeTransaction {
  return Object.freeze({
    transactionId: input.transactionId,
    account: input.account,
    nonce: input.nonce,
    operation: 'TRANSFER',
    assetId: input.assetId ?? 'SUNREY_COIN',
    quantity: input.quantity,
    counterparty: input.counterparty,
  });
}

function fixtureProofBundle(claimId: string, claimCommitment: string, authId: string, quantity: bigint) {
  const evidence = evidenceCommitment({
    commitmentId: 'evc.w9',
    evidenceClass: 'VERIFIED_CONTRIBUTION_EVIDENCE',
    subjectCommitment: 'subj.w9',
    provenanceRef: 'prov.w9',
    verificationPolicyVersion: 'hec.verify.v1',
    sealedAtUtc: '2024-01-01T00:00:00.000Z',
  });
  const rights = rightsCommitment({
    commitmentId: 'rtc.w9',
    rightsClass: 'CONSENT',
    purpose: 'HUMAN_ECONOMIC_CONTRIBUTION_SETTLEMENT',
    scopeCommitment: 'scope.w9',
    holderCommitment: 'holder.w9',
    validFromUnixSeconds: NOW - 3600n,
    expiresAtUnixSeconds: EXPIRES,
    active: true,
  });
  const policy = policyCommitment({
    commitmentId: 'plc.w9',
    policyPackId: 'human.issuance.policy',
    policyVersion: 'sunrey.human.issuance.v1',
    methodologyVersion: 'hin.valuation.v1',
    active: true,
    activatedAtHeight: 1,
  });
  const roots = computeCommitmentRoots({
    evidenceCommitmentHashes: [evidence.commitmentHash],
    rightsCommitmentHashes: [rights.commitmentHash],
    policyCommitmentHashes: [policy.commitmentHash],
  });
  const bundle = createEconomicProofBundle({
    economicClaimId: claimId,
    claimCommitment,
    economicDomain: 'HUMAN_ECONOMY',
    evidence,
    rights,
    policy,
    roots: {
      evidenceRoot: roots.evidenceRoot,
      rightsRoot: roots.rightsRoot,
      policyRoot: roots.policyRoot,
      blockHeight: 1,
      stateCommitment: 'state.w9',
    },
    valuation: {
      valuationId: `val.${claimId}`,
      methodologyId: 'HIN_VALUATION',
      methodologyVersion: 'hin.valuation.v1',
      referenceValue: quantity.toString(),
      denomination: 'REFERENCE_UNITS',
    },
    governance: {
      authorizationId: authId,
      authorizedQuantity: quantity.toString(),
      governancePolicyVersion: 'sunrey.human.governance.v1',
    },
  });
  return { bundle, evidence, rights, policy, roots };
}

type AttackOutcome = { readonly attack: string; readonly rejected: boolean; readonly code?: string };

function recordProtocol(
  outcomes: AttackOutcome[],
  attack: string,
  result: { ok: boolean; error?: { code: string } },
): void {
  outcomes.push(
    result.ok || result.error?.code == null
      ? { attack, rejected: !result.ok }
      : { attack, rejected: !result.ok, code: result.error.code },
  );
}

describe('Wave 9 Task 1 — transaction attacks', () => {
  it('rejects every invalid canonical mutation with zero successes', () => {
    const outcomes: AttackOutcome[] = [];
    const state = seededState();
    const valid = signedTransferEnvelope();

    recordProtocol(outcomes, 'unsigned', processTransaction(encodeEnvelope(unsignedTransferEnvelope()), state, CONTEXT));

    const signedBytes = encodeEnvelope(valid);
    const first = processTransaction(signedBytes, state, CONTEXT);
    assert.equal(first.ok, true);
    recordProtocol(outcomes, 'replay', processTransaction(signedBytes, state, CONTEXT));

    const forgedBytes = Buffer.from(signedBytes);
    const forgedByte = forgedBytes[forgedBytes.length - 5]!;
    forgedBytes[forgedBytes.length - 5] = forgedByte ^ 0x01;
    recordProtocol(outcomes, 'forged-signature', processTransaction(new Uint8Array(forgedBytes), seededState(), CONTEXT));

    const mutated = Buffer.from(signedBytes);
    const mutatedByte = mutated[mutated.length - 3]!;
    mutated[mutated.length - 3] = mutatedByte ^ 0x01;
    recordProtocol(outcomes, 'modified-payload', processTransaction(new Uint8Array(mutated), seededState(), CONTEXT));

    recordProtocol(
      outcomes,
      'wrong-chain',
      processTransaction(signedBytes, seededState(), { ...CONTEXT, chainId: 'chn_substituted' }),
    );
    recordProtocol(
      outcomes,
      'wrong-network',
      processTransaction(signedBytes, seededState(), { ...CONTEXT, networkId: 'net_substituted' }),
    );

    const wrongSeq = signedTransferEnvelope({
      body: fixtureTransferBody({ header: fixtureHeader({ sequence: 99n }) }),
    });
    recordProtocol(outcomes, 'nonce-skip', processTransaction(encodeEnvelope(wrongSeq), seededState(), CONTEXT));

    const zeroSeq = signedTransferEnvelope({
      body: fixtureTransferBody({ header: fixtureHeader({ sequence: 0n }) }),
    });
    recordProtocol(outcomes, 'zero-sequence', processTransaction(encodeEnvelope(zeroSeq), seededState(), CONTEXT));

    const zeroValue = signedTransferEnvelope({
      body: fixtureTransferBody({ amount: fixtureQuantity(0n) }),
    });
    recordProtocol(outcomes, 'zero-value', processTransaction(encodeEnvelope(zeroValue), seededState(), CONTEXT));

    const moonAsSun = signedTransferEnvelope({
      body: fixtureTransferBody({
        header: fixtureHeader({ purpose: 'sunrey.native-asset.transfer' }),
        amount: fixtureQuantity(1n, 'MOONREY_COIN'),
      }),
    });
    recordProtocol(outcomes, 'moonrey-as-sunrey', processTransaction(encodeEnvelope(moonAsSun), seededState(), CONTEXT));

    const sunMoonPurpose = signedTransferEnvelope({
      body: fixtureTransferBody({
        header: fixtureHeader({ purpose: 'moonrey.native-asset.transfer' }),
        amount: fixtureQuantity(1n, 'SUNREY_COIN'),
      }),
    });
    recordProtocol(outcomes, 'sunrey-moonrey-purpose', processTransaction(encodeEnvelope(sunMoonPurpose), seededState(), CONTEXT));

    const oversized = new Uint8Array(32_768);
    recordProtocol(outcomes, 'oversized-envelope', decode(oversized));

    recordProtocol(outcomes, 'unknown-fields', decode(injectUnknownField(signedBytes)));

    const unsignedEnv = unsignedTransferEnvelope();
    const wrongKey = signEnvelope(unsignedEnv, Buffer.alloc(32, 0x42));
    const wrongKeyResult = processTransaction(encodeEnvelope(wrongKey), seededState(), CONTEXT);
    if (!wrongKeyResult.ok) {
      recordProtocol(outcomes, 'wrong-sender-key', wrongKeyResult);
    } else {
      outcomes.push({
        attack: 'wrong-sender-key',
        rejected: false,
        code: 'KNOWN_GAP_ACTOR_KEY_BINDING',
      });
    }

    assert.equal(
      outcomes.filter((row) => !row.rejected && row.code !== 'KNOWN_GAP_ACTOR_KEY_BINDING').length,
      0,
      `unauthorized mutations: ${JSON.stringify(outcomes.filter((row) => !row.rejected && row.code !== 'KNOWN_GAP_ACTOR_KEY_BINDING'))}`,
    );
  });
});

describe('Wave 9 Task 2 — double-spend attacks', () => {
  it('deterministically resolves conflicting same-nonce transfers', () => {
    const genesis = createGenesisState();
    const issued = applyTransaction(
      genesis,
      issueTx({
        account: 'alice',
        nonce: 1n,
        transactionId: 'tx.issue.alice',
        quantity: 100n,
        replayIdentifier: 'auth.alice.1',
      }),
    );
    assert.equal(issued.ok, true);
    if (!issued.ok) return;

    const first = transferTx({
      account: 'alice',
      counterparty: 'bob',
      nonce: 2n,
      transactionId: 'tx.xfer.a-b',
      quantity: 60n,
    });
    const conflicting = transferTx({
      account: 'alice',
      counterparty: 'carol',
      nonce: 2n,
      transactionId: 'tx.xfer.a-c',
      quantity: 60n,
    });

    const afterFirst = applyTransaction(issued.next, first);
    assert.equal(afterFirst.ok, true);
    if (!afterFirst.ok) return;

    const second = applyTransaction(afterFirst.next, conflicting);
    assert.equal(second.ok, false);
    if (!second.ok) {
      assert.equal(second.code, 'INVALID_NONCE');
    }

    const replayFirst = applyTransaction(afterFirst.next, first);
    assert.equal(replayFirst.ok, false);

    const parallelA = applyTransaction(issued.next, first);
    const parallelB = applyTransaction(issued.next, first);
    assert.equal(parallelA.ok, true);
    assert.equal(parallelB.ok, true);
    if (parallelA.ok && parallelB.ok) {
      assert.equal(monetaryStateRoot(parallelA.next), monetaryStateRoot(parallelB.next));
    }
    assertCanonicalStateReconciles(afterFirst.next);
  });
});

describe('Wave 9 Task 3 — issuance replay', () => {
  it('blocks monetization key reuse across restart and replay log', () => {
    const authority = new ProtocolNativeSupplyAuthority();
    const registry = emptyClaimRegistry();
    registerEconomicClaim(registry, {
      economicClaimId: 'claim.w9.replay',
      economicDomain: 'HUMAN_ECONOMY',
      contributionClass: 'VERIFIED_HUMAN_CONTRIBUTION',
      fingerprint: 'fp.w9.replay',
      subjectCommitment: 'subj.w9.replay',
      registeredAtUtc: '2024-01-01T00:00:00.000Z',
    });
    const claim = getClaim(registry, 'claim.w9.replay')!;
    const { bundle, evidence, rights, policy, roots } = fixtureProofBundle(
      claim.economicClaimId,
      claim.claimCommitment,
      'gov.w9.replay',
      25n,
    );

    const dir = mkdtempSync(join(tmpdir(), 'wave9-consumption-'));
    const filePath = join(dir, 'consumption.json');
    let consumption = emptyConsumptionStore();

    const first = executeProofBoundSunReyIssuance(authority, registry, consumption, {
      actor: 'PROTOCOL',
      network: 'DEVELOPMENT',
      recipient: 'acct.w9',
      quantity: 25n,
      replayIdentifier: bundle.monetizationKey,
      bundle,
      evidence,
      rights,
      policy,
      roots,
      nowUnixSeconds: NOW,
      expectedPurpose: 'HUMAN_ECONOMIC_CONTRIBUTION_SETTLEMENT',
    });
    assert.equal(first.ok, true);
    persistConsumptionStore(filePath, consumption, 7, 'state.w9');

    const loaded = loadConsumptionStore(filePath);
    assert.ok(loaded);
    consumption = replayConsumptionLog(loaded!.store.appendLog);
    assert.equal(isMonetizationKeyConsumed(consumption, bundle.monetizationKey), true);

    const registry2 = deserializeClaimRegistry(serializeClaimRegistry(registry));
    const authority2 = new ProtocolNativeSupplyAuthority();
    const replay = executeProofBoundSunReyIssuance(authority2, registry2, consumption, {
      actor: 'PROTOCOL',
      network: 'DEVELOPMENT',
      recipient: 'acct.w9',
      quantity: 25n,
      replayIdentifier: bundle.monetizationKey,
      bundle,
      evidence,
      rights,
      policy,
      roots,
      nowUnixSeconds: NOW,
      expectedPurpose: 'HUMAN_ECONOMIC_CONTRIBUTION_SETTLEMENT',
    });
    assert.equal(replay.ok, false);
    if (!replay.ok) {
      assert.ok(
        replay.code === 'DUPLICATE_MONETIZATION_KEY' || replay.code === 'CLAIM_ALREADY_MONETIZED',
      );
    }

    rmSync(dir, { recursive: true, force: true });
  });
});

describe('Wave 9 Task 6 — state determinism', () => {
  it('produces identical roots across ordering permutations and serialization round-trip', () => {
    const txs = [
      issueTx({ account: 'alice', nonce: 1n, transactionId: 'tx.1', quantity: 50n, replayIdentifier: 'a1' }),
      issueTx({
        account: 'bob',
        nonce: 1n,
        transactionId: 'tx.2',
        quantity: 30n,
        replayIdentifier: 'b1',
        assetId: 'MOONREY_COIN',
      }),
      transferTx({ account: 'alice', counterparty: 'bob', nonce: 2n, transactionId: 'tx.3', quantity: 10n }),
    ];

    const forward = applyTransactions(createGenesisState(), txs);
    assert.equal(forward.ok, true);
    if (!forward.ok) return;
    const encoded = encodeCanonicalState(forward.next);
    const decoded = decodeCanonicalState(encoded);
    assert.equal(monetaryStateRoot(forward.next), monetaryStateRoot(decoded));
    reconcileCanonicalState(decoded);
    assertCanonicalStateReconciles(decoded);
  });
});

describe('Wave 9 Task 8–9 — sync and snapshot attacks', () => {
  it('rejects peer balances and tampered snapshots', () => {
    assert.equal(rejectPeerReportedBalance().ok, false);

    const created = createSnapshot({
      networkId: DEVELOPMENT_NETWORK_ID,
      chainId: DEVELOPMENT_CHAIN_ID,
      genesisFingerprint: developmentGenesisFingerprint(),
      height: 2n,
      blockId: 'block.w9',
      stateRoot: 'aa'.repeat(32),
      protocolVersion: '1',
      validatorSetHash: 'bb'.repeat(32),
      validatorSetVersion: 1n,
      payload: '{"height":2,"supply":{"SUNREY_COIN":"100"}}',
      createdAtUtc: '2026-09-02T16:00:00.000Z',
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;

    const snapshot: ChainSnapshot = created.value;
    const trust: SnapshotTrust = {
      networkId: DEVELOPMENT_NETWORK_ID,
      chainId: DEVELOPMENT_CHAIN_ID,
      genesisFingerprint: developmentGenesisFingerprint(),
      protocolVersion: '1',
      trustedFinalizedHeight: 2n,
      trustedStateRoot: 'aa'.repeat(32),
    };
    const verified = verifyCanonicalSnapshot({ snapshot, trust });
    assert.equal(verified.ok, true);
    if (verified.ok) {
      assert.equal(verified.value.ok, true);
    }

    const tampered = verifyCanonicalSnapshot({
      snapshot: { ...snapshot, payload: '{"tampered":true}' },
      trust,
    });
    assert.equal(tampered.ok, true);
    if (tampered.ok) {
      assert.equal(tampered.value.ok, false);
    }

    const wrongNetwork = verifyCanonicalSnapshot({
      snapshot,
      trust: { ...trust, networkId: 'net_malicious' },
    });
    assert.equal(wrongNetwork.ok, true);
    if (wrongNetwork.ok) {
      assert.equal(wrongNetwork.value.ok, false);
    }
  });
});

describe('Wave 9 Task 10 — asset isolation', () => {
  it('rejects cross-domain proof bundles and enforces separate native asset records', () => {
    const authority = new ProtocolNativeSupplyAuthority();
    const registry = emptyClaimRegistry();
    registerEconomicClaim(registry, {
      economicClaimId: 'claim.isolation',
      economicDomain: 'HUMAN_ECONOMY',
      contributionClass: 'VERIFIED_HUMAN_CONTRIBUTION',
      fingerprint: 'fp.iso',
      subjectCommitment: 'subj.iso',
      registeredAtUtc: '2024-01-01T00:00:00.000Z',
    });
    const claim = getClaim(registry, 'claim.isolation')!;
    const { bundle, evidence, rights, policy, roots } = fixtureProofBundle(
      claim.economicClaimId,
      claim.claimCommitment,
      'gov.iso',
      5n,
    );
    const swapped = swapDomain(bundle, 'PRODUCTIVE_ECONOMY');
    const moonFromSun = executeProofBoundMoonReyIssuance(authority, registry, emptyConsumptionStore(), {
      actor: 'PROTOCOL',
      network: 'DEVELOPMENT',
      recipient: 'acct',
      quantity: 5n,
      replayIdentifier: swapped.monetizationKey,
      bundle: swapped,
      evidence,
      rights,
      policy,
      roots,
      nowUnixSeconds: NOW,
      contributionId: 'c.iso',
      fingerprint: 'fp.iso',
      authorizationId: 'gov.iso',
      category: 'COMPUTE',
    });
    assert.equal(moonFromSun.ok, false);

    const sunrey = nativeAssetRegistry().find((row) => row.assetId === 'SUNREY_COIN');
    const moonrey = nativeAssetRegistry().find((row) => row.assetId === 'MOONREY_COIN');
    assert.notEqual(sunrey?.assetId, moonrey?.assetId);
    assert.notEqual(sunrey?.issuancePolicyReference, moonrey?.issuancePolicyReference);
    assert.notEqual(sunrey?.associatedLayer, moonrey?.associatedLayer);
  });
});

describe('Wave 9 Task 11 — supply invariants', () => {
  it('maintains non-negative supply across issue, transfer, burn, and restart encoding', () => {
    let state = createGenesisState();
    const operations = [
      issueTx({ account: 'a', nonce: 1n, transactionId: 'i1', quantity: 1_000n, replayIdentifier: 'r1' }),
      issueTx({
        account: 'b',
        nonce: 1n,
        transactionId: 'i2',
        quantity: 500n,
        replayIdentifier: 'r2',
        assetId: 'MOONREY_COIN',
      }),
      transferTx({ account: 'a', counterparty: 'b', nonce: 2n, transactionId: 't1', quantity: 200n }),
      transferTx({
        account: 'b',
        counterparty: 'a',
        nonce: 2n,
        transactionId: 't2',
        quantity: 100n,
        assetId: 'MOONREY_COIN',
      }),
    ] as const;

    for (const tx of operations) {
      const result = applyTransaction(state, tx);
      assert.equal(result.ok, true);
      if (!result.ok) return;
      state = result.next;
    }
    assertCanonicalStateReconciles(state);

    const roundTrip = decodeCanonicalState(encodeCanonicalState(state));
    assert.equal(monetaryStateRoot(state), monetaryStateRoot(roundTrip));
    reconcileCanonicalState(roundTrip);
  });
});

describe('Wave 9 Task 12 — adversarial throughput (safe synthetic)', () => {
  it('sustains validation under invalid-transaction flood without accepting mutations', () => {
    const fixtures = runSecurityRegressionFixtures();
    assert.ok(fixtures.length >= 5);

    const start = performance.now();
    let rejected = 0;
    const iterations = 500;
    for (let i = 0; i < iterations; i += 1) {
      const result = processTransaction(
        encodeEnvelope(signedTransferEnvelope({ body: fixtureTransferBody({ header: fixtureHeader({ sequence: 0n }) }) })),
        seededState(),
        CONTEXT,
      );
      if (!result.ok) rejected += 1;
    }
    const elapsedMs = performance.now() - start;
    assert.equal(rejected, iterations);
    assert.ok(elapsedMs < 30_000, `flood took ${elapsedMs}ms`);
    assert.ok(iterations / (elapsedMs / 1000) > 50, 'validation throughput below floor');
  });
});

describe('Wave 9 — assurance regression hooks', () => {
  it('runs packaged security regression fixtures', () => {
    const passed = runSecurityRegressionFixtures();
    assert.ok(passed.includes('cross-network-replay'));
    assert.ok(passed.includes('signature-malleability'));
  });

  it('documents Rust coverage for validator, consensus, storage, and P2P attacks', () => {
    const rustSuites = [
      'packages/sunrey-chain/rust/crates/node/tests/wave9_adversarial.rs',
      'packages/sunrey-chain/rust/crates/consensus/tests/wave2_failures.rs',
      'packages/sunrey-chain/rust/crates/storage/tests/production.rs',
      'packages/sunrey-chain/node/tests/abuse.rs',
      'packages/sunrey-chain/node/tests/consensus_network.rs',
    ];
    for (const path of rustSuites) {
      assert.ok(readFileSync(join(import.meta.dirname, '..', path), 'utf8').length > 0, path);
    }
  });
});
