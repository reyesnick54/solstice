/**
 * Public SunRey API version model.
 *
 * A protocol upgrade does not automatically imply an API breaking change.
 */

export const PUBLIC_API_VERSION = 'v1' as const;
export const PUBLIC_API_VERSION_NUMBER = 1 as const;
export const OPERATOR_API_VERSION = 'v1' as const;

export const API_COMPATIBILITY = [
  'BACKWARD_COMPATIBLE',
  'DEPRECATED',
  'BREAKING_CHANGE',
] as const;
export type ApiCompatibility = (typeof API_COMPATIBILITY)[number];

export const SUPPORTED_PUBLIC_API_VERSIONS = ['v1'] as const;
export type PublicApiVersion = (typeof SUPPORTED_PUBLIC_API_VERSIONS)[number];

export type ApiVersionDescriptor = {
  readonly version: PublicApiVersion;
  readonly compatibility: ApiCompatibility;
  readonly protocolVersionIndependent: true;
  readonly notes: string;
};

export const V1_API: ApiVersionDescriptor = Object.freeze({
  version: 'v1',
  compatibility: 'BACKWARD_COMPATIBLE',
  protocolVersionIndependent: true,
  notes: 'Initial public developer API. Protocol upgrades are not automatic API breaks.',
});

export function parseApiVersion(raw: string | undefined): PublicApiVersion | null {
  if (raw === undefined || raw === '') {
    return 'v1';
  }
  const normalized = raw.replace(/^\//, '').toLowerCase();
  if (normalized === 'v1' || normalized === '1') {
    return 'v1';
  }
  return null;
}

export function isSupportedPublicApiVersion(value: string): value is PublicApiVersion {
  return (SUPPORTED_PUBLIC_API_VERSIONS as readonly string[]).includes(value);
}

export type ApiDeprecationMetadata = {
  readonly path: string;
  readonly introducedIn: PublicApiVersion;
  readonly compatibility: 'DEPRECATED';
  readonly successor: string | null;
  readonly sunsetAt: string | null;
  readonly silentBreakForbidden: true;
};

export const API_DEPRECATIONS: readonly ApiDeprecationMetadata[] = Object.freeze([]);

export function compatibilityPolicy(): Readonly<Record<string, string>> {
  return Object.freeze({
    current: PUBLIC_API_VERSION,
    additiveFields: 'BACKWARD_COMPATIBLE',
    scheduledRemoval: 'DEPRECATED',
    newMajor: 'BREAKING_CHANGE',
    silentBreaks: 'forbidden',
    protocolUpgradeImpliesApiBreak: 'false',
  });
/**
 * Breaking public API changes require a new versioned prefix.
 * `/v1` remains the current public surface. `/v2` is reserved and
 * unpublished until an explicit compatibility review.
 */
export const PUBLIC_API_VERSION_STRATEGY = Object.freeze({
  current: 'v1' as const,
  preserveV1: true,
  breakingChangesRequireVersioning: true,
  unpublishedNext: 'v2' as const,
  protocolUpgradeDoesNotBreakApi: true,
});

export function requireVersionedPublicPath(path: string): boolean {
  return path === '/health' || path === '/ready' || path.startsWith('/v1/') || path.startsWith('/operator/v1/');
}
