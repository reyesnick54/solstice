import type { UtcInstant } from '../../domain/src/time.ts';
import { asModelId, asModelVersion } from '../../model-registry/src/ids.ts';
import { asRiskBudgetId } from '../../risk/src/ids.ts';
import type { StrategyExpr } from './dsl.ts';
import { EXPLICIT_COSTS } from './fixtures.ts';
import { asStrategyId, asStrategyVersion } from './ids.ts';
import { freezeSpecification } from './specification.ts';
import { freezePromotionCapsule } from './promotion-capsule.ts';
import type { StrategyPromotionRecord } from './promotion-store.ts';
import {
  CRYPTO_BTC_USD_ASSET_ID,
  CRYPTO_ETH_USD_ASSET_ID,
  HELIOS_CRYPTO_USD_INSTRUMENTS,
} from './multi-asset/constants.ts';
import {
  HELIOS_M10_CAPSULE_ID,
  HELIOS_M10_RULE_ID,
  HELIOS_M10_RULE_VERSION,
  HELIOS_MULTI_ASSET_M10_CRYPTO_MOMENTUM_BREAKOUT_QUALIFIED,
} from './crypto-momentum/constants.ts';

export const HELIOS_M10_STRATEGY_CAPSULE_ID = 'str_helios_m10_crypto_momentum_breakout_v1' as const;
export const HELIOS_M10_STRATEGY_CAPSULE_VERSION = 'v1' as const;

export type M10CapsuleQualificationObservation = {
  readonly capsuleId: string;
  readonly strategyId: typeof HELIOS_M10_STRATEGY_CAPSULE_ID;
  readonly version: typeof HELIOS_M10_STRATEGY_CAPSULE_VERSION;
  readonly fingerprint: string;
  readonly promotionState: StrategyPromotionRecord['promotionState'] | 'UNREGISTERED';
  readonly paperEligible: boolean;
  readonly liveEligible: false;
  readonly liveCryptoExecution: false;
  readonly qualificationMarker: typeof HELIOS_MULTI_ASSET_M10_CRYPTO_MOMENTUM_BREAKOUT_QUALIFIED;
  readonly policyVersion: string | null;
  readonly policyHash: string | null;
  readonly observedAt: UtcInstant;
};

export function observeM10CapsuleQualification(input: {
  readonly promotion?: StrategyPromotionRecord | null;
  readonly fingerprint?: string | null;
  readonly observedAt: UtcInstant;
}): M10CapsuleQualificationObservation {
  const promotion = input.promotion;
  return Object.freeze({
    capsuleId: HELIOS_M10_CAPSULE_ID,
    strategyId: HELIOS_M10_STRATEGY_CAPSULE_ID,
    version: HELIOS_M10_STRATEGY_CAPSULE_VERSION,
    fingerprint: input.fingerprint ?? 'unregistered',
    promotionState: promotion?.promotionState ?? 'UNREGISTERED',
    paperEligible:
      promotion?.promotionState === 'PAPER_ELIGIBLE' || promotion?.promotionState === 'PAPER_ACTIVE',
    liveEligible: false,
    liveCryptoExecution: false,
    qualificationMarker: HELIOS_MULTI_ASSET_M10_CRYPTO_MOMENTUM_BREAKOUT_QUALIFIED,
    policyVersion: promotion?.policyVersion ?? null,
    policyHash: promotion?.policyHash ?? null,
    observedAt: input.observedAt,
  });
}

export function buildM10StrategySpecification(now: UtcInstant) {
  const allocation: StrategyExpr = {
    op: 'ALLOCATION',
    weightsBps: Object.freeze({
      [CRYPTO_BTC_USD_ASSET_ID]: 5_000,
      [CRYPTO_ETH_USD_ASSET_ID]: 5_000,
      CASH: 0,
    }),
  };
  const entry: StrategyExpr = {
    op: 'AND',
    clauses: Object.freeze([
      {
        op: 'COMPARE',
        left: { kind: 'CLOSE', instrumentId: CRYPTO_BTC_USD_ASSET_ID },
        comparator: 'GT',
        right: { kind: 'THRESHOLD', minorUnits: 65_000_00n },
      },
      {
        op: 'COMPARE',
        left: { kind: 'CLOSE', instrumentId: CRYPTO_ETH_USD_ASSET_ID },
        comparator: 'GT',
        right: { kind: 'THRESHOLD', minorUnits: 3_400_00n },
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
        bps: 1_500,
      },
    ]),
  };
  const signal = { modelId: asModelId('mdl_investment_pretrade'), version: asModelVersion('risk-model-v1') };
  const frozen = freezeSpecification({
    strategyId: asStrategyId(HELIOS_M10_STRATEGY_CAPSULE_ID),
    version: asStrategyVersion(HELIOS_M10_STRATEGY_CAPSULE_VERSION),
    instrumentUniverse: Object.freeze([...HELIOS_CRYPTO_USD_INSTRUMENTS]),
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
    requiredData: Object.freeze(['ohlcv_1h', 'relative_volume', 'rolling_range', 'market_state']),
    requiredModels: Object.freeze([signal]),
    createdAt: now,
  });
  if (!frozen.ok) {
    throw new Error(frozen.error.message);
  }
  return frozen.value;
}

export function buildM10ReferenceCapsule(input: {
  readonly subjectId: string;
  readonly frozenAt: UtcInstant;
}) {
  return freezePromotionCapsule({
    specification: buildM10StrategySpecification(input.frozenAt),
    plan: null,
    evidenceRefs: Object.freeze([
      {
        evidenceKind: 'EXTERNAL' as const,
        refId: 'helios_m10_crypto_momentum_breakout',
        hash: `${HELIOS_M10_RULE_ID}_${HELIOS_M10_RULE_VERSION}`,
      },
    ]),
    subjectId: input.subjectId,
    frozenAt: input.frozenAt,
  });
}
