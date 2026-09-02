/**
 * Exchange read-only consumption of external chain intelligence.
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { ExternalChainIntelligenceService } from '../../../../sunrey-chain/src/chain-intelligence/service.ts';
import type { ExternalBlockchainId, MempoolObservation, NormalizedFeeEstimate } from '../../../../sunrey-chain/src/chain-intelligence/types.ts';

export type ExchangeChainContext = {
  readonly schema: 'sunrey.exchange.chain-context.v1';
  readonly readOnly: true;
  readonly mutatesSettlement: false;
  readonly chainId: ExternalBlockchainId;
  readonly generatedAt: UtcInstant;
  readonly confirmationContext: string | null;
  readonly feeEstimate: NormalizedFeeEstimate | null;
  readonly mempool: MempoolObservation | null;
  readonly networkCongestion: string | null;
};

export async function buildExchangeChainContext(
  service: ExternalChainIntelligenceService,
  chainId: ExternalBlockchainId,
  txHash: string | null,
  nowUtc: UtcInstant,
): Promise<ExchangeChainContext> {
  const proof = service.separationProof();
  const fees = await service.getFeeEstimate(chainId, nowUtc);
  const mempool = await service.getMempoolStatus(chainId, nowUtc);
  let confirmationContext: string | null = null;
  if (txHash) {
    const tx = await service.getTransaction(chainId, txHash, nowUtc);
    if (tx.ok) {
      confirmationContext = `${tx.value.confirmationCount} confirmations (${tx.value.status})`;
    }
  }
  return Object.freeze({
    schema: 'sunrey.exchange.chain-context.v1',
    readOnly: proof.externalObservationOnly,
    mutatesSettlement: false,
    chainId,
    generatedAt: nowUtc,
    confirmationContext,
    feeEstimate: fees.ok ? fees.value : null,
    mempool: mempool.ok ? mempool.value : null,
    networkCongestion: mempool.ok ? mempool.value.congestionLevel : null,
  });
}
