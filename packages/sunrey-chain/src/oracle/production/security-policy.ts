/**
 * Endpoint allowlist, SSRF defense, TLS policy, and redirect governance.
 *
 * External internet providers require HTTPS and certificate verification.
 * Private-network destinations are allowed only when the adapter class is
 * PRIVATE_NETWORK and the profile network class matches.
 */

import { err, ok, type Result } from '../../../../domain/src/result.ts';
import type { ProductionOracleRejection } from './types.ts';
import type {
  ConnectorNetworkClass,
  ConnectorRuntimeMode,
  ProviderEndpointProfile,
} from './runtime-types.ts';

const LOOPBACK_HOSTS = new Set(['localhost', 'localhost.localdomain', 'ip6-localhost', 'ip6-loopback']);
const METADATA_HOSTS = new Set([
  'metadata.google.internal',
  'metadata.google.com',
  '169.254.169.254',
]);

const BLOCKED_SCHEMES = new Set(['file', 'ftp', 'gopher', 'data', 'javascript', 'ws', 'wss']);

export type ResolvedDestination = {
  readonly href: string;
  readonly scheme: string;
  readonly hostname: string;
  readonly port: number;
  readonly pathname: string;
  readonly hasUserInfo: boolean;
};

export function parseDestination(raw: string): Result<ResolvedDestination, ProductionOracleRejection> {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return err({ code: 'ENDPOINT_NOT_APPROVED', detail: 'destination is not a valid absolute URL' });
  }
  if (BLOCKED_SCHEMES.has(parsed.protocol.replace(':', '').toLowerCase())) {
    return err({ code: 'SSRF_DESTINATION_FORBIDDEN', detail: `scheme ${parsed.protocol} is forbidden` });
  }
  if (parsed.username.length > 0 || parsed.password.length > 0) {
    return err({ code: 'SSRF_DESTINATION_FORBIDDEN', detail: 'credentials in URL are forbidden' });
  }
  const hostname = parsed.hostname.toLowerCase();
  const port = parsed.port.length > 0 ? Number(parsed.port) : parsed.protocol === 'https:' ? 443 : parsed.protocol === 'http:' ? 80 : 0;
  if (!Number.isInteger(port) || port <= 0) {
    return err({ code: 'ENDPOINT_NOT_APPROVED', detail: 'destination port is invalid' });
  }
  return ok(
    Object.freeze({
      href: parsed.href,
      scheme: parsed.protocol.replace(':', '').toLowerCase(),
      hostname,
      port,
      pathname: parsed.pathname,
      hasUserInfo: false,
    }),
  );
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
  return false;
}

export function classifyHostname(hostname: string): ConnectorNetworkClass | 'BLOCKED_METADATA' {
  if (isLinkLocalOrMetadata(hostname)) {
    return 'BLOCKED_METADATA';
  }
  if (isLoopbackHostname(hostname)) {
    return 'LOOPBACK_FIXTURE';
  }
  if (isPrivateIpv4(hostname)) {
    return 'PRIVATE_NETWORK';
  }
  return 'PUBLIC_INTERNET';
}

export function approveEndpointProfile(
  profile: ProviderEndpointProfile,
  sourceId: string,
  providerId: string,
): Result<true, ProductionOracleRejection> {
  if (profile.sourceId !== sourceId || profile.providerId !== providerId) {
    return err({
      code: 'ENDPOINT_NOT_APPROVED',
      detail: 'endpoint profile does not match the economic data source',
    });
  }
  if (profile.hostname.includes('/') || profile.hostname.includes('@') || profile.hostname.includes(':')) {
    return err({ code: 'ENDPOINT_NOT_APPROVED', detail: 'endpoint hostname must be a bare host' });
  }
  if (profile.scheme !== 'https' && profile.scheme !== 'http') {
    return err({ code: 'TLS_POLICY_VIOLATION', detail: 'only http and https schemes are recognized' });
  }
  if (profile.networkClass === 'PUBLIC_INTERNET') {
    if (profile.scheme !== 'https' || profile.tlsPolicy !== 'REQUIRE_VALID_CERTIFICATE') {
      return err({
        code: 'TLS_POLICY_VIOLATION',
        detail: 'public internet providers require HTTPS and certificate verification',
      });
    }
  }
  if (profile.tlsPolicy !== 'REQUIRE_VALID_CERTIFICATE' && profile.tlsPolicy !== 'FIXTURE_HTTP_ALLOWED') {
    return err({ code: 'TLS_POLICY_VIOLATION', detail: 'unknown TLS policy' });
  }
  if (profile.maximumResponseBytes <= 0 || profile.timeoutMs <= 0) {
    return err({ code: 'ENDPOINT_NOT_APPROVED', detail: 'timeout and response limits must be positive' });
  }
  return ok(true);
}

export function destinationMatchesProfile(
  destination: ResolvedDestination,
  profile: ProviderEndpointProfile,
): Result<true, ProductionOracleRejection> {
  if (destination.scheme !== profile.scheme) {
    return err({ code: 'ENDPOINT_NOT_APPROVED', detail: 'destination scheme is not on the approved profile' });
  }
  if (destination.hostname !== profile.hostname.toLowerCase()) {
    return err({ code: 'ENDPOINT_NOT_APPROVED', detail: 'destination hostname is not on the approved profile' });
  }
  if (destination.port !== profile.port) {
    return err({ code: 'ENDPOINT_NOT_APPROVED', detail: 'destination port is not on the approved profile' });
  }
  if (!destination.pathname.startsWith(profile.pathPrefix)) {
    return err({ code: 'ENDPOINT_NOT_APPROVED', detail: 'destination path is outside the approved prefix' });
  }
  return ok(true);
}

