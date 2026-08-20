import { evaluateNetworkPath } from '../../infra/network.ts';
import type { NetworkZone } from '../../infra/types.ts';
import {
  BINDING_CERTIFICATE_EXPECTATIONS,
  BINDING_REDIRECT_POLICIES,
  BINDING_TLS_POLICIES,
  bindingErr,
  bindingOk,
  type BindingEndpointProfile,
  type BindingResult,
} from './types.ts';

const BLOCKED_HOSTS = Object.freeze([
  'localhost',
  '127.0.0.1',
  '::1',
  '0.0.0.0',
  'metadata.google.internal',
  '169.254.169.254',
]);

function isPrivateOrLinkLocalHost(host: string): boolean {
  const normalized = host.toLowerCase();
  if (BLOCKED_HOSTS.includes(normalized)) {
    return true;
  }
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(normalized)) {
    return true;
  }
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(normalized)) {
    return true;
  }
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(normalized)) {
    return true;
  }
  if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(normalized)) {
    return true;
  }
  return false;
}

export function validateEndpointProfile(profile: BindingEndpointProfile | null | undefined): BindingResult<BindingEndpointProfile> {
  if (!profile) {
    return bindingErr('ENDPOINT_PROFILE_REQUIRED', 'endpoint profile is required');
  }
  if (!profile.profileId) {
    return bindingErr('ENDPOINT_PROFILE_REQUIRED', 'endpoint profile id is required');
  }
  if (profile.scheme !== 'https') {
    return bindingErr('ENDPOINT_PROFILE_INVALID', 'only https endpoint profiles are permitted');
  }
  if (!profile.host || isPrivateOrLinkLocalHost(profile.host)) {
    return bindingErr('ENDPOINT_PROFILE_INVALID', `host ${profile.host} is blocked by SSRF policy`);
  }
  if (profile.port <= 0 || profile.port > 65535) {
    return bindingErr('ENDPOINT_PROFILE_INVALID', 'endpoint port is invalid');
  }
  if (!profile.approvedPathPrefix.startsWith('/')) {
    return bindingErr('ENDPOINT_PROFILE_INVALID', 'approved path prefix must start with /');
  }
  if (!(BINDING_TLS_POLICIES as readonly string[]).includes(profile.tlsPolicy)) {
    return bindingErr('ENDPOINT_PROFILE_INVALID', 'TLS policy is required');
  }
  if (!(BINDING_REDIRECT_POLICIES as readonly string[]).includes(profile.redirectPolicy)) {
    return bindingErr('ENDPOINT_PROFILE_INVALID', 'redirect policy is required');
  }
  if (!(BINDING_CERTIFICATE_EXPECTATIONS as readonly string[]).includes(profile.certificateExpectation)) {
    return bindingErr('ENDPOINT_PROFILE_INVALID', 'certificate expectation is required');
  }
  if (!profile.allowlisted) {
    return bindingErr('ENDPOINT_PROFILE_INVALID', 'endpoint host must be on the allowlist');
  }
  if (profile.connectivityEnabled !== false) {
    return bindingErr('CONNECTIVITY_CANNOT_BE_ENABLED', 'binding endpoint connectivity stays disabled');
  }
  return bindingOk(profile);
}

export function authorizeBindingEgress(from: NetworkZone, to: NetworkZone): BindingResult<true> {
  const decision = evaluateNetworkPath(from, to);
  if (!decision.allowed) {
    return bindingErr('ENDPOINT_PROFILE_INVALID', decision.reason);
  }
  return bindingOk(true);
}
