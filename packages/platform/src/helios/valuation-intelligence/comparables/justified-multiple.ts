import { median } from './numeric.ts';
import type { ComparableMultipleKind } from './taxonomy.ts';
import type { JustifiedMultipleState, PeerCandidate } from './types.ts';

export function buildJustifiedMultipleState(
  kind: ComparableMultipleKind,
  target: PeerCandidate,
  peerMultiples: readonly number[],
): JustifiedMultipleState {
  const rawPeerMedian = median(peerMultiples);

  const growth = target.fundamentals.revenueGrowth ?? 0;
  const margin = target.fundamentals.operatingMargin ?? target.fundamentals.ebitdaMargin ?? 0;
  const roic = target.fundamentals.roic ?? 0;
  const beta = target.market.beta ?? 1;
  const capitalIntensity = target.fundamentals.capitalIntensity ?? 0;

  const growthAdjustment = (growth - 0.1) * 2;
  const marginAdjustment = (margin - 0.15) * 3;
  const roicAdjustment = (roic - 0.12) * 2.5;
  const riskAdjustment = (1 - beta) * 0.5;
  const costOfCapitalAdjustment = (beta - 1) * -0.3;
  const capitalIntensityAdjustment = (0.5 - capitalIntensity) * 0.4;

  const justifiedMultiple = Math.max(
    0.01,
    rawPeerMedian +
      growthAdjustment +
      marginAdjustment +
      roicAdjustment +
      riskAdjustment +
      costOfCapitalAdjustment +
      capitalIntensityAdjustment,
  );

  const economicsGap = rawPeerMedian - justifiedMultiple;
  const economicInterpretation =
    economicsGap > 0.15
      ? 'CHEAP_WEAKER_ECONOMICS'
      : economicsGap < -0.15
        ? 'RICH_RELATIVE_TO_COMPARABLE_ECONOMICS'
        : economicsGap < -0.05
          ? 'CHEAP_RELATIVE_TO_COMPARABLE_ECONOMICS'
          : 'NEUTRAL';

  return Object.freeze({
    multipleKind: kind,
    rawPeerMedian,
    growthAdjustment,
    marginAdjustment,
    roicAdjustment,
    riskAdjustment,
    costOfCapitalAdjustment,
    capitalIntensityAdjustment,
    justifiedMultiple,
    economicInterpretation,
  });
}

export function adjustObservationMultiple(
  rawMultiple: number,
  justified: JustifiedMultipleState,
): number {
  if (justified.rawPeerMedian <= 0) return rawMultiple;
  const scale = justified.justifiedMultiple / justified.rawPeerMedian;
  return rawMultiple * scale;
}
