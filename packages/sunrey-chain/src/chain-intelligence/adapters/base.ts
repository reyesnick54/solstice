/**
 * Shared builders and fixture loading for chain intelligence adapters.
 */

import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { asUtcInstant, type UtcInstant } from '../../../../domain/src/time.ts';
import type { AuthorityClass } from '../../../../provider-sdk/src/types.ts';
import { finalityNoteFor, minConfirmationsForLikelyFinal, networkLabel } from '../identity.ts';
import type {
  BlockConfirmationStatus,
  ChainObservationFreshness,
  ChainObservationProvenance,
  ExternalBlockchainId,
  FeeEstimateTier,
  MempoolObservation,
  NetworkMetrics,
  NetworkStatus,
  NormalizedBitcoinBlock,
  NormalizedFeeEstimate,
  NormalizedTransaction,
} from '../types.ts';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

export type AdapterScenario = 'normal' | 'stale' | 'timeout' | 'rate_limited' | 'disagreeing' | 'unavailable';

export function loadChainFixture(fileName: string): unknown {
  const text = readFileSync(join(FIXTURES_DIR, fileName), 'utf8');
  return JSON.parse(text) as unknown;
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function buildFreshness(nowUtc: UtcInstant, ageMs: bigint): ChainObservationFreshness {
  const age = Number(ageMs);
  let status: ChainObservationFreshness['status'] = 'fresh';
  if (age > 300_000) status = 'expired';
  else if (age > 120_000) status = 'stale';
  else if (age > 30_000) status = 'aging';
  return Object.freeze({ status, ageMs, assessedAt: nowUtc });
}

export function buildProvenance(
  providerId: string,
  authorityClass: AuthorityClass,
  capability: string,
  rawPayload: string,
): ChainObservationProvenance {
  return Object.freeze({
    providerId,
    authorityClass,
    sourceUrl: null,
    rawPayloadHash: sha256Hex(rawPayload),
    observationId: randomUUID(),
    capability,
  });
}

export function confirmationStatusFor(confirmations: number, chainId: ExternalBlockchainId): BlockConfirmationStatus {
  if (confirmations <= 0) return 'UNCONFIRMED';
  if (confirmations < minConfirmationsForLikelyFinal(chainId)) return 'PROBABILISTIC';
  if (confirmations < minConfirmationsForLikelyFinal(chainId) * 2) return 'LIKELY_FINAL';
  return 'FINAL';
}

export function normalizeMempoolSpaceBlock(
  raw: Record<string, unknown>,
  chainId: ExternalBlockchainId,
  providerId: string,
  nowUtc: UtcInstant,
): NormalizedBitcoinBlock {
  const height = Number(raw.height);
  const hash = String(raw.id ?? raw.hash);
  const confirmations = Number(raw.confirmations ?? 1);
  return Object.freeze({
    height,
    hash,
    previousHash: String(raw.previousblockhash ?? ''),
    timestamp: asUtcInstant(new Date(Number(raw.timestamp) * 1000).toISOString()),
    transactionCount: Number(raw.tx_count ?? 0),
    sizeBytes: Number(raw.size ?? 0),
    weight: Number(raw.weight ?? 0),
    difficulty: String(raw.difficulty ?? '0'),
    feeTotalSat: raw.fee_total != null ? BigInt(String(raw.fee_total)) : null,
    confirmationStatus: confirmationStatusFor(confirmations, chainId),
    observedAt: nowUtc,
  });
}

export function normalizeMempoolFees(
  raw: Record<string, unknown>,
  chainId: ExternalBlockchainId,
  providerId: string,
  nowUtc: UtcInstant,
): NormalizedFeeEstimate {
  const tiers: FeeEstimateTier[] = [
    Object.freeze({ label: 'minimum', rate: BigInt(Number(raw.minimumFee ?? 1)), unit: 'sat/vB' }),
    Object.freeze({ label: 'economy', rate: BigInt(Number(raw.economyFee ?? 2)), unit: 'sat/vB' }),
    Object.freeze({ label: 'normal', rate: BigInt(Number(raw.hourFee ?? 5)), unit: 'sat/vB' }),
    Object.freeze({ label: 'priority', rate: BigInt(Number(raw.fastestFee ?? 12)), unit: 'sat/vB' }),
  ];
  return Object.freeze({
    chainId,
    tiers: Object.freeze(tiers),
    timestamp: nowUtc,
    providerId,
    freshness: buildFreshness(nowUtc, 0n),
  });
}

export function normalizeMempoolObservation(
  raw: Record<string, unknown>,
  chainId: ExternalBlockchainId,
  providerId: string,
  nowUtc: UtcInstant,
  authorityClass: AuthorityClass,
): MempoolObservation {
  const fees = normalizeMempoolFees(raw, chainId, providerId, nowUtc);
  const count = Number(raw.count ?? 0);
  const congestion: MempoolObservation['congestionLevel'] =
    count > 80_000 ? 'severe' : count > 50_000 ? 'high' : count > 20_000 ? 'moderate' : count > 0 ? 'low' : 'unknown';
  return Object.freeze({
    schema: 'sunrey.mempool-observation.v1',
    chainId,
    pendingTransactionCount: count,
    mempoolSizeBytes: BigInt(Number(raw.vsize ?? 0)),
    feeDistribution: Object.freeze({
      '1sat/vB': Number(raw.minimumFee ?? 1),
      '5sat/vB': Number(raw.hourFee ?? 5),
      '12sat/vB': Number(raw.fastestFee ?? 12),
    }),
    recommendedFees: fees.tiers,
    congestionLevel: congestion,
    timestamp: nowUtc,
    retrievedAt: nowUtc,
    providerId,
    freshness: buildFreshness(nowUtc, 0n),
    provenance: buildProvenance(providerId, authorityClass, 'mempool', JSON.stringify(raw)),
  });
}

export function normalizeBitcoinTransaction(
  raw: Record<string, unknown>,
  chainId: ExternalBlockchainId,
  providerId: string,
  nowUtc: UtcInstant,
): NormalizedTransaction {
  const confirmations = Number(raw.confirmations ?? raw.block_index != null ? 1 : 0);
  const blockHeight = raw.block_height != null ? Number(raw.block_height) : null;
  return Object.freeze({
    txHash: String(raw.hash),
    blockHeight,
    blockHash: raw.block_hash != null ? String(raw.block_hash) : null,
    confirmationCount: confirmations,
    status: confirmationStatusFor(confirmations, chainId),
    feeSat: raw.fee != null ? BigInt(String(raw.fee)) : null,
    feeUnit: raw.fee != null ? 'sat' : null,
    sizeBytes: Number(raw.size ?? 0),
    timestamp: raw.time != null ? asUtcInstant(new Date(Number(raw.time) * 1000).toISOString()) : null,
    inputsSummary: `${Array.isArray(raw.inputs) ? raw.inputs.length : 0} inputs`,
    outputsSummary: `${Array.isArray(raw.outputs) ? raw.outputs.length : 0} outputs`,
    observedAt: nowUtc,
  });
}

export function buildNetworkStatus(
  chainId: ExternalBlockchainId,
  providerId: string,
  block: NormalizedBitcoinBlock | null,
  mempool: MempoolObservation | null,
  nowUtc: UtcInstant,
): NetworkStatus {
  return Object.freeze({
    chainId,
    healthy: block != null,
    latestBlockHeight: block?.height ?? null,
    latestBlockHash: block?.hash ?? null,
    mempoolCongestion: mempool?.congestionLevel ?? 'unknown',
    nodeReachable: block != null,
    timestamp: nowUtc,
    providerId,
  });
}

export function buildNetworkMetrics(
  chainId: ExternalBlockchainId,
  providerId: string,
  raw: Record<string, unknown>,
  nowUtc: UtcInstant,
): NetworkMetrics {
  return Object.freeze({
    chainId,
    hashrate: raw.hashrate != null ? String(raw.hashrate) : null,
    hashrateUnit: raw.hashrate != null ? 'EH/s' : null,
    difficulty: raw.difficulty != null ? String(raw.difficulty) : null,
    blockIntervalSeconds: raw.block_interval != null ? Number(raw.block_interval) : 600,
    transactionThroughputTps: raw.tps != null ? Number(raw.tps) : null,
    activeAddresses: raw.active_addresses != null ? Number(raw.active_addresses) : null,
    circulatingSupply: raw.circulating_supply != null ? String(raw.circulating_supply) : null,
    supplyUnit: raw.circulating_supply != null ? 'BTC' : null,
    timestamp: nowUtc,
    providerId,
    freshness: buildFreshness(nowUtc, 0n),
  });
}

export function networkName(chainId: ExternalBlockchainId): string {
  return networkLabel(chainId);
}

export function finalityNote(chainId: ExternalBlockchainId): string {
  return finalityNoteFor(chainId);
}

export function fail<T>(
  code: string,
  message: string,
  providerId: string,
): { ok: false; code: string; message: string; providerId: string } {
  return { ok: false, code, message, providerId };
}

export function ok<T>(
  value: T,
  providerId: string,
  fromCache = false,
): { ok: true; value: T; fromCache: boolean; fallbackProviderId: string | null } {
  return { ok: true, value, fromCache, fallbackProviderId: null };
}
