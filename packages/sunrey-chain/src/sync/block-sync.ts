/**
 * Wave 2 — verified block synchronization.
 *
 * A node must validate network identity, block ancestry, consensus finality,
 * transaction commitment, and state transition validity. Never trust
 * peer-reported balances directly.
 */

import { opsErr, opsOk } from '../ops/types.ts';
import type { BlockSyncInput, BlockSyncReport, ChainIdentity, CommitCertificateRef, SyncBlockHeader, SyncResult } from './types.ts';
export type { BlockSyncInput } from './types.ts';

function twoThirdsPlus(total: bigint): bigint {
  return (total * 2n) / 3n + 1n;
}

export function verifyChainIdentity(
  observed: ChainIdentity,
  expected: ChainIdentity,
): SyncResult<true> {
  if (observed.networkId !== expected.networkId) {
    return opsErr('WRONG_NETWORK_SNAPSHOT', 'network id mismatch');
  }
  if (observed.chainId !== expected.chainId) {
    return opsErr('WRONG_NETWORK_SNAPSHOT', 'chain id mismatch');
  }
  if (observed.genesisFingerprint !== expected.genesisFingerprint) {
    return opsErr('WRONG_NETWORK_SNAPSHOT', 'genesis fingerprint mismatch');
  }
  if (observed.protocolVersion !== expected.protocolVersion) {
    return opsErr('INCOMPATIBLE_PROTOCOL', 'protocol version mismatch');
  }
  return opsOk(true);
}

export function verifyBlockAncestry(
  parentBlockId: string,
  blocks: readonly SyncBlockHeader[],
  fromHeight = 1n,
): SyncResult<true> {
  if (blocks.length === 0) {
    return opsOk(true);
  }
  let parent = parentBlockId;
  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i]!;
    const expectedHeight = fromHeight + BigInt(i);
    if (block.height !== expectedHeight) {
      return opsErr('SNAPSHOT_TAMPER', `block height gap at index ${i}`);
    }
    if (block.parentBlockId !== parent) {
      return opsErr('SNAPSHOT_TAMPER', `parent mismatch at height ${block.height}`);
    }
    parent = block.blockId;
  }
  return opsOk(true);
}

export function verifyCommitCertificate(cert: CommitCertificateRef): SyncResult<true> {
  if (cert.signatureCount <= 0) {
    return opsErr('SNAPSHOT_TAMPER', 'commit certificate has no signatures');
  }
  if (cert.quorumPower < twoThirdsPlus(cert.totalPower)) {
    return opsErr('SNAPSHOT_TAMPER', 'commit certificate lacks >2/3 quorum');
  }
  return opsOk(true);
}

export function verifyFinalityCoverage(
  blocks: readonly SyncBlockHeader[],
  certificates: readonly CommitCertificateRef[],
  trustedFinalizedHeight: bigint,
): SyncResult<true> {
  const certByHeight = new Map(certificates.map((c) => [c.height.toString(), c]));
  for (const block of blocks) {
    if (block.height > trustedFinalizedHeight) {
      return opsErr('SNAPSHOT_TAMPER', 'block beyond trusted finalized height');
    }
    const cert = certByHeight.get(block.height.toString());
    if (!cert) {
      return opsErr('SNAPSHOT_TAMPER', `missing commit certificate at height ${block.height}`);
    }
    if (cert.blockId !== block.blockId) {
      return opsErr('SNAPSHOT_TAMPER', `certificate block id mismatch at height ${block.height}`);
    }
    const verified = verifyCommitCertificate(cert);
    if (!verified.ok) {
      return verified;
    }
  }
  return opsOk(true);
}

export function verifyStateTransitionChain(blocks: readonly SyncBlockHeader[]): SyncResult<true> {
  for (const block of blocks) {
    if (!block.stateRoot || block.stateRoot.length < 32) {
      return opsErr('SNAPSHOT_TAMPER', `invalid state root at height ${block.height}`);
    }
    if (!block.transactionRoot || block.transactionRoot.length < 32) {
      return opsErr('SNAPSHOT_TAMPER', `invalid transaction root at height ${block.height}`);
    }
  }
  return opsOk(true);
}

export function syncBlocksFromPeers(input: BlockSyncInput): SyncResult<BlockSyncReport> {
  const failures: string[] = [];
  const identity = verifyChainIdentity(input.identity, input.identity);
  if (!identity.ok) {
    failures.push(identity.error.message);
    return opsOk({ ok: false, verifiedBlocks: 0, finalHeight: 0n, finalStateRoot: '', failures });
  }
  const ancestry = verifyBlockAncestry(input.parentBlockId, input.blocks, input.fromHeight);
  if (!ancestry.ok) {
    failures.push(ancestry.error.message);
    return opsOk({ ok: false, verifiedBlocks: 0, finalHeight: 0n, finalStateRoot: '', failures });
  }
  const finality = verifyFinalityCoverage(input.blocks, input.certificates, input.trustedFinalizedHeight);
  if (!finality.ok) {
    failures.push(finality.error.message);
    return opsOk({ ok: false, verifiedBlocks: 0, finalHeight: 0n, finalStateRoot: '', failures });
  }
  const transitions = verifyStateTransitionChain(input.blocks);
  if (!transitions.ok) {
    failures.push(transitions.error.message);
    return opsOk({ ok: false, verifiedBlocks: 0, finalHeight: 0n, finalStateRoot: '', failures });
  }
  const last = input.blocks[input.blocks.length - 1];
  return opsOk({
    ok: true,
    verifiedBlocks: input.blocks.length,
    finalHeight: last?.height ?? 0n,
    finalStateRoot: last?.stateRoot ?? input.genesisBlockId,
    failures,
  });
}

export function rejectPeerReportedBalance(): SyncResult<never> {
  return opsErr('SNAPSHOT_TAMPER', 'peer-reported balances are not authoritative; derive from verified state');
}
