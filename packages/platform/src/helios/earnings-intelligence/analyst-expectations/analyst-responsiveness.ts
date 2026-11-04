/**
 * ANALYST_RESPONSIVENESS — revision speed after material company information.
 */

import { ANALYST_RESPONSIVENESS } from './taxonomy.ts';
import type {
  AnalystForecast,
  AnalystResponsiveness,
  MaterialCompanyInformationEvent,
  FiscalPeriodRef,
  EarningsForecastMetric,
} from './types.ts';
import { detectForecastRevisions } from './revision-intelligence.ts';
import { filterKnowableForecasts } from './consensus.ts';
import { median } from './statistics.ts';
import type { UtcInstant } from '@solstice/domain';

export function measureAnalystResponsiveness(input: {
  readonly securityId: string;
  readonly fiscalPeriod: FiscalPeriodRef;
  readonly metric: EarningsForecastMetric;
  readonly forecasts: readonly AnalystForecast[];
  readonly materialEvent: MaterialCompanyInformationEvent;
  readonly asOf: UtcInstant;
  readonly responseWindowHours?: number;
}): AnalystResponsiveness | null {
  const windowHours = input.responseWindowHours ?? 72;
  const eventMs = Date.parse(input.materialEvent.knowableAt);
  if (Date.parse(input.asOf) < eventMs) return null;

  const pit = filterKnowableForecasts(input.forecasts, input.asOf);
  const scoped = pit.filter(
    (f) =>
      f.securityId === input.securityId
      && f.metric === input.metric
      && f.fiscalPeriod.periodLabel === input.fiscalPeriod.periodLabel,
  );

  const revisions = detectForecastRevisions(scoped).filter((r) => {
    const lagMs = Date.parse(r.knowableAt) - eventMs;
    return lagMs >= 0 && lagMs <= windowHours * 3_600_000;
  });

  const analystsBefore = new Set(
    scoped
      .filter((f) => Date.parse(f.knowableAt) < eventMs && f.analystId)
      .map((f) => f.analystId as string),
  );
  if (analystsBefore.size === 0) return null;

  const participating = new Set(
    revisions.map((r) => r.analystId).filter((id): id is string => id !== null),
  );
  const revisionParticipationRate = participating.size / analystsBefore.size;

  const lagHours = revisions.map((r) => (Date.parse(r.knowableAt) - eventMs) / 3_600_000);
  const medianRevisionLagHours = lagHours.length > 0 ? median(lagHours) : null;

  const responsivenessScore =
    medianRevisionLagHours === null
      ? 0
      : Math.max(0, Math.min(1, 1 - medianRevisionLagHours / windowHours)) * revisionParticipationRate;

  return Object.freeze({
    kind: ANALYST_RESPONSIVENESS,
    securityId: input.securityId,
    fiscalPeriod: input.fiscalPeriod,
    metric: input.metric,
    materialEventKnowableAt: input.materialEvent.knowableAt,
    medianRevisionLagHours,
    revisionParticipationRate,
    responsivenessScore,
    computedAsOf: input.asOf,
  });
}
