import { breakingSchemaChange, validateExternalRecord } from '../schema.ts';
import type { FeedSchemaDefinition } from '../types.ts';
import type {
  CertificationPolicy,
  CertificationSubject,
  SchemaConformanceResult,
  SchemaDriftKind,
} from './types.ts';

const INTEGER_RE = /^-?\d+$/;

export function detectSchemaDrift(input: {
  readonly subject: CertificationSubject;
  readonly policy: CertificationPolicy;
  readonly previousRequiredFields?: readonly string[];
}): readonly SchemaDriftKind[] {
  const kinds: SchemaDriftKind[] = [];
  const observation = input.subject.observations[0];
  if (!observation) {
    return Object.freeze(['MISSING_FIELD']);
  }
  const prior = input.subject.prior;
  if (prior) {
    if (observation.schemaVersion !== prior.schemaVersion || observation.schemaId !== prior.schemaId) {
      kinds.push('UNSUPPORTED_VERSION');
    }
    if (observation.unit !== prior.unit) {
      kinds.push('UNIT_CHANGE');
    }
    if (prior.requiredFields.length > 0) {
      const present = new Set([
        'identifier',
        'numericValue',
        'unit',
        'sourceTimestampUnix',
        'schemaId',
        'schemaVersion',
        ...Object.keys(observation.extras ?? {}),
      ]);
      for (const field of prior.requiredFields) {
        if (!present.has(field)) {
          kinds.push('MISSING_FIELD');
        }
      }
    }
  }
  if (observation.extras) {
    for (const [key, value] of Object.entries(observation.extras)) {
      if (key.endsWith('_renamed') || key === 'renamedFrom') {
        kinds.push('RENAMED_FIELD');
      }
      if (typeof value === 'number' && !Number.isInteger(value)) {
        kinds.push('TYPE_CHANGE');
      }
      if (Array.isArray(value) && value.length > input.policy.maximumArrayLength) {
        kinds.push('ARRAY_EXPLOSION');
      }
    }
  }
  if (observation.numericValue.includes('.') || /e/i.test(observation.numericValue)) {
    kinds.push('TYPE_CHANGE');
  }
  if (observation.timestampSemantic === 'INGESTION' || observation.timestampSemantic === 'UNKNOWN') {
    kinds.push('TIMESTAMP_SEMANTIC_CHANGE');
  }
  if (prior && observation.identifier !== input.subject.sourceId && !new RegExp(input.policy.identifierPattern).test(observation.identifier)) {
    kinds.push('IDENTIFIER_CHANGE');
  }
  if (observation.schemaVersion !== input.subject.schemaVersion) {
    kinds.push('UNSUPPORTED_VERSION');
  }
  return Object.freeze([...new Set(kinds)]);
}

export function evaluateSchemaConformance(
  subject: CertificationSubject,
  policy: CertificationPolicy,
  feedSchema: FeedSchemaDefinition,
): SchemaConformanceResult {
  const details: string[] = [];
  const connector = subject.connector;
  const observation = subject.observations[0];
  const authenticationOk = connector.authenticationSucceeded;
  if (!authenticationOk) {
    details.push('authentication failed');
  }
  const endpointApproved = connector.approvedEndpointProfile && connector.endpointAllowlisted;
  if (!endpointApproved) {
    details.push('endpoint profile is not approved');
  }
  const responseBounded =
    connector.responseBytes <= policy.maximumResponseBytes &&
    connector.responseBytes <= connector.maxResponseBytes &&
    (observation === undefined || observation.responseBytes <= policy.maximumResponseBytes);
  if (!responseBounded) {
    details.push('response exceeds certified bound');
  }
  const contentTypeOk =
    connector.contentType === policy.approvedContentType &&
    (observation === undefined || observation.contentType === policy.approvedContentType);
  if (!contentTypeOk) {
    details.push(`content type ${connector.contentType} is not ${policy.approvedContentType}`);
  }

  let schemaValid = false;
  let identifiersValid = false;
  let sourceTimestampPresent = false;
  if (observation) {
    const validated = validateExternalRecord(feedSchema, {
      identifier: observation.identifier,
      numericValue: observation.numericValue,
      unit: observation.unit,
      sourceTimestampUnix: observation.sourceTimestampUnix,
      schemaId: observation.schemaId,
      schemaVersion: observation.schemaVersion,
      extras: observation.extras,
    });
    schemaValid = validated.ok;
    if (!validated.ok) {
      details.push(validated.error.detail);
    }
    identifiersValid = new RegExp(policy.identifierPattern).test(observation.identifier);
    if (!identifiersValid) {
      details.push(`identifier ${observation.identifier} is not an approved pattern`);
    }
    sourceTimestampPresent =
      observation.sourceTimestampUnix.length > 0 && INTEGER_RE.test(observation.sourceTimestampUnix);
    if (!sourceTimestampPresent) {
      details.push('source timestamp is missing or not an integer unix second');
    }
  } else {
    details.push('no sandbox observation was supplied');
  }

  const driftKinds = detectSchemaDrift({ subject, policy, previousRequiredFields: feedSchema.requiredFields });
  if (driftKinds.length > 0) {
    details.push(`schema drift: ${driftKinds.join(',')}`);
  }

  if (subject.prior) {
    const nextSchema: FeedSchemaDefinition = Object.freeze({
      ...feedSchema,
      schemaId: observation?.schemaId ?? feedSchema.schemaId,
      version: observation?.schemaVersion ?? feedSchema.version,
      unit: (observation?.unit as FeedSchemaDefinition['unit']) ?? feedSchema.unit,
    });
    const priorSchema: FeedSchemaDefinition = Object.freeze({
      ...feedSchema,
      schemaId: subject.prior.schemaId,
      version: subject.prior.schemaVersion,
      unit: subject.prior.unit as FeedSchemaDefinition['unit'],
      requiredFields: subject.prior.requiredFields,
    });
    if (breakingSchemaChange(priorSchema, nextSchema)) {
      details.push('breaking schema change requires a new source schema version and certification');
    }
  }

  const blocking =
    !authenticationOk ||
    !endpointApproved ||
    !responseBounded ||
    !contentTypeOk ||
    !schemaValid ||
    !identifiersValid ||
    !sourceTimestampPresent ||
    driftKinds.includes('UNSUPPORTED_VERSION') ||
    driftKinds.includes('TYPE_CHANGE') ||
    driftKinds.includes('UNIT_CHANGE') ||
    driftKinds.includes('ARRAY_EXPLOSION') ||
    driftKinds.includes('TIMESTAMP_SEMANTIC_CHANGE');

  return Object.freeze({
    verdict: blocking ? 'FAIL' : 'PASS',
    authenticationOk,
    endpointApproved,
    responseBounded,
    contentTypeOk,
    schemaValid,
    identifiersValid,
    sourceTimestampPresent,
    driftKinds,
    details: Object.freeze(details),
  });
}
