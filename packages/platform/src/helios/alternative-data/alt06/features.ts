import type { UtcInstant } from '@solstice/domain';
import type {
  AssortmentObservation,
  AvailabilityObservation,
  PriceObservation,
  PromotionObservation,
} from '@solstice/external-data';

import { ALT06_FORMULA_VERSION, type Alt06FeatureId } from './taxonomy.ts';
import type { Alt06ComputedFeature, Alt06FeatureQuality } from './types.ts';

function knowableRows<T extends { readonly provenance: { readonly knowableAt: UtcInstant } }>(
  rows: readonly T[],
  evaluationTime: UtcInstant,
): readonly T[] {
  const cutoff = Date.parse(evaluationTime);
  return Object.freeze(
    rows.filter((row) => {
      const knowable = Date.parse(row.provenance.knowableAt);
      return Number.isFinite(knowable) && Number.isFinite(cutoff) && knowable <= cutoff;
    }),
  );
}

function feature(
  featureId: Alt06FeatureId,
  skuEntityId: string,
  valueMinor: bigint | null,
  valueText: string | null,
  knowableAt: UtcInstant,
  quality: Alt06FeatureQuality,
  observationRefs: readonly string[],
): Alt06ComputedFeature {
  return Object.freeze({
    featureId,
    formulaVersion: ALT06_FORMULA_VERSION,
    skuEntityId,
    valueMinor,
    valueText,
    knowableAt,
    quality,
    observationRefs: Object.freeze([...observationRefs]),
    grantsExecutionAuthority: false,
  });
}

function availabilityScore(state: AvailabilityObservation['state'], units: number | null): bigint {
  switch (state) {
    case 'in_stock':
      return 100n;
    case 'limited':
      return 45n;
    case 'out_of_stock':
      return 0n;
    case 'discontinued':
      return 5n;
    default:
      return 50n;
  }
}

