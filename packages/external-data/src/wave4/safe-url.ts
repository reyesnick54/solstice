/**
 * Safe handling of untrusted provider strings — never fetch malicious URLs.
 */

const DANGEROUS_SCHEMES = new Set(['javascript:', 'data:', 'vbscript:', 'file:']);

/** Normalize and sanitize an untrusted indicator string for display/storage. */
export function sanitizeUntrustedIndicator(raw: string): string {
  const trimmed = raw.trim().slice(0, 2048);
  return trimmed.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/** Returns true if the string looks like a URL that must never be auto-fetched. */
export function isPotentiallyMaliciousUrl(value: string): boolean {
  const lower = value.toLowerCase().trim();
  for (const scheme of DANGEROUS_SCHEMES) {
    if (lower.startsWith(scheme)) {
      return true;
    }
  }
  return lower.startsWith('http://') || lower.startsWith('https://');
}

/** Render-safe representation — never an active link. */
export function toDisplaySafeString(value: string): string {
  return sanitizeUntrustedIndicator(value)
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Block automatic URL fetching for threat indicators. */
export function assertNoAutoFetch(indicator: string, indicatorType: string): void {
  if (
    indicatorType.includes('URL') ||
    indicatorType.includes('DOMAIN') ||
    isPotentiallyMaliciousUrl(indicator)
  ) {
    return;
  }
}
