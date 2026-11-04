import type { UtcInstant } from '@solstice/domain';
import type { FeatureQualityState } from '../types.ts';
import type { EarningsFeatureId, HELIOS_EARNINGS_FEATURE_PLANE_SCHEMA } from './taxonomy.ts';

export type EarningsFeatureValue = {
  readonly featureId: EarningsFeatureId;
  readonly formulaVersion: string;
  readonly valueMinor: bigint | null;
  readonly valueText: string | null;
  readonly knowableAt: UtcInstant;
  readonly quality: FeatureQualityState;
  readonly observationRefs: readonly string[];
  readonly grantsExecutionAuthority: false;
};

export type EarningsFeaturePlaneSnapshot = {
  readonly schema: typeof HELIOS_EARNINGS_FEATURE_PLANE_SCHEMA;
  readonly canonicalEntityId: string;
  readonly canonicalInstrumentId: string | null;
  readonly evaluationTimeUtc: UtcInstant;
  readonly features: readonly EarningsFeatureValue[];
  readonly grantsExecutionAuthority: false;
};
