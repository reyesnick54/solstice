// @ts-nocheck
import { buildExternalObservation } from '../../../provider-sdk/src/observation.ts';
import type { ExternalObservation } from '../../../provider-sdk/src/types.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';

export const FABRIC_OBSERVATION_ENVELOPE_SCHEMA = 'sunrey.fabric.observation-envelope.v1' as const;

export type CanonicalObservationEnvelope = {
  readonly schemaVersion: typeof FABRIC_OBSERVATION_ENVELOPE_SCHEMA;
  readonly envelopeId: string;
  readonly providerId: string;
  readonly economicDomain: string;
  readonly sourceClass: string;
  readonly externalObservation: ExternalObservation<unknown>;
  readonly normalizedAtUtc: string;
  readonly provenanceDigest: string;
  readonly licensingDigest: string;
};

export type NormalizeObservationInput = {
  readonly envelopeId: string;
  readonly providerId: string;
  readonly economicDomain: string;
  readonly sourceClass: string;
  readonly capability: string;
  readonly payload: unknown;
  readonly rawPayload: string;
  readonly retrievedAtUtc: string;
};

export function normalizeToEnvelope(input: NormalizeObservationInput): CanonicalObservationEnvelope {
  const built = buildExternalObservation({
    providerId: input.providerId,
    providerCategory: 'macroeconomics',
    capability: input.capability,
    data: input.payload,
    source: { provider: input.providerId, dataset: input.capability },
    time: { retrievedAt: asUtcInstant(input.retrievedAtUtc) },
    authorityClass: 'reference_data',
    provenance: {
      rawPayload: input.rawPayload,
      providerSchemaVersion: '1.0.0',
      normalizationVersion: FABRIC_OBSERVATION_ENVELOPE_SCHEMA,
    },
    licensing: {
      commercialUseStatus: 'research_only',
      redistributionStatus: 'prohibited',
    },
  });

  if (!built.ok) {
    throw new Error(`normalization failed: ${built.message}`);
  }

  const obs = built.value;
  return Object.freeze({
    schemaVersion: FABRIC_OBSERVATION_ENVELOPE_SCHEMA,
    envelopeId: input.envelopeId,
    providerId: input.providerId,
    economicDomain: input.economicDomain,
    sourceClass: input.sourceClass,
    externalObservation: obs,
    normalizedAtUtc: input.retrievedAtUtc,
    provenanceDigest: obs.provenance.rawPayloadHash,
    licensingDigest: `${obs.licensing.commercialUseStatus}:${obs.licensing.redistributionStatus}`,
  });
}
