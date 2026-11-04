/**
 * EARN04 simulation fixtures — not licensed analyst data.
 */

import type { UtcInstant } from '@solstice/domain';
import type {
  AnalystForecast,
  FiscalPeriodRef,
  MaterialCompanyInformationEvent,
  ResolvedForecastOutcome,
} from './types.ts';
import { HELIOS_EARN04_DATA_PLANE } from './taxonomy.ts';
import { buildConsensusSnapshot } from './consensus.ts';

export const FIXTURE_SECURITY_ID = 'SECURITY:US:AAPL:XNAS' as const;
export const FIXTURE_SECTOR_BY_SECURITY: Readonly<Record<string, string>> = Object.freeze({
  [FIXTURE_SECURITY_ID]: 'technology',
});

export const FIXTURE_FY26Q1: FiscalPeriodRef = Object.freeze({
  fiscalYear: 2026,
  fiscalQuarter: 1,
  periodLabel: 'FY2026-Q1',
});

function sourceRef(documentId: string): AnalystForecast['sourceRef'] {
  return Object.freeze({
    providerId: HELIOS_EARN04_DATA_PLANE,
    documentId,
    excerptHash: `fixture_${documentId}`,
  });
}

export function fixtureAnalystForecasts(): AnalystForecast[] {
  const base = '2026-01-10T14:00:00.000Z' as UtcInstant;
  const analysts = [
    { id: 'analyst.goldman.jlee', eps: 1.42 },
    { id: 'analyst.morgan.rkim', eps: 1.38 },
    { id: 'analyst.jpm.spatel', eps: 1.45 },
    { id: 'analyst.ubs.mchen', eps: 1.36 },
    { id: 'analyst.barclays.tross', eps: 1.41 },
    { id: 'analyst.citi.awong', eps: 1.33 },
  ];

  return analysts.map((a, i) =>
    Object.freeze({
      forecastId: `fcst.aapl.fy26q1.${i}`,
      securityId: FIXTURE_SECURITY_ID,
      issuedAt: base,
      providerPublishedAt: base,
      knowableAt: base,
      fiscalPeriod: FIXTURE_FY26Q1,
      metric: 'eps_diluted' as const,
      value: a.eps,
      analystId: a.id,
      revisionOf: null,
      sourceRef: sourceRef(`init-${i}`),
      horizonDays: 45,
    }),
  );
}

export function fixtureRevisionWave(asOf: UtcInstant): AnalystForecast[] {
  const initial = fixtureAnalystForecasts();
  const eventKnowable = '2026-01-15T21:00:00.000Z' as UtcInstant;
  const revisions: AnalystForecast[] = [
    Object.freeze({
      forecastId: 'fcst.aapl.fy26q1.rev0',
      securityId: FIXTURE_SECURITY_ID,
      issuedAt: '2026-01-16T13:00:00.000Z' as UtcInstant,
      providerPublishedAt: '2026-01-16T13:00:00.000Z' as UtcInstant,
      knowableAt: '2026-01-16T13:30:00.000Z' as UtcInstant,
      fiscalPeriod: FIXTURE_FY26Q1,
      metric: 'eps_diluted',
      value: 1.48,
      analystId: 'analyst.goldman.jlee',
      revisionOf: 'fcst.aapl.fy26q1.0',
      sourceRef: sourceRef('rev-goldman'),
      horizonDays: 40,
    }),
    Object.freeze({
      forecastId: 'fcst.aapl.fy26q1.rev1',
      securityId: FIXTURE_SECURITY_ID,
      issuedAt: '2026-01-16T15:00:00.000Z' as UtcInstant,
      providerPublishedAt: '2026-01-16T15:00:00.000Z' as UtcInstant,
      knowableAt: '2026-01-16T15:30:00.000Z' as UtcInstant,
      fiscalPeriod: FIXTURE_FY26Q1,
      metric: 'eps_diluted',
      value: 1.44,
      analystId: 'analyst.morgan.rkim',
      revisionOf: 'fcst.aapl.fy26q1.1',
      sourceRef: sourceRef('rev-morgan'),
      horizonDays: 40,
    }),
    Object.freeze({
      forecastId: 'fcst.aapl.fy26q1.rev2',
      securityId: FIXTURE_SECURITY_ID,
      issuedAt: '2026-01-17T12:00:00.000Z' as UtcInstant,
      providerPublishedAt: '2026-01-17T12:00:00.000Z' as UtcInstant,
      knowableAt: asOf,
      fiscalPeriod: FIXTURE_FY26Q1,
      metric: 'eps_diluted',
      value: 1.31,
      analystId: 'analyst.citi.awong',
      revisionOf: 'fcst.aapl.fy26q1.5',
      sourceRef: sourceRef('rev-citi-down'),
      horizonDays: 38,
    }),
  ];

  void eventKnowable;
  return [...initial, ...revisions];
}

