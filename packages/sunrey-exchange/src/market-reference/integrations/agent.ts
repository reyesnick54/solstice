import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { MarketReferenceService } from '../service.ts';

export type AgentMarketEvidence = {
  readonly schema: 'sunrey.agent.market-evidence.v1';
  readonly generatedAt: UtcInstant;
  readonly readOnly: true;
  readonly tradeAuthorized: false;
  readonly items: readonly {
    readonly assetId: string;
    readonly symbol: string;
    readonly priceMinorUnits: string;
    readonly currency: string;
    readonly label: 'REFERENCE_NOT_EXECUTION';
    readonly providerId: string;
  }[];
};

export async function buildAgentMarketEvidence(
  service: MarketReferenceService,
  assetIds: readonly string[],
  nowUtc: UtcInstant,
): Promise<AgentMarketEvidence> {
  const items: AgentMarketEvidence['items'][number][] = [];
  for (const assetId of assetIds) {
    const result = await service.getQuote(assetId, nowUtc);
    if (!result.ok) {
      continue;
    }
    items.push(
      Object.freeze({
        assetId,
        symbol: result.value.symbol,
        priceMinorUnits: result.value.priceMinorUnits.toString(),
        currency: result.value.currency,
        label: 'REFERENCE_NOT_EXECUTION' as const,
        providerId: result.value.providerId,
      }),
    );
  }
  return Object.freeze({
    schema: 'sunrey.agent.market-evidence.v1',
    generatedAt: nowUtc,
    readOnly: true,
    tradeAuthorized: false,
    items: Object.freeze(items),
  });
}
