import type { CustomerId } from '../../../../domain/src/customer.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';
import { qualificationDecisionIdFor } from './ids.ts';
import type { EvidenceRegistryPort, EvidenceVerificationDecision } from './types.ts';
import type { QualificationReasonCode } from './taxonomy.ts';

const FIXTURE_PROVENANCE_MARKERS = Object.freeze(['fixture_', 'fixture_lab_only', 'lab_only', 'test_harness']);

export function verifyCandidateEvidence(input: {
  readonly executableOpportunityId: string;
  readonly evidenceRefs: readonly string[];
  readonly registry: EvidenceRegistryPort;
  readonly now: UtcInstant;
  readonly customerId: CustomerId;
  readonly subjectId: string;
  readonly requireExternalObservation?: boolean;
}): EvidenceVerificationDecision {
  const reasonCodes: QualificationReasonCode[] = [];
  const admissibleRefs: string[] = [];
  const rejectedRefs: string[] = [];

  if (input.evidenceRefs.length === 0) {
    return finalize(false, reasonCodes, admissibleRefs, rejectedRefs, ['EVIDENCE_MISSING'], input);
  }

  for (const ref of input.evidenceRefs) {
    const record = input.registry.resolve(ref);
    if (!record) {
      rejectedRefs.push(ref);
      reasonCodes.push('EVIDENCE_PROVENANCE_UNKNOWN');
      continue;
    }
    if (!record.dataQualityOk || record.unresolvedQualityFailures.length > 0) {
      rejectedRefs.push(ref);
      reasonCodes.push('EVIDENCE_DATA_QUALITY_FAILURE');
      continue;
    }
    if (isFixtureMasquerade(record.sourceKind, record.provenanceId)) {
      rejectedRefs.push(ref);
      reasonCodes.push('EVIDENCE_FIXTURE_MASQUERADE');
      continue;
    }
    if (input.requireExternalObservation && record.sourceKind !== 'EXTERNAL_OBSERVATION' && record.sourceKind !== 'ORACLE_VERIFIED') {
      rejectedRefs.push(ref);
      reasonCodes.push('EVIDENCE_FIXTURE_MASQUERADE');
      continue;
    }
    if (isStale(record, input.now)) {
      rejectedRefs.push(ref);
      reasonCodes.push('EVIDENCE_STALE');
      continue;
    }
    if (!entitlementPermits(record, input.customerId, input.subjectId)) {
      rejectedRefs.push(ref);
      reasonCodes.push('EVIDENCE_ENTITLEMENT_DENIED');
      continue;
    }
    if (record.provenanceId.length === 0 || record.provenanceId === 'unknown') {
      rejectedRefs.push(ref);
      reasonCodes.push('EVIDENCE_PROVENANCE_UNKNOWN');
      continue;
    }
    admissibleRefs.push(ref);
  }

  const verified = rejectedRefs.length === 0 && admissibleRefs.length > 0;
  if (verified) {
    reasonCodes.push('EVIDENCE_ADMISSIBLE');
  }
  return finalize(
    verified,
    reasonCodes,
    admissibleRefs,
    rejectedRefs,
    verified ? ['OK'] : [...unique(reasonCodes)],
    input,
  );
}

function isFixtureMasquerade(sourceKind: string, provenanceId: string): boolean {
  if (sourceKind === 'FIXTURE') {
    return true;
  }
  return FIXTURE_PROVENANCE_MARKERS.some((marker) => provenanceId.includes(marker));
}

function isStale(record: { readonly observedAt: UtcInstant; readonly freshnessHorizonSeconds: number }, now: UtcInstant): boolean {
  const observedMs = Date.parse(record.observedAt);
  const nowMs = Date.parse(now);
  return nowMs - observedMs > record.freshnessHorizonSeconds * 1000;
}

function entitlementPermits(
  record: {
    readonly entitlementScope: string;
    readonly customerId?: string;
    readonly subjectId?: string;
  },
  customerId: CustomerId,
  subjectId: string,
): boolean {
  if (record.entitlementScope === 'PUBLIC') {
    return true;
  }
  if (record.entitlementScope === 'CUSTOMER') {
    return record.customerId === customerId;
  }
  if (record.entitlementScope === 'SUBJECT') {
    return record.subjectId === subjectId;
  }
  return false;
}

function unique(codes: readonly QualificationReasonCode[]): readonly QualificationReasonCode[] {
  return Object.freeze([...new Set(codes)]);
}

function finalize(
  verified: boolean,
  reasonCodes: QualificationReasonCode[],
  admissibleRefs: string[],
  rejectedRefs: string[],
  finalCodes: QualificationReasonCode[],
  input: { readonly executableOpportunityId: string; readonly now: UtcInstant },
): EvidenceVerificationDecision {
  return Object.freeze({
    decisionId: qualificationDecisionIdFor(input.executableOpportunityId, 'evidence'),
    verified,
    admissibleRefs: Object.freeze(admissibleRefs),
    rejectedRefs: Object.freeze(rejectedRefs),
    reasonCodes: Object.freeze(finalCodes.length > 0 ? finalCodes : reasonCodes),
    decidedAt: input.now,
  });
}
