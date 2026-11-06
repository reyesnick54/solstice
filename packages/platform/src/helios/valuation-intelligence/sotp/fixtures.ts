/**
 * VAL09 SOTP fixtures — multi-segment conglomerate rehearsal.
 */

import { asUtcInstant } from '@solstice/domain';
import type { SegmentObservation } from '@solstice/external-data';
import type { DriverLeafNode } from '../driver-forecast/types.ts';
import type { RunSotpValuationInput, SegmentValuationSpec } from './types.ts';

export const VAL09_FIXTURE_ENTITY_ID = 'entity:conglomerate-demo' as const;
export const VAL09_FIXTURE_AS_OF = '2024-06-30T20:00:00.000Z' as const;

function segmentObs(partial: Omit<SegmentObservation, 'observationKind'>): SegmentObservation {
  return Object.freeze({
    observationKind: 'segment',
    ...partial,
  });
}

export function val09FixtureSegmentObservations(): readonly SegmentObservation[] {
  const base = {
    accessionNumber: '0000320193-24-000001',
    form: '10-Q' as const,
    filingDate: '2024-05-02',
    acceptedAtUtc: asUtcInstant('2024-05-02T16:00:00.000Z'),
    publishedAtUtc: asUtcInstant('2024-05-02T18:00:00.000Z'),
    fiscalPeriod: '2024-Q2',
    reportPeriod: '2024-03-31',
    source: 'sec-edgar:as-filed',
    amendmentLineage: Object.freeze({
      kind: 'original' as const,
      supersedesFilingId: null,
      amendsFilingId: null,
      rootFilingId: 'filing-cloud-q2',
    }),
    canonicalEntityId: VAL09_FIXTURE_ENTITY_ID,
  };

  return Object.freeze([
    segmentObs({
      ...base,
      filingId: 'filing-cloud-q2',
      knowableAt: asUtcInstant('2024-05-02T18:00:00.000Z'),
      evidenceRef: 'sec-edgar:cloud-rev',
      segmentId: 'cloud',
      segmentLabel: 'Cloud Services',
      metricConcept: 'Revenues',
      valueMinor: 12_000_000_000_00n,
    }),
    segmentObs({
      ...base,
      filingId: 'filing-cloud-q2',
      knowableAt: asUtcInstant('2024-05-02T18:00:00.000Z'),
      evidenceRef: 'sec-edgar:semi-rev',
      segmentId: 'semi',
      segmentLabel: 'Semiconductor',
      metricConcept: 'Revenues',
      valueMinor: 8_000_000_000_00n,
    }),
    segmentObs({
      ...base,
      filingId: 'filing-industrial-q1',
      knowableAt: asUtcInstant('2024-02-01T18:00:00.000Z'),
      evidenceRef: 'sec-edgar:industrial-rev',
      segmentId: 'industrial',
      segmentLabel: 'Industrial Automation',
      metricConcept: 'Revenues',
      valueMinor: 4_000_000_000_00n,
    }),
    segmentObs({
      ...base,
      filingId: 'filing-rename',
      fiscalPeriod: '2023-Q4',
      reportPeriod: '2023-12-31',
      knowableAt: asUtcInstant('2024-02-15T18:00:00.000Z'),
      evidenceRef: 'sec-edgar:cloud-rename',
      segmentId: 'cloud',
      segmentLabel: 'Cloud & SaaS',
      metricConcept: 'Revenues',
      valueMinor: 11_000_000_000_00n,
    }),
  ]);
}

function cloudDriverTree(): DriverLeafNode {
  return Object.freeze({
    kind: 'LEAF',
    driverId: 'arr',
    label: 'Annual recurring revenue',
    dimension: 'SEGMENT',
    segmentId: 'cloud',
    geographyId: null,
    baseValue: 12_000,
    unit: 'USD_MILLIONS',
    growthShockFactor: null,
  });
}

