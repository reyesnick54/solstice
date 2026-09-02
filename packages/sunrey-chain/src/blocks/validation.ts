/**
 * Comprehensive block validation before canonical commitment.
 *
 * Invalid blocks produce zero canonical state mutation.
 */

import { blockId, hashFromHex, hashToHex, transactionIdFromBytes, transactionRoot } from './commitments.ts';
import type { MonetaryStateStore } from './monetary-state.ts';
import type {
  BlockValidationFailure,
  CandidateTransaction,
  CanonicalBlockHeader,
  ChainIdentity,
  CommitCertificate,
  ProposedBlock,
  ValidatorPower,
} from './types.ts';
import { verifyCommitCertificate } from './finality.ts';

export type BlockValidationResult =
  | { readonly ok: true; readonly blockHash: string }
  | { readonly ok: false; readonly reason: BlockValidationFailure; readonly detail: string };

export function validateBlockHeader(input: {
  readonly header: CanonicalBlockHeader;
  readonly identity: ChainIdentity;
  readonly expectedHeight: bigint;
  readonly parentBlockHash: Uint8Array;
  readonly expectedTransactionRoot: Uint8Array;
  readonly expectedPreviousState: Uint8Array;
  readonly expectedResultingState: Uint8Array;
  readonly supportedProtocolVersions: readonly string[];
}): BlockValidationResult {
  const { header } = input;
  if (header.version !== 1) {
    return fail('UNSUPPORTED_VERSION', `version ${header.version}`);
  }
  if (header.networkId !== input.identity.networkId) {
    return fail('WRONG_NETWORK', header.networkId);
  }
  if (header.chainId !== input.identity.chainId) {
    return fail('WRONG_CHAIN', header.chainId);
  }
  if (!input.supportedProtocolVersions.includes(header.protocolVersion)) {
    return fail('UNSUPPORTED_PROTOCOL_VERSION', header.protocolVersion);
  }
  if (header.height !== input.expectedHeight) {
    return fail('INCORRECT_HEIGHT', `${header.height}`);
  }
  if (hashToHex(header.parentBlockHash) !== hashToHex(input.parentBlockHash)) {
    return fail('INCORRECT_PARENT', hashToHex(header.parentBlockHash));
  }
  if (hashToHex(header.transactionRoot) !== hashToHex(input.expectedTransactionRoot)) {
    return fail('WRONG_TRANSACTION_ROOT', hashToHex(header.transactionRoot));
  }
  if (hashToHex(header.previousStateCommitment) !== hashToHex(input.expectedPreviousState)) {
    return fail('WRONG_PREVIOUS_STATE', hashToHex(header.previousStateCommitment));
  }
  if (hashToHex(header.resultingStateCommitment) !== hashToHex(input.expectedResultingState)) {
    return fail('WRONG_RESULTING_STATE', hashToHex(header.resultingStateCommitment));
  }
  return { ok: true, blockHash: hashToHex(blockId(header)) };
}

export function computeTransactionRoot(transactions: readonly CandidateTransaction[]): Uint8Array {
  const leaves = transactions.map((tx) => transactionIdFromBytes(tx.canonicalBytes));
  return transactionRoot(leaves);
}

export function executeTransactions(
  base: MonetaryStateStore,
  transactions: readonly CandidateTransaction[],
): { readonly state: MonetaryStateStore; readonly commitment: string } {
  const next = base.clone();
  for (const tx of transactions) {
    next.transfer({
      from: tx.signerAccountId,
      to: tx.toAccountId,
      assetId: tx.assetId,
      amount: tx.amount,
      fee: tx.fee,
      nonce: tx.nonce,
    });
  }
  return { state: next, commitment: next.commitment() };
}

export function validateProposedBlock(input: {
  readonly block: ProposedBlock;
  readonly identity: ChainIdentity;
  readonly parentBlockHash: Uint8Array;
  readonly parentStateCommitment: string;
  readonly parentTimestampUnixMs: bigint;
  readonly canonicalState: MonetaryStateStore;
  readonly supportedProtocolVersions: readonly string[];
}): BlockValidationResult {
  const txRoot = computeTransactionRoot(input.block.transactions);
  const execution = executeTransactions(input.canonicalState, input.block.transactions);
  const previous = hashFromHex(input.parentStateCommitment);
  const resulting = hashFromHex(execution.commitment);
  if (input.block.header.timestampUnixMs < input.parentTimestampUnixMs) {
    return fail('TIMESTAMP_REGRESSION', `${input.block.header.timestampUnixMs}`);
  }
  const headerResult = validateBlockHeader({
    header: input.block.header,
    identity: input.identity,
    expectedHeight: input.block.header.height,
    parentBlockHash: input.parentBlockHash,
    expectedTransactionRoot: txRoot,
    expectedPreviousState: previous,
    expectedResultingState: resulting,
    supportedProtocolVersions: input.supportedProtocolVersions,
  });
  if (!headerResult.ok) {
    return headerResult;
  }
  if (headerResult.blockHash !== input.block.blockHash) {
    return fail('STATE_DIVERGENCE', 'block hash mismatch');
  }
  return headerResult;
}

export function validateConsensusCertificate(input: {
  readonly certificate: CommitCertificate;
  readonly blockHash: string;
  readonly validators: readonly ValidatorPower[];
  readonly validatorSetHash: string;
}): BlockValidationResult {
  if (!verifyCommitCertificate(input.certificate, input.validators, input.blockHash)) {
    return fail('INVALID_CONSENSUS_CERTIFICATE', input.certificate.certificateHash);
  }
  return { ok: true, blockHash: input.blockHash };
}

function fail(reason: BlockValidationFailure, detail: string): BlockValidationResult {
  return { ok: false, reason, detail };
}
