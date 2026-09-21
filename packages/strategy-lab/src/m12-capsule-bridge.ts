import type { UtcInstant } from '@solstice/domain';
import { asStrategyCapsuleVersion } from './evaluation/ids.ts';
import { freezeStrategyCapsule } from './evaluation/capsule.ts';
import { DEFAULT_CONSERVATIVE_LATENCY } from './evaluation/latency-model.ts';
import { EXPLICIT_COSTS, DEFAULT_PARAMETER_SET } from './fixtures.ts';
import { asStrategyId, asStrategyVersion } from './ids.ts';
import { freezeSpecification } from './specification.ts';
import { compileStrategy } from './compiler.ts';
import { asRiskBudgetId, asRiskModelId, asRiskModelVersion } from '@solstice/risk';
import { asModelId, asModelVersion } from '@solstice/model-registry';
import {
  HELIOS_M12_CAPSULE_ID,
  HELIOS_M12_FAMILY_ID,
  buildHeliosM12Material,
  buildHeliosM12StrategyCapsule,
} from './capsule/m12-relative-value.ts';
import { computeStrategyCapsuleMaterialHash } from './capsule/fingerprint.ts';
import {
  HELIOS_M12_RULE_ID,
  HELIOS_MULTI_ASSET_M12_RELATIVE_VALUE_STAT_ARB_QUALIFIED,
} from './relative-value/constants.ts';
import { M12_PAIR_UNIVERSE, M12_SPY_QQQ_PAIR_ID } from './relative-value/ids.ts';
import { M12_PARAMETERS_V1 } from './relative-value/parameters.ts';
import type { StrategyCapsuleRecord } from './capsule/types.ts';
import type { StrategyPromotionRecord } from './promotion-store.ts';

export const HELIOS_M12_STRATEGY_CAPSULE_ID = 'str_helios_m12_relative_value_stat_arb_v1' as const;
export const HELIOS_M12_STRATEGY_CAPSULE_VERSION = 'v1' as const;

export type M12CapsuleQualificationObservation = {
  readonly capsuleId: string;
  readonly strategyId: typeof HELIOS_M12_STRATEGY_CAPSULE_ID;
  readonly version: typeof HELIOS_M12_STRATEGY_CAPSULE_VERSION;
  readonly fingerprint: string;
  readonly materialHash: string;
  readonly parameterVersion: string;
  readonly promotionState: StrategyPromotionRecord['promotionState'] | 'UNREGISTERED';
  readonly paperEligible: boolean;
  readonly shadowEligible: boolean;
  readonly liveEligible: false;
  readonly qualificationMarker: typeof HELIOS_MULTI_ASSET_M12_RELATIVE_VALUE_STAT_ARB_QUALIFIED;
  readonly observedAt: UtcInstant;
};

export function observeM12CapsuleQualification(input: {
  readonly capsule?: StrategyCapsuleRecord | null;
  readonly promotion?: StrategyPromotionRecord | null;
  readonly observedAt: UtcInstant;
}): M12CapsuleQualificationObservation {
  const capsule = input.capsule;
  const promotion = input.promotion;
  return Object.freeze({
    capsuleId: capsule?.strategyCapsuleId ?? HELIOS_M12_CAPSULE_ID,
    strategyId: HELIOS_M12_STRATEGY_CAPSULE_ID,
    version: HELIOS_M12_STRATEGY_CAPSULE_VERSION,
    fingerprint: capsule?.materialHash ?? 'unregistered',
    materialHash: capsule?.materialHash ?? 'unregistered',
    parameterVersion: M12_PARAMETERS_V1.version,
    promotionState: promotion?.promotionState ?? 'UNREGISTERED',
    paperEligible:
      promotion?.promotionState === 'PAPER_ELIGIBLE' || promotion?.promotionState === 'PAPER_ACTIVE',
    shadowEligible:
      promotion?.promotionState === 'SHADOW_ELIGIBLE' || promotion?.promotionState === 'SHADOW_ACTIVE',
    liveEligible: false,
    qualificationMarker: HELIOS_MULTI_ASSET_M12_RELATIVE_VALUE_STAT_ARB_QUALIFIED,
    observedAt: input.observedAt,
  });
}

export function buildM12ReferenceCapsule(now: UtcInstant) {
  const spec = freezeSpecification({
    strategyId: asStrategyId(HELIOS_M12_STRATEGY_CAPSULE_ID),
    version: asStrategyVersion(HELIOS_M12_STRATEGY_CAPSULE_VERSION),
    instrumentUniverse: M12_PAIR_UNIVERSE.map((pairId) => `pair:${pairId}`),
    eligibilityFilters: Object.freeze([
      { instrumentType: 'ETF', currency: 'USD', requireMembership: true },
    ]),
    approvedSignalRefs: Object.freeze([]),
    rebalanceCadence: 'DAILY',
    targetAllocation: Object.freeze({
      op: 'ALLOCATION' as const,
      weightsBps: Object.freeze({
        [`pair:${M12_SPY_QQQ_PAIR_ID}`]: 5_000,
        CASH: 5_000,
      }),
    }),
    entryConditions: Object.freeze({
      op: 'COMPARE' as const,
      left: { kind: 'CLOSE' as const, instrumentId: `pair:${M12_SPY_QQQ_PAIR_ID}` },
      comparator: 'LT' as const,
      right: { kind: 'THRESHOLD' as const, minorUnits: 999_999_999n },
    }),
    exitConditions: Object.freeze({
      op: 'RISK_CONDITION' as const,
      kind: 'CASH_BELOW_BPS' as const,
      bps: 100,
    }),
    cashAllocationBps: 5_000,
    riskBudgetId: asRiskBudgetId('rbdg_m12_relative_value_stat_arb'),
    mandateCompatibility: Object.freeze(['GROW', 'RESEARCH']),
    transactionCosts: EXPLICIT_COSTS,
    requiredData: Object.freeze(['bar_1h', 'pair_spread', 'rolling_correlation', 'spread_z_score']),
    requiredModels: Object.freeze([
      { modelId: asModelId('mdl_investment_pretrade'), version: asModelVersion('risk-model-v1') },
    ]),
    createdAt: now,
  });
  if (!spec.ok) {
    return spec;
  }
  const plan = compileStrategy(spec.value, {
    riskBudgetId: spec.value.riskBudgetId,
    riskModelId: asRiskModelId('mdl_investment_pretrade'),
    riskModelVersion: asRiskModelVersion('risk-model-v1'),
  });
  if (!plan.ok) {
    return plan;
  }
  return freezeStrategyCapsule({
    capsuleId: HELIOS_M12_CAPSULE_ID,
    version: asStrategyCapsuleVersion('v1'),
    specification: spec.value,
    plan: plan.value,
    parameterSet: DEFAULT_PARAMETER_SET,
    costSpec: EXPLICIT_COSTS,
    latencyModel: DEFAULT_CONSERVATIVE_LATENCY,
    frozenAt: now,
  });
}

export function registerM12StrategyCapsuleRecord(now: UtcInstant, createdBy: string): StrategyCapsuleRecord {
  return buildHeliosM12StrategyCapsule({ createdAt: now, createdBy });
}

export function m12MaterialFingerprint(scope: 'GLOBAL' | 'CUSTOMER_SCOPED' = 'GLOBAL'): string {
  return computeStrategyCapsuleMaterialHash(buildHeliosM12Material(), scope);
}

export { HELIOS_M12_RULE_ID };
