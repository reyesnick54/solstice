/**
 * Wave 6 — application URL security for untrusted job posting links.
 */

const DANGEROUS_SCHEMES = new Set(['javascript:', 'data:', 'vbscript:', 'file:', 'blob:']);

export function validateApplicationUrl(raw: string | null | undefined): {
  readonly url: string | null;
  readonly safe: boolean;
  readonly reason: string | null;
} {
  if (!raw || raw.trim() === '') {
    return { url: null, safe: false, reason: 'empty_url' };
  }
  const trimmed = raw.trim().slice(0, 2048);
  const lower = trimmed.toLowerCase();
  for (const scheme of DANGEROUS_SCHEMES) {
    if (lower.startsWith(scheme)) {
      return { url: null, safe: false, reason: `dangerous_scheme:${scheme}` };
    }
  }
  if (!lower.startsWith('https://') && !lower.startsWith('http://')) {
    return { url: null, safe: false, reason: 'invalid_scheme' };
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.username || parsed.password) {
      return { url: null, safe: false, reason: 'embedded_credentials' };
    }
    return { url: trimmed, safe: true, reason: null };
  } catch {
    return { url: null, safe: false, reason: 'malformed_url' };
  }
}

/** Never fetch application URLs server-side. */
export function assertNoApplicationUrlFetch(): void {
  // Structural guard — adapters must not fetch application URLs.
}
