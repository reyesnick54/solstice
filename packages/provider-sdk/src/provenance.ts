/**
 * Provenance helpers. Secrets and auth query parameters never persist.
 */

import type { ObservationProvenance, ObservationSource } from './types.ts';
import { hashRawPayload, type RawPayloadHash } from './hash.ts';

const SECRET_QUERY_PARAM_NAMES = new Set([
  'api_key',
  'apikey',
  'api-key',
  'access_token',
  'access-token',
  'token',
  'auth',
  'authorization',
  'secret',
  'password',
  'passwd',
  'signature',
  'sig',
  'key',
  'session',
  'sessionid',
  'session_id',
]);

export function sanitizeSourceUrl(sourceUrl: string | null | undefined): string | null {
  if (!sourceUrl || sourceUrl.trim().length === 0) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return null;
  }
  for (const name of [...parsed.searchParams.keys()]) {
    if (SECRET_QUERY_PARAM_NAMES.has(name.toLowerCase())) {
      parsed.searchParams.delete(name);
    }
  }
  return parsed.toString();
}

export function buildObservationSource(input: {
  readonly provider: string;
  readonly dataset: string;
  readonly sourceUrl?: string | null;
}): ObservationSource {
  return Object.freeze({
    provider: input.provider,
    dataset: input.dataset,
    sourceUrl: sanitizeSourceUrl(input.sourceUrl ?? null),
  });
}

export function buildProvenance(input: {
  readonly requestId?: string | null;
  readonly rawPayload: string | Buffer;
  readonly providerSchemaVersion: string;
  readonly normalizationVersion: string;
  readonly canonicalModelVersion?: string | null;
}): ObservationProvenance {
  const hash: RawPayloadHash = hashRawPayload(input.rawPayload);
  return Object.freeze({
    requestId: input.requestId ?? null,
    rawPayloadHash: hash.digest,
    providerSchemaVersion: input.providerSchemaVersion,
    normalizationVersion: input.normalizationVersion,
    canonicalModelVersion: input.canonicalModelVersion ?? null,
  });
}

export function provenanceDigestMaterial(provenance: ObservationProvenance): string {
  return [
    provenance.requestId ?? '',
    provenance.rawPayloadHash,
    provenance.providerSchemaVersion,
    provenance.normalizationVersion,
    provenance.canonicalModelVersion ?? '',
  ].join('|');
}
