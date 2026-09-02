/**
 * Wave 5 — Post-finality challenge semantics.
 *
 * If a claim supporting historical MoonRey issuance is later challenged,
 * historical blocks are NOT rewritten. Subsequent challenge/correction state
 * is recorded. Corrective monetary action requires explicit governance;
 * automatic clawback and silent burn are forbidden.
 */

import { ok, type Result } from '../../../../domain/src/result.ts';
import { asUtcInstant, type UtcInstant } from '../../../../domain/src/time.ts';
import type {
  CorrectiveActionRequirement,
  PostFinalityChallengeRecord,
  ProductiveClaimChallenge,
  ProductiveOperationsRejection,
} from './types.ts';
import { PRODUCTIVE_OPERATIONS_SCHEMA_VERSION } from './types.ts';

export const POST_FINALITY_HISTORY_IMMUTABLE = true as const;
export const AUTOMATIC_CLAWBACK_FORBIDDEN = true as const;
export const SILENT_BURN_FORBIDDEN = true as const;

export function recordPostFinalityChallenge(input: {
  readonly challenge: ProductiveClaimChallenge;
  readonly issuanceReceiptId: string | null;
  readonly historicalBlockHeight: number;
  readonly historicalBlockId: string;
  readonly recordedAtUtc?: UtcInstant;
}): Result<PostFinalityChallengeRecord, ProductiveOperationsRejection> {
  if (!input.challenge.postFinality) {
    return ok(buildPostFinalityRecord(input));
  }
  return ok(buildPostFinalityRecord(input));
}

function buildPostFinalityRecord(input: {
  readonly challenge: ProductiveClaimChallenge;
  readonly issuanceReceiptId: string | null;
  readonly historicalBlockHeight: number;
  readonly historicalBlockId: string;
  readonly recordedAtUtc?: UtcInstant;
}): PostFinalityChallengeRecord {
  return Object.freeze({
    schemaVersion: PRODUCTIVE_OPERATIONS_SCHEMA_VERSION,
    challengeId: input.challenge.challengeId,
    claimId: input.challenge.claimId,
    issuanceReceiptId: input.issuanceReceiptId,
    historicalBlockHeight: input.historicalBlockHeight,
    historicalBlockId: input.historicalBlockId,
    historyRewritten: false,
    automaticClawback: false,
    silentBurn: false,
    requiredCorrectiveActions: determineCorrectiveActions(input.challenge),
    recordedAtUtc: input.recordedAtUtc ?? asUtcInstant(new Date().toISOString()),
  });
}

export function determineCorrectiveActions(
  challenge: ProductiveClaimChallenge,
): readonly CorrectiveActionRequirement[] {
  const actions: CorrectiveActionRequirement[] = ['GOVERNANCE_REVIEW'];
  if (challenge.postFinality) {
    actions.push('MULTI_PARTY_AUTHORIZATION', 'COMPENSATING_GOVERNED_TRANSACTION');
  }
  if (challenge.reason === 'SOURCE_COMPROMISE' || challenge.reason === 'DATA_INTEGRITY') {
    actions.push('MANUAL_COUNSEL_REVIEW');
  }
  if (challenge.status === 'CORRECTED' || challenge.status === 'SUPERSEDED') {
    actions.push('PARAMETER_PACKAGE_AMENDMENT');
  }
  return Object.freeze([...new Set(actions)]);
}

export function refuseAutomaticClawback(): {
  readonly ok: false;
  readonly code: 'AUTOMATIC_CLAWBACK_FORBIDDEN';
  readonly detail: string;
} {
  return {
    ok: false,
    code: 'AUTOMATIC_CLAWBACK_FORBIDDEN',
    detail: 'User-held MoonRey cannot be burned automatically; governed corrective transaction required',
  };
}

export function refuseHistoryRewrite(): {
  readonly ok: false;
  readonly code: 'POST_FINALITY_HISTORY_IMMUTABLE';
  readonly detail: string;
} {
  return {
    ok: false,
    code: 'POST_FINALITY_HISTORY_IMMUTABLE',
    detail: 'Finalized blockchain history cannot be rewritten; record subsequent challenge state only',
  };
}
