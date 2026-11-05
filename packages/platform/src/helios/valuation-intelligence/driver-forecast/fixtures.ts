/**
 * Sandbox fixtures for VAL02 qualification and tests.
 */

import { asUtcInstant } from '@solstice/domain';
import type { PointInTimeFundamentalSnapshot } from '../../feature-fabric/fundamental-types.ts';
import { HELIOS_FUNDAMENTAL_FEATURE_SCHEMA } from '../../feature-fabric/fundamental-types.ts';
import { DEFAULT_VAL02_CORRELATION } from './correlations.ts';
import type { BusinessDriverModel } from './types.ts';

export const FIXTURE_VAL02_AS_OF = asUtcInstant('2026-11-01T00:00:00.000Z');

export function fixtureVal02Fundamentals(): PointInTimeFundamentalSnapshot {
  const knowableAt = FIXTURE_VAL02_AS_OF;
  const feature = (
    featureId: keyof PointInTimeFundamentalSnapshot['features'],
    valueMinor: bigint | null,
    ratio: string | null,
  ) =>
    Object.freeze({
      featureId,
      supported: true,
      valueMinor,
      ratio,
      unit: valueMinor !== null ? 'USD_MINOR' : null,
      fiscalPeriod: '2025FY',
      reportPeriod: '2025-12-31',
      sourceFilingId: 'fixture-10k',
      evidenceRef: 'fixture:sec:10k',
      knowableAt,
    });

  return Object.freeze({
    schema: HELIOS_FUNDAMENTAL_FEATURE_SCHEMA,
    canonicalEntityId: 'eq:AAPL',
    evaluationTimeUtc: FIXTURE_VAL02_AS_OF,
    features: Object.freeze({
      revenue: feature('revenue', 400_000_000_000n, null),
      revenue_growth: feature('revenue_growth', null, '0.08'),
      gross_margin: feature('gross_margin', null, '0.46'),
      operating_margin: feature('operating_margin', null, '0.30'),
      fcf: feature('fcf', 95_000_000_000_000n, null),
      fcf_margin: feature('fcf_margin', null, '0.24'),
      roic_proxy: feature('roic_proxy', null, '0.28'),
      cash: feature('cash', 50_000_000_000_000n, null),
      debt: feature('debt', 110_000_000_000_000n, null),
      net_debt: feature('net_debt', 80_000_000_000n, null),
      share_count: feature('share_count', 15_500_000n, null),
      capex: feature('capex', 18_000_000_000n, null),
      sbc: feature('sbc', 10_000_000_000_000n, null),
      working_capital_change: feature('working_capital_change', 2_000_000_000_000n, null),
    }),
  });
}

export function fixtureVal02DriverModel(): BusinessDriverModel {
  const segmentHardware = Object.freeze({
    kind: 'PRODUCT' as const,
    driverId: 'seg_hw_units_price',
    label: 'Hardware segment revenue',
    volume: Object.freeze({
      kind: 'LEAF' as const,
      driverId: 'hw_units',
      label: 'Hardware units',
      dimension: 'SEGMENT' as const,
      segmentId: 'hardware',
      geographyId: null,
      baseValue: 220,
      unit: 'M_units',
      growthShockFactor: 'revenueGrowth' as const,
    }),
    price: Object.freeze({
      kind: 'LEAF' as const,
      driverId: 'hw_asp',
      label: 'Hardware ASP',
      dimension: 'SEGMENT' as const,
      segmentId: 'hardware',
      geographyId: null,
      baseValue: 900,
      unit: 'USD',
      growthShockFactor: null,
    }),
  });

  const segmentServices = Object.freeze({
    kind: 'MARKET_SHARE' as const,
    driverId: 'seg_services_tam_share',
    label: 'Services segment revenue',
    addressableMarket: 180_000,
    marketUnit: 'USD_M',
    shareBase: 0.34,
    shareGrowthFactor: 'revenueGrowth' as const,
  });

  const geoAmericas = Object.freeze({
    kind: 'PRODUCT' as const,
    driverId: 'geo_am_units_price',
    label: 'Americas revenue',
    volume: Object.freeze({
      kind: 'LEAF' as const,
      driverId: 'am_units',
      label: 'Americas volume',
      dimension: 'GEOGRAPHY' as const,
      segmentId: null,
      geographyId: 'americas',
      baseValue: 160,
      unit: 'M_units',
      growthShockFactor: 'revenueGrowth' as const,
    }),
    price: Object.freeze({
      kind: 'LEAF' as const,
      driverId: 'am_price',
      label: 'Americas blended price',
      dimension: 'GEOGRAPHY' as const,
      segmentId: null,
      geographyId: 'americas',
      baseValue: 820,
      unit: 'USD',
      growthShockFactor: null,
    }),
  });

  const consolidated = Object.freeze({
    kind: 'CAPACITY_BIND' as const,
    driverId: 'consolidated_revenue',
    label: 'Consolidated revenue driver tree',
    demand: Object.freeze({
      kind: 'SUM' as const,
      driverId: 'segment_sum',
      label: 'Segment rollup',
      children: Object.freeze([segmentHardware, segmentServices]),
    }),
    capacityUnits: 420_000,
    utilizationCap: 0.92,
  });

  return Object.freeze({
    modelId: 'val02-fixture-driver-model-v1',
    revenueDriverTree: consolidated,
    segmentTrees: Object.freeze([segmentHardware, segmentServices]),
    geographyTrees: Object.freeze([geoAmericas]),
    horizonWeights: Object.freeze({ NEAR: 0.45, MEDIUM: 0.4, LONG: 0.15 }),
    terminal: Object.freeze({
      convergenceYears: 2,
      terminalRevenueGrowth: 0.03,
      terminalOperatingMargin: 0.28,
      terminalCapexToRevenue: 0.045,
      terminalWorkingCapitalToRevenueDelta: 0.008,
    }),
    correlation: DEFAULT_VAL02_CORRELATION,
    forecastYears: 5,
    nearTermQuarters: 4,
  });
}

export const FIXTURE_VAL02_ANALYST_REVENUE = Object.freeze([
  Object.freeze({ fiscalYear: 2027, revenuePoint: 430_000, revenueDispersion: 12_000 }),
  Object.freeze({ fiscalYear: 2028, revenuePoint: 455_000, revenueDispersion: 18_000 }),
]);
