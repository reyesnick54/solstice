/**
 * SSRF and egress protection for provider outbound HTTP.
 *
 * Provider adapters must use approved base URLs from configuration.
 * Arbitrary destinations are rejected before any network I/O.
 */

import type { ProviderTransportEnvironment } from './config.ts';

const LOOPBACK_HOSTS = new Set(['localhost', 'localhost.localdomain', 'ip6-localhost', 'ip6-loopback']);
const METADATA_HOSTS = new Set([
  'metadata.google.internal',
  'metadata.google.com',
  '169.254.169.254',
  'metadata',
  'kubernetes',
  'kubernetes.default',
  'kubernetes.default.svc',
]);

const BLOCKED_SCHEMES = new Set(['file', 'ftp', 'gopher', 'data', 'javascript', 'ws', 'wss', 'mock']);

export type ResolvedDestination = {
  readonly href: string;
  readonly scheme: 'http' | 'https';
  readonly hostname: string;
  readonly port: number;
  readonly pathname: string;
  readonly search: string;
};

export type SsrfDecision =
  | { readonly ok: true; readonly destination: ResolvedDestination }
  | { readonly ok: false; readonly reason: string };

export function parseDestination(raw: string): SsrfDecision {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, reason: 'destination is not a valid absolute URL' };
  }
  const scheme = parsed.protocol.replace(':', '').toLowerCase();
  if (BLOCKED_SCHEMES.has(scheme)) {
    return { ok: false, reason: `scheme ${scheme} is not permitted` };
  }
  if (scheme !== 'http' && scheme !== 'https') {
    return { ok: false, reason: `scheme ${scheme} is not permitted` };
  }
  if (parsed.username.length > 0 || parsed.password.length > 0) {
    return { ok: false, reason: 'credentials embedded in URL are forbidden' };
  }
  const hostname = parsed.hostname.toLowerCase();
  const port = parsed.port.length > 0 ? Number(parsed.port) : scheme === 'https' ? 443 : 80;
  if (!Number.isInteger(port) || port <= 0) {
    return { ok: false, reason: 'destination port is invalid' };
  }
  return {
    ok: true,
    destination: Object.freeze({
      href: parsed.href,
      scheme,
      hostname,
      port,
      pathname: parsed.pathname,
      search: parsed.search,
    }),
  };
}

export function isLoopbackHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (LOOPBACK_HOSTS.has(host)) {
    return true;
  }
  if (host === '::1' || host === '[::1]') {
    return true;
  }
  if (host.startsWith('127.')) {
    return true;
  }
  return false;
}

export function isLinkLocalOrMetadata(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (METADATA_HOSTS.has(host)) {
    return true;
  }
  if (host.endsWith('.internal') || host.endsWith('.local')) {
    return true;
  }
  if (host.startsWith('169.254.')) {
    return true;
  }
  return false;
}

export function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  const [a, b] = parts as [number, number, number, number];
  if (a === 10) {
    return true;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  if (a === 0) {
    return true;
  }
  return false;
}

export function isPrivateIpv6(hostname: string): boolean {
  const normalized = hostname.replace(/^\[/, '').replace(/\]$/, '').toLowerCase();
  return (
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80') ||
    normalized.startsWith('::ffff:127.') ||
    normalized.startsWith('::ffff:10.') ||
    normalized.startsWith('::ffff:192.168.')
  );
}

export function enforceSsrfPolicy(
  destination: ResolvedDestination,
  input: {
    readonly allowHttp: boolean;
    readonly environment: ProviderTransportEnvironment;
    readonly approvedHostname: string;
    readonly approvedPort: number;
    readonly approvedScheme: 'http' | 'https';
    readonly allowLoopbackInTest?: boolean | undefined;
  },
): SsrfDecision {
  if (destination.hostname !== input.approvedHostname.toLowerCase()) {
    return { ok: false, reason: 'destination hostname is not the approved provider base URL' };
  }
  if (destination.port !== input.approvedPort) {
    return { ok: false, reason: 'destination port is not the approved provider base URL' };
  }
  if (destination.scheme !== input.approvedScheme) {
    return { ok: false, reason: 'destination scheme is not the approved provider base URL' };
  }
  if (destination.scheme === 'http' && !input.allowHttp) {
    return { ok: false, reason: 'HTTP is not permitted for this provider endpoint' };
  }
  if (isLinkLocalOrMetadata(destination.hostname)) {
    return { ok: false, reason: 'cloud metadata and link-local destinations are forbidden' };
  }
  if (isLoopbackHostname(destination.hostname)) {
    if (input.allowLoopbackInTest === true && (input.environment === 'development' || input.environment === 'test')) {
      return { ok: true, destination };
    }
    return { ok: false, reason: 'loopback destinations are forbidden' };
  }
  if (isPrivateIpv4(destination.hostname) || isPrivateIpv6(destination.hostname)) {
    return { ok: false, reason: 'private network destinations are forbidden' };
  }
  return { ok: true, destination };
}

export function resolveRedirectLocation(current: ResolvedDestination, location: string): string {
  if (location.startsWith('http://') || location.startsWith('https://')) {
    return location;
  }
  if (location.startsWith('/')) {
    return `${current.scheme}://${current.hostname}:${current.port}${location}`;
  }
  const basePath = current.pathname.endsWith('/') ? current.pathname : `${current.pathname}/`;
  return `${current.scheme}://${current.hostname}:${current.port}${basePath}${location}`;
}

export function buildAbsoluteUrl(
  baseUrl: string,
  path: string,
  query?: Readonly<Record<string, string | number | boolean>>,
  authQuery?: Readonly<Record<string, string>>,
): SsrfDecision {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  let url: URL;
  try {
    url = new URL(normalizedPath, normalizedBase);
  } catch {
    return { ok: false, reason: 'destination is not a valid absolute URL' };
  }
  for (const [key, value] of Object.entries(query ?? {})) {
    url.searchParams.set(key, String(value));
  }
  for (const [key, value] of Object.entries(authQuery ?? {})) {
    url.searchParams.set(key, value);
  }
  return parseDestination(url.toString());
}
