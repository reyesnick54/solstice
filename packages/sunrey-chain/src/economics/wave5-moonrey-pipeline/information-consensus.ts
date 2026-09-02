/**
 * Wave 5 — Information consensus receipt.
 *
 * Oracle mesh quorum is information authorization only. It cannot mint.
 */

import { createHash } from 'node:crypto';

import {
  INFORMATION_CONSENSUS_RECEIPT_SCHEMA,
  type InformationConsensusReceipt,
  type MoonReyPipelineRejection,
} from './types.ts';

export const INFORMATION_CONSENSUS_CANNOT_MINT = true as const;
export const SINGLE_ORACLE_IS_NOT_CONSENSUS = true as const;

export function consensusDigest(input: {
  readonly observationIds: readonly string[];
  readonly providerIds: readonly string[];
  readonly finalizedAtUtc: string;
}): string {
  return createHash('sha256')
    .update(
      [
        'information-consensus',
        [...input.observationIds].sort().join(','),
        [...input.providerIds].sort().join(','),
        input.finalizedAtUtc,
      ].join(':'),
    )
    .digest('hex');
}

export function buildInformationConsensusReceipt(input: {
  readonly receiptId: string;
  readonly observationIds: readonly string[];
  readonly providerIds: readonly string[];
  readonly finalizedAtUtc: string;
}): InformationConsensusReceipt | { readonly ok: false; readonly code: MoonReyPipelineRejection } {
  if (input.observationIds.length < 2) {
    return { ok: false, code: 'ORACLE_QUORUM_INSUFFICIENT' };
  }
  if (input.providerIds.length < 2) {
    return { ok: false, code: 'ORACLE_QUORUM_INSUFFICIENT' };
  }
  const uniqueProviders = new Set(input.providerIds);
  if (uniqueProviders.size < 2) {
    return { ok: false, code: 'ORACLE_QUORUM_INSUFFICIENT' };
  }
  return Object.freeze({
    schema: INFORMATION_CONSENSUS_RECEIPT_SCHEMA,
    receiptId: input.receiptId,
    consensusClass: 'ORACLE_MESH_QUORUM' as const,
    observationIds: Object.freeze([...input.observationIds]),
    providerIds: Object.freeze([...input.providerIds]),
    quorumAchieved: true as const,
    consensusDigest: consensusDigest(input),
    finalizedAtUtc: input.finalizedAtUtc,
    mintsNativeAsset: false as const,
  });
}

export function validateInformationConsensusReceipt(
  receipt: InformationConsensusReceipt,
): MoonReyPipelineRejection | null {
  if (receipt.schema !== INFORMATION_CONSENSUS_RECEIPT_SCHEMA) {
    return 'INFORMATION_CONSENSUS_INVALID';
  }
  if (!receipt.quorumAchieved || receipt.mintsNativeAsset) {
    return 'INFORMATION_CONSENSUS_INVALID';
  }
  if (receipt.observationIds.length < 2 || receipt.providerIds.length < 2) {
    return 'ORACLE_QUORUM_INSUFFICIENT';
  }
  const expected = consensusDigest({
    observationIds: receipt.observationIds,
    providerIds: receipt.providerIds,
    finalizedAtUtc: receipt.finalizedAtUtc,
  });
  if (receipt.consensusDigest !== expected) {
    return 'INFORMATION_CONSENSUS_INVALID';
  }
  return null;
}
