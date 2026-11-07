import type { Md09NormalizedDerivatives } from './types.ts';

function optionalDecimalString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : null;
  }
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }
  if (!/^-?\d+(\.\d+)?$/.test(value.trim())) {
    return null;
  }
  return value.trim();
}

const EMPTY: Md09NormalizedDerivatives = Object.freeze({
  fundingRate: null,
  markPrice: null,
  indexPrice: null,
  openInterest: null,
  liquidationPrice: null,
  liquidationQuantity: null,
  liquidationSide: null,
});

export function normalizeMd09Derivatives(input: {
  readonly funding?: unknown;
  readonly markPrice?: unknown;
  readonly indexPrice?: unknown;
  readonly openInterest?: unknown;
  readonly liquidation?: unknown;
}): Md09NormalizedDerivatives {
  const funding = input.funding as Record<string, unknown> | undefined;
  const mark = input.markPrice as Record<string, unknown> | undefined;
  const index = input.indexPrice as Record<string, unknown> | undefined;
  const oi = input.openInterest as Record<string, unknown> | undefined;
  const liq = input.liquidation as Record<string, unknown> | undefined;

  const fundingRate =
    funding?.fundingRate !== undefined
      ? optionalDecimalString(funding.fundingRate)
      : funding?.rate !== undefined
        ? optionalDecimalString(funding.rate)
        : null;

  const markPrice =
    mark?.markPx !== undefined
      ? optionalDecimalString(mark.markPx)
      : mark?.markPrice !== undefined
        ? optionalDecimalString(mark.markPrice)
        : null;

  const indexPrice =
    index?.indexPx !== undefined
      ? optionalDecimalString(index.indexPx)
      : index?.indexPrice !== undefined
        ? optionalDecimalString(index.indexPrice)
        : mark?.indexPrice !== undefined
          ? optionalDecimalString(mark.indexPrice)
          : null;

  const openInterest =
    oi?.oi !== undefined
      ? optionalDecimalString(oi.oi)
      : oi?.openInterest !== undefined
        ? optionalDecimalString(oi.openInterest)
        : null;

  let liquidationSide: Md09NormalizedDerivatives['liquidationSide'] = null;
  if (liq?.side === 'sell' || liq?.side === 'buy') {
    liquidationSide = liq.side;
  } else if (liq?.side === 'A') {
    liquidationSide = 'sell';
  } else if (liq?.side === 'B') {
    liquidationSide = 'buy';
  }

  return Object.freeze({
    fundingRate,
    markPrice,
    indexPrice,
    openInterest,
    liquidationPrice: liq?.px !== undefined ? optionalDecimalString(liq.px) : null,
    liquidationQuantity: liq?.sz !== undefined ? optionalDecimalString(liq.sz) : null,
    liquidationSide,
  });
}

export function emptyMd09Derivatives(): Md09NormalizedDerivatives {
  return EMPTY;
}
