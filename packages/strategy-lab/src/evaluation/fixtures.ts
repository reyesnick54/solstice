import { asUtcInstant, type UtcInstant } from '../../../domain/src/time.ts';
import { asModelId, asModelVersion } from '../../../model-registry/src/ids.ts';
import { asRiskBudgetId, asRiskModelId, asRiskModelVersion } from '../../../risk/src/ids.ts';
import { compileStrategy, STRATEGY_COMPILER_VERSION } from '../compiler.ts';
import type { StrategyExpr } from '../dsl.ts';
import { EXPLICIT_COSTS, SIM_ETF_1, DEFAULT_PARAMETER_SET } from '../fixtures.ts';
import { asMarketDatasetVersion, asStrategyId, asStrategyVersion } from '../ids.ts';
import { freezeSpecification } from '../specification.ts';
import { asStrategyCapsuleVersion } from './ids.ts';
import { freezeStrategyCapsule } from './capsule.ts';
import {
  buildChronologicalObservation,
  freezeEvaluationDatasetManifest,
  type EvaluationDatasetManifest,
} from './manifest.ts';
import { DEFAULT_CONSERVATIVE_LATENCY } from './latency-model.ts';

function instant(iso: string): UtcInstant {
  return asUtcInstant(iso);
}

export function informationTimeLeakFixture(): EvaluationDatasetManifest {
  const sourceEvent = instant('2026-03-01T10:00:00.000Z');
  const knowableLate = instant('2026-03-01T10:00:03.000Z');
  const evaluationEarly = instant('2026-03-01T10:00:01.000Z');

  const observations = [
    buildChronologicalObservation({
      observationId: 'obs_leak_test',
      instrumentId: SIM_ETF_1,
      sourceEventTime: sourceEvent,
      providerAvailabilityTime: knowableLate,
      sunreyArrivalTime: knowableLate,
      ingestionTime: knowableLate,
      providerId: 'fixture_provider',
      providerSequence: 1,
      openMinor: 10_000n,
      highMinor: 10_050n,
      lowMinor: 9_950n,
      closeMinor: 10_000n,
      bidMinor: 9_995n,
      askMinor: 10_005n,
      available: true,
      sessionOpen: true,
    }),
    buildChronologicalObservation({
      observationId: 'obs_eval_day',
      instrumentId: SIM_ETF_1,
      sourceEventTime: evaluationEarly,
      providerAvailabilityTime: evaluationEarly,
      sunreyArrivalTime: evaluationEarly,
      ingestionTime: evaluationEarly,
      providerId: 'fixture_provider',
      providerSequence: 2,
      openMinor: 10_000n,
      highMinor: 10_050n,
      lowMinor: 9_950n,
      closeMinor: 10_000n,
      bidMinor: 9_995n,
      askMinor: 10_005n,
      available: true,
      sessionOpen: true,
    }),
  ];

  for (let i = 0; i < 10; i += 1) {
    const at = instant(`2026-03-${String(i + 2).padStart(2, '0')}T00:00:00.000Z`);
    observations.push(
      buildChronologicalObservation({
        observationId: `obs_day_${String(i)}`,
        instrumentId: SIM_ETF_1,
        sourceEventTime: at,
        sunreyArrivalTime: at,
        ingestionTime: at,
        providerId: 'fixture_provider',
        providerSequence: 10 + i,
        openMinor: 10_000n + BigInt(i) * 10n,
        highMinor: 10_050n + BigInt(i) * 10n,
        lowMinor: 9_950n + BigInt(i) * 10n,
        closeMinor: 10_000n + BigInt(i) * 10n,
        bidMinor: 9_995n + BigInt(i) * 10n,
        askMinor: 10_005n + BigInt(i) * 10n,
        available: true,
        sessionOpen: true,
      }),
    );
  }

  const frozen = freezeEvaluationDatasetManifest({
    version: 'edmf-h17-leak-v1',
    instruments: Object.freeze([SIM_ETF_1]),
    membership: Object.freeze([{ instrumentId: SIM_ETF_1, enteredAt: instant('2026-03-01T00:00:00.000Z'), leftAt: null }]),
    timeRange: { start: instant('2026-03-01T00:00:00.000Z'), end: instant('2026-03-11T00:00:00.000Z') },
    providerIds: Object.freeze(['fixture_provider']),
    datasetIds: Object.freeze(['fixture_dataset_h17']),
    corporateActionHandling: 'INVESTMENTS_SPLIT_DIVIDEND_SEMANTICS',
    corporateActionVersion: null,
    degradedPeriods: Object.freeze([]),
    feedEntitlement: 'SYNTHETIC_FIXTURE',
    gapsExplicit: Object.freeze([]),
    limitations: Object.freeze([
      'H17 information-time leak regression fixture.',
      'Report at 10:00:00 is knowable only at 10:00:03.',
    ]),
    observations: Object.freeze(observations),
    corporateActions: Object.freeze([]),
  });
  if (!frozen.ok) {
    throw new Error(frozen.error.message);
  }
  return frozen.value;
}

