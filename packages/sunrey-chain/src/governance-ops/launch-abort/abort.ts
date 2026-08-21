/**
 * Pre-genesis and ceremony abort records.
 *
 * An abort before finalized genesis writes no chain history, no genesis
 * block, and no migrated balances. After finalized genesis there is no
 * undo-genesis function.
 */

import { commitGovernance } from '../hash.ts';
import type {
  CeremonyAbortRecord,
  CeremonyAbortPhase,
  LaunchAbortEvidence,
  PreGenesisAbortReason,
  PreGenesisAbortRecord,
} from './types.ts';

export function bindLaunchAbortEvidence(input: {
  readonly incidentId: string;
  readonly candidateFreezeHash?: string | null;
  readonly activePolicyHashes?: readonly string[];
  readonly chainHeight?: number | null;
  readonly stateRoot?: string | null;
  readonly providerState?: string;
  readonly reconciliationState?: LaunchAbortEvidence['reconciliationState'];
  readonly operatorActions?: readonly string[];
}): LaunchAbortEvidence {
  return Object.freeze({
    incidentId: input.incidentId,
    candidateFreezeHash: input.candidateFreezeHash ?? null,
    activePolicyHashes: Object.freeze([...(input.activePolicyHashes ?? [])]),
    chainHeight: input.chainHeight ?? null,
    stateRoot: input.stateRoot ?? null,
    providerState: input.providerState ?? 'UNKNOWN',
    reconciliationState: input.reconciliationState ?? 'NOT_APPLICABLE',
    operatorActions: Object.freeze([...(input.operatorActions ?? [])]),
    containsRawSecrets: false,
  });
}

export function recordPreGenesisAbort(input: {
  readonly reason: PreGenesisAbortReason;
  readonly candidateFreezeHash: string;
  readonly ceremonyTranscriptHash?: string | null;
  readonly operatorActions?: readonly string[];
  readonly evidence?: LaunchAbortEvidence;
}): PreGenesisAbortRecord {
  const evidence =
    input.evidence ??
    bindLaunchAbortEvidence({
      incidentId: `INC-PREGENESIS-${input.reason}`,
      candidateFreezeHash: input.candidateFreezeHash,
      ...(input.operatorActions ? { operatorActions: input.operatorActions } : {}),
      reconciliationState: 'NOT_APPLICABLE',
    });
  const abortId = commitGovernance({
    kind: 'PRE_GENESIS_ABORT',
    reason: input.reason,
    candidateFreezeHash: input.candidateFreezeHash,
    ceremonyTranscriptHash: input.ceremonyTranscriptHash ?? null,
  });
  return Object.freeze({
    abortId,
    reason: input.reason,
    phase: 'BEFORE_GENESIS',
    candidateFreezeHash: input.candidateFreezeHash,
    ceremonyTranscriptHash: input.ceremonyTranscriptHash ?? null,
    evidence,
    operatorActions: Object.freeze([...(input.operatorActions ?? ['HOLD_AND_PRESERVE_CANDIDATE'])]),
    createdChainHistory: false,
    createdGenesisBlock: false,
    migratedBalances: false,
    productionActive: false,
  });
}

export function abortCeremony(input: {
  readonly phase: CeremonyAbortPhase;
  readonly reason: PreGenesisAbortReason;
  readonly ceremonyTranscriptHash: string;
  readonly candidateFreezeHash: string;
  readonly operatorActions?: readonly string[];
}): CeremonyAbortRecord {
  const evidence = bindLaunchAbortEvidence({
    incidentId: `INC-CEREMONY-${input.reason}`,
    candidateFreezeHash: input.candidateFreezeHash,
    operatorActions: input.operatorActions ?? ['ABORT_CEREMONY_PRESERVE_TRANSCRIPT'],
    reconciliationState: 'NOT_APPLICABLE',
  });
  return Object.freeze({
    abortId: commitGovernance({
      kind: 'CEREMONY_ABORT',
      phase: input.phase,
      reason: input.reason,
      ceremonyTranscriptHash: input.ceremonyTranscriptHash,
    }),
    phase: input.phase,
    reason: input.reason,
    ceremonyTranscriptHash: input.ceremonyTranscriptHash,
    transcriptPreserved: true,
    createdGenesisBlock: false,
    createdChainHistory: false,
    evidence,
  });
}

export function refuseUndoGenesis(input: {
  readonly genesisFinalized: boolean;
  readonly requested: 'UNDO_GENESIS' | 'ERASE_FINALIZED_HISTORY';
}): { readonly accepted: false; readonly rejectionReason: 'FINALIZED_GENESIS_CANNOT_BE_ERASED' } {
  void input;
  return Object.freeze({
    accepted: false,
    rejectionReason: 'FINALIZED_GENESIS_CANNOT_BE_ERASED',
  });
}
