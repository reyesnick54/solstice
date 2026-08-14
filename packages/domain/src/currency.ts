import { type Brand, brandAs } from './brand.ts';

/** ISO 4217 alphabetic currency code. */
export type Currency = Brand<string, 'Currency'>;

const ISO_4217 = /^[A-Z]{3}$/;

export function asCurrency(code: string): Currency {
  if (!ISO_4217.test(code)) {
    throw new TypeError(`Invalid currency code: ${code}`);
  }
  return brandAs<string, 'Currency'>(code);
}

export function isCurrency(value: unknown): value is Currency {
  return typeof value === 'string' && ISO_4217.test(value);
}
