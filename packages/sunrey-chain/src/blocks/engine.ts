/**
 * Canonical block lifecycle engine.
 *
 * candidate transactions → proposed block → consensus validation →
 * deterministic execution → consensus commit → finalized block →
 * canonical state → durable persistence
 */

import { createHash } from 'node:crypto';

import { blockId, hashFromHex, hashToHex, transactionIdFromBytes } from './commitments.ts';
import { resolveFinalizedConflict } from './fork.ts';
import { buildCommitCertificate, quorumPower, totalVotingPower } from './finality.ts';
import { advanceLifecycle, advanceToIncluded, createSubmitted, isCanonicalTruth } from './lifecycle.ts';
import { MonetaryStateStore } from './monetary-state.ts';
import { createChainQueries } from './queries.ts';
import { assertFinalizedReconciliation, reconcileFinalizedBlock } from './reconciliation.ts';
import {
  computeTransactionRoot,
  executeTransactions,
  validateConsensusCertificate,
  validateProposedBlock,
} from './validation.ts';
import type {
  BlockPipelineStage,
  BlockValidationFailure,
  CandidateTransaction,
  CanonicalBlockHeader,
  ChainIdentity,
  CommitCertificate,
  FinalizedBlock,
  ProposedBlock,
  TransactionLifecycleRecord,
  ValidatorPower,
} from './types.ts';
import { BLOCK_HEADER_VERSION_V1 } from './types.ts';

const ZERO_HASH = new Uint8Array(32);

export type PersistedChainSnapshot = {
  readonly canonicalState: MonetaryStateStore;
  readonly finalizedBlocks: readonly FinalizedBlock[];
  readonly lifecycle: readonly TransactionLifecycleRecord[];
  readonly tipBlockHash: string | null;
  readonly tipHeight: bigint;
};

export class BlockLifecycleEngine {
  readonly identity: ChainIdentity;
  readonly validators: readonly ValidatorPower[];
  readonly supportedProtocolVersions: readonly string[];

  private canonicalState: MonetaryStateStore;
  private readonly mempool = new Map<string, CandidateTransaction>();
  private readonly lifecycle = new Map<string, TransactionLifecycleRecord>();
  private readonly finalizedBlocks = new Map<string, FinalizedBlock>();
  private readonly finalizedByHeight = new Map<string, FinalizedBlock>();
  private readonly pendingBlocks = new Map<string, { readonly block: ProposedBlock; readonly stage: BlockPipelineStage }>();

  private tipBlockHash: string | null = null;
  private tipHeight = 0n;
  private parentTimestampUnixMs = 0n;
  private validatorSetVersion = 1n;

  constructor(input: {
    readonly identity: ChainIdentity;
    readonly validators: readonly ValidatorPower[];
    readonly genesisState?: MonetaryStateStore;
    readonly supportedProtocolVersions?: readonly string[];
  }) {
    this.identity = input.identity;
    this.validators = Object.freeze([...input.validators]);
    this.supportedProtocolVersions = Object.freeze(input.supportedProtocolVersions ?? [input.identity.protocolVersion]);
    this.canonicalState = input.genesisState?.clone() ?? new MonetaryStateStore();
  }

  queries() {
    return createChainQueries({
      identity: this.identity,
      finalizedBlocks: this.finalizedBlocks,
      finalizedByHeight: this.finalizedByHeight,
      lifecycle: this.lifecycle,
      canonicalState: this.canonicalState,
      validators: this.validators,
      quorumPower: quorumPower(totalVotingPower(this.validators)),
    });
  }

  submitTransaction(tx: CandidateTransaction): TransactionLifecycleRecord {
    const txId = hashToHex(transactionIdFromBytes(tx.canonicalBytes));
    if (tx.txId !== txId) {
      throw new Error('transaction id does not match canonical bytes');
    }
    this.mempool.set(txId, tx);
    const record = advanceLifecycle(createSubmitted(txId), 'PENDING');
    this.lifecycle.set(txId, record);
    return record;
  }

