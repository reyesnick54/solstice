import type { UtcInstant } from '@solstice/domain';
import type { ValuationFeatureId, HELIOS_VALUATION_FEATURE_PLANE_SCHEMA } from './taxonomy.ts';

export type ValuationFeatureValue = {
  readonly featureId: ValuationFeatureId;
  readonly valueMinor: bigint | null;
  readonly ratioDecimal: string | null;
  readonly knowableAt: UtcInstant;
  readonly evidenceRef: string | null;
};

export type ValuationFeaturePlaneSnapshot = {
  readonly schema: typeof HELIOS_VALUATION_FEATURE_PLANE_SCHEMA;
  readonly evaluationTime: UtcInstant;
  readonly canonicalEntityId: string;
  readonly manifestId: string;
  readonly features: readonly ValuationFeatureValue[];
};
