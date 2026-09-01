/**
 * Wave 7 — final provider program classification models.
 */

export const WAVE7_PROGRAM_STATUSES = [
  'IMPLEMENTED_ACTIVE',
  'IMPLEMENTED_PREVIEW_ONLY',
  'IMPLEMENTED_BLOCKED',
  'DEPRECATED',
  'UNAVAILABLE',
  'NOT_FREE_ANYMORE',
  'LEGAL_REVIEW_REQUIRED',
  'MISSING_IMPLEMENTATION',
] as const;

export type Wave7ProgramStatus = (typeof WAVE7_PROGRAM_STATUSES)[number];

export type Wave7ProviderCoverage = {
  readonly providerId: string;
  readonly category: string;
  readonly status: Wave7ProgramStatus;
  readonly certificationStatus: string;
  readonly liveValidated: boolean;
  readonly simulated: boolean;
  readonly adapterId: string | null;
  readonly environment: 'simulation';
  readonly authRequired: boolean;
  readonly commercialStatus: string;
  readonly canonicalService: string | null;
  readonly notes: string;
};

export type Wave7CoverageSummary = Record<Wave7ProgramStatus, number>;

export type Wave7CoverageReport = {
  readonly catalogTotal: number;
  readonly expectedTotal: number;
  readonly providers: readonly Wave7ProviderCoverage[];
  readonly summary: Wave7CoverageSummary;
  readonly byCategory: Readonly<Record<string, number>>;
  readonly acceptedProgramGaps: number;
  readonly programTotalAccounted: number;
};

export const TRUST_ENGINE_OUTCOMES = ['AGREEMENT', 'LOW_CONFIDENCE', 'CONFLICTED', 'UNAVAILABLE'] as const;
export type TrustEngineOutcome = (typeof TRUST_ENGINE_OUTCOMES)[number];

export type TrustEngineResult<T> = {
  readonly outcome: TrustEngineOutcome;
  readonly value: T | null;
  readonly contributingProviders: readonly string[];
  readonly notes: string;
};
