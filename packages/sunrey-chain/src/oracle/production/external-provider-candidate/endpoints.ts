import { err, ok, type Result } from '../../../../../domain/src/result.ts';
import {
  classifyHostname,
  destinationMatchesProfile,
  enforceSsrfPolicy,
  enforceTlsPolicy,
  governRedirect,
  isLinkLocalOrMetadata,
  isLoopbackHostname,
  isPrivateIpv4,
  parseDestination,
} from '../security-policy.ts';
import type { ProviderEndpointProfile } from '../runtime-types.ts';
import type { AuthenticationMethod } from '../types.ts';
import {
  candidateRejection,
  type ExternalProviderEndpointProfile,
  type ProviderCandidateRejection,
} from './types.ts';

const IP_LITERAL = /^(?:\d{1,3}\.){3}\d{1,3}$|^\[?[0-9a-fA-F:]+\]?$/;

export function createEndpointProfile(
  input: ExternalProviderEndpointProfile,
): Result<ExternalProviderEndpointProfile, ProviderCandidateRejection> {
  if (input.endpointProfileId.length === 0 || input.providerId.length === 0) {
    return err(candidateRejection('ENDPOINT_NOT_APPROVED', 'endpointProfileId and providerId are required'));
  }
  if (input.tlsRequired !== true) {
    return err(candidateRejection('TLS_POLICY_VIOLATION', 'tlsRequired must be true'));
  }
  if (input.timeoutMs <= 0 || input.maxResponseBytes <= 0) {
    return err(candidateRejection('ENDPOINT_NOT_APPROVED', 'timeout and response limits must be positive'));
  }
  if (input.allowedPathPrefixes.length === 0 || input.allowedMethods.length === 0) {
    return err(candidateRejection('ENDPOINT_NOT_APPROVED', 'path prefixes and methods are required'));
  }
  if (containsSecret(input)) {
    return err(candidateRejection('AUTHORIZATION_IN_BLUEPRINT', 'endpoint profiles must not store secrets'));
  }
  const origin = parseDestination(input.baseOrigin);
  if (!origin.ok) {
    return err(candidateRejection('ENDPOINT_NOT_APPROVED', origin.error.detail));
  }
  if (origin.value.hasUserInfo) {
    return err(candidateRejection('CREDENTIAL_IN_URL', 'credentials in URL are forbidden'));
  }
  const hostCheck = rejectForbiddenHostname(origin.value.hostname, input);
  if (!hostCheck.ok) {
    return hostCheck;
  }
  if (origin.value.scheme !== 'https' && input.networkZone === 'PUBLIC_INTERNET') {
    return err(candidateRejection('TLS_POLICY_VIOLATION', 'public internet endpoints require HTTPS'));
  }
  return ok(Object.freeze({ ...input, tlsRequired: true as const }));
}

export function rejectForbiddenHostname(
  hostname: string,
  profile: Pick<ExternalProviderEndpointProfile, 'privateNetworkRequired' | 'networkZone'>,
): Result<true, ProviderCandidateRejection> {
  const host = hostname.toLowerCase();
  if (isLinkLocalOrMetadata(host)) {
    return err(candidateRejection('SSRF_DESTINATION_FORBIDDEN', 'metadata and link-local hosts are forbidden'));
  }
  if (isLoopbackHostname(host)) {
    return err(candidateRejection('SSRF_DESTINATION_FORBIDDEN', 'localhost is forbidden'));
  }
  const classified = classifyHostname(host);
  if (classified === 'BLOCKED_METADATA') {
    return err(candidateRejection('SSRF_DESTINATION_FORBIDDEN', 'metadata destinations are forbidden'));
  }
  if (IP_LITERAL.test(host) && profile.networkZone !== 'PRIVATE_NETWORK') {
    return err(candidateRejection('UNAPPROVED_HOSTNAME', 'IP-literal bypass is forbidden unless the private network is approved'));
  }
  if (isPrivateIpv4(host) && (profile.networkZone !== 'PRIVATE_NETWORK' || !profile.privateNetworkRequired)) {
    return err(candidateRejection('SSRF_DESTINATION_FORBIDDEN', 'private network is forbidden unless explicitly approved'));
  }
  if (profile.networkZone === 'PUBLIC_INTERNET' && classified !== 'PUBLIC_INTERNET') {
    return err(candidateRejection('UNAPPROVED_HOSTNAME', `hostname ${host} is not an approved public origin`));
  }
  return ok(true);
}

