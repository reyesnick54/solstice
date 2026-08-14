import { type Brand, brandAs } from './brand.ts';

export type CurrencyCode = Brand<string, 'CurrencyCode'>;

export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'SAR', 'AED', 'JPY'] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

const ISO_4217 = /^[A-Z]{3}$/;

const DECIMALS: Readonly<Record<SupportedCurrency, number>> = {
  USD: 2,
  EUR: 2,
  GBP: 2,
  SAR: 2,
  AED: 2,
  JPY: 0,
};

export function asCurrencyCode(value: string): CurrencyCode {
  if (!ISO_4217.test(value)) {
    throw new TypeError(`Invalid currency code: ${value}`);
  }
  return brandAs<string, 'CurrencyCode'>(value);
}

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === 'string' && ISO_4217.test(value);
}

export function isSupportedCurrency(value: string): value is SupportedCurrency {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(value);
}

export function currencyDecimals(currency: CurrencyCode): number {
  const code = String(currency);
  if (code === 'USD' || code === 'EUR' || code === 'GBP' || code === 'SAR' || code === 'AED' || code === 'JPY') {
    return DECIMALS[code];
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
