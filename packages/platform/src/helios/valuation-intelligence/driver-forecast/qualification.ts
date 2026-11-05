/**
 * VAL02 qualification — HELIOS_VAL02_DRIVER_FORECAST_QUALIFIED
 */

import {
  HELIOS_VAL02_DRIVER_FORECAST_BLOCKED,
  HELIOS_VAL02_DRIVER_FORECAST_QUALIFIED,
} from './taxonomy.ts';
import type { DriverForecastResult } from './types.ts';

export { HELIOS_VAL02_DRIVER_FORECAST_BLOCKED, HELIOS_VAL02_DRIVER_FORECAST_QUALIFIED };

export type Val02DriverForecastQualificationChecks = {
  readonly driverTreesNotEpsExtrapolation: boolean;
  readonly segmentOrGeoDriversPresent: boolean;
  readonly threeHorizonBands: boolean;
  readonly probabilityDistributionsPerPeriod: boolean;
  readonly correlationsDeclared: boolean;
  readonly economicConstraintsEnforced: boolean;
  readonly cashFlowLinesComplete: boolean;
  readonly noExecutionAuthority: boolean;
  readonly researchOnly: boolean;
};

export type Val02DriverForecastQualificationResult = {
  readonly marker:
    | typeof HELIOS_VAL02_DRIVER_FORECAST_QUALIFIED
    | typeof HELIOS_VAL02_DRIVER_FORECAST_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateVal02DriverForecastQualification(
  checks: Val02DriverForecastQualificationChecks,
): Val02DriverForecastQualificationResult {
  const entries: [keyof Val02DriverForecastQualificationChecks, string][] = [
    ['driverTreesNotEpsExtrapolation', 'driver_trees_not_eps_extrapolation'],
    ['segmentOrGeoDriversPresent', 'segment_or_geo_drivers'],
    ['threeHorizonBands', 'three_horizon_bands'],
    ['probabilityDistributionsPerPeriod', 'probability_distributions'],
    ['correlationsDeclared', 'correlations_declared'],
    ['economicConstraintsEnforced', 'economic_constraints'],
    ['cashFlowLinesComplete', 'cash_flow_lines'],
    ['noExecutionAuthority', 'no_execution_authority'],
    ['researchOnly', 'research_only'],
  ];
  const blockers = entries.filter(([key]) => !checks[key]).map(([, label]) => label);
  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified ? HELIOS_VAL02_DRIVER_FORECAST_QUALIFIED : HELIOS_VAL02_DRIVER_FORECAST_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}

export function qualificationChecksFromForecast(
  forecast: DriverForecastResult,
  segmentOrGeoPresent: boolean,
): Val02DriverForecastQualificationChecks {
  const firstPeriod = forecast.periods[0];
  const lines = firstPeriod?.lineItems;
  const cashFlowComplete =
    lines !== undefined &&
    lines.revenue !== undefined &&
    lines.fcff !== undefined &&
    lines.fcfe !== undefined &&
    lines.shareCount !== undefined &&
    lines.netDebt !== undefined;

  const constraintsEnforced = forecast.periods.some((period) => period.rejectedPathCount >= 0);

  return Object.freeze({
    driverTreesNotEpsExtrapolation: forecast.driverTreesUsed && !forecast.epsExtrapolationOnly,
    segmentOrGeoDriversPresent: segmentOrGeoPresent,
    threeHorizonBands: forecast.horizonBands.length === 3,
    probabilityDistributionsPerPeriod:
      forecast.periods.length > 0 &&
      forecast.periods.every((period) => period.lineItems.revenue.p50 > 0 && period.feasiblePathCount > 0),
    correlationsDeclared: forecast.correlationFactors.length >= 4,
    economicConstraintsEnforced: constraintsEnforced,
    cashFlowLinesComplete: cashFlowComplete === true,
    noExecutionAuthority: forecast.grantsExecutionAuthority === false,
    researchOnly: forecast.researchOnly === true,
  });
}
