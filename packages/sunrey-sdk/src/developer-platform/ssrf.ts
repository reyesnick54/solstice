/**
 * Webhook destination guard. Rejects SSRF, private networks, invalid
 * TLS targets, redirect abuse, and non-public schemes.
 */

const BLOCKED_HOSTS = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata.google.internal.',
  'metadata',
  'kubernetes',
  'kubernetes.default',
  'kubernetes.default.svc',
]);

const PRIVATE_IPV4 = [
  /^127\./,
  /^10\./,
  /^0\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^100\.(6[4-9]|[7-9]\d|1[0-2]\d)\./,
  /^198\.18\./,
  /^198\.19\./,
];

function isIpv4(hostname: string): boolean {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
}

function isIpv6(hostname: string): boolean {
  return hostname.includes(':');
}

function ipv6IsPrivate(hostname: string): boolean {
  const normalized = hostname.replace(/^\[/, '').replace(/\]$/, '').toLowerCase();
  return (
    normalized === '::1' ||
    normalized === '0:0:0:0:0:0:0:1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80') ||
    normalized.startsWith('::ffff:127.') ||
    normalized.startsWith('::ffff:10.') ||
    normalized.startsWith('::ffff:192.168.')
  );
}

export type SsrfRejection =
  | 'SCHEME'
  | 'PRIVATE_NETWORK'
  | 'BLOCKED_HOST'
  | 'CREDENTIALS'
  | 'REDIRECT'
  | 'INVALID_TLS'
  | 'OVERSIZED_RESPONSE';

export type DestinationDecision =
  | { readonly ok: true; readonly url: URL; readonly localMock: boolean }
  | { readonly ok: false; readonly reason: SsrfRejection };

export function inspectWebhookDestination(
  rawUrl: string,
  input: { readonly environment: 'LOCAL' | 'TESTNET' | 'SANDBOX' | 'PRODUCTION'; readonly allowLocalMock?: boolean } = {
    environment: 'PRODUCTION',
  },
): DestinationDecision {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: 'SCHEME' };
  }
  if (parsed.username !== '' || parsed.password !== '') {
    return { ok: false, reason: 'CREDENTIALS' };
  }
  if (parsed.protocol === 'mock:') {
    if (input.environment === 'LOCAL' || input.environment === 'SANDBOX' || input.allowLocalMock === true) {
      return { ok: true, url: parsed, localMock: true };
    }
    return { ok: false, reason: 'SCHEME' };
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, reason: 'SCHEME' };
  }
  const host = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host) || host.endsWith('.internal') || host.endsWith('.local')) {
    return { ok: false, reason: 'BLOCKED_HOST' };
  }
  if (isIpv4(host) && PRIVATE_IPV4.some((re) => re.test(host))) {
    return { ok: false, reason: 'PRIVATE_NETWORK' };
  }
  if (isIpv6(host) && ipv6IsPrivate(host)) {
    return { ok: false, reason: 'PRIVATE_NETWORK' };
  }
  if (parsed.protocol === 'http:') {
    return { ok: false, reason: 'INVALID_TLS' };
  }
  return { ok: true, url: parsed, localMock: false };
}

export const WEBHOOK_MAX_RESPONSE_BYTES = 8_192;
export const WEBHOOK_REDIRECTS_FORBIDDEN = 0;
