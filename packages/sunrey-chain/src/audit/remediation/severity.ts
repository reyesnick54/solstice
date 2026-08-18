import { FINDING_SEVERITIES, type FindingSeverity } from './types.ts';

const RANK: Readonly<Record<FindingSeverity, number>> = {
  INFORMATIONAL: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

export function isFindingSeverity(value: string): value is FindingSeverity {
  return (FINDING_SEVERITIES as readonly string[]).includes(value);
}

export function severityRank(severity: FindingSeverity): number {
  return RANK[severity];
}

/**
 * Map a reviewer-provided severity string onto the engineering scale
 * without rewriting the source string. Unknown source values stay
 * unmapped so they cannot silently disappear.
 */
export function mapExternalSeverity(source: string): FindingSeverity | null {
  const normalized = source.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (normalized === 'INFO' || normalized === 'INFORMATIONAL' || normalized === 'S5_INFORMATIONAL') {
    return 'INFORMATIONAL';
  }
  if (normalized === 'LOW' || normalized === 'S4_LOW') {
    return 'LOW';
  }
  if (normalized === 'MEDIUM' || normalized === 'MED' || normalized === 'S3_MEDIUM') {
    return 'MEDIUM';
  }
  if (normalized === 'HIGH' || normalized === 'S2_HIGH') {
    return 'HIGH';
  }
  if (normalized === 'CRITICAL' || normalized === 'S1_CRITICAL' || normalized === 'S0_EMERGENCY') {
    return 'CRITICAL';
  }
  return null;
}

export function externalSeverityPreserved(before: string, after: string): boolean {
  return before === after;
}

export function silentDowngrade(
  externalSeverity: string,
  internal: FindingSeverity | null,
): boolean {
  if (internal === null) {
    return false;
  }
  const mapped = mapExternalSeverity(externalSeverity);
  if (mapped === null) {
    return false;
  }
  return RANK[internal] < RANK[mapped];
}

export function assertNoSilentDowngrade(
  externalSeverity: string,
  internal: FindingSeverity | null,
): void {
  if (silentDowngrade(externalSeverity, internal)) {
    throw new Error(
      `internal severity ${internal} silently downgrades preserved external severity ${externalSeverity}`,
    );
  }
}
