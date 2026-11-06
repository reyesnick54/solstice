/**
 * VAL09 — sum-of-the-parts valuation engine.
 */

import { computeObservedConglomerateDiscountState } from './conglomerate-discount.ts';
import { buildCorporateAdjustmentBridge } from './corporate-bridge.ts';
import { buildSegmentContributionMap, computeSegmentValueConcentration } from './contribution.ts';
import {
  perSegmentIntersegmentAdjustment,
  reconcileIntersegmentFlows,
} from './intersegment.ts';
import {
  bindSegmentIdentities,
  filterKnowableSegmentObservations,
  resolveStableKeyAtEvaluation,
} from './segment-identity.ts';
import { valueSegment } from './segment-valuation.ts';
import {
  HELIOS_VAL09_SOTP_QUALIFIED,
  VAL09_SOTP_SCHEMA,
} from './taxonomy.ts';
import type {
  RunSotpValuationInput,
  SotpIntrinsicValueDistribution,
  SotpValuation,
} from './types.ts';

export function runSotpValuationEngine(input: RunSotpValuationInput): SotpValuation {
  const knowableSegments = filterKnowableSegmentObservations(
    input.segmentSource.observations,
    input.evaluationTimeUtc,
  );
  const segments = bindSegmentIdentities(knowableSegments);

  const intersegment = reconcileIntersegmentFlows(input.intersegmentFlows);

  const segmentValuations = input.segmentSpecs.map((spec) => {
    const intersegmentAdj = perSegmentIntersegmentAdjustment(input.intersegmentFlows, spec.stableSegmentKey);
    return valueSegment(spec, input.currency, intersegmentAdj);
  });

  const contributionMap = buildSegmentContributionMap(segmentValuations);
  const concentration = computeSegmentValueConcentration(contributionMap);

  const segmentSubtotal = contributionMap.totalEnterpriseValueMinor;
  const corporateBridge = buildCorporateAdjustmentBridge(segmentSubtotal, input.corporateAdjustments);

  const fundamentalIntrinsic = corporateBridge.bridgedEquityMinor;

  const observed =
    input.observedConglomerateDiscount ??
    computeObservedConglomerateDiscountState({
      peerSetRef: null,
      marketCapMinor: null,
      sumOfPartsMinor: fundamentalIntrinsic,
      asOfKnowableAt: input.evaluationTimeUtc,
    });

  const valuePerShare =
    input.sharesOutstandingMinor && input.sharesOutstandingMinor > 0n
      ? fundamentalIntrinsic / input.sharesOutstandingMinor
      : null;

  const segmentMedians = segmentValuations.map((row) => Number(row.distribution.medianMinor));
  segmentMedians.sort((a, b) => a - b);
  const pick = (pct: number) =>
    BigInt(Math.round(segmentMedians[Math.min(segmentMedians.length - 1, Math.max(0, Math.floor(pct * segmentMedians.length)))] ?? Number(fundamentalIntrinsic)));

  const intrinsicDistribution: SotpIntrinsicValueDistribution = Object.freeze({
    currency: input.currency,
    enterpriseValueMinor: segmentSubtotal,
    equityValueMinor: fundamentalIntrinsic,
    valuePerShareMinor: valuePerShare,
    p05Minor: pick(0.05),
    p25Minor: pick(0.25),
    medianMinor: fundamentalIntrinsic,
    p75Minor: pick(0.75),
    p95Minor: pick(0.95),
    segmentCount: segmentValuations.length,
    notAFact: true,
    researchOnly: true,
    grantsExecutionAuthority: false,
  });

  return Object.freeze({
    schema: VAL09_SOTP_SCHEMA,
    valuationId: input.valuationId,
    canonicalEntityId: input.canonicalEntityId,
    evaluationTimeUtc: input.evaluationTimeUtc,
    segments,
    segmentValuations,
    intrinsicDistribution,
    contributionMap,
    concentration,
    bridge: Object.freeze({
      segmentSubtotalEnterpriseMinor: segmentSubtotal,
      intersegmentEliminationsMinor: intersegment.eliminationTotalMinor,
      corporateBridge,
      fundamentalIntrinsicMinor: fundamentalIntrinsic,
      observedConglomerateDiscount: observed,
    }),
    intersegmentFlows: intersegment.flows,
    qualificationMarker: HELIOS_VAL09_SOTP_QUALIFIED,
    grantsExecutionAuthority: false,
    researchOnly: true,
  });
}

export { resolveStableKeyAtEvaluation, filterKnowableSegmentObservations, bindSegmentIdentities };
