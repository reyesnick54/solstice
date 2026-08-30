/**
 * Wave 2 Prompt 8 — canonical macroeconomic domain models.
 */

import type { ExternalObservation } from '../../../provider-sdk/src/types.ts';

export const MACRO_INDICATOR_FREQUENCIES = [
  'annual',
  'quarterly',
  'monthly',
  'weekly',
  'daily',
  'intraday',
  'unknown',
] as const;
export type MacroIndicatorFrequency = (typeof MACRO_INDICATOR_FREQUENCIES)[number];

export const MACRO_REVISION_STATUSES = ['preliminary', 'revised', 'final', 'unknown'] as const;
export type MacroRevisionStatus = (typeof MACRO_REVISION_STATUSES)[number];

export const MACRO_SEASONAL_ADJUSTMENTS = [
  'seasonally_adjusted',
  'not_adjusted',
  'unknown',
] as const;
export type MacroSeasonalAdjustment = (typeof MACRO_SEASONAL_ADJUSTMENTS)[number];

export type MacroIndicator = {
  readonly indicatorId: string;
  readonly name: string;
  readonly description: string | null;
  readonly value: number | null;
  readonly unit: string | null;
  readonly frequency: MacroIndicatorFrequency;
  readonly country: string | null;
  readonly region: string | null;
  readonly currency: string | null;
  readonly period: string | null;
  readonly effectiveDate: string | null;
  readonly releaseDate: string | null;
  readonly revisionStatus: MacroRevisionStatus;
  readonly seasonalAdjustment: MacroSeasonalAdjustment;
  readonly sourceObservation: ExternalObservation<unknown> | null;
};

export type MacroTimeSeriesPoint = {
  readonly period: string;
  readonly effectiveDate: string | null;
  readonly value: number | null;
  readonly revisionStatus: MacroRevisionStatus;
};

export type MacroTimeSeries = {
  readonly indicatorId: string;
  readonly name: string;
  readonly country: string | null;
  readonly frequency: MacroIndicatorFrequency;
  readonly unit: string | null;
  readonly points: readonly MacroTimeSeriesPoint[];
  readonly sourceObservation: ExternalObservation<unknown> | null;
};

export type MacroCountrySnapshot = {
  readonly country: string;
  readonly asOf: string;
  readonly indicators: readonly MacroIndicator[];
  readonly stale: boolean;
  readonly degraded: boolean;
  readonly warnings: readonly string[];
};

export type MacroGlobalSnapshot = {
  readonly asOf: string;
  readonly countries: readonly MacroCountrySnapshot[];
  readonly stale: boolean;
  readonly degraded: boolean;
  readonly warnings: readonly string[];
};

export type MacroProviderCoverage = {
  readonly providerId: string;
  readonly indicators: readonly string[];
  readonly countries: readonly string[];
  readonly capabilities: readonly string[];
  readonly healthy: boolean;
};

export type MacroServiceResult<T> = {
  readonly data: T;
  readonly providerId: string;
  readonly stale: boolean;
  readonly degraded: boolean;
  readonly warnings: readonly string[];
};
