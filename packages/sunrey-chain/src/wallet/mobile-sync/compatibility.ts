/**
 * Versioned mobile-sync API compatibility and client minimum-version policy.
 */

import {
  MINIMUM_MOBILE_CLIENT_VERSION,
  MOBILE_SYNC_API_VERSION,
  SUPPORTED_MOBILE_CLIENT_VERSIONS,
  type ClientCompatibilityDecision,
} from './types.ts';

export function parseClientVersion(raw: string | undefined): string {
  if (!raw || raw.trim() === '') {
    return MINIMUM_MOBILE_CLIENT_VERSION;
  }
  return raw.trim();
}

export function evaluateClientCompatibility(clientVersion: string): ClientCompatibilityDecision {
  const version = parseClientVersion(clientVersion);
  if (version === '0.9.0' || version.startsWith('0.')) {
    return Object.freeze({
      allowed: false,
      compatibility: 'UPGRADE_REQUIRED',
      minimumVersion: MINIMUM_MOBILE_CLIENT_VERSION,
      currentApiVersion: MOBILE_SYNC_API_VERSION,
      reason: 'protocol-critical incompatibility; upgrade before risky actions',
    });
  }
  if (!(SUPPORTED_MOBILE_CLIENT_VERSIONS as readonly string[]).includes(version) && version !== MINIMUM_MOBILE_CLIENT_VERSION) {
    const [major] = version.split('.');
    if (major === '1') {
      return Object.freeze({
        allowed: true,
        compatibility: 'BACKWARD_COMPATIBLE',
        minimumVersion: MINIMUM_MOBILE_CLIENT_VERSION,
        currentApiVersion: MOBILE_SYNC_API_VERSION,
        reason: 'older supported v1 client; additive fields only',
      });
    }
    return Object.freeze({
      allowed: false,
      compatibility: 'UNSUPPORTED',
      minimumVersion: MINIMUM_MOBILE_CLIENT_VERSION,
      currentApiVersion: MOBILE_SYNC_API_VERSION,
      reason: 'unsupported mobile sync schema',
    });
  }
  return Object.freeze({
    allowed: true,
    compatibility: 'BACKWARD_COMPATIBLE',
    minimumVersion: MINIMUM_MOBILE_CLIENT_VERSION,
    currentApiVersion: MOBILE_SYNC_API_VERSION,
    reason: 'supported mobile sync client',
  });
}

export function minimumVersionMetadata(): Readonly<Record<string, string | boolean>> {
  return Object.freeze({
    apiVersion: MOBILE_SYNC_API_VERSION,
    minimumClientVersion: MINIMUM_MOBILE_CLIENT_VERSION,
    olderSupportedClients: 'explicit BACKWARD_COMPATIBLE handling',
    protocolCriticalIncompatibility: 'requires app upgrade before risky actions',
    silentBreaks: false,
  });
}