export function enforceSsrfPolicy(
  destination: ResolvedDestination,
  profile: ProviderEndpointProfile,
  mode: ConnectorRuntimeMode,
): Result<true, ProductionOracleRejection> {
  const classified = classifyHostname(destination.hostname);
  if (classified === 'BLOCKED_METADATA') {
    return err({ code: 'SSRF_DESTINATION_FORBIDDEN', detail: 'cloud metadata and link-local destinations are forbidden' });
  }
  if (profile.networkClass === 'PUBLIC_INTERNET') {
    if (classified !== 'PUBLIC_INTERNET') {
      return err({
        code: 'SSRF_DESTINATION_FORBIDDEN',
        detail: 'public internet profiles cannot target loopback or private networks',
      });
    }
    if (destination.scheme !== 'https') {
      return err({ code: 'TLS_POLICY_VIOLATION', detail: 'public internet fetches require HTTPS' });
    }
  }
  if (classified === 'LOOPBACK_FIXTURE') {
    if (profile.networkClass !== 'LOOPBACK_FIXTURE' && profile.authenticationClass !== 'PRIVATE_NETWORK') {
      return err({
        code: 'SSRF_DESTINATION_FORBIDDEN',
        detail: 'loopback is forbidden unless the profile is a fixture or PRIVATE_NETWORK',
      });
    }
    if (mode === 'TESTNET_EXTERNAL' || mode === 'PRODUCTION_CANDIDATE_EXTERNAL') {
      if (profile.networkClass !== 'PRIVATE_NETWORK') {
        return err({
          code: 'SSRF_DESTINATION_FORBIDDEN',
          detail: 'external modes cannot use loopback fixtures',
        });
      }
    }
  }
  if (classified === 'PRIVATE_NETWORK') {
    if (profile.authenticationClass !== 'PRIVATE_NETWORK' || profile.networkClass !== 'PRIVATE_NETWORK') {
      return err({
        code: 'SSRF_DESTINATION_FORBIDDEN',
        detail: 'private networks require an approved PRIVATE_NETWORK profile',
      });
    }
  }
  return ok(true);
}

export function enforceTlsPolicy(
  destination: ResolvedDestination,
  profile: ProviderEndpointProfile,
): Result<true, ProductionOracleRejection> {
  if (profile.tlsPolicy === 'REQUIRE_VALID_CERTIFICATE') {
    if (destination.scheme !== 'https') {
      return err({ code: 'TLS_POLICY_VIOLATION', detail: 'certificate verification requires HTTPS' });
    }
  }
  if (profile.tlsPolicy === 'FIXTURE_HTTP_ALLOWED') {
    if (profile.networkClass === 'PUBLIC_INTERNET') {
      return err({ code: 'TLS_POLICY_VIOLATION', detail: 'fixture HTTP is not valid for public internet' });
    }
  }
  return ok(true);
}

export function governRedirect(
  current: ResolvedDestination,
  nextLocation: string,
  profile: ProviderEndpointProfile,
  hopsUsed: number,
  mode: ConnectorRuntimeMode,
): Result<ResolvedDestination, ProductionOracleRejection> {
  if (profile.redirectPolicy === 'NONE') {
    return err({ code: 'SSRF_DESTINATION_FORBIDDEN', detail: 'redirects are not permitted for this profile' });
  }
  if (hopsUsed >= profile.maxRedirects) {
    return err({ code: 'SSRF_DESTINATION_FORBIDDEN', detail: 'redirect chain exceeds the approved bound' });
  }
  const absolute = nextLocation.startsWith('http://') || nextLocation.startsWith('https://')
    ? nextLocation
    : `${current.scheme}://${current.hostname}:${current.port}${nextLocation.startsWith('/') ? nextLocation : `/${nextLocation}`}`;
  const next = parseDestination(absolute);
  if (!next.ok) {
    return next;
  }
  const matched = destinationMatchesProfile(next.value, profile);
  if (!matched.ok) {
    return matched;
  }
  const ssrf = enforceSsrfPolicy(next.value, profile, mode);
  if (!ssrf.ok) {
    return ssrf;
  }
  const tls = enforceTlsPolicy(next.value, profile);
  if (!tls.ok) {
    return tls;
  }
  return next;
}

export class ProviderEndpointProfileRegistry {
  private readonly byId = new Map<string, ProviderEndpointProfile>();
  private readonly bySource = new Map<string, ProviderEndpointProfile>();

  register(profile: ProviderEndpointProfile): Result<ProviderEndpointProfile, ProductionOracleRejection> {
    const approved = approveEndpointProfile(profile, profile.sourceId, profile.providerId);
    if (!approved.ok) {
      return approved;
    }
    if (this.byId.has(profile.profileId)) {
      return err({ code: 'INVALID_IDENTIFIER', detail: `endpoint profile ${profile.profileId} already exists` });
    }
    this.byId.set(profile.profileId, profile);
    this.bySource.set(profile.sourceId, profile);
    return ok(profile);
  }

  get(profileId: string): ProviderEndpointProfile | undefined {
    return this.byId.get(profileId);
  }

  getForSource(sourceId: string): ProviderEndpointProfile | undefined {
    return this.bySource.get(sourceId);
  }
}
