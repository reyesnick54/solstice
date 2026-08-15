import { type Brand, brandAs } from '../../domain/src/brand.ts';

export type RegulatoryTwinId = Brand<string, 'RegulatoryTwinId'>;
export type RegulatoryScenarioId = Brand<string, 'RegulatoryScenarioId'>;
export type ScenarioRunId = Brand<string, 'ScenarioRunId'>;
export type RegulatorySnapshotId = Brand<string, 'RegulatorySnapshotId'>;
export type CandidatePolicySetId = Brand<string, 'CandidatePolicySetId'>;
export type ImpactReportId = Brand<string, 'ImpactReportId'>;
export type RegulatoryAssumptionId = Brand<string, 'RegulatoryAssumptionId'>;
export type RegulatoryReadinessAssessmentId = Brand<string, 'RegulatoryReadinessAssessmentId'>;
export type RegulatoryScenarioSuiteId = Brand<string, 'RegulatoryScenarioSuiteId'>;
export type ReadinessReviewId = Brand<string, 'ReadinessReviewId'>;
export type OpaqueSubjectRef = Brand<string, 'OpaqueSubjectRef'>;

const PREFIX = {
  RegulatoryTwinId: 'rtw_',
  RegulatoryScenarioId: 'rsc_',
  ScenarioRunId: 'rrn_',
  RegulatorySnapshotId: 'rsn_',
  CandidatePolicySetId: 'cps_',
  ImpactReportId: 'rir_',
  RegulatoryAssumptionId: 'ras_',
  RegulatoryReadinessAssessmentId: 'rra_',
  RegulatoryScenarioSuiteId: 'rss_',
  ReadinessReviewId: 'rrv_',
  OpaqueSubjectRef: 'osr_',
} as const;

function brandPrefixed<Name extends keyof typeof PREFIX>(
  value: string,
  name: Name,
): Brand<string, Name> {
  if (value.length === 0 || !value.startsWith(PREFIX[name])) {
    throw new TypeError(`${name} must start with ${PREFIX[name]}`);
  }
  return brandAs<string, Name>(value);
}

export function asRegulatoryTwinId(value: string): RegulatoryTwinId {
  return brandPrefixed(value, 'RegulatoryTwinId');
}

export function asRegulatoryScenarioId(value: string): RegulatoryScenarioId {
  return brandPrefixed(value, 'RegulatoryScenarioId');
}

export function asScenarioRunId(value: string): ScenarioRunId {
  return brandPrefixed(value, 'ScenarioRunId');
}

export function asRegulatorySnapshotId(value: string): RegulatorySnapshotId {
  return brandPrefixed(value, 'RegulatorySnapshotId');
}

export function asCandidatePolicySetId(value: string): CandidatePolicySetId {
  return brandPrefixed(value, 'CandidatePolicySetId');
}

export function asImpactReportId(value: string): ImpactReportId {
  return brandPrefixed(value, 'ImpactReportId');
}

export function asRegulatoryAssumptionId(value: string): RegulatoryAssumptionId {
  return brandPrefixed(value, 'RegulatoryAssumptionId');
}

export function asRegulatoryReadinessAssessmentId(
  value: string,
): RegulatoryReadinessAssessmentId {
  return brandPrefixed(value, 'RegulatoryReadinessAssessmentId');
}

export function asRegulatoryScenarioSuiteId(value: string): RegulatoryScenarioSuiteId {
  return brandPrefixed(value, 'RegulatoryScenarioSuiteId');
}

export function asReadinessReviewId(value: string): ReadinessReviewId {
  return brandPrefixed(value, 'ReadinessReviewId');
}

export function asOpaqueSubjectRef(value: string): OpaqueSubjectRef {
  return brandPrefixed(value, 'OpaqueSubjectRef');
}

export const REGULATORY_ID_PREFIXES = PREFIX;
