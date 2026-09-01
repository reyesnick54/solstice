import type { MerchantIdentity } from './models.ts';

const NOISE_PATTERNS: readonly RegExp[] = [
  /\bPOS\b/gi,
  /\bDEBIT\b/gi,
  /\bCREDIT\b/gi,
  /\bPURCHASE\b/gi,
  /\bCARD\b/gi,
  /\b\d{2}\/\d{2}\b/g,
  /\b\d{4,}\b/g,
  /\*{2,}\d+/g,
  /\s{2,}/g,
  /[#*]+/g,
];

const MERCHANT_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  'netflix.com': 'Netflix',
  'netflix': 'Netflix',
  'spotify': 'Spotify',
  'spotify usa': 'Spotify',
  'hulu': 'Hulu',
  'disney plus': 'Disney+',
  'disney+': 'Disney+',
  'amazon prime': 'Amazon Prime',
  'amazon web services': 'Amazon Web Services',
  'aws': 'Amazon Web Services',
  'apple.com/bill': 'Apple Services',
  'apple services': 'Apple Services',
  'google *youtube': 'YouTube Premium',
  'youtube premium': 'YouTube Premium',
  'microsoft*subscription': 'Microsoft 365',
  'microsoft 365': 'Microsoft 365',
  'adobe': 'Adobe Creative Cloud',
  'dropbox': 'Dropbox',
  'icloud': 'iCloud',
  'google one': 'Google One',
  'comcast': 'Comcast',
  'verizon': 'Verizon',
  'at&t': 'AT&T',
  'att': 'AT&T',
  'tmobile': 'T-Mobile',
  'planet fitness': 'Planet Fitness',
  'geico': 'GEICO',
  'state farm': 'State Farm',
});

function stripNoise(raw: string): string {
  let value = raw.trim();
  for (const pattern of NOISE_PATTERNS) {
    value = value.replace(pattern, ' ');
  }
  return value.replace(/\s+/g, ' ').trim();
}

function toKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

/**
 * Normalize a noisy merchant descriptor without destroying the raw value.
 */
export function normalizeMerchant(rawDescriptor: string): MerchantIdentity {
  const cleaned = stripNoise(rawDescriptor);
  const lower = cleaned.toLowerCase();
  for (const [alias, canonical] of Object.entries(MERCHANT_ALIASES)) {
    if (lower.includes(alias)) {
      return Object.freeze({
        rawDescriptor,
        normalizedMerchant: canonical,
        merchantKey: toKey(canonical),
      });
    }
  }
  const title = cleaned
    .split(' ')
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
  const normalized = title.length > 0 ? title : 'Unknown Merchant';
  return Object.freeze({
    rawDescriptor,
    normalizedMerchant: normalized,
    merchantKey: toKey(normalized),
  });
}

export function merchantsMatch(a: MerchantIdentity, b: MerchantIdentity): boolean {
  return a.merchantKey === b.merchantKey;
}
