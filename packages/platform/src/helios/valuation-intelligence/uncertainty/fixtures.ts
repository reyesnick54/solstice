import { fixtureTerminalGrowthDcfInput } from '../val04-probabilistic-dcf/fixtures.ts';
import type { Val10UncertaintyEngineInput } from './types.ts';
import { DEFAULT_VAL10_SEED } from './taxonomy.ts';

export function fixtureVal10UncertaintyInput(): Val10UncertaintyEngineInput {
  const dcf = fixtureTerminalGrowthDcfInput();
  return Object.freeze({
    valuationId: 'val_fixture_val10_uncertainty',
    entityLabel: 'FixtureCo',
    probabilisticDcf: dcf,
    monteCarloPaths: 128,
    seed: DEFAULT_VAL10_SEED,
    crossModelValues: Object.freeze([
      Object.freeze({ method: 'DCF', enterpriseValue: 12_500, consistentWithReverseDcf: true }),
      Object.freeze({ method: 'RIV', enterpriseValue: 11_800, consistentWithReverseDcf: null }),
      Object.freeze({ method: 'ECONOMIC_PROFIT', enterpriseValue: 12_100, consistentWithReverseDcf: null }),
      Object.freeze({ method: 'COMPARABLES', enterpriseValue: 13_400, consistentWithReverseDcf: null }),
      Object.freeze({ method: 'SOTP', enterpriseValue: 12_900, consistentWithReverseDcf: null }),
      Object.freeze({ method: 'REVERSE_DCF', enterpriseValue: 12_200, consistentWithReverseDcf: true }),
    ]),
    accountingStates: Object.freeze([
      Object.freeze({
        stateId: 'reported',
        label: 'As reported',
        revenueMultiplier: 1,
        marginAdjustment: 0,
        reinvestmentRateAdjustment: 0,
        rationale: Object.freeze(['reported_data']),
      }),
      Object.freeze({
        stateId: 'cash_conversion_stress',
        label: 'Cash conversion stress',
        revenueMultiplier: 1,
        marginAdjustment: -0.01,
        reinvestmentRateAdjustment: 0.03,
        rationale: Object.freeze(['accrual_uncertainty', 'cash_conversion']),
      }),
      Object.freeze({
        stateId: 'restatement_adjacent',
        label: 'Restatement-adjacent adjustments',
        revenueMultiplier: 0.98,
        marginAdjustment: -0.005,
        reinvestmentRateAdjustment: 0,
        rationale: Object.freeze(['restatement_history']),
      }),
    ]),
    dataQualityFlags: Object.freeze(['simulation_fixture_only']),
    segmentUncertaintyNotes: Object.freeze(['single_segment_fixture']),
    macroUncertaintyNotes: Object.freeze(['macro_bridge_not_live']),
  });
}
