import { createHash } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';

import type { ShadowCapitalPortfolioBook } from '../alpha04-shadow-capital/shadow-portfolio-book.ts';
import { DAILY_SNAPSHOT_SCHEMA } from './taxonomy.ts';
import type {
  ImmutableDailyPortfolioSnapshot,
  PaperFillRecord,
  PortfolioRuntimeState,
  StrategyTickRecord,
} from './types.ts';

function stableDigest(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export function sealDailyPortfolioSnapshot(input: {
  readonly tradingDay: string;
  readonly sealedAt: UtcInstant;
  readonly runtime: PortfolioRuntimeState;
  readonly book: ShadowCapitalPortfolioBook;
  readonly fills: readonly PaperFillRecord[];
  readonly ticks: readonly StrategyTickRecord[];
}): ImmutableDailyPortfolioSnapshot {
  const shadowSnapshot = input.book.snapshot();
  const digestMaterial = Object.freeze({
    tradingDay: input.tradingDay,
    sealedAt: input.sealedAt,
    navMinor: input.runtime.pnl.navMinor,
    sequence: input.runtime.sequence,
    positionCount: input.runtime.positionCount,
    fillCount: input.fills.length,
    tickCount: input.ticks.length,
    shadowSequence: shadowSnapshot.sequence,
  });
  return Object.freeze({
    schema: DAILY_SNAPSHOT_SCHEMA,
    tradingDay: input.tradingDay,
    sealedAt: input.sealedAt,
    digest: stableDigest(digestMaterial),
    runtime: input.runtime,
    shadowSnapshot,
    fills: Object.freeze([...input.fills]),
    ticks: Object.freeze([...input.ticks]),
  });
}
