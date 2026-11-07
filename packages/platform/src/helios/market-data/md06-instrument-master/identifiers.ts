/**
 * MD06 identifier rules — ticker is never permanent identity.
 */

import { createHash } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';

import type { InstrumentIdentifier, InstrumentIdentifierKind } from './types.ts';
import { PERMANENT_INSTRUMENT_IDENTITY_KINDS } from './taxonomy.ts';

export function isPermanentIdentityKind(
  kind: InstrumentIdentifierKind,
): kind is (typeof PERMANENT_INSTRUMENT_IDENTITY_KINDS)[number] {
  return (PERMANENT_INSTRUMENT_IDENTITY_KINDS as readonly string[]).includes(kind);
}

export function assertTickerNotPermanentIdentity(kind: InstrumentIdentifierKind): void {
  if (kind === 'TICKER') {
    throw new Error('ticker cannot be used as permanent instrument identity');
  }
}

export function instrumentIdentityIdFromPermanentIdentifier(
  kind: Exclude<InstrumentIdentifierKind, 'TICKER' | 'MIC' | 'CIK'>,
  value: string,
): string {
  assertTickerNotPermanentIdentity(kind as InstrumentIdentifierKind);
  const normalized = value.trim().toUpperCase();
  const digest = createHash('sha256').update(`${kind}:${normalized}`).digest('hex').slice(0, 16);
  return `imid:${kind.toLowerCase()}:${digest}`;
}

export function identifierActive(
  row: InstrumentIdentifier,
  asOf: UtcInstant,
  knowableAtCutoff: UtcInstant,
): boolean {
  if (Date.parse(knowableAtCutoff) < Date.parse(row.knowableAt)) {
    return false;
  }
  if (Date.parse(asOf) < Date.parse(row.effectiveFrom)) {
    return false;
  }
  if (row.effectiveTo !== null && Date.parse(asOf) >= Date.parse(row.effectiveTo)) {
    return false;
  }
  return true;
}

export function resolveIdentifierAt(
  identifiers: readonly InstrumentIdentifier[],
  kind: InstrumentIdentifierKind,
  asOf: UtcInstant,
  knowableAtCutoff: UtcInstant,
): InstrumentIdentifier | null {
  const hits = identifiers.filter(
    (row) => row.kind === kind && identifierActive(row, asOf, knowableAtCutoff),
  );
  if (hits.length !== 1) {
    return null;
  }
  return hits[0] ?? null;
}