export function val09FixtureSegmentSpecs(): readonly SegmentValuationSpec[] {
  return Object.freeze([
    Object.freeze({
      stableSegmentKey: 'seg:cloud:Cloud Services',
      method: 'DCF_FCFF' as const,
      forecast: Object.freeze({
        stableSegmentKey: 'seg:cloud:Cloud Services',
        horizonYears: 5,
        driverTree: cloudDriverTree(),
        explicitFcffMinor: Object.freeze([
          2_000_000_000_00n,
          2_200_000_000_00n,
          2_400_000_000_00n,
          2_600_000_000_00n,
          2_800_000_000_00n,
        ]),
        explicitFcfeMinor: Object.freeze([]),
        discountRateBps: 900,
        terminalGrowthBps: 250,
        scenarioWeights: Object.freeze([
          Object.freeze({ scenarioId: 'BASE', label: 'Base', weight: 0.7 }),
          Object.freeze({ scenarioId: 'DOWNSIDE', label: 'Downside retention', weight: 0.3 }),
        ]),
        evidenceDriverIds: Object.freeze(['arr']),
      }),
      profile: null,
      comparableMultipleBps: null,
      comparableMetricMinor: null,
      assetBaseMinor: null,
      dividendCapacityMinor: null,
    }),
    Object.freeze({
      stableSegmentKey: 'seg:semi:Semiconductor',
      method: 'COMPARABLE_MULTIPLES' as const,
      forecast: null,
      profile: Object.freeze({
        stableSegmentKey: 'seg:semi:Semiconductor',
        fiscalPeriod: '2024-Q2',
        revenueMinor: 8_000_000_000_00n,
        operatingIncomeMinor: 2_400_000_000_00n,
        assetsMinor: null,
        capexMinor: null,
        currency: 'USD',
        knowableAt: asUtcInstant('2024-05-02T18:00:00.000Z'),
        sourceObservationRefs: Object.freeze(['sec-edgar:semi-rev']),
      }),
      comparableMultipleBps: 450,
      comparableMetricMinor: 2_400_000_000_00n,
      assetBaseMinor: null,
      dividendCapacityMinor: null,
    }),
    Object.freeze({
      stableSegmentKey: 'seg:industrial:Industrial Automation',
      method: 'ASSET_BASED' as const,
      forecast: null,
      profile: null,
      comparableMultipleBps: null,
      comparableMetricMinor: null,
      assetBaseMinor: 5_500_000_000_00n,
      dividendCapacityMinor: null,
    }),
  ]);
}

export function fixtureSotpValuationInput(): RunSotpValuationInput {
  return Object.freeze({
    valuationId: 'val09-demo-sotp',
    canonicalEntityId: VAL09_FIXTURE_ENTITY_ID,
    evaluationTimeUtc: asUtcInstant(VAL09_FIXTURE_AS_OF),
    currency: 'USD',
    segmentSource: Object.freeze({
      evaluationTimeUtc: asUtcInstant(VAL09_FIXTURE_AS_OF),
      observations: val09FixtureSegmentObservations(),
    }),
    segmentSpecs: val09FixtureSegmentSpecs(),
    intersegmentFlows: Object.freeze([
      Object.freeze({
        flowId: 'is-1',
        kind: 'INTERSEGMENT_REVENUE' as const,
        fromStableSegmentKey: 'seg:semi:Semiconductor',
        toStableSegmentKey: 'seg:cloud:Cloud Services',
        amountMinor: 200_000_000_00n,
        fiscalPeriod: '2024-Q2',
        eliminationApplied: true,
        note: 'Internal chip sales',
      }),
    ]),
    corporateAdjustments: Object.freeze([
      Object.freeze({
        adjustmentId: 'corp-oh',
        kind: 'CORPORATE_OVERHEAD' as const,
        label: 'Unallocated corporate overhead',
        amountMinor: 500_000_000_00n,
        sign: 'SUBTRACT' as const,
        knowableAt: asUtcInstant(VAL09_FIXTURE_AS_OF),
        evidenceRef: 'fixture:corporate-overhead',
      }),
      Object.freeze({
        adjustmentId: 'net-debt',
        kind: 'NET_DEBT' as const,
        label: 'Net debt',
        amountMinor: 3_000_000_000_00n,
        sign: 'SUBTRACT' as const,
        knowableAt: asUtcInstant(VAL09_FIXTURE_AS_OF),
        evidenceRef: 'fixture:net-debt',
      }),
      Object.freeze({
        adjustmentId: 'nci',
        kind: 'NON_CONTROLLING_INTEREST' as const,
        label: 'Non-controlling interests',
        amountMinor: 400_000_000_00n,
        sign: 'SUBTRACT' as const,
        knowableAt: asUtcInstant(VAL09_FIXTURE_AS_OF),
        evidenceRef: 'fixture:nci',
      }),
    ]),
    sharesOutstandingMinor: 1_000_000_000n,
    observedConglomerateDiscount: Object.freeze({
      observed: true,
      discountBps: 800,
      peerSetRef: 'peers:multi-industry',
      marketCapMinor: 40_000_000_000_00n,
      sumOfPartsMinor: 43_500_000_000_00n,
      asOfKnowableAt: asUtcInstant(VAL09_FIXTURE_AS_OF),
      notAppliedToIntrinsic: true,
      researchOnly: true,
    }),
  });
}