  proposeBlock(input: {
    readonly transactions: readonly CandidateTransaction[];
    readonly proposer: string;
    readonly round?: number;
    readonly timestampUnixMs: bigint;
    readonly registryHashes?: {
      readonly validatorSetHash?: Uint8Array;
      readonly consensusParameterHash?: Uint8Array;
      readonly moduleRegistryHash?: Uint8Array;
      readonly codecRegistryHash?: Uint8Array;
      readonly cryptoPolicyHash?: Uint8Array;
    };
  }): ProposedBlock | { readonly ok: false; readonly reason: BlockValidationFailure; readonly detail: string } {
    const height = this.tipHeight + 1n;
    const parentBlockHash = this.tipBlockHash ? hashFromHex(this.tipBlockHash) : ZERO_HASH;
    const previousStateCommitment = hashFromHex(this.canonicalState.commitment());
    let execution: { readonly state: MonetaryStateStore; readonly commitment: string };
    try {
      execution = executeTransactions(this.canonicalState, input.transactions);
    } catch (error) {
      return {
        ok: false,
        reason: 'INVALID_TRANSACTION',
        detail: error instanceof Error ? error.message : 'execution failed',
      };
    }
    const transactionRootBytes = computeTransactionRoot(input.transactions);
    const header: CanonicalBlockHeader = {
      version: BLOCK_HEADER_VERSION_V1,
      networkId: this.identity.networkId,
      chainId: this.identity.chainId,
      height,
      round: input.round ?? 0,
      parentBlockHash,
      transactionRoot: transactionRootBytes,
      previousStateCommitment,
      resultingStateCommitment: hashFromHex(execution.commitment),
      validatorSetHash: input.registryHashes?.validatorSetHash ?? hashFromHex(validatorSetHash(this.validators)),
      consensusParameterHash: input.registryHashes?.consensusParameterHash ?? ZERO_HASH,
      protocolVersion: this.identity.protocolVersion,
      moduleRegistryHash: input.registryHashes?.moduleRegistryHash ?? ZERO_HASH,
      codecRegistryHash: input.registryHashes?.codecRegistryHash ?? ZERO_HASH,
      cryptoPolicyHash: input.registryHashes?.cryptoPolicyHash ?? ZERO_HASH,
      timestampUnixMs: input.timestampUnixMs,
      proposer: input.proposer,
      cryptoSuiteId: 'SUNREY_DEV_ED25519_SHA256',
      consensusCertificateHash: ZERO_HASH,
      extensionCommitments: {},
    };
    const blockHash = hashToHex(blockId(header));
    const block: ProposedBlock = {
      header,
      blockHash,
      transactions: Object.freeze([...input.transactions]),
      rejected: Object.freeze([]),
    };
    const validation = validateProposedBlock({
      block,
      identity: this.identity,
      parentBlockHash,
      parentStateCommitment: this.canonicalState.commitment(),
      parentTimestampUnixMs: this.parentTimestampUnixMs,
      canonicalState: this.canonicalState,
      supportedProtocolVersions: this.supportedProtocolVersions,
    });
    if (!validation.ok) {
      return validation;
    }
    for (const tx of input.transactions) {
      const current = this.lifecycle.get(tx.txId) ?? createSubmitted(tx.txId);
      this.lifecycle.set(
        tx.txId,
        advanceToIncluded(current, { height, blockHash }),
      );
      this.mempool.delete(tx.txId);
    }
    this.pendingBlocks.set(blockHash, { block, stage: 'PROPOSED' });
    return block;
  }

  executeLocally(blockHash: string): { readonly ok: true; readonly stateCommitment: string } | { readonly ok: false; readonly reason: string } {
    const pending = this.pendingBlocks.get(blockHash);
    if (!pending) {
      return { ok: false, reason: 'unknown block' };
    }
    const execution = executeTransactions(this.canonicalState, pending.block.transactions);
    for (const tx of pending.block.transactions) {
      const current = this.lifecycle.get(tx.txId);
      if (current) {
        this.lifecycle.set(
          tx.txId,
          advanceLifecycle(current, 'EXECUTED', { height: pending.block.header.height, blockHash }),
        );
      }
    }
    this.pendingBlocks.set(blockHash, { block: pending.block, stage: 'EXECUTED' });
    return { ok: true, stateCommitment: execution.commitment };
  }

  commitWithCertificate(blockHash: string, voters: readonly string[]): FinalizedBlock | { readonly ok: false; readonly reason: BlockValidationFailure; readonly detail: string } {
    const pending = this.pendingBlocks.get(blockHash);
    if (!pending) {
      return { ok: false, reason: 'INVALID_CONSENSUS_CERTIFICATE', detail: 'unknown block' };
    }
    const certificate = buildCommitCertificate({
      height: pending.block.header.height,
      round: pending.block.header.round,
      blockHash,
      validatorSetVersion: this.validatorSetVersion,
      voters,
    });
    const certValidation = validateConsensusCertificate({
      certificate,
      blockHash,
      validators: this.validators,
      validatorSetHash: hashToHex(pending.block.header.validatorSetHash),
    });
    if (!certValidation.ok) {
      return certValidation;
    }
    return this.finalizeBlock(pending.block, certificate);
  }

