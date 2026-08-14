import type {
  AdmissibleVerdict,
  RiskLimits,
  RiskOverridePath,
  RiskRefuse,
  RiskRequest,
  RiskVerdict,
} from '../../contracts/src/risk-types.ts';
import { KillSwitchBoard } from './kill-switch.ts';

export const DEFAULT_RISK_LIMITS: RiskLimits = Object.freeze({
  maxPositionMicros: 50_000_000n,
  maxGrossExposureMinorUnits: 5_000_000_00n,
  maxNetExposureMinorUnits: 3_000_000_00n,
  maxLeverageNumerator: 2n,
  maxLeverageDenominator: 1n,
  maxConcentrationNumerator: 1n,
  maxConcentrationDenominator: 2n,
  maxDailyLossMinorUnits: 50_000_00n,
  maxDrawdownMinorUnits: 100_000_00n,
  maxVolatilityMadBps: 800n,
  maxExpectedShortfallBps: 1_200n,
  maxStrategyGrossMinorUnits: 2_000_000_00n,
  maxCounterpartyMinorUnits: 1_000_000_00n,
  maxMarketImpactNumerator: 1n,
  maxMarketImpactDenominator: 10n,
});

/**
 * Deterministic Risk Engine. OUTRANKS every trading model and agent.
 * A REFUSE verdict is FINAL. There is no override method.
 */
export class RiskEngine {
  readonly killSwitches = new KillSwitchBoard();
  readonly #limits: RiskLimits;

  constructor(limits: RiskLimits = DEFAULT_RISK_LIMITS) {
    this.#limits = limits;
  }

  evaluate(request: RiskRequest): RiskVerdict {
    if (this.killSwitches.strategyHalted(request.strategyId)) {
      return refuse('STRATEGY_LIMIT', 'kill switch engaged; trading halted');
    }
    if (request.quantityMicros > this.#limits.maxPositionMicros) {
      return reduceOrRefuse(
        request,
        'MAX_POSITION',
        this.#limits.maxPositionMicros,
        'quantity exceeds max position',
      );
    }
    const nextGross = request.currentGrossMinorUnits + request.proposedNotional.minorUnits;
    if (nextGross > this.#limits.maxGrossExposureMinorUnits) {
      return refuse('MAX_GROSS_EXPOSURE', 'gross exposure would exceed limit');
    }
    const signed =
      request.side === 'BUY'
        ? request.proposedNotional.minorUnits
        : -request.proposedNotional.minorUnits;
    const nextNetAbs =
      request.currentNetMinorUnits + signed < 0n
        ? -(request.currentNetMinorUnits + signed)
        : request.currentNetMinorUnits + signed;
    if (nextNetAbs > this.#limits.maxNetExposureMinorUnits) {
      return refuse('MAX_NET_EXPOSURE', 'net exposure would exceed limit');
    }
    if (request.equityMinorUnits > 0n) {
      if (
        nextGross * this.#limits.maxLeverageDenominator >
        request.equityMinorUnits * this.#limits.maxLeverageNumerator
      ) {
        return refuse('LEVERAGE', 'leverage would exceed limit');
      }
    }
    const largest = max(request.largestPositionMinorUnits, request.proposedNotional.minorUnits);
    if (
      nextGross > 0n &&
      largest * this.#limits.maxConcentrationDenominator >
        nextGross * this.#limits.maxConcentrationNumerator
    ) {
      return refuse('CONCENTRATION', 'concentration would exceed limit');
    }
    if (!request.instrumentLiquid) {
      return refuse('LIQUIDITY', 'instrument is not on the liquid set');
    }
    if (request.dailyRealizedLossMinorUnits > this.#limits.maxDailyLossMinorUnits) {
      return refuse('DAILY_LOSS', 'daily realized loss exceeds limit');
    }
    const drawdown = request.peakEquityMinorUnits - request.troughEquityMinorUnits;
    if (drawdown > this.#limits.maxDrawdownMinorUnits) {
      return refuse('ROLLING_DRAWDOWN', 'rolling drawdown exceeds limit');
    }
    if (request.volatilityMadBps > this.#limits.maxVolatilityMadBps) {
      return refuse('VOLATILITY', 'volatility MAD exceeds limit');
    }
    if (request.expectedShortfallBps > this.#limits.maxExpectedShortfallBps) {
      return refuse('EXPECTED_SHORTFALL', 'expected shortfall exceeds limit');
    }
    if (
      request.strategyGrossMinorUnits + request.proposedNotional.minorUnits >
      this.#limits.maxStrategyGrossMinorUnits
    ) {
      return refuse('STRATEGY_LIMIT', 'strategy gross would exceed limit');
    }
    if (
      request.counterpartyNotionalMinorUnits + request.proposedNotional.minorUnits >
      this.#limits.maxCounterpartyMinorUnits
    ) {
      return refuse('COUNTERPARTY_LIMIT', 'counterparty notional would exceed limit');
    }
    if (request.averageDailyVolumeMicros > 0n) {
      if (
        request.quantityMicros * this.#limits.maxMarketImpactDenominator >
        request.averageDailyVolumeMicros * this.#limits.maxMarketImpactNumerator
      ) {
        return refuse('MARKET_IMPACT', 'order size exceeds market-impact constraint');
      }
    }
    return Object.freeze({ kind: 'ALLOW', final: false });
  }

  /**
   * The only admission gate. REFUSE cannot be passed to execution because
   * AdmissibleVerdict does not include RiskRefuse.
   */
  admit(verdict: RiskVerdict): AdmissibleVerdict | RiskRefuse {
    if (verdict.kind === 'REFUSE') {
      return verdict;
    }
    return verdict;
  }
}

function refuse(limit: RiskRefuse['limit'], reason: string): RiskRefuse {
  return Object.freeze({ kind: 'REFUSE', final: true, limit, reason });
}

function reduceOrRefuse(
  request: RiskRequest,
  limit: RiskRefuse['limit'],
  maxQty: bigint,
  reason: string,
): RiskVerdict {
  if (maxQty <= 0n) {
    return refuse(limit, reason);
  }
  return Object.freeze({
    kind: 'REDUCE',
    final: false,
    scaledQuantityMicros: maxQty,
    limit,
    reason,
  });
}

function max(a: bigint, b: bigint): bigint {
  return a > b ? a : b;
}

/**
 * Structural proof: there is no override path. The parameter type is
 * `never`. No model, agent, or meta-allocator can inhabit that type.
 */
export function overrideRiskRefusal(
  _refusal: RiskRefuse,
  _by: RiskOverridePath,
): never {
  throw new Error('RISK_REFUSAL_IS_FINAL: no model, agent, or allocator may reverse a Risk Engine refusal');
}

export type AssertRefusalUnoverridable = RiskRefuse extends AdmissibleVerdict
  ? 'OVERRIDE_POSSIBLE'
  : 'UNOVERRIDABLE';

export const RISK_REFUSAL_UNOVERRIDABLE: AssertRefusalUnoverridable = 'UNOVERRIDABLE';
