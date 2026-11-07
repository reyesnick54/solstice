/**
 * Explicit commodity basis between futures and physical benchmarks.
 */

import { asUtcInstant, type UtcInstant } from '@solstice/domain';
import { requiresCommodityBasisLink } from './compatibility.ts';
import { HELIOS_MD10_MACRO_MARKET_REFERENCE_SCHEMA } from './taxonomy.ts';
import type { CommodityBasisLink, MacroCommodityObservation } from './types.ts';

export type CommodityBasisValidation =
  | { readonly ok: true; readonly basis: CommodityBasisLink | null }
  | { readonly ok: false; readonly reason: string };

export function assertCommodityComparable(
  left: MacroCommodityObservation,
  right: MacroCommodityObservation,
  basisLink: CommodityBasisLink | null,
): CommodityBasisValidation {
  if (left.kind === right.kind && left.commodityCode === right.commodityCode && left.contractMonth === right.contractMonth) {
    return { ok: true, basis: basisLink };
  }

  if (!requiresCommodityBasisLink(left.kind, right.kind)) {
    return { ok: false, reason: 'incompatible_commodity_reference_kinds' };
  }

  if (basisLink === null) {
    return { ok: false, reason: 'futures_physical_basis_required' };
  }

  const futuresId =
    left.kind === 'futures' ? left.provenance.observationId : right.provenance.observationId;
  const physicalId =
    left.kind === 'physical_benchmark'
      ? left.provenance.observationId
      : right.provenance.observationId;

  if (basisLink.futuresObservationId !== futuresId || basisLink.physicalObservationId !== physicalId) {
    return { ok: false, reason: 'basis_link_observation_mismatch' };
  }

  return { ok: true, basis: basisLink };
}

export function buildCommodityBasisLink(input: {
  readonly futures: MacroCommodityObservation;
  readonly physical: MacroCommodityObservation;
  readonly basisMinorUnits: bigint;
  readonly documentedAt: UtcInstant;
  readonly linkId?: string;
}): CommodityBasisLink | null {
  if (input.futures.kind !== 'futures' || input.physical.kind !== 'physical_benchmark') {
    return null;
  }
  if (input.futures.commodityCode !== input.physical.commodityCode) {
    return null;
  }
  return Object.freeze({
    schema: HELIOS_MD10_MACRO_MARKET_REFERENCE_SCHEMA,
    linkId:
      input.linkId ??
      `basis:${input.futures.provenance.observationId}:${input.physical.provenance.observationId}`,
    futuresObservationId: input.futures.provenance.observationId,
    physicalObservationId: input.physical.provenance.observationId,
    basisMinorUnits: input.basisMinorUnits,
    priceScale: input.futures.priceScale,
    currency: input.futures.currency,
    documentedAt: input.documentedAt,
  });
}
