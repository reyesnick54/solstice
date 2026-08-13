import { type Brand, brandAs } from './brand.ts';

/** ISO 3166-1 alpha-2 country code naming the governing jurisdiction. */
export type Jurisdiction = Brand<string, 'Jurisdiction'>;

/** ISO 3166-1 alpha-2 country code naming the person's country of residence. */
export type Residency = Brand<string, 'Residency'>;

const ISO_3166_ALPHA_2 = /^[A-Z]{2}$/;

export function asJurisdiction(countryCode: string): Jurisdiction {
  if (!ISO_3166_ALPHA_2.test(countryCode)) {
    throw new TypeError(`Invalid jurisdiction country code: ${countryCode}`);
  }
  return brandAs<string, 'Jurisdiction'>(countryCode);
}

export function asResidency(countryCode: string): Residency {
  if (!ISO_3166_ALPHA_2.test(countryCode)) {
    throw new TypeError(`Invalid residency country code: ${countryCode}`);
  }
  return brandAs<string, 'Residency'>(countryCode);
}

export function isJurisdiction(value: unknown): value is Jurisdiction {
  return typeof value === 'string' && ISO_3166_ALPHA_2.test(value);
}

export function isResidency(value: unknown): value is Residency {
  return typeof value === 'string' && ISO_3166_ALPHA_2.test(value);
}
