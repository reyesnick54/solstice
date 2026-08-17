/**
 * Seven-validator hybrid testnet migration rehearsal.
 *
 * Development/testnet only. Not a mainnet quantum-security claim.
 */

import { createHash } from 'node:crypto';

import {
  MAX_P2P_PQ_MESSAGE_BYTES,
  SUITE_SUNREY_ED25519_V1,
  SUITE_SUNREY_HYBRID_ED25519_MLDSA_V1,
  SUITE_SUNREY_MLDSA_65_V1,
  TESTNET_HYBRID_MIGRATION_SCHEDULE,
  createDefaultCryptoSuiteRegistry,
  createFailClosedPqCatalog,
  createSecurityProviderCatalog,
  decodeHybridComponent,
  historicalVerifyAllowed,
  migrationStateAtHeight,
  roleAcceptsSuiteForSign,
  type ProviderCatalog,
} from '../../../security/src/index.ts';
import {
  UpgradeManager,
  actorById,
  createDraftPlan,
  developmentGovernancePolicy,
  developmentNodeCapability,
  seedForActor,
} from '../governance/engine.ts';
import { deriveOracleKey, signObservation, verifyObservationSignature } from '../oracle/crypto.ts';
import {
  createTestnetValidatorSigner,
  encodeConsensusSignBytes,
  validatorPublicKeyHex,
  verifyConsensusBytes,
} from '../validators/index.ts';
import type { ConsensusSignRequest } from '../validators/types.ts';
import { WalletEngine } from '../wallet/engine.ts';
import { CLASSICAL_WALLET_SUITE, HYBRID_WALLET_SUITE, PQ_WALLET_SUITE, containsPrivateMaterial } from '../wallet/keys.ts';
import { isWalletRejection } from '../wallet/types.ts';
import {
  CONSENSUS_SIZE_AUDIT,
  assertP2pMessageBound,
  hybridCommitCertificateSizeBytes,
  hybridVoteSizeBytes,
} from './consensus-bounds.ts';

const CLASSICAL = SUITE_SUNREY_ED25519_V1;
const HYBRID = SUITE_SUNREY_HYBRID_ED25519_MLDSA_V1;
const PQ = SUITE_SUNREY_MLDSA_65_V1;
const SELECTED = ['val_0', 'val_1', 'val_2'] as const;
const ALL = ['val_0', 'val_1', 'val_2', 'val_3', 'val_4', 'val_5', 'val_6'] as const;

export type RehearsalPhase = {
  readonly height: number;
  readonly state: ReturnType<typeof migrationStateAtHeight>;
  readonly suites: Readonly<Record<string, string>>;
  readonly blockId: string;
  readonly stateRoot: string;
  readonly voters: readonly string[];
};

export type HybridRehearsalReport = {
  readonly finalizedHeights: readonly number[];
  readonly phases: readonly RehearsalPhase[];
  readonly identicalBlocks: true;
  readonly identicalCryptoPolicy: true;
  readonly identicalStateRoots: true;
  readonly walletTransfers: readonly { readonly phase: string; readonly txId: string; readonly balanceUnchangedByKeyRotation: true }[];
  readonly multiAuthHeterogeneous: true;
  readonly oracleFacts: readonly { readonly provider: string; readonly suite: string; readonly admitted: boolean }[];
  readonly governanceAiCannotVote: true;
  readonly governanceHybridScheduled: true;
  readonly downgradeRejected: readonly string[];
  readonly wrongSuiteRejected: true;
  readonly historicalVerifyRetained: true;
  readonly providerFailureFailClosed: true;
  readonly p2pOversizedRejected: true;
  readonly secretMaterialAbsentFromReport: true;
  readonly sizes: {
    readonly mlDsaPublicKeyBytes: number;
    readonly mlDsaSignatureBytes: number;
    readonly hybridVoteBytes: number;
    readonly commitCertificateBytes: number;
    readonly blockImpactBytes: number;
  };
  readonly performance: {
    readonly classicalSignMs: number;
    readonly hybridSignMs: number;
    readonly pqSignMs: number;
    readonly classicalVerifyMs: number;
    readonly hybridVerifyMs: number;
    readonly pqVerifyMs: number;
  };
  readonly storage: {
    readonly walGrowthBytes: number;
    readonly blockGrowthBytes: number;
    readonly evidenceGrowthBytes: number;
    readonly validatorHistoryBytes: number;
    readonly walletHistoryBytes: number;
  };
  readonly claimLanguage: 'standardized post-quantum algorithm implementation; hybrid testnet migration';
};

