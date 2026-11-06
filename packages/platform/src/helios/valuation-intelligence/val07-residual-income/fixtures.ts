import { asUtcInstant } from '@solstice/domain';

import type { ResidualIncomePathInput } from './engine.ts';

export const FIXTURE_VAL07_ENTITY = 'helios-fixture-val07' as const;
export const FIXTURE_VAL07_AS_OF = asUtcInstant('2026-11-01T00:00:00.000Z');

export function fixtureVal07Paths(): ResidualIncomePathInput {
  const roeSamples = Array.from({ length: 64 }, (_, i) => 0.1 + (i % 7) * 0.01);
  const costOfEquitySamples = Array.from({ length: 64 }, (_, i) => 0.085 + (i % 5) * 0.004);
  return Object.freeze({
    bookValuePerShare: 42,
    roeSamples: Object.freeze(roeSamples),
    costOfEquitySamples: Object.freeze(costOfEquitySamples),
    persistenceYears: 5,
    terminalGrowth: 0.02,
  });
}
