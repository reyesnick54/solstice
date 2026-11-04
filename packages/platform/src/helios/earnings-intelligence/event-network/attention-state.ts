/**
 * Earnings attention state — concurrent events and cross-sectional context.
 */

import type { UtcInstant } from '../../../../../domain/src/time.ts';
import type { EarningsAttentionState, EarningsEventRecord } from './types.ts';
import type { LiquidityBucket, MarketCapBucket } from './taxonomy.ts';

export type EarningsAttentionStateInput = {
  readonly asOfInstant: UtcInstant;
  readonly focalSecurityNodeId: string;
  readonly events: readonly EarningsEventRecord[];
  readonly windowHours?: number;
  readonly marketAbsoluteReturnBps?: number | null;
  readonly sectorAbsoluteReturnBps?: number | null;
  readonly analystCoverage?: number | null;
  readonly marketCapBucket?: MarketCapBucket;
  readonly liquidityBucket?: LiquidityBucket;
  readonly newsIntensity?: number | null;
  readonly preEventVolumeAnomaly?: number | null;
};

const DEFAULT_WINDOW_HOURS = 24;

export function computeEarningsAttentionState(input: EarningsAttentionStateInput): EarningsAttentionState {
  const windowMs = (input.windowHours ?? DEFAULT_WINDOW_HOURS) * 60 * 60 * 1000;
  const windowStart = new Date(input.asOfInstant).getTime() - windowMs;
  const asOfMs = new Date(input.asOfInstant).getTime();

  const concurrent = input.events.filter((event) => {
    const t = new Date(event.announcementInstant).getTime();
    return t >= windowStart && t <= asOfMs && event.knowableAt <= input.asOfInstant;
  });

  return Object.freeze({
    asOfInstant: input.asOfInstant,
    numberOfConcurrentEarningsEvents: concurrent.length,
    marketAbsoluteReturnBps: input.marketAbsoluteReturnBps ?? null,
    sectorAbsoluteReturnBps: input.sectorAbsoluteReturnBps ?? null,
    analystCoverage: input.analystCoverage ?? null,
    marketCapBucket: input.marketCapBucket ?? 'UNKNOWN',
    liquidityBucket: input.liquidityBucket ?? 'UNKNOWN',
    newsIntensity: input.newsIntensity ?? null,
    preEventVolumeAnomaly: input.preEventVolumeAnomaly ?? null,
    grantsExecutionAuthority: false,
  });
}
