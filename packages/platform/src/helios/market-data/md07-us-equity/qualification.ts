/**
 * HELIOS Market Data MD07 qualification gate.
 */

export const HELIOS_MD07_US_EQUITY_MARKET_STATE_QUALIFIED =
  'HELIOS_MD07_US_EQUITY_MARKET_STATE_QUALIFIED' as const;
export const HELIOS_MD07_US_EQUITY_MARKET_STATE_BLOCKED =
  'HELIOS_MD07_US_EQUITY_MARKET_STATE_BLOCKED' as const;

export type Md07UsEquityQualificationChecks = {
  readonly dualViewsTrackedSeparately: boolean;
  readonly noSilentSubstitution: boolean;
  readonly nbboSynthesized: boolean;
  readonly venueBboPresent: boolean;
  readonly oddLotSeparated: boolean;
  readonly roundLotPolicyVersioned: boolean;
  readonly roundLotPolicyHistoryPreserved: boolean;
  readonly crossedTopologyExplicit: boolean;
  readonly lockedTopologyExplicit: boolean;
  readonly divergenceMeasured: boolean;
  readonly depthSupported: boolean;
  readonly auctionImbalanceSupported: boolean;
  readonly tradingStatusSupported: boolean;
  readonly haltRepresented: boolean;
  readonly shortSaleStateSupported: boolean;
  readonly tradePrintsSupported: boolean;
};

export type Md07UsEquityQualificationResult = {
  readonly marker:
    | typeof HELIOS_MD07_US_EQUITY_MARKET_STATE_QUALIFIED
    | typeof HELIOS_MD07_US_EQUITY_MARKET_STATE_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateMd07UsEquityQualification(
  checks: Md07UsEquityQualificationChecks,
): Md07UsEquityQualificationResult {
  const blockers: string[] = [];
  const entries: [keyof Md07UsEquityQualificationChecks, string][] = [
    ['dualViewsTrackedSeparately', 'direct and consolidated views not tracked separately'],
    ['noSilentSubstitution', 'feed views may be silently substituted'],
    ['nbboSynthesized', 'NBBO not synthesized from venue BBOs'],
    ['venueBboPresent', 'venue BBO missing'],
    ['oddLotSeparated', 'odd-lot bests not separated from round-lot BBO/NBBO'],
    ['roundLotPolicyVersioned', 'round-lot policy not versioned'],
    ['roundLotPolicyHistoryPreserved', 'round-lot policy history not preserved'],
    ['crossedTopologyExplicit', 'crossed market topology not explicit'],
    ['lockedTopologyExplicit', 'locked market topology not explicit'],
    ['divergenceMeasured', 'view divergence not measured'],
    ['depthSupported', 'depth snapshot not supported'],
    ['auctionImbalanceSupported', 'auction imbalance not supported'],
    ['tradingStatusSupported', 'trading status not supported'],
    ['haltRepresented', 'halt state not represented'],
    ['shortSaleStateSupported', 'short-sale/reference state not supported'],
    ['tradePrintsSupported', 'trade prints not supported'],
  ];
  for (const [key, message] of entries) {
    if (!checks[key]) {
      blockers.push(message);
    }
  }
  if (blockers.length > 0) {
    return Object.freeze({
      marker: HELIOS_MD07_US_EQUITY_MARKET_STATE_BLOCKED,
      qualified: false,
      blockers: Object.freeze(blockers),
    });
  }
  return Object.freeze({
    marker: HELIOS_MD07_US_EQUITY_MARKET_STATE_QUALIFIED,
    qualified: true,
    blockers: Object.freeze([]),
  });
}