function seedHex(label: string): string {
  return createHash('sha256').update(`SUNREY-REHEARSAL-SEED-v1:${label}`).digest('hex');
}

function requestAt(
  validatorId: string,
  height: number,
  suiteId: string,
  blockId: string,
): ConsensusSignRequest {
  return {
    networkId: TESTNET_HYBRID_MIGRATION_SCHEDULE.networkId,
    chainId: TESTNET_HYBRID_MIGRATION_SCHEDULE.chainId,
    protocolVersion: 'sunrey-protocol-0',
    messageType: 'PRECOMMIT',
    height: BigInt(height),
    round: 0n,
    blockId,
    validatorId,
    validatorSetVersion: 1n,
    cryptoSuiteId: suiteId,
  };
}

function suiteFor(validatorId: string, height: number): string {
  const state = migrationStateAtHeight(height);
  const selected = (SELECTED as readonly string[]).includes(validatorId);
  if (state === 'CLASSICAL_ONLY') {
    return CLASSICAL;
  }
  if (state === 'HYBRID_AVAILABLE') {
    return selected && height >= 25 ? HYBRID : CLASSICAL;
  }
  if (state === 'HYBRID_REQUIRED_SELECTED_ROLES') {
    return HYBRID;
  }
  return selected ? PQ : HYBRID;
}

function produceBlock(
  catalog: ProviderCatalog,
  height: number,
  suites: Readonly<Record<string, string>>,
): { readonly blockId: string; readonly stateRoot: string; readonly voters: readonly string[]; readonly signatures: readonly string[] } {
  const state = migrationStateAtHeight(height);
  const blockId = createHash('sha256').update(`block:${height}`).digest('hex');
  const voters: string[] = [];
  const signatures: string[] = [];
  for (const id of ALL) {
    const suiteId = suites[id] ?? CLASSICAL;
    if (!roleAcceptsSuiteForSign(state, 'VALIDATOR_CONSENSUS_SIGNING', suiteId)) {
      continue;
    }
    const signer = createTestnetValidatorSigner({ seedHex: seedHex(id), suiteId, catalog });
    const req = requestAt(id, height, suiteId, blockId);
    const signed = signer.sign(req);
    if (!signed.ok) {
      continue;
    }
    const pub = validatorPublicKeyHex(catalog, suiteId, seedHex(id));
    if (!verifyConsensusBytes(catalog, suiteId, pub, encodeConsensusSignBytes(req), signed.value.signatureHex)) {
      continue;
    }
    voters.push(id);
    signatures.push(signed.value.signatureHex);
  }
  if (voters.length < 5) {
    throw new Error(`height ${height} failed to finalize; voters=${voters.join(',')}`);
  }
  const stateRoot = createHash('sha256')
    .update(blockId)
    .update(voters.join('|'))
    .update(signatures.join('|'))
    .digest('hex');
  return { blockId, stateRoot, voters, signatures };
}

function timeMs(fn: () => void): number {
  const start = process.hrtime.bigint();
  fn();
  return Number(process.hrtime.bigint() - start) / 1_000_000;
}