export function chronologicalEvaluationManifest(): EvaluationDatasetManifest {
  const observations = [];
  for (let i = 0; i < 14; i += 1) {
    const at = instant(`2026-04-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`);
    const close = 10_000n + BigInt(i) * 25n;
    observations.push(
      buildChronologicalObservation({
        observationId: `obs_h17_${String(i)}`,
        instrumentId: SIM_ETF_1,
        sourceEventTime: at,
        providerAvailabilityTime: at,
        sunreyArrivalTime: at,
        ingestionTime: at,
        providerId: 'fixture_provider',
        providerSequence: i,
        openMinor: close,
        highMinor: close + 50n,
        lowMinor: close - 50n,
        closeMinor: close,
        bidMinor: close - 5n,
        askMinor: close + 5n,
        available: i !== 7,
        sessionOpen: i !== 8,
        degraded: false,
      }),
    );
  }

  const frozen = freezeEvaluationDatasetManifest({
    version: asMarketDatasetVersion('edmf-h17-chrono-v1'),
    instruments: Object.freeze([SIM_ETF_1]),
    membership: Object.freeze([{ instrumentId: SIM_ETF_1, enteredAt: instant('2026-04-01T00:00:00.000Z'), leftAt: null }]),
    timeRange: { start: instant('2026-04-01T00:00:00.000Z'), end: instant('2026-04-14T00:00:00.000Z') },
    providerIds: Object.freeze(['fixture_provider']),
    datasetIds: Object.freeze(['fixture_dataset_h17_chrono']),
    corporateActionHandling: 'INVESTMENTS_SPLIT_DIVIDEND_SEMANTICS',
    corporateActionVersion: 'corp-v1',
    degradedPeriods: Object.freeze([
      { start: instant('2026-04-08T00:00:00.000Z'), end: instant('2026-04-08T00:00:00.000Z'), reason: 'market unavailable' },
    ]),
    feedEntitlement: 'SYNTHETIC_FIXTURE',
    gapsExplicit: Object.freeze([
      { start: instant('2026-04-08T00:00:00.000Z'), end: instant('2026-04-08T00:00:00.000Z'), reason: 'explicit gap — not silently filled' },
    ]),
    limitations: Object.freeze(['Synthetic fixture with bid/ask, session state, and explicit gap at day 8.']),
    observations: Object.freeze(observations),
    corporateActions: Object.freeze([]),
  });
  if (!frozen.ok) {
    throw new Error(frozen.error.message);
  }
  return frozen.value;
}

function singleInstrumentSpec(now: UtcInstant) {
  const allocation: StrategyExpr = {
    op: 'ALLOCATION',
    weightsBps: { [SIM_ETF_1]: 8_000, CASH: 2_000 },
  };
  const entry: StrategyExpr = {
    op: 'COMPARE',
    left: { kind: 'CLOSE', instrumentId: SIM_ETF_1 },
    comparator: 'GT',
    right: { kind: 'THRESHOLD', minorUnits: 9_000n },
  };
  const exit: StrategyExpr = {
    op: 'RISK_CONDITION',
    kind: 'CASH_BELOW_BPS',
    bps: 500,
  };
  const signal = { modelId: asModelId('mdl_investment_pretrade'), version: asModelVersion('risk-model-v1') };
  return freezeSpecification({
    strategyId: asStrategyId('str_h17_single_etf'),
    version: asStrategyVersion('v1'),
    instrumentUniverse: Object.freeze([SIM_ETF_1]),
    eligibilityFilters: Object.freeze([{ instrumentType: 'ETF', currency: 'USD', requireMembership: true }]),
    approvedSignalRefs: Object.freeze([signal]),
    rebalanceCadence: 'DAILY',
    targetAllocation: allocation,
    entryConditions: entry,
    exitConditions: exit,
    cashAllocationBps: 2_000,
    riskBudgetId: asRiskBudgetId('rbdg_default_simulation'),
    mandateCompatibility: Object.freeze(['paper-simulation']),
    transactionCosts: EXPLICIT_COSTS,
    requiredData: Object.freeze(['daily-close', 'membership']),
    requiredModels: Object.freeze([signal]),
    createdAt: now,
  });
}

export function buildReferenceCapsule(now: UtcInstant) {
  const spec = singleInstrumentSpec(now);
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
    version: asStrategyCapsuleVersion('v1'),
    specification: spec.value,
    plan: plan.value,
    parameterSet: DEFAULT_PARAMETER_SET,
    costSpec: EXPLICIT_COSTS,
    latencyModel: DEFAULT_CONSERVATIVE_LATENCY,
    frozenAt: now,
  });
}

export { STRATEGY_COMPILER_VERSION };
