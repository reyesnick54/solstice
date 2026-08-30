/**
 * Generic normalization pipeline contracts.
 *
 * RawProviderResponse
 *   → provider schema validation
 *   → provider parser
 *   → canonical domain mapping
 *   → ExternalObservation<T>
 *   → domain service
 */

import { hashRawPayload } from './hash.ts';
import type { ExternalObservation, ProviderResult } from './types.ts';
import type { UntrustedPayloadResult } from './untrusted.ts';

export type RawProviderResponse = {
  readonly providerId: string;
  readonly capability: string;
  readonly requestId: string | null;
  readonly retrievedAt: string;
  readonly rawPayload: string | Buffer;
  readonly sourceUrl?: string | null;
  readonly providerSchemaVersion: string;
};

export type ProviderSchemaValidator = {
  readonly providerId: string;
  readonly providerSchemaVersion: string;
  validate(raw: unknown): ProviderResult<unknown>;
};

export type ProviderParser<TParsed> = {
  readonly providerId: string;
  parse(validated: unknown): ProviderResult<TParsed>;
};

export type DomainMapper<TParsed, TDomain> = {
  readonly normalizationVersion: string;
  readonly canonicalModelVersion?: string | null;
  map(parsed: TParsed): ProviderResult<TDomain>;
};

export type ObservationAssembler<TDomain> = {
  assemble(input: {
    readonly raw: RawProviderResponse;
    readonly domainData: TDomain;
    readonly rawPayloadHash: string;
  }): ProviderResult<ExternalObservation<TDomain>>;
};

export type NormalizationPipeline<TParsed, TDomain> = {
  readonly untrustedParse: (payload: string | Buffer) => UntrustedPayloadResult;
  readonly schemaValidator: ProviderSchemaValidator;
  readonly parser: ProviderParser<TParsed>;
  readonly mapper: DomainMapper<TParsed, TDomain>;
  readonly assembler: ObservationAssembler<TDomain>;
};

export function runNormalizationPipeline<TParsed, TDomain>(
  pipeline: NormalizationPipeline<TParsed, TDomain>,
  raw: RawProviderResponse,
): ProviderResult<ExternalObservation<TDomain>> {
  const parsed = pipeline.untrustedParse(raw.rawPayload);
  if (!parsed.ok) {
    return { ok: false, code: parsed.code, message: parsed.message };
  }
  const validated = pipeline.schemaValidator.validate(parsed.value);
  if (!validated.ok) {
    return validated;
  }
  const parsedDomain = pipeline.parser.parse(validated.value);
  if (!parsedDomain.ok) {
    return parsedDomain;
  }
  const mapped = pipeline.mapper.map(parsedDomain.value);
  if (!mapped.ok) {
    return mapped;
  }
  const digest = hashRawPayload(raw.rawPayload).digest;
  return pipeline.assembler.assemble({
    raw,
    domainData: mapped.value,
    rawPayloadHash: digest,
  });
}
