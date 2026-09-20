import type { UtcInstant } from '../../domain/src/time.ts';
import { asStrategyCapsuleVersion } from './evaluation/ids.ts';
import { freezeStrategyCapsule } from './evaluation/capsule.ts';
import { DEFAULT_CONSERVATIVE_LATENCY } from './evaluation/latency-model.ts';
import { EXPLICIT_COSTS, DEFAULT_PARAMETER_SET } from './fixtures.ts';
import { asStrategyId, asStrategyVersion } from './ids.ts';
import { freezeSpecification } from './specification.ts';
import { compileStrategy } from './compiler.ts';
import { asRiskBudgetId, asRiskModelId, asRiskModelVersion } from '../../risk/src/ids.ts';
import { asModelId, asModelVersion } from '../../model-registry/src/ids.ts';
import {
  HELIOS_M09_CAPSULE_ID,
  HELIOS_M09_FAMILY_ID,
  buildHeliosM09Material,
  buildHeliosM09StrategyCapsule,
} from './capsule/m09-index-mean-reversion.ts';
import { computeStrategyCapsuleMaterialHash } from './capsule/fingerprint.ts';
import { M09_INSTRUMENT_UNIVERSE } from './m09/ids.ts';
import { M09_PARAMETERS_V1 } from './m09/parameters.ts';
import type { StrategyCapsuleRecord } from './capsule/types.ts';
import type { StrategyPromotionRecord } from './promotion-store.ts';

export const HELIOS_M09_STRATEGY_CAPSULE_ID = 'str_helios_m09_index_mean_reversion_v1' as const;
export const HELIOS_M09_STRATEGY_CAPSULE_VERSION = 'v1' as const;

export type M09CapsuleQualificationObservation = {
  readonly capsuleId: string;
  readonly strategyId: typeof HELIOS_M09_STRATEGY_CAPSULE_ID;
  readonly version: typeof HELIOS_M09_STRATEGY_CAPSULE_VERSION;
  readonly fingerprint: string;
  readonly materialHash: string;
  readonly parameterVersion: string;
  readonly promotionState: StrategyPromotionRecord['promotionState'] | 'UNREGISTERED';
  readonly paperEligible: boolean;
  readonly shadowEligible: boolean;
  readonly liveEligible: false;
  readonly observedAt: UtcInstant;
};

export function observeM09CapsuleQualification(input: {
  readonly capsule?: StrategyCapsuleRecord | null;
  readonly promotion?: StrategyPromotionRecord | null;
  readonly observedAt: UtcInstant;
}): M09CapsuleQualificationObservation {
  const capsule = input.capsule;
  const promotion = input.promotion;
  return Object.freeze({
    capsuleId: capsule?.strategyCapsuleId ?? HELIOS_M09_CAPSULE_ID,
    strategyId: HELIOS_M09_STRATEGY_CAPSULE_ID,
    version: HELIOS_M09_STRATEGY_CAPSULE_VERSION,
    fingerprint: capsule?.materialHash ?? 'unregistered',
    materialHash: capsule?.materialHash ?? 'unregistered',
    parameterVersion: M09_PARAMETERS_V1.version,
    promotionState: promotion?.promotionState ?? 'UNREGISTERED',
    paperEligible:
      promotion?.promotionState === 'PAPER_ELIGIBLE' || promotion?.promotionState === 'PAPER_ACTIVE',
    shadowEligible:
      promotion?.promotionState === 'SHADOW_ELIGIBLE' || promotion?.promotionState === 'SHADOW_ACTIVE',
    liveEligible: false,
    observedAt: input.observedAt,
  });
}

export function buildM09EvaluationCapsule(now: UtcInstant) {
  const spec = freezeSpecification({
    strategyId: asStrategyId(HELIOS_M09_STRATEGY_CAPSULE_ID),
    version: asStrategyVersion(HELIOS_M09_STRATEGY_CAPSULE_VERSION),
    instrumentUniverse: M09_INSTRUMENT_UNIVERSE,
    eligibilityFilters: Object.freeze([
      { instrumentType: 'ETF', currency: 'USD', requireMembership: true },
    ]),
    approvedSignalRefs: Object.freeze([]),
    rebalanceCadence: 'DAILY',
    targetAllocation: Object.freeze({
      op: 'ALLOCATION' as const,
      weightsBps: Object.freeze({
        [M09_INSTRUMENT_UNIVERSE[0]!]: 4_000,
        [M09_INSTRUMENT_UNIVERSE[1]!]: 4_000,
        CASH: 2_000,
      }),
    }),
    entryConditions: Object.freeze({
      op: 'COMPARE' as const,
      left: { kind: 'CLOSE' as const, instrumentId: M09_INSTRUMENT_UNIVERSE[0]! },
      comparator: 'LT' as const,
      right: { kind: 'THRESHOLD' as const, minorUnits: 999_999_999n },
    }),
    exitConditions: Object.freeze({
      op: 'RISK_CONDITION' as const,
      kind: 'CASH_BELOW_BPS' as const,
      bps: 100,
    }),
    cashAllocationBps: 2_000,
    riskBudgetId: asRiskBudgetId('rbdg_m09_index_mean_reversion'),
    mandateCompatibility: Object.freeze(['GROW', 'RESEARCH']),
    transactionCosts: EXPLICIT_COSTS,
    requiredData: Object.freeze(['bar_15m', 'rolling_mean', 'realized_volatility', 'spread']),
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
    capsuleId: HELIOS_M09_CAPSULE_ID,
    version: asStrategyCapsuleVersion('v1'),
    specification: spec.value,
    plan: plan.value,
    parameterSet: DEFAULT_PARAMETER_SET,
    costSpec: EXPLICIT_COSTS,
    latencyModel: DEFAULT_CONSERVATIVE_LATENCY,
    frozenAt: now,
  });
}

export function registerM09StrategyCapsuleRecord(now: UtcInstant, createdBy: string): StrategyCapsuleRecord {
  return buildHeliosM09StrategyCapsule({ createdAt: now, createdBy });
}

export function m09MaterialFingerprint(scope: 'GLOBAL' | 'CUSTOMER_SCOPED' = 'GLOBAL'): string {
  return computeStrategyCapsuleMaterialHash(buildHeliosM09Material(), scope);
}