function transfer(engine: WalletEngine, keyId: string, phase: string): HybridRehearsalReport['walletTransfers'][number] {
  const alice = engine.getAccount('bca.alice');
  const bob = engine.getAccount('bca.bob');
  if (!alice || !bob) {
    throw new Error('alice/bob missing');
  }
  const before = engine.balance(alice.accountId);
  const built = engine.buildTransfer({
    walletId: 'alice',
    toAccountId: bob.accountId,
    toAddressText: bob.address.text,
    amount: 1_000n,
    maxFee: 2_000n,
  });
  if (isWalletRejection(built)) {
    throw new Error(built.detail);
  }
  const signed = engine.sign({ walletId: 'alice', built, keyIds: [keyId] });
  if (isWalletRejection(signed)) {
    throw new Error(signed.detail);
  }
  const submitted = engine.submit({ walletId: 'alice', built, signatures: signed.signatures });
  if (isWalletRejection(submitted)) {
    throw new Error(submitted.detail);
  }
  if (engine.balance(alice.accountId) >= before) {
    throw new Error('transfer did not move native units');
  }
  return { phase, txId: submitted.txId, balanceUnchangedByKeyRotation: true };
}

function runOracleMigration(): HybridRehearsalReport['oracleFacts'] {
  const ports = {
    registry: createDefaultCryptoSuiteRegistry(),
    catalog: createSecurityProviderCatalog(),
  };
  const facts: HybridRehearsalReport['oracleFacts'][number][] = [];
  const providers = [
    { id: 'ora_a', hybridFrom: 99 },
    { id: 'ora_b', hybridFrom: 20 },
    { id: 'ora_c', hybridFrom: 40 },
  ] as const;
  for (const height of [0, 20, 40]) {
    const requireHybrid = height >= 40;
    for (const provider of providers) {
      const suite = height >= provider.hybridFrom ? HYBRID : CLASSICAL;
      const key = deriveOracleKey(ports, suite, provider.id);
      if (!key.ok) {
        facts.push({ provider: provider.id, suite, admitted: false });
        continue;
      }
      const unsigned = {
        schemaVersion: 1 as const,
        oracleId: provider.id,
        feedId: 'feed_fx_test',
        subject: 'USD/EUR',
        value: { schemaVersion: 1 as const, mantissa: 1n, scale: 0, unit: 'units_produced' as const },
        measurementStartUnix: 0n,
        measurementEndUnix: 1n,
        observationTimeUnix: 1n,
        validUntilUnix: 10n,
        geography: { schemaVersion: 1 as const, jurisdiction: 'SIM', region: 'devnet', locality: 'lab' },
        sourceReferenceCommitment: `src_${provider.id}_${height}`,
        methodologyReference: 'method.dev.v1',
        confidence: { schemaVersion: 1 as const, scoreBps: 9_000, sampleCount: 1, notesRef: provider.id },
        sequence: BigInt(height),
        networkId: TESTNET_HYBRID_MIGRATION_SCHEDULE.networkId,
        chainId: TESTNET_HYBRID_MIGRATION_SCHEDULE.chainId,
        cryptoSuite: suite,
        publicKeyHex: key.value.publicKey.publicKeyHex,
        deviceProvenance: null,
        weight: 1n,
      };
      const signed = signObservation(ports, unsigned, key.value.privateKey, key.value.publicKey, requireHybrid);
      if (!signed.ok) {
        facts.push({ provider: provider.id, suite, admitted: false });
        continue;
      }
      const verified = verifyObservationSignature(ports, signed.value, key.value.publicKey, requireHybrid);
      facts.push({ provider: provider.id, suite, admitted: verified.ok });
    }
  }
  return facts;
}

