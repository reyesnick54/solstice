import type { AlternativeDataIntelligencePlane } from './types.ts';

export type AdaptiveAlphaAltDataContext = {
  readonly featureCount: number;
  readonly observationCount: number;
  readonly coverageTensorDigests: readonly string[];
  readonly authorityClass: 'REFERENCE_AND_RESEARCH_ONLY';
  readonly grantsExecutionAuthority: false;
};

export function alternativeDataPlaneToAdaptiveAlphaContext(
  plane: AlternativeDataIntelligencePlane,
): AdaptiveAlphaAltDataContext {
  return Object.freeze({
    featureCount: plane.features.length,
    observationCount: plane.observations.length,
    coverageTensorDigests: Object.freeze(
      plane.coverageStates.map((row) => row.tensorDigest).filter((row): row is string => row !== null),
    ),
    authorityClass: 'REFERENCE_AND_RESEARCH_ONLY',
    grantsExecutionAuthority: false,
  });
}
