/**
 * Canonical read-only external chain RPC provider contract.
 * No signing, deployment, or transaction submission authority.
 */

import type {
  ExternalBalanceObservation,
  ExternalBlockSummary,
  ExternalFeeEstimate,
  ExternalNetworkStatusObservation,
  ExternalTokenIdentity,
  ExternalTransactionSummary,
  ProviderHealthSnapshot,
  ProviderObservationEnvelope,
} from './types.ts';
import { assertReadOnlyRpcOperation } from './types.ts';

export type ReadOnlyContractCall = {
  readonly networkId: string;
  readonly contractAddress: string;
  readonly data: string;
  readonly blockTag?: string | number;
};

export type ExternalChainRpcProvider = {
  readonly providerId: string;
  readonly networkId: string;
  readonly expectedChainId: string | null;

  getChainId(): ProviderObservationEnvelope<string>;
  getLatestBlock(): ProviderObservationEnvelope<ExternalBlockSummary>;
  getBlock(blockNumber: number): ProviderObservationEnvelope<ExternalBlockSummary>;
  getTransaction(hash: string): ProviderObservationEnvelope<ExternalTransactionSummary>;
  getBalance(address: string): ProviderObservationEnvelope<ExternalBalanceObservation>;
  getTokenMetadata(contractAddress: string): ProviderObservationEnvelope<ExternalTokenIdentity>;
  callReadOnlyContract(call: ReadOnlyContractCall): ProviderObservationEnvelope<string>;
  getNetworkStatus(): ProviderObservationEnvelope<ExternalNetworkStatusObservation>;
  getFeeEstimate(): ProviderObservationEnvelope<ExternalFeeEstimate>;
  health(): ProviderHealthSnapshot;
};

export function guardRpcMethod(method: string): void {
  assertReadOnlyRpcOperation(method);
}

function normalizeChainId(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (/^0x[0-9a-f]+$/.test(trimmed)) {
    return BigInt(trimmed).toString();
  }
  return trimmed;
}

export function validateChainIdResponse(
  providerId: string,
  expectedChainId: string | null,
  observedChainId: string,
): void {
  if (!expectedChainId) return;
  if (normalizeChainId(expectedChainId) !== normalizeChainId(observedChainId)) {
    throw new Error(`chain_id_mismatch:${providerId}:expected=${expectedChainId}:observed=${observedChainId}`);
  }
}
