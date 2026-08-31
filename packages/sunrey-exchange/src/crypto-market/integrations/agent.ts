/**
 * Financial Agent integration — crypto observations as research evidence only.
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { CryptoMarketReferenceService } from '../service.ts';

export type AgentCryptoEvidence = {
  readonly schema: 'sunrey.agent.crypto-evidence.v1';
  readonly generatedAt: UtcInstant;
  readonly readOnly: true;
  readonly tradeAuthorized: false;
  readonly executionAuthority: false;
  readonly items: readonly {
    readonly assetId: string;
    readonly symbol: string;
    readonly priceMinorUnits: string;
    readonly quoteCurrency: string;
    readonly label: 'REFERENCE_NOT_EXECUTION';
    readonly providerId: string;
    readonly freshness: string;
    readonly evidenceRef: string;
  }[];
};

export async function buildAgentCryptoEvidence(
  service: CryptoMarketReferenceService,
  assetIds: readonly string[],
  nowUtc: UtcInstant,
): Promise<AgentCryptoEvidence> {
  const items: AgentCryptoEvidence['items'][number][] = [];
  for (const assetId of assetIds) {
    const result = await service.getQuote(assetId, nowUtc);
    if (!result.ok) continue;
    items.push(
      Object.freeze({
        assetId,
        symbol: result.value.symbol,
        priceMinorUnits: result.value.priceMinorUnits.toString(),
        quoteCurrency: result.value.quoteCurrency,
        label: 'REFERENCE_NOT_EXECUTION' as const,
        providerId: result.value.providerId,
        freshness: result.value.freshness.status,
        evidenceRef: result.value.observationId,
      }),
    );
  }
  return Object.freeze({
    schema: 'sunrey.agent.crypto-evidence.v1',
    generatedAt: nowUtc,
    readOnly: true,
    tradeAuthorized: false,
    executionAuthority: false,
    items: Object.freeze(items),
  });
}
