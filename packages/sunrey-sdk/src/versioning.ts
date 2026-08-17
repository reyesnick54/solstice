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
