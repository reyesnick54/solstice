/**
 * HELIOS ALT10 — adversarial qualification harness (fixture timeline).
 */

import { asUtcInstant } from '@solstice/domain';
import {
  ADVERSARIAL_PROCUREMENT_TIMELINE,
  DUPLICATE_AWARD_SUBSIDIARY,
  ENTITY_IDS,
  ingestProcurementObservation,
} from '@solstice/external-data';

import { assertNoFutureProcurementLeak } from './knowable-at.ts';
import { parentDoesNotInheritJvCeiling } from './attribution-guard.ts';
import { computeGovernmentDemandFeatures } from './features.ts';
import { estimateContractRevenueFromCalibration } from './revenue-conversion.ts';
import { createProcurementIntelligenceService } from './service.ts';
import { evaluateAlt10Qualification, type Alt10QualificationChecks, type Alt10QualificationResult } from './qualification.ts';

export function runAlt10AdversarialChecks(): Alt10QualificationChecks {
  const service = createProcurementIntelligenceService();
  service.ingestMany(ADVERSARIAL_PROCUREMENT_TIMELINE, asUtcInstant('2024-03-01T00:00:00.000Z'));

  const store = service.store();
  const dedupeResult = ingestProcurementObservation(store.list(), DUPLICATE_AWARD_SUBSIDIARY);
  const dedupedCount = dedupeResult.next.filter((row) => row.provenance.dedupeKey === 'award-sub-initial').length;

  const beforeJvAward = service.demandStateAt({
    attributionEntityId: ENTITY_IDS.jointVenture,
    decisionTimeUtc: asUtcInstant('2024-04-30T23:59:59.000Z'),
  });
  const afterJvAward = service.demandStateAt({
    attributionEntityId: ENTITY_IDS.jointVenture,
    decisionTimeUtc: asUtcInstant('2024-05-02T12:00:00.000Z'),
  });

  const parentBeforeFuture = service.demandStateAt({
    attributionEntityId: ENTITY_IDS.parent,
    decisionTimeUtc: asUtcInstant('2024-12-31T23:59:59.000Z'),
  });

  const subsidiaryState = service.demandStateAt({
    attributionEntityId: ENTITY_IDS.subsidiary,
    decisionTimeUtc: asUtcInstant('2024-08-01T12:00:00.000Z'),
  });
  const subsidiaryAfterMod = service.demandStateAt({
    attributionEntityId: ENTITY_IDS.subsidiary,
    decisionTimeUtc: asUtcInstant('2024-07-01T12:00:00.000Z'),
  });

  const parentPit = parentBeforeFuture?.observations ?? [];
  const futureLeak = assertNoFutureProcurementLeak({
    decisionTimeUtc: asUtcInstant('2024-12-31T23:59:59.000Z'),
    observations: parentPit,
  });

  const allAtDecision = service.store().list();

  const jvIsolation = parentDoesNotInheritJvCeiling({
    parentEntityId: ENTITY_IDS.parent,
    jointVentureEntityId: ENTITY_IDS.jointVenture,
    observations: allAtDecision,
  });

  const revenueEstimate = estimateContractRevenueFromCalibration({
    attributionEntityId: ENTITY_IDS.subsidiary,
    sourceObligationMinor: subsidiaryState?.totalObligatedMinor ?? 0n,
    currency: 'USD',
    calibrationWindowStart: '2022-01-01',
    calibrationWindowEnd: '2023-12-31',
    calibrationRows: Object.freeze([
      { fiscalPeriod: 'FY2022', recognizedRevenueMinor: 72_000_000_00n, obligatedMinor: 90_000_000_00n },
      { fiscalPeriod: 'FY2023', recognizedRevenueMinor: 60_000_000_00n, obligatedMinor: 80_000_000_00n },
    ]),
  });

  const ceilingDistinct =
    revenueEstimate !== null &&
    subsidiaryState !== null &&
    revenueEstimate.estimatedRecognizedRevenueMinor !== subsidiaryState.totalAwardCeilingMinor;

  const obligationDistinct =
    revenueEstimate !== null &&
    subsidiaryState !== null &&
    revenueEstimate.estimatedRecognizedRevenueMinor !== subsidiaryState.totalObligatedMinor;

  const featureSnapshot =
    subsidiaryState === null
      ? null
      : computeGovernmentDemandFeatures({
          state: subsidiaryState,
          priorState: subsidiaryAfterMod,
          priorYearState: null,
          normalization: Object.freeze({
            companyRevenueMinor: 2_000_000_00n,
            marketCapMinor: 8_000_000_000_00n,
            existingGovernmentBusinessMinor: 500_000_000_00n,
            currency: 'USD',
          }),
        });

  const normalizationOk =
    featureSnapshot !== null &&
    featureSnapshot.features.every(
      (row) =>
        row.normalizedBy.includes('companyRevenue') &&
        row.normalizedBy.includes('marketCap') &&
        row.normalizedBy.includes('existingGovernmentBusiness'),
    );

  return Object.freeze({
    futureAwardCannotLeak:
      futureLeak.ok &&
      (parentBeforeFuture === null || parentBeforeFuture.activeAwardCount === 0) &&
      beforeJvAward === null,
    jointVentureNotAttributedToParent: jvIsolation && (afterJvAward?.activeAwardCount ?? 0) === 1,
    awardCeilingDistinctFromRevenueEstimate: ceilingDistinct,
    obligationDistinctFromRevenueEstimate: obligationDistinct,
    revenueEstimateRequiresCalibration: revenueEstimate !== null && revenueEstimate.obligationToRevenueFactor > 0,
    duplicateProviderReportsDedupe:
      dedupeResult.result.ok && dedupedCount === 1 && dedupeResult.result.deduplicated === true,
    modificationAppendsWithoutErasingAward:
      subsidiaryAfterMod !== null &&
      subsidiaryAfterMod.totalAwardCeilingMinor === 475_000_000_00n &&
      subsidiaryState !== null &&
      subsidiaryState.totalAwardCeilingMinor === 475_000_000_00n,
    featuresExposeNormalizationDenominators: normalizationOk,
  });
}

export function runAlt10QualificationHarness(): Alt10QualificationResult {
  return evaluateAlt10Qualification(runAlt10AdversarialChecks());
}
