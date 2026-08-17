/**
 * Root-of-trust ceremony binding.
 *
 * Simulation rehearsal is process-readiness evidence only.
 * It is not proof of real production key creation.
 */

import { encodeString, encodeU32, sha256Hex } from '../validators/canonical.ts';
import type { CeremonyBinding, MainnetValidatorCandidate } from './types.ts';

export const CEREMONY_REHEARSAL_DOMAIN = 'SUNREY_PRODUCTION_CANDIDATE_CEREMONY_V1' as const;

export type SimulatedCeremonyTranscript = {
  readonly kind: 'SIMULATION_REHEARSAL';
  readonly domain: typeof CEREMONY_REHEARSAL_DOMAIN;
  readonly chunkReference: 'CHUNK-64-SIMULATION-BINDING';
  readonly coordinatorCollectedPrivateKeys: false;
  readonly provesRealProductionKeyCreation: false;
  readonly contributions: readonly {
    readonly validatorId: string;
    readonly contributionHash: string;
  }[];
  readonly transcriptHash: string;
};

export function buildSimulatedCeremonyTranscript(
  validators: readonly MainnetValidatorCandidate[],
): SimulatedCeremonyTranscript {
  const contributions = validators.map((row) =>
    Object.freeze({
      validatorId: row.validatorId,
      contributionHash: row.ceremonyContributionHash,
    }),
  );
  const parts = [
    encodeString(CEREMONY_REHEARSAL_DOMAIN),
    encodeString('SIMULATION_REHEARSAL'),
    encodeU32(contributions.length),
  ];
  for (const row of [...contributions].sort((a, b) => a.validatorId.localeCompare(b.validatorId))) {
    parts.push(encodeString(row.validatorId), encodeString(row.contributionHash));
  }
  return Object.freeze({
    kind: 'SIMULATION_REHEARSAL',
    domain: CEREMONY_REHEARSAL_DOMAIN,
    chunkReference: 'CHUNK-64-SIMULATION-BINDING',
    coordinatorCollectedPrivateKeys: false,
    provesRealProductionKeyCreation: false,
    contributions: Object.freeze(contributions),
    transcriptHash: sha256Hex(Buffer.concat(parts)),
  });
}

export function bindCeremony(transcript: SimulatedCeremonyTranscript | null): CeremonyBinding {
  if (!transcript) {
    return Object.freeze({
      kind: 'REAL_EXTERNAL_CEREMONY',
      transcriptHash: null,
      transcriptReference: null,
      processReadinessOnly: true,
      provesRealProductionKeyCreation: false,
      notes: 'Real external ceremony has not occurred. Slot reserved for a future Chunk 64 transcript.',
    });
  }
  return Object.freeze({
    kind: 'SIMULATION_REHEARSAL',
    transcriptHash: transcript.transcriptHash,
    transcriptReference: transcript.chunkReference,
    processReadinessOnly: true,
    provesRealProductionKeyCreation: false,
    notes: 'Simulation rehearsal binds process readiness only. It does not prove real production key creation.',
  });
}

export function realCeremonyProvided(binding: CeremonyBinding): boolean {
  return binding.kind === 'REAL_EXTERNAL_CEREMONY' && binding.transcriptHash !== null && !binding.processReadinessOnly;
}
