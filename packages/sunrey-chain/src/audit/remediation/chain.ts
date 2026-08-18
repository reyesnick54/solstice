import { createHash } from 'node:crypto';

import type {
  ActorKind,
  FindingEvidenceChainRecord,
  FindingState,
} from './types.ts';

export function hashCanonical(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function signTransition(input: {
  readonly findingId: string;
  readonly actor: ActorKind;
  readonly actorReference: string;
  readonly sourceState: FindingState | null;
  readonly destinationState: FindingState;
  readonly evidenceReference: string;
  readonly commitReference: string;
  readonly secret: string;
}): string {
  return hashCanonical({
    findingId: input.findingId,
    actor: input.actor,
    actorReference: input.actorReference,
    sourceState: input.sourceState,
    destinationState: input.destinationState,
    evidenceReference: input.evidenceReference,
    commitReference: input.commitReference,
    secret: input.secret,
  });
}

export function verifyTransitionSignature(
  record: FindingEvidenceChainRecord,
  secret: string,
): boolean {
  if (!record.signatureHex) {
    return false;
  }
  const expected = signTransition({
    findingId: record.findingId,
    actor: record.actor,
    actorReference: record.actorReference,
    sourceState: record.sourceState,
    destinationState: record.destinationState,
    evidenceReference: record.evidenceReference,
    commitReference: record.commitReference,
    secret,
  });
  return expected === record.signatureHex;
}

export function recordTransition(input: {
  readonly findingId: string;
  readonly actor: ActorKind;
  readonly actorReference: string;
  readonly timestampUtc: string;
  readonly sourceState: FindingState | null;
  readonly destinationState: FindingState;
  readonly evidenceReference: string;
  readonly commitReference: string;
  readonly signatureHex: string | null;
}): FindingEvidenceChainRecord {
  return Object.freeze({
    recordId: hashCanonical({
      findingId: input.findingId,
      sourceState: input.sourceState,
      destinationState: input.destinationState,
      timestampUtc: input.timestampUtc,
      evidenceReference: input.evidenceReference,
    }),
    findingId: input.findingId,
    actor: input.actor,
    actorReference: input.actorReference,
    timestampUtc: input.timestampUtc,
    sourceState: input.sourceState,
    destinationState: input.destinationState,
    evidenceReference: input.evidenceReference,
    commitReference: input.commitReference,
    signatureHex: input.signatureHex,
  });
}
