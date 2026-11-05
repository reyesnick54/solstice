import { createHash } from 'node:crypto';

import type { UtcInstant } from '../imports.ts';
import type { FrozenValuationEvidencePack, ValuationAssumptionChallengeState } from './types.ts';

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function factMinor(pack: FrozenValuationEvidencePack, labelIncludes: string): bigint | null {
  const row = pack.canonicalFinancialFacts.find((fact) =>
    fact.label.toUpperCase().includes(labelIncludes.toUpperCase()),
  );
  return row?.valueMinor ?? null;
}

export function buildValuationAssumptionChallengeState(input: {
  readonly entity: string;
  readonly instrumentId: string;
  readonly informationTime: UtcInstant;
  readonly pack: FrozenValuationEvidencePack;
  readonly marketPriceMinor: bigint | null;
}): ValuationAssumptionChallengeState {
  const freshCount = input.pack.evidence.filter((row) => row.freshnessOk).length;
  const entitledCount = input.pack.evidence.filter((row) => row.entitlementOk).length;
  const coverageRatio = clamp01(freshCount / input.pack.evidence.length);
  const entitlementRatio = clamp01(entitledCount / input.pack.evidence.length);

  const revenueMinor = factMinor(input.pack, 'REVENUE') ?? 1_000_000_000_000n;
  const ebitdaMinor = factMinor(input.pack, 'EBITDA') ?? revenueMinor / 10n;
  const netDebtMinor = factMinor(input.pack, 'NET_DEBT') ?? 0n;
  const sharesMinor = factMinor(input.pack, 'SHARES') ?? 100_000_000n;

  const market = input.marketPriceMinor ?? revenueMinor / sharesMinor / 5n;
  const basePerShare = market;
  const bullPerShare = (basePerShare * 125n) / 100n;
  const bearPerShare = (basePerShare * 78n) / 100n;

  const baseWeight = clamp01(0.5 + coverageRatio * 0.15);
  const bullWeight = clamp01((1 - baseWeight) * 0.55);
  const bearWeight = clamp01(1 - baseWeight - bullWeight);

  const stateId = `vas_${createHash('sha256')
    .update(`${input.entity}:${input.instrumentId}:${input.pack.contentHash}:${input.pack.factsHash}`)
    .digest('hex')
    .slice(0, 16)}`;

  const uncertaintyScore = clamp01(1 - (coverageRatio * 0.55 + entitlementRatio * 0.45));

  const impliedGrowthBps =
    coverageRatio >= 0.5 ? Math.round(600 + coverageRatio * 400 - Number(netDebtMinor % 100n)) : null;
  const impliedWaccBps =
    coverageRatio >= 0.5 ? Math.round(850 + (1 - entitlementRatio) * 250) : null;

  return Object.freeze({
    stateId,
    entityRef: input.entity,
    instrumentRef: input.instrumentId,
    informationTime: input.informationTime,
    intrinsicValueDistribution: Object.freeze([
      Object.freeze({ label: 'BEAR', perShareMinor: bearPerShare, probability: bearWeight }),
      Object.freeze({ label: 'BASE', perShareMinor: basePerShare, probability: baseWeight }),
      Object.freeze({ label: 'BULL', perShareMinor: bullPerShare, probability: bullWeight }),
    ]),
    marketPriceMinor: input.marketPriceMinor,
    impliedGrowthBps,
    impliedWaccBps,
    uncertaintyScore,
  });
}
