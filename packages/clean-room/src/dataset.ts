import type { DataCategory } from '../../personal-data-vault/src/taxonomy.ts';
import { newCleanRoomDatasetId } from './ids.ts';
import type { DatasetLineage } from './types.ts';
import type { EphemeralRow } from './compute.ts';

const ROW_FIELDS = Object.freeze(['category', 'amountMinor', 'bookedAt', 'currency']);

export function minimizePayload(
  payload: unknown,
  allowedFields: readonly string[],
): readonly Readonly<Record<string, string | number | boolean | null>>[] {
  if (payload === null || typeof payload !== 'object') {
    return Object.freeze([]);
  }
  const body = payload as Record<string, unknown>;
  if (Array.isArray(body.transactions) && allowedFields.includes('transactions')) {
    return Object.freeze(
      body.transactions.flatMap((row) => {
        if (row === null || typeof row !== 'object') {
          return [];
        }
        const source = row as Record<string, unknown>;
        const picked: Record<string, string | number | boolean | null> = {};
        for (const field of ROW_FIELDS) {
          if (allowedFields.includes(field) && field in source) {
            const value = source[field];
            if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) {
              picked[field] = value;
            }
          }
        }
        return Object.keys(picked).length > 0 ? [Object.freeze(picked)] : [];
      }),
    );
  }
  const picked: Record<string, string | number | boolean | null> = {};
  for (const field of allowedFields) {
    if (field === 'transactions') {
      continue;
    }
    const value = body[field];
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) {
      picked[field] = value;
    }
  }
  return Object.keys(picked).length > 0 ? Object.freeze([Object.freeze(picked)]) : Object.freeze([]);
}

export function buildLineage(input: {
  readonly sessionId: DatasetLineage['sessionId'];
  readonly jobId: DatasetLineage['jobId'];
  readonly rows: readonly EphemeralRow[];
  readonly assets: DatasetLineage['assetRefs'];
  readonly fields: readonly string[];
  readonly createdAt: DatasetLineage['createdAt'];
}): DatasetLineage {
  return Object.freeze({
    datasetId: newCleanRoomDatasetId(),
    sessionId: input.sessionId,
    jobId: input.jobId,
    subjectCount: new Set(input.rows.map((row) => row.subjectId)).size,
    assetRefs: Object.freeze([...input.assets]),
    fields: Object.freeze([...input.fields]),
    createdAt: input.createdAt,
    plaintextPersisted: false,
  });
}

export function isForbiddenAutoField(category: DataCategory): boolean {
  return (
    category === 'PAYROLL_DATA' ||
    category === 'DOCUMENT' ||
    category === 'IDENTITY_ATTRIBUTE' ||
    category === 'LOCATION_SUMMARY'
  );
}