export function toConnectorEndpointProfile(input: {
  readonly endpoint: ExternalProviderEndpointProfile;
  readonly sourceId: string;
  readonly authenticationClass: AuthenticationMethod;
}): Result<ProviderEndpointProfile, ProviderCandidateRejection> {
  const origin = parseDestination(input.endpoint.baseOrigin);
  if (!origin.ok) {
    return err(candidateRejection('ENDPOINT_NOT_APPROVED', origin.error.detail));
  }
  const mapped: ProviderEndpointProfile = Object.freeze({
    profileId: input.endpoint.endpointProfileId,
    providerId: input.endpoint.providerId,
    sourceId: input.sourceId,
    scheme: origin.value.scheme === 'http' ? 'http' : 'https',
    hostname: origin.value.hostname,
    port: origin.value.port,
    pathPrefix: input.endpoint.allowedPathPrefixes[0] ?? '/',
    allowedMethods: input.endpoint.allowedMethods,
    authenticationClass: input.authenticationClass,
    tlsPolicy: 'REQUIRE_VALID_CERTIFICATE',
    maximumResponseBytes: input.endpoint.maxResponseBytes,
    timeoutMs: input.endpoint.timeoutMs,
    redirectPolicy: input.endpoint.maxRedirects > 0 ? 'FOLLOW_BOUNDED' : 'NONE',
    maxRedirects: input.endpoint.maxRedirects,
    networkClass: input.endpoint.networkZone,
    allowedContentTypes: input.endpoint.expectedContentTypes,
  });
  return ok(mapped);
}

export function enforceApprovedDestination(input: {
  readonly href: string;
  readonly endpoint: ExternalProviderEndpointProfile;
  readonly connectorProfile: ProviderEndpointProfile;
}): Result<true, ProviderCandidateRejection> {
  const destination = parseDestination(input.href);
  if (!destination.ok) {
    return err(candidateRejection('ENDPOINT_NOT_APPROVED', destination.error.detail));
  }
  if (destination.value.hasUserInfo) {
    return err(candidateRejection('CREDENTIAL_IN_URL', 'credentials in URL are forbidden'));
  }
  const host = rejectForbiddenHostname(destination.value.hostname, input.endpoint);
  if (!host.ok) {
    return host;
  }
  const matched = destinationMatchesProfile(destination.value, input.connectorProfile);
  if (!matched.ok) {
    return err(candidateRejection('UNAPPROVED_HOSTNAME', matched.error.detail));
  }
  const ssrf = enforceSsrfPolicy(destination.value, input.connectorProfile, 'FIXTURE');
  if (!ssrf.ok) {
    return err(candidateRejection('SSRF_DESTINATION_FORBIDDEN', ssrf.error.detail));
  }
  const tls = enforceTlsPolicy(destination.value, input.connectorProfile);
  if (!tls.ok) {
    return err(candidateRejection('TLS_POLICY_VIOLATION', tls.error.detail));
  }
  return ok(true);
}

export function governCandidateRedirect(input: {
  readonly currentHref: string;
  readonly location: string;
  readonly endpoint: ExternalProviderEndpointProfile;
  readonly connectorProfile: ProviderEndpointProfile;
  readonly hopsUsed: number;
}): Result<string, ProviderCandidateRejection> {
  const current = parseDestination(input.currentHref);
  if (!current.ok) {
    return err(candidateRejection('REDIRECT_ESCAPE', current.error.detail));
  }
  const next = governRedirect(current.value, input.location, input.connectorProfile, input.hopsUsed, 'FIXTURE');
  if (!next.ok) {
    return err(candidateRejection('REDIRECT_ESCAPE', next.error.detail));
  }
  const host = rejectForbiddenHostname(next.value.hostname, input.endpoint);
  if (!host.ok) {
    return err(candidateRejection('REDIRECT_ESCAPE', host.error.detail));
  }
  return ok(next.value.href);
}

function containsSecret(value: unknown): boolean {
  const encoded = JSON.stringify(value);
  return /authorization|api[_-]?key|client_secret|bearer\s+|-----BEGIN/i.test(encoded);
}
