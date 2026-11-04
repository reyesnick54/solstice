/**
 * HELIOS EARN04 — analyst expectation dynamics types.
 */

import type { UtcInstant } from '@solstice/domain';
import type {
  ANALYST_RESPONSIVENESS,
  HELIOS_EARN04_ANALYST_EXPECTATIONS_AUTHORITY,
  HELIOS_EARN04_ANALYST_EXPECTATIONS_SCHEMA,
  HELIOS_EARN04_DATA_PLANE,
} from './taxonomy.ts';

export type { EarningsForecastMetric, FiscalPeriodRef } from './taxonomy.ts';
import type { EarningsForecastMetric, FiscalPeriodRef } from './taxonomy.ts';

export type AnalystForecastSourceRef = {
  readonly providerId: typeof HELIOS_EARN04_DATA_PLANE;
  readonly documentId: string;
  readonly excerptHash: string | null;
};

/** Point-in-time analyst forecast observation. */
export type AnalystForecast = {
  readonly forecastId: string;
  readonly securityId: string;
  readonly issuedAt: UtcInstant;
  readonly providerPublishedAt: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly fiscalPeriod: FiscalPeriodRef;
  readonly metric: EarningsForecastMetric;
  readonly value: number;
  readonly analystId: string | null;
  readonly revisionOf: string | null;
  readonly sourceRef: AnalystForecastSourceRef;
  readonly horizonDays: number;
};

export type AnalystIdentity = {
  readonly analystId: string;
  readonly displayName: string | null;
  readonly firmId: string | null;
  readonly firmName: string | null;
  readonly licensedIdentityAvailable: boolean;
};

export type AnalystForecastRevision = {
  readonly revisionId: string;
  readonly priorForecastId: string;
  readonly revisedForecastId: string;
  readonly analystId: string | null;
  readonly metric: EarningsForecastMetric;
  readonly fiscalPeriod: FiscalPeriodRef;
  readonly priorValue: number;
  readonly revisedValue: number;
  readonly delta: number;
  readonly revisedAt: UtcInstant;
  readonly knowableAt: UtcInstant;
};

export type AnalystTrackRecord = {
  readonly analystId: string;
  readonly pastAbsoluteError: number;
  readonly pastDirectionalAccuracy: number;
  readonly sectorAccuracy: number;
  readonly firmSpecificAccuracy: number;
  readonly recencyWeightedAccuracy: number;
  readonly forecastHorizonAccuracy: number;
  readonly sampleCount: number;
  readonly computedAsOf: UtcInstant;
};

export type ConsensusSnapshot = {
  readonly securityId: string;
  readonly fiscalPeriod: FiscalPeriodRef;
  readonly metric: EarningsForecastMetric;
  readonly asOf: UtcInstant;
  readonly consensusMean: number;
  readonly consensusMedian: number;
  readonly trimmedMean: number;
  readonly forecastCount: number;
  readonly dispersion: number;
  readonly interquartileRange: number;
  readonly forecastRange: { readonly min: number; readonly max: number };
  readonly freshForecastCount: number;
  readonly staleForecastCount: number;
};

export type ConsensusRevisionState = {
  readonly revisionBreadth: number;
  readonly revisionMagnitude: number;
  readonly revisionVelocity: number;
  readonly revisionAcceleration: number;
  readonly upwardRevisionShare: number;
  readonly downwardRevisionShare: number;
  readonly daysSinceLastRevision: number | null;
  readonly consensusMomentum: number;
  readonly consensusAcceleration: number;
};

export type AnalystResponsiveness = {
  readonly kind: typeof ANALYST_RESPONSIVENESS;
  readonly securityId: string;
  readonly fiscalPeriod: FiscalPeriodRef;
  readonly metric: EarningsForecastMetric;
  readonly materialEventKnowableAt: UtcInstant;
  readonly medianRevisionLagHours: number | null;
  readonly revisionParticipationRate: number;
  readonly responsivenessScore: number;
  readonly computedAsOf: UtcInstant;
};

export type ForecastDispersionState = {
  readonly currentDispersion: number;
  readonly historicalDispersionSeries: readonly number[];
  readonly volatilityOfDisagreement: number;
  readonly highCurrentDispersion: boolean;
  readonly unstableDispersionOverTime: boolean;
};

export type DynamicExpectationState = {
  readonly schema: typeof HELIOS_EARN04_ANALYST_EXPECTATIONS_SCHEMA;
  readonly authority: typeof HELIOS_EARN04_ANALYST_EXPECTATIONS_AUTHORITY;
  readonly securityId: string;
  readonly fiscalPeriod: FiscalPeriodRef;
  readonly metric: EarningsForecastMetric;
  readonly asOf: UtcInstant;
  readonly consensus: ConsensusSnapshot;
  readonly revisionState: ConsensusRevisionState;
  readonly dispersionState: ForecastDispersionState;
  readonly analystResponsiveness: AnalystResponsiveness | null;
  readonly streetDistribution: StreetExpectationDistribution;
  readonly grantsExecutionAuthority: false;
  readonly grantsFinancialMutation: false;
  readonly dataPlane: typeof HELIOS_EARN04_DATA_PLANE;
};

export type StreetExpectationDistribution = {
  readonly mean: number;
  readonly median: number;
  readonly robustLocation: number;
  readonly dispersion: number;
  readonly confidenceInterval: { readonly lower: number; readonly upper: number; readonly level: number };
  readonly breadth: number;
  readonly revisionState: ConsensusRevisionState;
  readonly uncertainty: number;
};

export type ResolvedForecastOutcome = {
  readonly securityId: string;
  readonly fiscalPeriod: FiscalPeriodRef;
  readonly metric: EarningsForecastMetric;
  readonly realizedValue: number;
  readonly knowableAt: UtcInstant;
};

export type MaterialCompanyInformationEvent = {
  readonly eventId: string;
  readonly securityId: string;
  readonly knowableAt: UtcInstant;
  readonly label: string;
};
