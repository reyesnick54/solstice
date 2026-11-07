/**
 * SKU resolution — deterministic identifiers first; probabilistic title match with variant guards.
 */

import { createHash } from 'node:crypto';

import type { ProductVariantFingerprint, SkuEntity, SkuIdentifier, SkuMatchResult } from './types.ts';

export function normalizeProductTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function variantFingerprintFromTitle(title: string): ProductVariantFingerprint {
  const normalizedTitle = normalizeProductTitle(title);
  const packMatch = normalizedTitle.match(/(\d+)\s*(pk|pack|count)/);
  const sizeMatch = normalizedTitle.match(/(\d+(?:\.\d+)?)\s*(oz|fl oz|ml|l|g|kg|lb)/);
  const flavorMatch = normalizedTitle.match(
    /\b(vanilla|chocolate|strawberry|unscented|lavender|citrus|original)\b/,
  );
  return Object.freeze({
    packCount: packMatch?.[1] ?? null,
    unitOfMeasure: sizeMatch?.[2] ?? null,
    flavorOrScent: flavorMatch?.[1] ?? null,
    sizeLabel: sizeMatch ? `${sizeMatch[1]}${sizeMatch[2]}` : null,
    normalizedTitle,
  });
}

export function normalizedTitleFingerprint(title: string): string {
  const material = normalizeProductTitle(title);
  return createHash('sha256').update(material).digest('hex').slice(0, 24);
}

function identifierValueMatch(a: SkuIdentifier, b: SkuIdentifier): boolean {
  if (a.kind !== b.kind) {
    return false;
  }
  const normalize = (kind: SkuIdentifier['kind'], value: string): string => {
    if (kind === 'gtin' || kind === 'upc' || kind === 'ean') {
      return value.replace(/\D/g, '');
    }
    return value.trim().toLowerCase();
  };
  return normalize(a.kind, a.value) === normalize(b.kind, b.value);
}

function variantsComparable(a: ProductVariantFingerprint, b: ProductVariantFingerprint): boolean {
  if (a.packCount !== null && b.packCount !== null && a.packCount !== b.packCount) {
    return false;
  }
  if (a.sizeLabel !== null && b.sizeLabel !== null && a.sizeLabel !== b.sizeLabel) {
    return false;
  }
  if (a.flavorOrScent !== null && b.flavorOrScent !== null && a.flavorOrScent !== b.flavorOrScent) {
    return false;
  }
  return true;
}

export function matchSkuEntity(input: {
  readonly catalog: readonly SkuEntity[];
  readonly queryIdentifiers: readonly SkuIdentifier[];
  readonly queryTitle?: string | null;
  readonly queryVariant?: ProductVariantFingerprint | null;
}): SkuMatchResult {
  for (const id of input.queryIdentifiers) {
    if (id.kind === 'deterministic_product_id' || id.kind === 'gtin' || id.kind === 'upc' || id.kind === 'ean' || id.kind === 'manufacturer_sku') {
      for (const sku of input.catalog) {
        const hit = sku.identifiers.find((row) => identifierValueMatch(row, id));
        if (hit) {
          const variant = input.queryVariant;
          if (variant && !variantsComparable(sku.variant, variant)) {
            return Object.freeze({
              skuEntityId: null,
              confidence: 'rejected_variant_mismatch',
              matchedIdentifier: hit,
              variantComparable: false,
              message: 'unrelated_product_variant',
            });
          }
          return Object.freeze({
            skuEntityId: sku.skuEntityId,
            confidence: 'deterministic',
            matchedIdentifier: hit,
            variantComparable: true,
            message: null,
          });
        }
      }
    }
  }

  const title = input.queryTitle?.trim();
  if (!title) {
    return Object.freeze({
      skuEntityId: null,
      confidence: 'rejected_variant_mismatch',
      matchedIdentifier: null,
      variantComparable: false,
      message: 'insufficient_identifiers',
    });
  }

  const queryVariant = input.queryVariant ?? variantFingerprintFromTitle(title);
  const fingerprint = normalizedTitleFingerprint(title);
  const fingerprintId: SkuIdentifier = Object.freeze({ kind: 'normalized_title_fingerprint', value: fingerprint });

  let best: { readonly sku: SkuEntity; readonly score: number } | null = null;
  for (const sku of input.catalog) {
    const fpHit = sku.identifiers.find(
      (row) => row.kind === 'normalized_title_fingerprint' && identifierValueMatch(row, fingerprintId),
    );
    if (fpHit && variantsComparable(sku.variant, queryVariant)) {
      return Object.freeze({
        skuEntityId: sku.skuEntityId,
        confidence: 'probabilistic',
        matchedIdentifier: fpHit,
        variantComparable: true,
        message: null,
      });
    }
    if (!variantsComparable(sku.variant, queryVariant)) {
      continue;
    }
    const score = sku.variant.normalizedTitle === queryVariant.normalizedTitle ? 1 : 0.72;
    if (!best || score > best.score) {
      best = Object.freeze({ sku, score });
    }
  }

  if (best && best.score >= 0.72) {
    return Object.freeze({
      skuEntityId: best.sku.skuEntityId,
      confidence: 'probabilistic',
      matchedIdentifier: null,
      variantComparable: true,
      message: null,
    });
  }

  return Object.freeze({
    skuEntityId: null,
    confidence: 'rejected_variant_mismatch',
    matchedIdentifier: null,
    variantComparable: false,
    message: 'no_comparable_sku',
  });
}
