import { err, ok, type Result } from '../../../../../domain/src/result.ts';
import type { ExternalSourceRecord } from '../schema.ts';
import { validateExternalRecord } from '../schema.ts';
import type { FeedSchemaDefinition } from '../types.ts';
import { deterministicSourceObservationId } from './profiles.ts';
import {
  candidateRejection,
  type ExternalProviderFeedProfile,
  type ProviderCandidateRejection,
  type TimestampSemantics,
} from './types.ts';

export type VendorShapedRecord = {
  readonly schemaId?: string;
  readonly schemaVersion?: number;
  readonly unit?: string;
  readonly timestamp?: string;
  readonly intervalStart?: string;
  readonly intervalEnd?: string;
  readonly snapshotTime?: string;
  readonly cumulativeTime?: string;
  readonly identifier?: string;
  readonly value?: string;
  readonly [key: string]: unknown;
};

export type ExternalProviderResponseTranslator = {
  readonly translatorId: string;
  readonly providerSchemaId: string;
  readonly providerSchemaVersion: number;
  readonly canonicalSchemaId: string;
  readonly mappingVersion: number;
  translate(input: {
    readonly body: unknown;
    readonly feed: ExternalProviderFeedProfile;
    readonly schema: FeedSchemaDefinition;
    readonly providerId: string;
  }): Result<readonly ExternalSourceRecord[], ProviderCandidateRejection>;
};

export function detectSchemaDrift(input: {
  readonly feed: ExternalProviderFeedProfile;
  readonly incomingSchemaId?: string | undefined;
  readonly incomingSchemaVersion?: number | undefined;
  readonly incomingUnit?: string | undefined;
  readonly incomingTimestampSemantics?: TimestampSemantics;
  readonly missingRequiredField?: boolean;
  readonly fieldTypeChanged?: boolean;
}): Result<true, ProviderCandidateRejection> {
  if (input.missingRequiredField || input.fieldTypeChanged) {
    return err(candidateRejection('SCHEMA_DRIFT', 'unexpected field removal or type change requires revalidation'));
  }
  if (input.incomingSchemaId && input.incomingSchemaId !== input.feed.providerSchemaId) {
    return err(candidateRejection('SCHEMA_DRIFT', `schema ${input.incomingSchemaId} is not the bound provider schema`));
  }
  if (input.incomingSchemaVersion !== undefined && input.incomingSchemaVersion !== input.feed.providerSchemaVersion) {
    return err(candidateRejection('SCHEMA_DRIFT', `schema version ${input.incomingSchemaVersion} drifted`));
  }
  if (input.incomingUnit && input.incomingUnit !== input.feed.sourceUnit) {
    return err(candidateRejection('UNIT_DRIFT', `unit ${input.incomingUnit} drifted from ${input.feed.sourceUnit}`));
  }
  if (input.incomingTimestampSemantics && input.incomingTimestampSemantics !== input.feed.timestampSemantics) {
    return err(candidateRejection('TIMESTAMP_SEMANTICS_DRIFT', 'timestamp semantics changed'));
  }
  return ok(true);
}

export function extractSourceTimestamp(
  record: VendorShapedRecord,
  semantics: TimestampSemantics,
): Result<string, ProviderCandidateRejection> {
  const raw =
    semantics === 'SOURCE_EVENT_TIME'
      ? record.timestamp
      : semantics === 'INTERVAL_START_END'
        ? record.intervalStart
        : semantics === 'SNAPSHOT_TIME'
          ? record.snapshotTime
          : record.cumulativeTime;
  if (typeof raw !== 'string' || raw.length === 0 || !/^-?\d+$/.test(raw)) {
    return err(candidateRejection('TIMESTAMP_MISSING', `${semantics} is required and cannot be fabricated from collection time`));
  }
  return ok(raw);
}

