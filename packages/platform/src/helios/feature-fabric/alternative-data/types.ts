import type { UtcInstant } from '@solstice/domain';
import type { RevisionPolicy, TemporalObservation } from '../temporal-types.ts';
import type {
  AlternativeDataFeature,
  AlternativeDataObservation,
  AlternativeDataCoverageState,
} from '../../alternative-data-intelligence/types.ts';
import type { HELIOS_ALT01_FEATURE_FABRIC_SCHEMA } from './taxonomy.ts';

export type PointInTimeAlternativeDataFeaturePlane = {
  readonly schema: typeof HELIOS_ALT01_FEATURE_FABRIC_SCHEMA;
  readonly evaluationTime: UtcInstant;
  readonly revisionPolicy: RevisionPolicy;
  readonly observations: readonly AlternativeDataObservation[];
  readonly features: readonly AlternativeDataFeature[];
  readonly temporalObservations: readonly TemporalObservation[];
  readonly coverageStates: readonly AlternativeDataCoverageState[];
  readonly grantsExecutionAuthority: false;
};