  finalizeBlock(
    block: ProposedBlock,
    certificate: CommitCertificate,
  ): FinalizedBlock | { readonly ok: false; readonly reason: BlockValidationFailure; readonly detail: string } {
    const validation = validateProposedBlock({
      block,
      identity: this.identity,
      parentBlockHash: block.header.parentBlockHash,
      parentStateCommitment: hashToHex(block.header.previousStateCommitment),
      parentTimestampUnixMs: this.parentTimestampUnixMs,
      canonicalState: this.canonicalState,
      supportedProtocolVersions: this.supportedProtocolVersions,
    });
    if (!validation.ok) {
      return validation;
    }
    const execution = executeTransactions(this.canonicalState, block.transactions);
    if (execution.commitment !== hashToHex(block.header.resultingStateCommitment)) {
      return { ok: false, reason: 'STATE_DIVERGENCE', detail: execution.commitment };
    }
    const finalized: FinalizedBlock = Object.freeze({
      ...block,
      header: Object.freeze({
        ...block.header,
        consensusCertificateHash: hashFromHex(certificate.certificateHash),
      }),
      consensusCertificateHash: certificate.certificateHash,
      finalizedAtUnixMs: block.header.timestampUnixMs,
    });
    const conflict = resolveFinalizedConflict(
      this.finalizedByHeight.get(String(block.header.height)) ?? null,
      finalized,
    );
    if (conflict.outcome === 'REJECT_INCOMPATIBLE_FINALIZED') {
      return {
        ok: false,
        reason: 'INVALID_CONSENSUS_CERTIFICATE',
        detail: `incompatible finalized history ${conflict.existingHash} vs ${conflict.conflictingHash}`,
      };
    }
    const report = reconcileFinalizedBlock({ block: finalized, state: execution.state });
    try {
      assertFinalizedReconciliation(report);
    } catch (error) {
      return {
        ok: false,
        reason: 'STATE_DIVERGENCE',
        detail: error instanceof Error ? error.message : 'reconciliation failed',
      };
    }
    this.canonicalState = execution.state;
    this.finalizedBlocks.set(finalized.blockHash, finalized);
    this.finalizedByHeight.set(String(finalized.header.height), finalized);
    this.tipBlockHash = finalized.blockHash;
    this.tipHeight = finalized.header.height;
    this.parentTimestampUnixMs = finalized.header.timestampUnixMs;
    this.pendingBlocks.delete(finalized.blockHash);
    for (const tx of block.transactions) {
      const current = this.lifecycle.get(tx.txId);
      if (current) {
        this.lifecycle.set(
          tx.txId,
          advanceLifecycle(current, 'FINALIZED', { height: finalized.header.height, blockHash: finalized.blockHash }),
        );
      }
    }
    return finalized;
  }

  rejectBlock(blockHash: string, reason: string): void {
    const pending = this.pendingBlocks.get(blockHash);
    if (!pending) {
      return;
    }
    for (const tx of pending.block.transactions) {
      const current = this.lifecycle.get(tx.txId);
      if (current && !isCanonicalTruth(current.status)) {
        this.lifecycle.set(
          tx.txId,
          advanceLifecycle(current, 'FAILED', { failureReason: reason }),
        );
        this.mempool.set(tx.txId, pending.block.transactions.find((row) => row.txId === tx.txId)!);
      }
    }
    this.pendingBlocks.delete(blockHash);
  }

  snapshot(): PersistedChainSnapshot {
    return {
      canonicalState: this.canonicalState.clone(),
      finalizedBlocks: Object.freeze([...this.finalizedBlocks.values()]),
      lifecycle: Object.freeze([...this.lifecycle.values()]),
      tipBlockHash: this.tipBlockHash,
      tipHeight: this.tipHeight,
    };
  }

  restore(snapshot: PersistedChainSnapshot): void {
    this.canonicalState = snapshot.canonicalState.clone();
    this.finalizedBlocks.clear();
    this.finalizedByHeight.clear();
    this.lifecycle.clear();
    this.pendingBlocks.clear();
    this.mempool.clear();
    for (const block of snapshot.finalizedBlocks) {
      this.finalizedBlocks.set(block.blockHash, block);
      this.finalizedByHeight.set(String(block.header.height), block);
    }
    for (const record of snapshot.lifecycle) {
      this.lifecycle.set(record.txId, record);
    }
    this.tipBlockHash = snapshot.tipBlockHash;
    this.tipHeight = snapshot.tipHeight;
    const tip = snapshot.tipBlockHash ? this.finalizedBlocks.get(snapshot.tipBlockHash) : null;
    this.parentTimestampUnixMs = tip?.header.timestampUnixMs ?? 0n;
  }

  nonCanonicalLifecycle(txId: string): TransactionLifecycleRecord | undefined {
    const row = this.lifecycle.get(txId);
    if (!row || isCanonicalTruth(row.status)) {
      return row;
    }
    return row;
  }
}

function validatorSetHash(validators: readonly ValidatorPower[]): string {
  return createHash('sha256')
    .update(validators.map((row) => `${row.validatorId}:${row.votingPower}`).sort().join('|'))
    .digest('hex');
}

export function candidateTransaction(input: {
  readonly signerAccountId: string;
  readonly toAccountId: string;
  readonly assetId: 'SUNREY_COIN' | 'MOONREY_COIN';
  readonly amount: bigint;
  readonly fee: bigint;
  readonly nonce: bigint;
}): CandidateTransaction {
  const canonicalBytes = Buffer.from(
    [
      input.signerAccountId,
      input.toAccountId,
      input.assetId,
      input.amount.toString(),
      input.fee.toString(),
      input.nonce.toString(),
    ].join('|'),
    'utf8',
  );
  const txId = hashToHex(transactionIdFromBytes(canonicalBytes));
  return Object.freeze({
    txId,
    canonicalBytes,
    signerAccountId: input.signerAccountId,
    nonce: input.nonce,
    assetId: input.assetId,
    amount: input.amount,
    fee: input.fee,
    toAccountId: input.toAccountId,
  });
}