export function computeAlt06Features(input: {
  readonly skuEntityId: string;
  readonly evaluationTime: UtcInstant;
  readonly prices: readonly PriceObservation[];
  readonly availability: readonly AvailabilityObservation[];
  readonly promotions: readonly PromotionObservation[];
  readonly assortments: readonly AssortmentObservation[];
  readonly competitorSkuIds: readonly string[];
  readonly categorySkuIds: readonly string[];
}): readonly Alt06ComputedFeature[] {
  const prices = [...knowableRows(
    input.prices.filter((row) => row.skuEntityId === input.skuEntityId),
    input.evaluationTime,
  )].sort((a, b) => Date.parse(a.provenance.knowableAt) - Date.parse(b.provenance.knowableAt));

  const availability = [...knowableRows(
    input.availability.filter((row) => row.skuEntityId === input.skuEntityId),
    input.evaluationTime,
  )].sort((a, b) => Date.parse(a.provenance.knowableAt) - Date.parse(b.provenance.knowableAt));

  const promotions = knowableRows(
    input.promotions.filter((row) => row.skuEntityId === input.skuEntityId),
    input.evaluationTime,
  );

  const assortments = [...knowableRows(input.assortments, input.evaluationTime)].sort(
    (a, b) => Date.parse(a.provenance.knowableAt) - Date.parse(b.provenance.knowableAt),
  );

  const latestPrice = prices[prices.length - 1];
  const priorPrice = prices.length >= 2 ? prices[prices.length - 2] : null;
  const latestAvail = availability[availability.length - 1];

  const stockouts = availability.filter((row) => row.state === 'out_of_stock').length;
  const stockoutFreqMinor =
    availability.length > 0 ? BigInt(Math.round((stockouts / availability.length) * 10_000)) : null;

  const promoFreqMinor = BigInt(promotions.length * 10_000);

  const latestAssort = assortments[assortments.length - 1];
  const priorAssort = assortments.length >= 2 ? assortments[assortments.length - 2] : null;

  const breadthMinor = latestAssort ? BigInt(latestAssort.listedSkuEntityIds.length * 100) : null;
  const introMinor = latestAssort ? BigInt(latestAssort.newIntroductionSkuIds.length * 100) : null;
  const removalMinor = latestAssort ? BigInt(latestAssort.removedSkuIds.length * 100) : null;

  const competitorPrices = knowableRows(
    input.prices.filter((row) => input.competitorSkuIds.includes(row.skuEntityId)),
    input.evaluationTime,
  );
  const categoryPrices = knowableRows(
    input.prices.filter((row) => input.categorySkuIds.includes(row.skuEntityId)),
    input.evaluationTime,
  );

  const relCompetitorBps = (() => {
    if (!latestPrice || competitorPrices.length === 0) {
      return null;
    }
    const comp = competitorPrices[competitorPrices.length - 1]!;
    if (comp.shelfPriceMinor === 0n) {
      return null;
    }
    return Number(((latestPrice.shelfPriceMinor - comp.shelfPriceMinor) * 10_000n) / comp.shelfPriceMinor);
  })();

  const relCategoryBps = (() => {
    if (!latestPrice || categoryPrices.length === 0) {
      return null;
    }
    const sum = categoryPrices.reduce((acc, row) => acc + row.shelfPriceMinor, 0n);
    const mean = sum / BigInt(categoryPrices.length);
    if (mean === 0n) {
      return null;
    }
    return Number(((latestPrice.shelfPriceMinor - mean) * 10_000n) / mean);
  })();

  const priceChangeBps =
    latestPrice && priorPrice && priorPrice.shelfPriceMinor !== 0n
      ? Number(
          ((latestPrice.shelfPriceMinor - priorPrice.shelfPriceMinor) * 10_000n) /
            priorPrice.shelfPriceMinor,
        )
      : null;

  const discountDepthBps = (() => {
    const promo = promotions[promotions.length - 1];
    if (promo?.discountBps != null) {
      return promo.discountBps;
    }
    if (latestPrice?.listPriceMinor && latestPrice.listPriceMinor > 0n) {
      return Number(
        ((latestPrice.listPriceMinor - latestPrice.shelfPriceMinor) * 10_000n) / latestPrice.listPriceMinor,
      );
    }
    return null;
  })();

  const knowableAt =
    latestPrice?.provenance.knowableAt ??
    latestAvail?.provenance.knowableAt ??
    input.evaluationTime;

  const quality: Alt06FeatureQuality =
    latestPrice || latestAvail ? 'VALID' : 'UNAVAILABLE';

  const refs = Object.freeze([
    ...prices.map((row) => row.priceObservationId),
    ...availability.map((row) => row.availabilityObservationId),
    ...promotions.map((row) => row.promotionObservationId),
    ...assortments.map((row) => row.assortmentObservationId),
  ]);

  return Object.freeze([
    feature(
      'alt06.price_level',
      input.skuEntityId,
      latestPrice?.shelfPriceMinor ?? null,
      null,
      knowableAt,
      quality,
      refs,
    ),
    feature(
      'alt06.price_change',
      input.skuEntityId,
      priceChangeBps !== null ? BigInt(Math.round(priceChangeBps)) : null,
      null,
      knowableAt,
      priceChangeBps !== null ? quality : 'DEGRADED_MISSING_INPUT',
      refs,
    ),
    feature(
      'alt06.discount_depth',
      input.skuEntityId,
      discountDepthBps !== null ? BigInt(discountDepthBps) : null,
      null,
      knowableAt,
      discountDepthBps !== null ? quality : 'DEGRADED_MISSING_INPUT',
      refs,
    ),
    feature(
      'alt06.promotion_frequency',
      input.skuEntityId,
      promoFreqMinor,
      null,
      knowableAt,
      promotions.length > 0 ? quality : 'DEGRADED_MISSING_INPUT',
      refs,
    ),
    feature(
      'alt06.stock_availability',
      input.skuEntityId,
      latestAvail ? availabilityScore(latestAvail.state, latestAvail.unitsAvailable) : null,
      latestAvail?.state ?? null,
      knowableAt,
      latestAvail ? quality : 'DEGRADED_MISSING_INPUT',
      refs,
    ),
    feature(
      'alt06.stockout_frequency',
      input.skuEntityId,
      stockoutFreqMinor,
      null,
      knowableAt,
      availability.length > 0 ? quality : 'DEGRADED_MISSING_INPUT',
      refs,
    ),
    feature(
      'alt06.assortment_breadth',
      input.skuEntityId,
      breadthMinor,
      null,
      knowableAt,
      latestAssort ? quality : 'DEGRADED_MISSING_INPUT',
      refs,
    ),
    feature(
      'alt06.new_product_introduction',
      input.skuEntityId,
      introMinor,
      priorAssort ? String(priorAssort.newIntroductionSkuIds.length) : null,
      knowableAt,
      latestAssort ? quality : 'DEGRADED_MISSING_INPUT',
      refs,
    ),
    feature(
      'alt06.product_removal',
      input.skuEntityId,
      removalMinor,
      null,
      knowableAt,
      latestAssort ? quality : 'DEGRADED_MISSING_INPUT',
      refs,
    ),
    feature(
      'alt06.relative_price_vs_category',
      input.skuEntityId,
      relCategoryBps !== null ? BigInt(Math.round(relCategoryBps)) : null,
      null,
      knowableAt,
      relCategoryBps !== null ? quality : 'DEGRADED_MISSING_INPUT',
      refs,
    ),
    feature(
      'alt06.relative_price_vs_competitor',
      input.skuEntityId,
      relCompetitorBps !== null ? BigInt(Math.round(relCompetitorBps)) : null,
      null,
      knowableAt,
      relCompetitorBps !== null ? quality : 'DEGRADED_MISSING_INPUT',
      refs,
    ),
  ]);
}
