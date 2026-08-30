import { asCurrencyCode } from '../../../domain/src/currency.ts';

export function normalizeFxCurrencyCode(code: string): string {
  const upper = code.trim().toUpperCase();
  asCurrencyCode(upper);
  return upper;
}

export function isValidFxCurrencyCode(code: string): boolean {
  try {
    normalizeFxCurrencyCode(code);
    return true;
  } catch {
    return false;
  }
}

export function assertFxCurrencyPair(base: string, quote: string): { readonly base: string; readonly quote: string } {
  const normalizedBase = normalizeFxCurrencyCode(base);
  const normalizedQuote = normalizeFxCurrencyCode(quote);
  if (normalizedBase === normalizedQuote) {
    throw new TypeError('base and quote currency must differ');
  }
  return Object.freeze({ base: normalizedBase, quote: normalizedQuote });
}
