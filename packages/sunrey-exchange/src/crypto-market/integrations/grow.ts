/**
 * Grow integration — crypto market trend evidence.
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { CryptoMarketReferenceService } from '../service.ts';

export type GrowCryptoEvidence = {
  readonly schema: 'sunrey.grow.crypto-evidence.v1';
  readonly generatedAt: UtcInstant;
  readonly researchOnly: true;
  readonly trends: readonly {
    readonly assetId: string;
    readonly symbol: string;
    readonly change24hBps: string | null;
    readonly change7dBps: string | null;
    readonly providerId: string;
  }[];
};

export async function buildGrowCryptoEvidence(
  service: CryptoMarketReferenceService,
  assetIds: readonly string[],
  nowUtc: UtcInstant,
): Promise<GrowCryptoEvidence> {
  const trends: GrowCryptoEvidence['trends'][number][] = [];
  for (const assetId of assetIds) {
    const result = await service.getQuote(assetId, nowUtc);
    if (!result.ok) continue;
    trends.push(
      Object.freeze({
        assetId,
        symbol: result.value.symbol,
        change24hBps: result.value.change24hBps?.toString() ?? null,
        change7dBps: result.value.change7dBps?.toString() ?? null,
        providerId: result.value.providerId,
      }),
    );
  }
  return Object.freeze({
    schema: 'sunrey.grow.crypto-evidence.v1',
    generatedAt: nowUtc,
    researchOnly: true,
    trends: Object.freeze(trends),
  });
}
