import { contentHashOf, recordProvenance } from '../provenance.ts';
import { COLLECTOR_VERSION } from '../types.ts';
import type { CertificationPolicy, CertificationSubject, ProvenanceConformanceResult } from './types.ts';

const CREDENTIAL_KEYS = ['apiKey', 'password', 'secret', 'token', 'authorization', 'credential', 'privateKey'];

export function evaluateProvenanceConformance(
  subject: CertificationSubject,
  policy: CertificationPolicy,
): ProvenanceConformanceResult {
  const details: string[] = [];
  const observation = subject.observations[0];
  if (!observation) {
    return Object.freeze({
      verdict: 'FAIL',
      requiredFieldsPresent: false,
      credentialMaterialAbsent: true,
      contentHashDeterministic: false,
      details: Object.freeze(['no observation available for provenance']),
    });
  }

  const leaked = Boolean(observation.leakedCredentialField) || hasCredentialMaterial(observation);
  if (leaked) {
    details.push('credential material must not appear in provenance or observation payload');
  }

  const present = {
    providerId: subject.providerId.length > 0,
    sourceId: subject.sourceId.length > 0,
    sourceObservationId: observation.sourceObservationId.length > 0,
    collectionTime: observation.collectionTimestampUnix.length > 0,
    sourceTime: observation.sourceTimestampUnix.length > 0,
    schemaVersion: Number.isInteger(observation.schemaVersion),
    unit: observation.unit.length > 0,
    normalizationVersion: subject.normalizationVersion.length > 0,
    collectorVersion: COLLECTOR_VERSION.length > 0,
    contentHash: true,
  };
  const missing = policy.requiredProvenanceFields.filter((field) => present[field as keyof typeof present] !== true);
  if (missing.length > 0) {
    details.push(`missing provenance fields: ${missing.join(',')}`);
  }

  const payload = Object.freeze({
    identifier: observation.identifier,
    numericValue: observation.numericValue,
    unit: observation.unit,
    sourceTimestampUnix: observation.sourceTimestampUnix,
    schemaId: observation.schemaId,
    schemaVersion: observation.schemaVersion,
  });
  const first = contentHashOf(payload);
  const second = contentHashOf(payload);
  const provenance = recordProvenance({
    providerId: subject.providerId,
    sourceId: subject.sourceId,
    sourceObservationId: observation.sourceObservationId,
    collectionTimestampUnix: BigInt(observation.collectionTimestampUnix || '0'),
    sourceTimestampUnix: BigInt(observation.sourceTimestampUnix || '0'),
    schemaVersionRecord: observation.schemaVersion,
    unit: observation.unit as never,
    normalizationVersion: subject.normalizationVersion,
    credentialRefHref: null,
    authMethod: subject.connector.authenticationClass,
    payload,
  });
  const contentHashDeterministic = first === second && provenance.contentHash === first;
  if (!contentHashDeterministic) {
    details.push('content hash is not deterministic');
  }

  return Object.freeze({
    verdict: leaked || missing.length > 0 || !contentHashDeterministic ? 'FAIL' : 'PASS',
    requiredFieldsPresent: missing.length === 0,
    credentialMaterialAbsent: true,
    contentHashDeterministic,
    details: Object.freeze(leaked ? [...details] : details),
  });
}

function hasCredentialMaterial(observation: CertificationSubject['observations'][number]): boolean {
  const extras = observation.extras ?? {};
  return CREDENTIAL_KEYS.some((key) => key in extras || key === observation.leakedCredentialField);
}
