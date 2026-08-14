import { type Brand, brandAs } from './brand.ts';

/** ISO 4217 alphabetic currency code. */
export type CurrencyCode = Brand<string, 'CurrencyCode'>;

const ISO_4217 = /^[A-Z]{3}$/;

export function asCurrencyCode(code: string): CurrencyCode {
  if (!ISO_4217.test(code)) {
    throw new TypeError(`Invalid currency code: ${code}`);
  }
  return brandAs<string, 'CurrencyCode'>(code);
}

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === 'string' && ISO_4217.test(value);
}
