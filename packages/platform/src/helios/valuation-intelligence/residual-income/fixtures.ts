import { asUtcInstant } from '@solstice/domain';

import type { ResidualIncomeEngineInput } from './types.ts';

export const VAL07_FIXTURE_AS_OF = asUtcInstant('2026-11-01T00:00:00.000Z');
export const VAL07_FIXTURE_ENTITY_ID = 'entity_val07_fixture';

export function fixturePositiveResidualIncomeInput(): ResidualIncomeEngineInput {
  return Object.freeze({
    valuationId: 'val07_pos_ri',
    entityLabel: VAL07_FIXTURE_ENTITY_ID,
    evaluationTime: VAL07_FIXTURE_AS_OF,
    currentBookEquity: 100,
    costOfEquityBps: 1000,
    forecast: Object.freeze({
      stageKind: 'SINGLE_STAGE',
      currency: 'USD',
      assumeCleanSurplus: true,
      explicitPeriods: Object.freeze([
        Object.freeze({
          periodIndex: 1,
          netIncome: 15,
          beginningBookEquity: 100,
        }),
      ]),
      continuing: Object.freeze({
        kind: 'PERPETUAL_RESIDUAL_INCOME',
        terminalResidualIncome: 5,
        terminalGrowthBps: 0,
      }),
    }),
  });
}

export function fixtureRoeEqualsKeInput(): ResidualIncomeEngineInput {
  return Object.freeze({
    valuationId: 'val07_roe_ke',
    entityLabel: VAL07_FIXTURE_ENTITY_ID,
    evaluationTime: VAL07_FIXTURE_AS_OF,
    currentBookEquity: 200,
    costOfEquityBps: 1200,
    forecast: Object.freeze({
      stageKind: 'SINGLE_STAGE',
      currency: 'USD',
      assumeCleanSurplus: true,
      explicitPeriods: Object.freeze([
        Object.freeze({
          periodIndex: 1,
          netIncome: 24,
          beginningBookEquity: 200,
        }),
      ]),
      continuing: Object.freeze({
        kind: 'PERPETUAL_RESIDUAL_INCOME',
        terminalResidualIncome: 0,
        terminalGrowthBps: 0,
      }),
    }),
  });
}
