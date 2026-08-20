import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import type { RealEstateRefusal, RealEstateSourceRecord } from './types.ts';

const PERSON_LEVEL_KEYS = Object.freeze([
  'residentname',
  'tenantname',
  'employeename',
  'badgehistory',
  'badgeid',
  'roomaccesslog',
  'accesslog',
  'personoccupancy',
  'individualtrace',
  'occupantname',
]);

function normalizedKey(key: string): string {
  return key.replace(/[^A-Za-z]/g, '').toLowerCase();
}

function extrasLeakPersonLevel(extras: Readonly<Record<string, unknown>> | undefined): string | null {
  if (!extras) {
    return null;
  }
  for (const key of Object.keys(extras)) {
    const normalized = normalizedKey(key);
    if (PERSON_LEVEL_KEYS.some((forbidden) => normalized.includes(forbidden))) {
      return key;
    }
  }
  return null;
}

export function refusePersonLevelData(record: RealEstateSourceRecord): Result<true, RealEstateRefusal> {
  const leaked = extrasLeakPersonLevel(record.extras);
  if (leaked) {
    return err({
      code: 'PERSON_LEVEL_DATA_FORBIDDEN',
      detail: `person-level occupancy field ${leaked} is excluded from economic evidence`,
    });
  }
  return ok(true);
}

export function economicRecordOmitsPersonLevel(record: unknown): boolean {
  const encoded = JSON.stringify(record, (_key, value) => (typeof value === 'bigint' ? value.toString() : value)).toLowerCase();
  return (
    !encoded.includes('residentname') &&
    !encoded.includes('tenant_name') &&
    !encoded.includes('badgehistory') &&
    !encoded.includes('roomaccesslog')
  );
}
