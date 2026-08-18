/**
 * Append-only hash-chained ProductionCeremonyTranscript.
 *
 * Changing, removing, or reordering an entry invalidates verification.
 */

import { encodeString, encodeU32, sha256Hex } from '../validators/canonical.ts';
import type {
  CeremonyTranscriptAction,
  ProductionCeremonyActorKind,
  ProductionCeremonyRole,
  ProductionCeremonyTranscript,
  ProductionCeremonyTranscriptEntry,
} from './types.ts';

export const TRANSCRIPT_DOMAIN = 'SUNREY_PRODUCTION_CEREMONY_TRANSCRIPT_V1' as const;
export const TRANSCRIPT_GENESIS_PRIOR = 'GENESIS' as const;

export function transcriptEntryHash(input: {
  readonly sessionId: string;
  readonly sequence: number;
  readonly action: CeremonyTranscriptAction;
  readonly participantRole: ProductionCeremonyRole | 'SYSTEM';
  readonly publicContribution: string | null;
  readonly artifactHashes: readonly string[];
  readonly approval: string | null;
  readonly attestation: string | null;
  readonly previousEntryHash: string;
  readonly occurredAtUtc: string;
}): string {
  return sha256Hex(
    Buffer.concat([
      encodeString(TRANSCRIPT_DOMAIN),
      encodeString(input.sessionId),
      encodeU32(input.sequence),
      encodeString(input.action),
      encodeString(input.participantRole),
      encodeString(input.publicContribution ?? ''),
      encodeString(input.artifactHashes.join(',')),
      encodeString(input.approval ?? ''),
      encodeString(input.attestation ?? ''),
      encodeString(input.previousEntryHash),
      encodeString(input.occurredAtUtc),
    ]),
  );
}

export function emptyTranscript(sessionId: string): ProductionCeremonyTranscript {
  return Object.freeze({
    sessionId,
    entries: Object.freeze([]),
    transcriptHash: sha256Hex(Buffer.concat([encodeString(TRANSCRIPT_DOMAIN), encodeString(sessionId), encodeString('EMPTY')])),
    finalized: false,
  });
}

export function appendTranscriptEntry(
  transcript: ProductionCeremonyTranscript,
  input: {
    readonly action: CeremonyTranscriptAction;
    readonly participantRole: ProductionCeremonyRole | 'SYSTEM';
    readonly actorKind: ProductionCeremonyActorKind | 'SYSTEM';
    readonly publicContribution?: string | null;
    readonly artifactHashes?: readonly string[];
    readonly approval?: string | null;
    readonly attestation?: string | null;
    readonly occurredAtUtc: string;
  },
): ProductionCeremonyTranscript {
  if (transcript.finalized) {
    throw new TypeError('finalized transcript is append-only and cannot accept new entries');
  }
  const previousEntryHash =
    transcript.entries.length === 0
      ? TRANSCRIPT_GENESIS_PRIOR
      : transcript.entries[transcript.entries.length - 1]!.entryHash;
  const sequence = transcript.entries.length + 1;
  const artifactHashes = Object.freeze([...(input.artifactHashes ?? [])]);
  const entry: ProductionCeremonyTranscriptEntry = Object.freeze({
    sessionId: transcript.sessionId,
    sequence,
    action: input.action,
    participantRole: input.participantRole,
    actorKind: input.actorKind,
    publicContribution: input.publicContribution ?? null,
    artifactHashes,
    approval: input.approval ?? null,
    attestation: input.attestation ?? null,
    previousEntryHash,
    entryHash: transcriptEntryHash({
      sessionId: transcript.sessionId,
      sequence,
      action: input.action,
      participantRole: input.participantRole,
      publicContribution: input.publicContribution ?? null,
      artifactHashes,
      approval: input.approval ?? null,
      attestation: input.attestation ?? null,
      previousEntryHash,
      occurredAtUtc: input.occurredAtUtc,
    }),
    occurredAtUtc: input.occurredAtUtc,
  });
  const entries = Object.freeze([...transcript.entries, entry]);
  return Object.freeze({
    sessionId: transcript.sessionId,
    entries,
    transcriptHash: entry.entryHash,
    finalized: false,
  });
}

export function finalizeTranscript(transcript: ProductionCeremonyTranscript): ProductionCeremonyTranscript {
  const verified = verifyTranscript(transcript);
  if (!verified.ok) {
    throw new TypeError(verified.reason);
  }
  return Object.freeze({ ...transcript, finalized: true, transcriptHash: verified.transcriptHash });
}

export function verifyTranscript(transcript: ProductionCeremonyTranscript): {
  readonly ok: boolean;
  readonly reason: string;
  readonly transcriptHash: string;
} {
  if (transcript.entries.length === 0) {
    return { ok: false, reason: 'empty transcript cannot be verified as complete', transcriptHash: transcript.transcriptHash };
  }
  for (const [index, entry] of transcript.entries.entries()) {
    if (entry.sessionId !== transcript.sessionId) {
      return { ok: false, reason: 'transcript session mismatch', transcriptHash: transcript.transcriptHash };
    }
    if (entry.sequence !== index + 1) {
      return { ok: false, reason: 'transcript sequence tamper detected', transcriptHash: transcript.transcriptHash };
    }
    const expectedPrior = index === 0 ? TRANSCRIPT_GENESIS_PRIOR : transcript.entries[index - 1]!.entryHash;
    if (entry.previousEntryHash !== expectedPrior) {
      return { ok: false, reason: 'transcript chain tamper detected', transcriptHash: transcript.transcriptHash };
    }
    const recomputed = transcriptEntryHash({
      sessionId: entry.sessionId,
      sequence: entry.sequence,
      action: entry.action,
      participantRole: entry.participantRole,
      publicContribution: entry.publicContribution,
      artifactHashes: entry.artifactHashes,
      approval: entry.approval,
      attestation: entry.attestation,
      previousEntryHash: entry.previousEntryHash,
      occurredAtUtc: entry.occurredAtUtc,
    });
    if (recomputed !== entry.entryHash) {
      return { ok: false, reason: 'transcript entry hash tamper detected', transcriptHash: transcript.transcriptHash };
    }
  }
  const tip = transcript.entries[transcript.entries.length - 1]!.entryHash;
  if (transcript.transcriptHash !== tip) {
    return { ok: false, reason: 'transcript tip hash mismatch', transcriptHash: transcript.transcriptHash };
  }
  return { ok: true, reason: 'verified', transcriptHash: tip };
}

export function tamperTranscript(
  transcript: ProductionCeremonyTranscript,
  kind: 'change' | 'remove' | 'reorder',
): ProductionCeremonyTranscript {
  if (transcript.entries.length < 2) {
    throw new TypeError('need at least two entries to demonstrate tamper');
  }
  if (kind === 'remove') {
    const entries = transcript.entries.filter((_, index) => index !== 0);
    return Object.freeze({
      ...transcript,
      entries: Object.freeze(entries),
    });
  }
  if (kind === 'reorder') {
    const entries = [...transcript.entries];
    const last = entries[entries.length - 1]!;
    const prev = entries[entries.length - 2]!;
    entries[entries.length - 1] = prev;
    entries[entries.length - 2] = last;
    return Object.freeze({ ...transcript, entries: Object.freeze(entries) });
  }
  const entries = transcript.entries.map((entry, index) =>
    index === 0
      ? Object.freeze({ ...entry, publicContribution: 'tampered', artifactHashes: Object.freeze(['tampered-artifact']) })
      : entry,
  );
  return Object.freeze({ ...transcript, entries: Object.freeze(entries) });
}
