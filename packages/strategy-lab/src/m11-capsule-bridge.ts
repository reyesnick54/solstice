import type { UtcInstant } from '@solstice/domain';
import { asModelId, asModelVersion } from '@solstice/model-registry';
import { asRiskBudgetId } from '@solstice/risk';
import type { StrategyExpr } from './dsl.ts';
import { EXPLICIT_COSTS } from './fixtures.ts';
import { asStrategyId, asStrategyVersion } from './ids.ts';
import { freezeSpecification } from './specification.ts';
import { freezePromotionCapsule } from './promotion-capsule.ts';
import type { StrategyPromotionRecord } from './promotion-store.ts';
import {
  GOLD_ETF_GLD_ID,
  HELIOS_M11_INSTRUMENT_UNIVERSE,
  WTI_OIL_ETF_PROXY_ID,
} from './multi-asset/constants.ts';
import {
  HELIOS_M11_CAPSULE_ID,
  HELIOS_M11_RULE_ID,
  HELIOS_M11_RULE_VERSION,
  HELIOS_MULTI_ASSET_M11_COMMODITY_TREND_QUALIFIED,
} from './commodity-trend/constants.ts';

export const HELIOS_M11_STRATEGY_CAPSULE_ID = 'str_helios_m11_commodity_trend_following_v1' as const;
export const HELIOS_M11_STRATEGY_CAPSULE_VERSION = 'v1' as const;

export type M11CapsuleQualificationObservation = {
  readonly capsuleId: string;
  readonly strategyId: typeof HELIOS_M11_STRATEGY_CAPSULE_ID;
  readonly version: typeof HELIOS_M11_STRATEGY_CAPSULE_VERSION;
  readonly fingerprint: string;
  readonly promotionState: StrategyPromotionRecord['promotionState'] | 'UNREGISTERED';
  readonly paperEligible: boolean;
  readonly liveEligible: false;
  readonly liveCommodityExecution: false;
  readonly liveFuturesExecution: false;
  readonly qualificationMarker: typeof HELIOS_MULTI_ASSET_M11_COMMODITY_TREND_QUALIFIED;
  readonly policyVersion: string | null;
  readonly policyHash: string | null;
  readonly observedAt: UtcInstant;
};

export function observeM11CapsuleQualification(input: {
  readonly promotion?: StrategyPromotionRecord | null;
  readonly fingerprint?: string | null;
  readonly observedAt: UtcInstant;
}): M11CapsuleQualificationObservation {
  const promotion = input.promotion;
  return Object.freeze({
    capsuleId: HELIOS_M11_CAPSULE_ID,
    strategyId: HELIOS_M11_STRATEGY_CAPSULE_ID,
    version: HELIOS_M11_STRATEGY_CAPSULE_VERSION,
    fingerprint: input.fingerprint ?? 'unregistered',
    promotionState: promotion?.promotionState ?? 'UNREGISTERED',
    paperEligible:
      promotion?.promotionState === 'PAPER_ELIGIBLE' || promotion?.promotionState === 'PAPER_ACTIVE',
    liveEligible: false,
    liveCommodityExecution: false,
    liveFuturesExecution: false,
    qualificationMarker: HELIOS_MULTI_ASSET_M11_COMMODITY_TREND_QUALIFIED,
    policyVersion: promotion?.policyVersion ?? null,
    policyHash: promotion?.policyHash ?? null,
    observedAt: input.observedAt,
  });
}

export function buildM11StrategySpecification(now: UtcInstant) {
  const allocation: StrategyExpr = {
    op: 'ALLOCATION',
    weightsBps: Object.freeze({
      [GOLD_ETF_GLD_ID]: 5_000,
      [WTI_OIL_ETF_PROXY_ID]: 5_000,
      CASH: 0,
    }),
  };
  const entry: StrategyExpr = {
    op: 'AND',
    clauses: Object.freeze([
      {
        op: 'COMPARE',
        left: { kind: 'CLOSE', instrumentId: GOLD_ETF_GLD_ID },
        comparator: 'GT',
        right: { kind: 'THRESHOLD', minorUnits: 2_400_00n },
      },
      {
        op: 'COMPARE',
        left: { kind: 'CLOSE', instrumentId: WTI_OIL_ETF_PROXY_ID },
        comparator: 'GT',
        right: { kind: 'THRESHOLD', minorUnits: 70_00n },
      },
    ]),
  };
  const exit: StrategyExpr = {
    op: 'OR',
    clauses: Object.freeze([
      {
        op: 'RISK_CONDITION',
        kind: 'DRAWDOWN_ABOVE_BPS',
        bps: 500,
      },
      {
        op: 'RISK_CONDITION',
        kind: 'CONCENTRATION_ABOVE_BPS',
        bps: 2_000,
      },
    ]),
  };
  const signal = { modelId: asModelId('mdl_investment_pretrade'), version: asModelVersion('risk-model-v1') };
  const frozen = freezeSpecification({
    strategyId: asStrategyId(HELIOS_M11_STRATEGY_CAPSULE_ID),
    version: asStrategyVersion(HELIOS_M11_STRATEGY_CAPSULE_VERSION),
    instrumentUniverse: Object.freeze([...HELIOS_M11_INSTRUMENT_UNIVERSE]),
    eligibilityFilters: Object.freeze([{ requireMembership: true }]),
    approvedSignalRefs: Object.freeze([signal]),
    rebalanceCadence: 'DAILY',
    targetAllocation: allocation,
    entryConditions: entry,
    exitConditions: exit,
    cashAllocationBps: 0,
    riskBudgetId: asRiskBudgetId('rbdg_default_simulation'),
    mandateCompatibility: Object.freeze(['GROW', 'RESEARCH']),
    transactionCosts: EXPLICIT_COSTS,
    requiredData: Object.freeze([
      'ohlcv_1h',
      'ohlcv_4h',
      'moving_averages',
      'rate_of_change',
      'realized_volatility',
      'breakout_state',
      'market_state',
      'futures_roll_state',
    ]),
    requiredModels: Object.freeze([signal]),
    createdAt: now,
  });
  if (!frozen.ok) {
    throw new Error(frozen.error.message);
  }
  return frozen.value;
}

export function buildM11ReferenceCapsule(input: {
  readonly subjectId: string;
  readonly frozenAt: UtcInstant;
}) {
  return freezePromotionCapsule({
    specification: buildM11StrategySpecification(input.frozenAt),
    plan: null,
    evidenceRefs: Object.freeze([
      {
        evidenceKind: 'EXTERNAL' as const,
        refId: 'helios_m11_commodity_trend_following',
        hash: `${HELIOS_M11_RULE_ID}_${HELIOS_M11_RULE_VERSION}`,
      },
    ]),
    subjectId: input.subjectId,
    frozenAt: input.frozenAt,
  });
}
