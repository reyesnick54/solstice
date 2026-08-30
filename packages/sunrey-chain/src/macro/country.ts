/**
 * ISO 3166-1 alpha-2 country normalization for macro providers.
 */

const ISO_3166_ALPHA_2 = /^[A-Z]{2}$/;

export const COUNTRY_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  'united states': 'US',
  usa: 'US',
  'u.s.': 'US',
  'u.s.a.': 'US',
  america: 'US',
  'united kingdom': 'GB',
  uk: 'GB',
  britain: 'GB',
  'great britain': 'GB',
  'saudi arabia': 'SA',
  ksa: 'SA',
  germany: 'DE',
  france: 'FR',
  japan: 'JP',
  china: 'CN',
  canada: 'CA',
  australia: 'AU',
  global: 'GLOBAL',
  world: 'GLOBAL',
});

export function normalizeCountryCode(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const upper = trimmed.toUpperCase();
  if (ISO_3166_ALPHA_2.test(upper)) {
    return upper;
  }
  if (upper === 'GLOBAL') {
    return 'GLOBAL';
  }
  const alias = COUNTRY_ALIASES[trimmed.toLowerCase()];
  return alias ?? null;
}
