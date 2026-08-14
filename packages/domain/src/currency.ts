import { type Brand, brandAs } from './brand.ts';

export type CurrencyCode = Brand<string, 'CurrencyCode'>;
/** ISO 4217 alphabetic currency code. Alias of CurrencyCode. */
export type Currency = CurrencyCode;

export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'SAR', 'AED', 'JPY', 'PYR'] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

const ISO_4217 = /^[A-Z]{3}$/;

const DECIMALS: Readonly<Record<SupportedCurrency, number>> = {
  USD: 2,
  EUR: 2,
  GBP: 2,
  SAR: 2,
  AED: 2,
  JPY: 0,
  PYR: 2,
};

export function asCurrencyCode(value: string): CurrencyCode {
  if (!ISO_4217.test(value)) {
    throw new TypeError(`Invalid currency code: ${value}`);
  }
  return brandAs<string, 'CurrencyCode'>(value);
}

export function asCurrency(code: string): Currency {
  return asCurrencyCode(code);
}

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === 'string' && ISO_4217.test(value);
}

export function isCurrency(value: unknown): value is Currency {
  return isCurrencyCode(value);
}

export function isSupportedCurrency(value: string): value is SupportedCurrency {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(value);
}

export function currencyDecimals(currency: CurrencyCode): number {
  const code = String(currency);
  if (code in DECIMALS) {
    return DECIMALS[code as SupportedCurrency];
  }
  return 2;
}

export function minorUnitsScale(currency: CurrencyCode): bigint {
  const decimals = currencyDecimals(currency);
  let scale = 1n;
  for (let i = 0; i < decimals; i += 1) {
    scale *= 10n;
  }
  return scale;
}