export function translateVendorRecord(input: {
  readonly vendor: VendorShapedRecord;
  readonly feed: ExternalProviderFeedProfile;
  readonly schema: FeedSchemaDefinition;
  readonly providerId: string;
}): Result<ExternalSourceRecord, ProviderCandidateRejection> {
  const drift = detectSchemaDrift({
    feed: input.feed,
    incomingSchemaId: input.vendor.schemaId,
    incomingSchemaVersion: input.vendor.schemaVersion,
    incomingUnit: input.vendor.unit,
  });
  if (!drift.ok) {
    return drift;
  }
  if (input.vendor.unit && input.vendor.unit !== input.feed.sourceUnit) {
    return err(candidateRejection('UNIT_DRIFT', `unit ${input.vendor.unit} is not the declared source unit`));
  }
  if (input.vendor.unit && input.vendor.unit !== input.schema.unit && input.feed.canonicalUnitPath.length === 0) {
    return err(candidateRejection('UNIT_EXTENSION_REQUIRED', `unsupported unit ${input.vendor.unit}`));
  }
  const timestamp = extractSourceTimestamp(input.vendor, input.feed.timestampSemantics);
  if (!timestamp.ok) {
    return timestamp;
  }
  if (typeof input.vendor.identifier !== 'string' || typeof input.vendor.value !== 'string') {
    return err(candidateRejection('SCHEMA_DRIFT', 'vendor record missing identifier or value'));
  }
  const record: ExternalSourceRecord = Object.freeze({
    identifier: input.vendor.identifier,
    numericValue: input.vendor.value,
    unit: input.feed.sourceUnit,
    sourceTimestampUnix: timestamp.value,
    schemaId: input.feed.canonicalSchemaId,
    schemaVersion: input.schema.version,
    extras: Object.freeze({
      sourceObservationId: deterministicSourceObservationId({
        providerId: input.providerId,
        sourceId: input.feed.sourceId,
        feedId: input.feed.feedId,
        subject: input.vendor.identifier,
        sourceTimestampUnix: timestamp.value,
        numericValue: input.vendor.value,
      }),
    }),
  });
  const validated = validateExternalRecord(input.schema, record);
  if (!validated.ok) {
    if (validated.error.code === 'WRONG_UNIT') {
      return err(candidateRejection('UNIT_EXTENSION_REQUIRED', validated.error.detail));
    }
    if (validated.error.code === 'SCHEMA_DRIFT' || validated.error.code === 'SCHEMA_INCOMPATIBLE') {
      return err(candidateRejection('SCHEMA_DRIFT', validated.error.detail));
    }
    return err(candidateRejection('SCHEMA_DRIFT', validated.error.detail));
  }
  return ok(validated.value);
}

export function createFixtureTranslator(translatorId: string): ExternalProviderResponseTranslator {
  return Object.freeze({
    translatorId,
    providerSchemaId: 'fixture.vendor.v1',
    providerSchemaVersion: 1,
    canonicalSchemaId: 'energy.resource.v1',
    mappingVersion: 1,
    translate(input) {
      const body = input.body;
      const rows = Array.isArray((body as { records?: unknown }).records)
        ? ((body as { records: VendorShapedRecord[] }).records)
        : [body as VendorShapedRecord];
      const out: ExternalSourceRecord[] = [];
      for (const row of rows) {
        const translated = translateVendorRecord({
          vendor: row,
          feed: input.feed,
          schema: input.schema,
          providerId: input.providerId,
        });
        if (!translated.ok) {
          return translated;
        }
        out.push(translated.value);
      }
      return ok(Object.freeze(out));
    },
  });
}

export function vendorDtoMustNotEscape(value: unknown): Result<true, ProviderCandidateRejection> {
  if (value && typeof value === 'object' && 'vendorDto' in value) {
    return err(candidateRejection('VENDOR_DTO_ESCAPE_FORBIDDEN', 'vendor DTOs cannot leave the translator'));
  }
  const encoded = JSON.stringify(value);
  if (/"kWh_raw"|"meterReadingRaw"|"vendorPayload"/.test(encoded)) {
    return err(candidateRejection('VENDOR_DTO_ESCAPE_FORBIDDEN', 'raw vendor fields escaped the adapter'));
  }
  return ok(true);
}
