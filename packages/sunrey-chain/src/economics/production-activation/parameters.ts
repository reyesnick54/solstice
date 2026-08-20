/**
 * Production economic parameter checklist and deterministic manifest hash.
 *
 * Zero / placeholder / development values are not production parameters.
 * Hashing is ordered by PRODUCTION_PARAMETER_IDS — never unordered JSON.
 */

import { encodeString, sha256Hex } from '../../validators/canonical.ts';

import {
  PRODUCTION_PARAMETER_IDS,
  REJECTED_PARAMETER_SOURCES,
  type ProductionParameterId,
  type ProductionParameterRecord,
} from './types.ts';

export const PARAMETER_MANIFEST_DOMAIN = 'SUNREY_PRODUCTION_ECONOMIC_PARAMETER_MANIFEST_V1' as const;

export function parameterSourceRejected(
  sourceClass: string,
  infrastructureMetadataOnly: boolean,
): boolean {
  if (infrastructureMetadataOnly) {
    return false;
  }
  return (REJECTED_PARAMETER_SOURCES as readonly string[]).includes(sourceClass);
}

export function unconfiguredParameter(id: ProductionParameterId): ProductionParameterRecord {
  return Object.freeze({
    id,
    status: 'UNCONFIGURED',
    sourceClass: 'UNCONFIGURED',
    versionId: null,
    valueHash: null,
    governed: false,
    infrastructureMetadataOnly: false,
  });
}

export function currentUnconfiguredParameters(): readonly ProductionParameterRecord[] {
  return Object.freeze(PRODUCTION_PARAMETER_IDS.map((id) => unconfiguredParameter(id)));
}

export function classifyParameter(record: ProductionParameterRecord): ProductionParameterRecord {
  if (parameterSourceRejected(record.sourceClass, record.infrastructureMetadataOnly)) {
    return Object.freeze({ ...record, status: 'REJECTED_SOURCE' });
  }
  if (
    record.status === 'UNCONFIGURED' ||
    record.versionId === null ||
    record.valueHash === null ||
    !record.governed
  ) {
    return Object.freeze({ ...record, status: 'UNCONFIGURED' });
  }
  if (record.versionId.toLowerCase() === 'latest') {
    return Object.freeze({ ...record, status: 'UNCONFIGURED' });
  }
  return Object.freeze({ ...record, status: 'CONFIGURED' });
}

export function parameterManifestHash(parameters: readonly ProductionParameterRecord[]): string {
  const byId = new Map(parameters.map((row) => [row.id, classifyParameter(row)]));
  const parts = [encodeString(PARAMETER_MANIFEST_DOMAIN), encodeString(String(PRODUCTION_PARAMETER_IDS.length))];
  for (const id of PRODUCTION_PARAMETER_IDS) {
    const row = byId.get(id) ?? unconfiguredParameter(id);
    parts.push(
      encodeString(row.id),
      encodeString(row.status),
      encodeString(row.sourceClass),
      encodeString(row.versionId ?? ''),
      encodeString(row.valueHash ?? ''),
      encodeString(row.governed ? '1' : '0'),
      encodeString(row.infrastructureMetadataOnly ? '1' : '0'),
    );
  }
  return sha256Hex(Buffer.concat(parts));
}

export function overallParameterStatus(
  parameters: readonly ProductionParameterRecord[],
): 'UNCONFIGURED' | 'REJECTED_SOURCE' | 'CONFIGURED' {
  const classified = PRODUCTION_PARAMETER_IDS.map(
    (id) => parameters.find((row) => row.id === id) ?? unconfiguredParameter(id),
  ).map(classifyParameter);
  if (classified.some((row) => row.status === 'REJECTED_SOURCE')) {
    return 'REJECTED_SOURCE';
  }
  if (classified.every((row) => row.status === 'CONFIGURED')) {
    return 'CONFIGURED';
  }
  return 'UNCONFIGURED';
}

export function parameterConfigured(parameters: readonly ProductionParameterRecord[], id: ProductionParameterId): boolean {
  const found = parameters.find((row) => row.id === id);
  return classifyParameter(found ?? unconfiguredParameter(id)).status === 'CONFIGURED';
}