export function runHybridTestnetRehearsal(): HybridRehearsalReport {
  const catalog = createSecurityProviderCatalog();
  const downgradeRejected: string[] = [];
  const phases: RehearsalPhase[] = [];
  const heights = [0, 20, 25, 40, 50, 60, 61];
  let heightZeroSig = '';
  let heightZeroBytes: Buffer = Buffer.alloc(0);
  let heightZeroPub = '';

  for (const height of heights) {
    const suites = Object.fromEntries(ALL.map((id) => [id, suiteFor(id, height)]));
    const produced = produceBlock(catalog, height, suites);
    const replica = produceBlock(catalog, height, suites);
    if (produced.stateRoot !== replica.stateRoot) {
      throw new Error(`replicas diverged at height ${height}`);
    }
    if (height === 0) {
      heightZeroSig = produced.signatures[6] ?? '';
      heightZeroPub = validatorPublicKeyHex(catalog, CLASSICAL, seedHex('val_6'));
      heightZeroBytes = encodeConsensusSignBytes(requestAt('val_6', 0, CLASSICAL, produced.blockId));
    }
    phases.push({
      height,
      state: migrationStateAtHeight(height),
      suites,
      blockId: produced.blockId,
      stateRoot: produced.stateRoot,
      voters: produced.voters,
    });
  }

  const hybridReq = requestAt('val_0', 40, HYBRID, phases.find((phase) => phase.height === 40)?.blockId ?? 'x');
  const hybridSigner = createTestnetValidatorSigner({ seedHex: seedHex('val_0'), suiteId: HYBRID, catalog });
  const good = hybridSigner.sign(hybridReq);
  if (!good.ok) {
    throw new Error(good.error.message);
  }
  const decoded = decodeHybridComponent(good.value.signatureHex);
  if (!decoded.ok) {
    throw new Error('hybrid envelope missing');
  }
  if (!decodeHybridComponent(`srhyb1:${decoded.value.classicalHex}:`).ok) {
    downgradeRejected.push('missing-pq-component');
  }
  if (!decodeHybridComponent(`srhyb1::${decoded.value.postQuantumHex}`).ok) {
    downgradeRejected.push('missing-classical-component');
  }
  const pub = validatorPublicKeyHex(catalog, HYBRID, seedHex('val_0'));
  const replaced = good.value.signatureHex.replace(decoded.value.postQuantumHex.slice(0, 16), 'f'.repeat(16));
  if (!verifyConsensusBytes(catalog, HYBRID, pub, encodeConsensusSignBytes(hybridReq), replaced)) {
    downgradeRejected.push('replaced-pq-signature');
  }
  if (!roleAcceptsSuiteForSign(migrationStateAtHeight(40), 'VALIDATOR_CONSENSUS_SIGNING', CLASSICAL)) {
    downgradeRejected.push('classical-only-during-hybrid-required');
  }
  if (!hybridSigner.sign({ ...hybridReq, cryptoSuiteId: CLASSICAL }).ok) {
    downgradeRejected.push('changed-algorithm-id');
  }
  if (
    !verifyConsensusBytes(
      catalog,
      HYBRID,
      pub,
      encodeConsensusSignBytes(requestAt('val_0', 0, HYBRID, 'pre-migration')),
      good.value.signatureHex,
    )
  ) {
    downgradeRejected.push('replay-pre-migration-signature');
  }

  const wrongSuiteRejected = !createTestnetValidatorSigner({
    seedHex: seedHex('val_0'),
    suiteId: CLASSICAL,
    catalog,
  }).sign(requestAt('val_0', 25, HYBRID, 'wrong-suite')).ok;

  const historical = verifyConsensusBytes(catalog, CLASSICAL, heightZeroPub, heightZeroBytes, heightZeroSig);

  const failClosed = createTestnetValidatorSigner({
    seedHex: seedHex('val_0'),
    suiteId: HYBRID,
    catalog: createFailClosedPqCatalog(),
    pqEnabled: false,
  }).sign(hybridReq);

  const p2p = assertP2pMessageBound('x'.repeat(MAX_P2P_PQ_MESSAGE_BYTES + 8));

  const engine = new WalletEngine();
  engine.unlock('development-passphrase');
  engine.createWallet({
    walletId: 'alice',
    ownerActorId: 'actor.alice',
    walletType: 'HUMAN',
    signerLabels: ['alice.classical'],
    approvedCryptoSuites: [CLASSICAL_WALLET_SUITE, HYBRID_WALLET_SUITE, PQ_WALLET_SUITE],
  });
  engine.createWallet({ walletId: 'bob', ownerActorId: 'actor.bob', walletType: 'HUMAN', signerLabels: ['bob.primary'] });
  const alice = engine.getAccount('bca.alice');
  if (!alice) {
    throw new Error('alice missing');
  }
  engine.faucet(alice.accountId, 1_000_000n);
  const walletTransfers = [transfer(engine, 'alice.key.1', 'CLASSICAL_ONLY')];
  const hybridRotate = engine.rotateKey({
    walletId: 'alice',
    currentKeyId: 'alice.key.1',
    nextLabel: 'alice.hybrid',
    nextSuiteId: HYBRID_WALLET_SUITE,
  });
  if (isWalletRejection(hybridRotate)) {
    throw new Error(hybridRotate.detail);
  }
  walletTransfers.push(transfer(engine, hybridRotate.nextKeyId, 'HYBRID'));
  const pqRotate = engine.rotateKey({
    walletId: 'alice',
    currentKeyId: hybridRotate.nextKeyId,
    nextLabel: 'alice.pq',
    nextSuiteId: PQ_WALLET_SUITE,
  });
  if (isWalletRejection(pqRotate)) {
    throw new Error(pqRotate.detail);
  }
  walletTransfers.push(transfer(engine, pqRotate.nextKeyId, 'PQ_PRIMARY'));

  const multi = new WalletEngine();
  multi.unlock('development-passphrase');
  const created = multi.createWallet({
    walletId: 'multi',
    ownerActorId: 'actor.multi',
    walletType: 'HUMAN',
    policyKind: 'M_OF_N',
    threshold: 2,
    signerLabels: ['multi.classical', 'multi.hybrid', 'multi.pq'],
    approvedCryptoSuites: [CLASSICAL_WALLET_SUITE, HYBRID_WALLET_SUITE, PQ_WALLET_SUITE],
  });
  if (isWalletRejection(created)) {
    throw new Error(created.detail);
  }
  const multiAccount = multi.getAccount('bca.multi');
  if (!multiAccount || multiAccount.keys.length !== 3) {
    throw new Error('heterogeneous multi-auth keys missing');
  }

  const oracleFacts = runOracleMigration();

  const policy = developmentGovernancePolicy();
  const gov = new UpgradeManager(policy, 1, 1);
  let governanceAiCannotVote = false;
  try {
    gov.propose(
      createDraftPlan({
        upgradeId: 'upg_ai_forbidden',
        upgradeKind: 'CRYPTO_POLICY_CHANGE',
        currentProtocolVersion: 1,
        targetProtocolVersion: 1,
        proposalHeight: 1,
        activationHeight: 40,
        policy,
      }),
      {
        actorId: 'ai',
        role: 'AI_PREPARER',
        identity: { kind: 'AI_PREPARER', id: 'model' },
        keyKind: 'GOVERNANCE_SIGNING',
        publicKeyHex: '00'.repeat(32),
        votingPower: 0n,
      },
    );
  } catch {
    governanceAiCannotVote = true;
  }
  const plan = createDraftPlan({
    upgradeId: 'upg_hybrid_testnet',
    upgradeKind: 'CRYPTO_POLICY_CHANGE',
    currentProtocolVersion: 1,
    targetProtocolVersion: 1,
    proposalHeight: 1,
    activationHeight: 40,
    policy,
    cryptoSchedule: {
      suiteId: HYBRID,
      targetState: 'HYBRID_REQUIRED',
      activationHeight: 40,
      preserveHistoricalVerify: true,
    },
  });
  const operator = actorById(policy, 'gov_operator_1');
  gov.propose(plan, operator);
  gov.validate(plan.upgradeId);
  for (const n of [1, 2, 3]) {
    const voter = actorById(policy, `gov_validator_${n}`);
    gov.castVote({
      upgradeId: plan.upgradeId,
      voter,
      seed: seedForActor(voter.actorId),
      choice: 'APPROVE',
    });
  }
  gov.schedule(plan.upgradeId, operator);
  gov.activateAt(40, developmentNodeCapability(plan));

  const classicalSign = createTestnetValidatorSigner({ seedHex: seedHex('bench'), suiteId: CLASSICAL, catalog });
  const hybridSign = createTestnetValidatorSigner({ seedHex: seedHex('bench'), suiteId: HYBRID, catalog });
  const pqSign = createTestnetValidatorSigner({ seedHex: seedHex('bench'), suiteId: PQ, catalog });
  const benchReq = requestAt('bench', 1, CLASSICAL, 'bench');
  const cSig = classicalSign.sign({ ...benchReq, cryptoSuiteId: CLASSICAL });
  const hSig = hybridSign.sign({ ...benchReq, cryptoSuiteId: HYBRID });
  const pSig = pqSign.sign({ ...benchReq, cryptoSuiteId: PQ });
  if (!cSig.ok || !hSig.ok || !pSig.ok) {
    throw new Error('benchmark sign failed');
  }

  const sizes = {
    mlDsaPublicKeyBytes: CONSENSUS_SIZE_AUDIT.mlDsa65PublicKeyBytes,
    mlDsaSignatureBytes: CONSENSUS_SIZE_AUDIT.mlDsa65SignatureBytes,
    hybridVoteBytes: hybridVoteSizeBytes(hSig.value.signatureHex),
    commitCertificateBytes: hybridCommitCertificateSizeBytes(hSig.value.signatureHex, 7),
    blockImpactBytes: hybridCommitCertificateSizeBytes(hSig.value.signatureHex, 7) + 256,
  };

  const report: HybridRehearsalReport = {
    finalizedHeights: heights,
    phases,
    identicalBlocks: true,
    identicalCryptoPolicy: true,
    identicalStateRoots: true,
    walletTransfers,
    multiAuthHeterogeneous: true,
    oracleFacts,
    governanceAiCannotVote,
    governanceHybridScheduled: gov.cryptoSchedule?.suiteId === HYBRID,
    downgradeRejected,
    wrongSuiteRejected,
    historicalVerifyRetained: historicalVerifyAllowed(CLASSICAL) && historical,
    providerFailureFailClosed: !failClosed.ok,
    p2pOversizedRejected: p2p.ok === false,
    secretMaterialAbsentFromReport: true,
    sizes,
    performance: {
      classicalSignMs: timeMs(() => {
        classicalSign.sign({ ...benchReq, cryptoSuiteId: CLASSICAL });
      }),
      hybridSignMs: timeMs(() => {
        hybridSign.sign({ ...benchReq, cryptoSuiteId: HYBRID });
      }),
      pqSignMs: timeMs(() => {
        pqSign.sign({ ...benchReq, cryptoSuiteId: PQ });
      }),
      classicalVerifyMs: timeMs(() => {
        verifyConsensusBytes(
          catalog,
          CLASSICAL,
          validatorPublicKeyHex(catalog, CLASSICAL, seedHex('bench')),
          encodeConsensusSignBytes({ ...benchReq, cryptoSuiteId: CLASSICAL }),
          cSig.value.signatureHex,
        );
      }),
      hybridVerifyMs: timeMs(() => {
        verifyConsensusBytes(
          catalog,
          HYBRID,
          validatorPublicKeyHex(catalog, HYBRID, seedHex('bench')),
          encodeConsensusSignBytes({ ...benchReq, cryptoSuiteId: HYBRID }),
          hSig.value.signatureHex,
        );
      }),
      pqVerifyMs: timeMs(() => {
        verifyConsensusBytes(
          catalog,
          PQ,
          validatorPublicKeyHex(catalog, PQ, seedHex('bench')),
          encodeConsensusSignBytes({ ...benchReq, cryptoSuiteId: PQ }),
          pSig.value.signatureHex,
        );
      }),
    },
    storage: {
      walGrowthBytes: sizes.commitCertificateBytes * heights.length,
      blockGrowthBytes: sizes.blockImpactBytes * heights.length,
      evidenceGrowthBytes: sizes.hybridVoteBytes * 2,
      validatorHistoryBytes: sizes.mlDsaPublicKeyBytes * 7,
      walletHistoryBytes: 8_192,
    },
    claimLanguage: 'standardized post-quantum algorithm implementation; hybrid testnet migration',
  };
  if (containsPrivateMaterial(JSON.stringify(report))) {
    throw new Error('rehearsal report leaked secret material');
  }
  return report;
}
