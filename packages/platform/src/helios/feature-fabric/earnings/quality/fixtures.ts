import { asUtcInstant, type UtcInstant } from '@solstice/domain';
import type { Earn06ManagementGuidance, Earn06QuarterFinancials } from './types.ts';

const ENTITY = 'ekg_ent_earn06_demo';

function quarter(partial: Omit<Earn06QuarterFinancials, 'evidenceRefs'> & { readonly evidenceRefs?: readonly string[] }): Earn06QuarterFinancials {
  return Object.freeze({
    ...partial,
    evidenceRefs: Object.freeze(partial.evidenceRefs ?? [`evidence.${partial.fiscalPeriod}`]),
  });
}

export const EARN06_DEMO_ENTITY_ID = ENTITY;

export function earn06ReceivablesDivergenceScenario(): {
  readonly entityId: string;
  readonly evaluationTime: UtcInstant;
  readonly fiscalPeriod: string;
  readonly previousQuarterPeriod: string;
  readonly quarters: readonly Earn06QuarterFinancials[];
} {
  const evaluationTime = asUtcInstant('2025-05-15T14:00:00.000Z');
  const q1 = quarter({
    fiscalPeriod: '2025-Q1',
    periodEnd: '2025-03-31',
    knowableAt: asUtcInstant('2025-05-10T21:00:00.000Z'),
    revenueMinor: 1_100_000_000_00n,
    netIncomeMinor: 120_000_000_00n,
    operatingIncomeMinor: 150_000_000_00n,
    grossProfitMinor: 440_000_000_00n,
    operatingCashFlowMinor: 80_000_000_00n,
    freeCashFlowMinor: 60_000_000_00n,
    accountsReceivableMinor: 550_000_000_00n,
    inventoryMinor: 200_000_000_00n,
    deferredRevenueMinor: 90_000_000_00n,
    workingCapitalMinor: 300_000_000_00n,
    shareCountScaled: 1_000_000_000n,
    dilutedEpsMinor: 120n,
    effectiveTaxRateBps: 2_100n,
    capexMinor: 20_000_000_00n,
    capitalizedCostsMinor: 5_000_000_00n,
    nonGaapAdjustmentsMinor: 10_000_000_00n,
    oneTimeItemsMinor: 8_000_000_00n,
    sbcMinor: 15_000_000_00n,
    buybackSpendMinor: 25_000_000_00n,
  });
  const q0 = quarter({
    fiscalPeriod: '2024-Q4',
    periodEnd: '2024-12-31',
    knowableAt: asUtcInstant('2025-02-10T21:00:00.000Z'),
    revenueMinor: 1_000_000_000_00n,
    netIncomeMinor: 100_000_000_00n,
    operatingIncomeMinor: 130_000_000_00n,
    grossProfitMinor: 400_000_000_00n,
    operatingCashFlowMinor: 95_000_000_00n,
    freeCashFlowMinor: 75_000_000_00n,
    accountsReceivableMinor: 400_000_000_00n,
    inventoryMinor: 180_000_000_00n,
    deferredRevenueMinor: 100_000_000_00n,
    workingCapitalMinor: 340_000_000_00n,
    shareCountScaled: 1_020_000_000n,
    dilutedEpsMinor: 98n,
    effectiveTaxRateBps: 2_200n,
    capexMinor: 20_000_000_00n,
    capitalizedCostsMinor: 4_000_000_00n,
    nonGaapAdjustmentsMinor: 8_000_000_00n,
    oneTimeItemsMinor: 5_000_000_00n,
    sbcMinor: 14_000_000_00n,
    buybackSpendMinor: 30_000_000_00n,
  });
  return Object.freeze({
    entityId: ENTITY,
    evaluationTime,
    fiscalPeriod: '2025-Q1',
    previousQuarterPeriod: '2024-Q4',
    quarters: Object.freeze([q0, q1]),
  });
}

export function earn06ManagementGuidanceFixture(): Earn06ManagementGuidance {
  return Object.freeze({
    metricId: 'revenue',
    valueMinor: 1_200_000_000_00n,
    knowableAt: asUtcInstant('2025-04-01T12:00:00.000Z'),
    fiscalPeriod: '2025-Q1',
    evidenceRef: 'evidence.guidance.2025-q1',
  });
}
