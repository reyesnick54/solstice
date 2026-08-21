/**
 * Hash-chained launch-ceremony transcript.
 *
 * Extends the Chunk 85 transcript. Sequence numbers are monotonic.
 * Previous-entry hash is required. Missing or reordered entries
 * invalidate the transcript. Secret material is rejected.
 */

import { findPrivateKeyLeakage, looksLikePrivateKeyField } from '../../../../security/src/crypto-leakage.ts';
import { appendTranscriptEntry, verifyTranscript } from '../transcript.ts';
import type {
  CeremonyTranscriptAction,
  ProductionCeremonyActorKind,
  ProductionCeremonyRole,
  ProductionCeremonyTranscript,
} from '../types.ts';

const SECRET_TEXT = /private[_-]?key|secret[_-]?key|mnemonic|seedphrase|begin private key/i;

export const LAUNCH_TRANSCRIPT_ACTIONS = [
  'CANDIDATE_FREEZE_BOUND',
  'PARTICIPANT_VERIFIED',
  'EXTERNAL_EVIDENCE_VERIFIED',
  'HSM_ATTESTATION_VERIFIED',
  'OFFLINE_PACKAGE_EXPORTED',
  'SIGNATURE_IMPORTED',
  'SIGNATURE_ACCEPTED',
  'SIGNATURE_REJECTED',
  'CEREMONY_ABORTED',
  'CEREMONY_RESTART_REQUIRED',
  'AUTHORIZATION_CANDIDATE_SEALED',
] as const satisfies readonly CeremonyTranscriptAction[];

function walkSecretStrings(value: unknown, seen: WeakSet<object>): void {
  if (typeof value === 'string') {
    if (SECRET_TEXT.test(value)) {
      throw new TypeError('secret string value rejected');
    }
    return;
  }
  if (value === null || typeof value !== 'object') {
    return;
  }
  if (seen.has(value)) {
    return;
  }
  seen.add(value);
  if (Array.isArray(value)) {
    for (const entry of value) {
      walkSecretStrings(entry, seen);
    }
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (looksLikePrivateKeyField(key) && typeof entry !== 'boolean') {
      throw new TypeError(`private key cannot enter field ${key}`);
    }
    walkSecretStrings(entry, seen);
  }
}

export function assertNoSecretMaterial(value: unknown, context: string): void {
  const hits = findPrivateKeyLeakage(value);
  if (hits.length > 0) {
    throw new TypeError(`private key cannot enter ${context}`);
  }
  try {
    walkSecretStrings(value, new WeakSet());
  } catch (error) {
    if (error instanceof TypeError && /secret|private key/.test(error.message)) {
      throw new TypeError(`${error.message} in ${context}`);
    }
    throw error;
  }
}

export function appendLaunchTranscript(
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
  assertNoSecretMaterial(input, 'transcript');
  const next = appendTranscriptEntry(transcript, input);
  if (next.entries.length > 1) {
    const prior = next.entries[next.entries.length - 2]!;
    const tip = next.entries[next.entries.length - 1]!;
    if (tip.sequence !== prior.sequence + 1) {
      throw new TypeError('transcript sequence must be monotonic');
    }
    if (tip.previousEntryHash !== prior.entryHash) {
      throw new TypeError('transcript previous-entry hash required');
    }
  }
  return next;
}

export function launchTranscriptIntegrity(transcript: ProductionCeremonyTranscript): boolean {
  return verifyTranscript(transcript).ok;
}
