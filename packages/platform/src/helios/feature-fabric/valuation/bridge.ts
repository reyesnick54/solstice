/**
 * Bridge VAL01 valuation evidence manifest into Feature Fabric contribution plane.
 */

import type { UtcInstant } from '@solstice/domain';
import { filterKnowableValuationArtifacts } from '../../valuation-intelligence/knowable-at.ts';
import type { ValuationEvidenceManifest } from '../../valuation-intelligence/val01-canonical-domain.ts';
import { applicableMethodsOnly } from '../../valuation-intelligence/applicability.ts';
import type { ValuationIssuerProfile } from '../../valuation-intelligence/applicability.ts';
import { VALUATION_METHODS } from '../../valuation-intelligence/taxonomy.ts';
import type { ValuationFeaturePlaneSnapshot, ValuationFeatureValue } from './types.ts';
import { HELIOS_VALUATION_FEATURE_PLANE_SCHEMA } from './taxonomy.ts';

export function compileValuationFeaturePlaneFromManifest(input: {
  readonly manifest: ValuationEvidenceManifest;
  readonly issuerProfile: ValuationIssuerProfile;
}): ValuationFeaturePlaneSnapshot | null {
  const snapshot = input.manifest.snapshots[0];
  if (!snapshot) {
    return null;
  }

  const assumptions = filterKnowableValuationArtifacts(
    input.manifest.evaluationTime,
    input.manifest.assumptions,
  );
  const intrinsic = filterKnowableValuationArtifacts(
    input.manifest.evaluationTime,
    input.manifest.intrinsicDistributions,
  )[0];

  const wacc = assumptions.find((row) => row.parameterKey === 'discount_rate.wacc');
  const applicable = applicableMethodsOnly(input.issuerProfile, VALUATION_METHODS);

  const features: ValuationFeatureValue[] = [];

  if (intrinsic) {
    features.push(
      Object.freeze({
        featureId: 'val01.intrinsic_equity_value_minor',
        valueMinor: intrinsic.equityValueMinor,
        ratioDecimal: null,
        knowableAt: intrinsic.knowableAt,
        evidenceRef: input.manifest.manifestId,
      }),
      Object.freeze({
        featureId: 'val01.intrinsic_value_per_share_minor',
        valueMinor:
          intrinsic.equityValueMinor !== null && intrinsic.sharesOutstandingMinor
            ? intrinsic.equityValueMinor / intrinsic.sharesOutstandingMinor
            : null,
        ratioDecimal: null,
        knowableAt: intrinsic.knowableAt,
        evidenceRef: input.manifest.manifestId,
      }),
    );
  }

  features.push(
    Object.freeze({
      featureId: 'val01.applicable_method_count',
      valueMinor: BigInt(applicable.length),
      ratioDecimal: null,
      knowableAt: input.manifest.evaluationTime,
      evidenceRef: input.manifest.manifestId,
    }),
  );

  if (wacc && wacc.value.kind === 'ratio_decimal') {
    features.push(
      Object.freeze({
        featureId: 'val01.wacc_assumption_decimal',
        valueMinor: null,
        ratioDecimal: wacc.value.decimal,
        knowableAt: wacc.knowableAt,
        evidenceRef: wacc.evidenceRefs[0] ?? null,
      }),
    );
  }

  const marketImplied = filterKnowableValuationArtifacts(
    input.manifest.evaluationTime,
    input.manifest.marketImpliedExpectations,
  )[0];
  if (marketImplied?.impliedValueDecimal) {
    features.push(
      Object.freeze({
        featureId: 'val01.market_implied_growth_decimal',
        valueMinor: null,
        ratioDecimal: marketImplied.impliedValueDecimal,
        knowableAt: marketImplied.asOfKnowableAt,
        evidenceRef: marketImplied.expectationId,
      }),
    );
  }

  return Object.freeze({
    schema: HELIOS_VALUATION_FEATURE_PLANE_SCHEMA,
    evaluationTime: input.manifest.evaluationTime,
    canonicalEntityId: snapshot.canonicalEntityId,
    manifestId: input.manifest.manifestId,
    features: Object.freeze(features),
  });
}

export function valuationFeaturePlaneAt(
  evaluationTime: UtcInstant,
  plane: ValuationFeaturePlaneSnapshot,
): ValuationFeaturePlaneSnapshot {
  const features = plane.features.filter((row) => Date.parse(evaluationTime) >= Date.parse(row.knowableAt));
  return Object.freeze({ ...plane, features: Object.freeze(features) });
}