export function fixtureMaterialGuidanceEvent(): MaterialCompanyInformationEvent {
  return Object.freeze({
    eventId: 'mat.aapl.guidance.preprint',
    securityId: FIXTURE_SECURITY_ID,
    knowableAt: '2026-01-15T21:00:00.000Z' as UtcInstant,
    label: 'Preliminary demand commentary (fixture)',
  });
}

export function fixtureHistoricalOutcomes(): ResolvedForecastOutcome[] {
  return Object.freeze([
    Object.freeze({
      securityId: FIXTURE_SECURITY_ID,
      fiscalPeriod: Object.freeze({
        fiscalYear: 2025,
        fiscalQuarter: 4,
        periodLabel: 'FY2025-Q4',
      }),
      metric: 'eps_diluted',
      realizedValue: 1.29,
      knowableAt: '2025-10-30T20:00:00.000Z' as UtcInstant,
    }),
    Object.freeze({
      securityId: FIXTURE_SECURITY_ID,
      fiscalPeriod: Object.freeze({
        fiscalYear: 2025,
        fiscalQuarter: 3,
        periodLabel: 'FY2025-Q3',
      }),
      metric: 'eps_diluted',
      realizedValue: 1.24,
      knowableAt: '2025-07-31T20:00:00.000Z' as UtcInstant,
    }),
  ]) as ResolvedForecastOutcome[];
}

export function fixtureHistoricalConsensusSnapshots(asOf: UtcInstant): import('./types.ts').ConsensusSnapshot[] {
  const periods = [
    { label: 'FY2025-Q2', eps: [1.18, 1.2, 1.22, 1.17, 1.19] },
    { label: 'FY2025-Q3', eps: [1.21, 1.25, 1.23, 1.19, 1.27, 1.22] },
    { label: 'FY2025-Q4', eps: [1.26, 1.28, 1.31, 1.24, 1.29] },
  ];

  return periods.map((p, idx) => {
    const knowable = new Date(Date.parse(asOf) - (periods.length - idx) * 86_400_000 * 30).toISOString() as UtcInstant;
    const forecasts = p.eps.map((value, i) =>
      Object.freeze({
        forecastId: `hist.${p.label}.${i}`,
        securityId: FIXTURE_SECURITY_ID,
        issuedAt: knowable,
        providerPublishedAt: knowable,
        knowableAt: knowable,
        fiscalPeriod: Object.freeze({
          fiscalYear: 2025,
          fiscalQuarter: ((idx + 2) as 1 | 2 | 3 | 4),
          periodLabel: p.label,
        }),
        metric: 'eps_diluted' as const,
        value,
        analystId: `analyst.hist.${i}`,
        revisionOf: null,
        sourceRef: sourceRef(`hist-${p.label}-${i}`),
        horizonDays: 60,
      }),
    );
    const snap = buildConsensusSnapshot({
      securityId: FIXTURE_SECURITY_ID,
      fiscalPeriod: forecasts[0]!.fiscalPeriod,
      metric: 'eps_diluted',
      forecasts,
      asOf: knowable,
    });
    return snap!;
  });
}
