import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { ResearchAssertion, ResearchEvidenceRef, ResearchToolCallRecord } from './types.ts';
import type { AssertionKind } from './taxonomy.ts';

export function evidenceRefFromToolCall(
  record: ResearchToolCallRecord,
  now: UtcInstant,
): ResearchEvidenceRef | null {
  if (!record.resultEvidenceRef || record.authorization !== 'ALLOWED') {
    return null;
  }
  const payload = record.resultPayload;
  const sourceId = typeof payload?.sourceId === 'string' ? payload.sourceId : null;
  const provider = typeof payload?.provider === 'string' ? payload.provider : null;
  const asOf = typeof payload?.asOf === 'string' ? payload.asOf as UtcInstant : null;
  return Object.freeze({
    evidenceId: record.resultEvidenceRef,
    sourceId,
    sourceTime: asOf,
    arrivalTime: record.completedAt,
    provider,
    entitlement: 'public_research',
    provenanceRef: `tool:${record.request.toolId}:${record.request.operation}`,
    excerptHash: null,
    freshnessMs: asOf ? Date.parse(now) - Date.parse(asOf) : null,
    confidenceBand: 'SIMULATION',
  });
}

export function bindAssertionToEvidence(input: {
  readonly assertionId: string;
  readonly kind: AssertionKind;
  readonly statement: string;
  readonly citedEvidenceIds: readonly string[];
  readonly knownEvidenceIds: ReadonlySet<string>;
  readonly contradictedPairs: ReadonlyMap<string, readonly string[]>;
}): ResearchAssertion {
  const unsupported = input.citedEvidenceIds.some((id) => !input.knownEvidenceIds.has(id));
  const contradictedBy = input.contradictedPairs.get(input.assertionId) ?? Object.freeze([]);
  let kind = input.kind;
  if (unsupported && kind === 'FACT') {
    kind = 'UNKNOWN';
  }
  if (contradictedBy.length > 0) {
    kind = 'CONTRADICTED';
  }
  return Object.freeze({
    assertionId: input.assertionId,
    kind,
    statement: input.statement,
    evidenceRefs: Object.freeze([...input.citedEvidenceIds]),
    unsupported,
    contradictedBy: Object.freeze([...contradictedBy]),
  });
}

export function collectKnownEvidenceIds(
  existing: readonly string[],
  toolRecords: readonly ResearchToolCallRecord[],
  collected: readonly ResearchEvidenceRef[],
): ReadonlySet<string> {
  const ids = new Set<string>(existing);
  for (const record of toolRecords) {
    if (record.resultEvidenceRef) {
      ids.add(record.resultEvidenceRef);
    }
  }
  for (const ref of collected) {
    ids.add(ref.evidenceId);
  }
  return ids;
}

export function modelCannotSelfVerify(
  assertion: ResearchAssertion,
  deterministicVerified: boolean,
): ResearchAssertion {
  if (!deterministicVerified && assertion.kind === 'FACT' && !assertion.unsupported) {
    return Object.freeze({
      ...assertion,
      kind: 'INFERENCE',
      unsupported: true,
    });
  }
  return assertion;
}
