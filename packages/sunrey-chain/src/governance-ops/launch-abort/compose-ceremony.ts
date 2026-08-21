/**
 * Compose Chunk 165 frozen-candidate ceremony abort with Chunk 167
 * launch-abort records.
 *
 * Ceremony abort stays on the Chunk 85/165 owner. Launch-abort records
 * the operational abort evidence. Neither path writes genesis, reuses
 * private keys, or activates production.
 */

import {
  abortCeremony as abortLaunchCeremonySession,
  abortPreservesAuditHistory,
} from '../../production-ceremony/launch-candidate/abort.ts';
import {
  LAUNCH_AUTH_REHEARSAL_NOW,
  openFixtureLaunchSession,
} from '../../production-ceremony/launch-candidate/fixtures.ts';
import { bindFrozenCandidate } from '../../production-ceremony/launch-candidate/verify.ts';
import { abortCeremony, recordPreGenesisAbort } from './abort.ts';

export function composeCeremonyLaunchAbort() {
  const opened = bindFrozenCandidate(openFixtureLaunchSession(), LAUNCH_AUTH_REHEARSAL_NOW);
  const aborted = abortLaunchCeremonySession(opened, {
    code: 'CEREMONY_ABORTED',
    reason: 'operator abort during frozen-candidate ceremony',
    occurredAtUtc: LAUNCH_AUTH_REHEARSAL_NOW,
  });
  const launchAbort = abortCeremony({
    phase: 'DURING_CEREMONY',
    reason: 'CEREMONY_DEFECT',
    ceremonyTranscriptHash: aborted.transcript.transcriptHash,
    candidateFreezeHash: aborted.binding.launchFreezeHash,
  });
  const preGenesis = recordPreGenesisAbort({
    reason: 'CEREMONY_DEFECT',
    candidateFreezeHash: aborted.binding.launchFreezeHash,
    ceremonyTranscriptHash: aborted.transcript.transcriptHash,
  });
  return Object.freeze({
    session: aborted,
    launchAbort,
    preGenesis,
    transcriptPreserved: abortPreservesAuditHistory(aborted) && launchAbort.transcriptPreserved,
    wroteGenesis:
      aborted.productionActivated || launchAbort.createdGenesisBlock || preGenesis.createdGenesisBlock,
    wroteChainHistory: launchAbort.createdChainHistory || preGenesis.createdChainHistory,
    privateKeysReused: Boolean(aborted.abort?.privateKeysReused),
    restartRequired: aborted.abort?.restartRequired === true,
    freezeHashBound: aborted.binding.launchFreezeHash.length > 0,
    productionActive: aborted.productionActivated,
  });
}
