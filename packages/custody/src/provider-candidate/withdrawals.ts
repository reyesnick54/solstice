import type { NativeCustodyAssetId } from '../native-assets.ts';
import type { CustodyCandidateTransport } from './transport.ts';
import {
  candidateErr,
  candidateOk,
  type CustodyCandidateResult,
  type CustodySubmissionState,
} from './types.ts';

export type CustodyWithdrawalSubmission = {
  readonly withdrawalId: string;
  readonly assetId: NativeCustodyAssetId;
  readonly quantity: bigint;
  readonly destination: string;
  readonly state: CustodySubmissionState;
  readonly providerQueryRequiredBeforeRetry: boolean;
  readonly chainQueryRequiredBeforeRetry: boolean;
  readonly submittedOnce: boolean;
  readonly locallyFinalized: false;
};

const submissions = new Map<string, CustodyWithdrawalSubmission>();
const seenWithdrawalCallbacks = new Set<string>();

export function createWithdrawalSubmission(input: {
  readonly withdrawalId: string;
  readonly assetId: NativeCustodyAssetId;
  readonly quantity: bigint;
  readonly destination: string;
}): CustodyWithdrawalSubmission {
  const record: CustodyWithdrawalSubmission = Object.freeze({
    withdrawalId: input.withdrawalId,
    assetId: input.assetId,
    quantity: input.quantity,
    destination: input.destination,
    state: 'NOT_SUBMITTED',
    providerQueryRequiredBeforeRetry: false,
    chainQueryRequiredBeforeRetry: false,
    submittedOnce: false,
    locallyFinalized: false,
  });
  submissions.set(input.withdrawalId, record);
  return record;
}

export function submitWithdrawal(
  withdrawalId: string,
  transport: CustodyCandidateTransport,
  options?: { readonly timeoutAfterPossibleBroadcast?: boolean },
): CustodyCandidateResult<CustodyWithdrawalSubmission> {
  const current = submissions.get(withdrawalId);
  if (!current) {
    return candidateErr('UNKNOWN_WITHDRAWAL', 'withdrawal not found');
  }
  if (current.submittedOnce || current.state === 'SUBMISSION_UNKNOWN') {
    return candidateErr(
      'QUERY_BEFORE_RETRY',
      'SUBMISSION_UNKNOWN must query provider and chain before a second withdrawal',
    );
  }
  const exchanged = transport.exchange({
    method: 'POST',
    path: `/withdrawals/${withdrawalId}`,
    body: { assetId: current.assetId, quantity: current.quantity.toString() },
  });
  if (!exchanged.ok) {
    return exchanged;
  }
  if (options?.timeoutAfterPossibleBroadcast === true) {
    const unknown: CustodyWithdrawalSubmission = Object.freeze({
      ...current,
      state: 'SUBMISSION_UNKNOWN',
      providerQueryRequiredBeforeRetry: true,
      chainQueryRequiredBeforeRetry: true,
      submittedOnce: true,
      locallyFinalized: false,
    });
    submissions.set(withdrawalId, unknown);
    return candidateOk(unknown);
  }
  const submitted: CustodyWithdrawalSubmission = Object.freeze({
    ...current,
    state: 'SUBMITTED',
    submittedOnce: true,
    locallyFinalized: false,
  });
  submissions.set(withdrawalId, submitted);
  return candidateOk(submitted);
}

export function queryBeforeRetry(input: {
  readonly withdrawalId: string;
  readonly transport: CustodyCandidateTransport;
  readonly providerFound: boolean;
  readonly chainFound: boolean;
}): CustodyCandidateResult<CustodyWithdrawalSubmission> {
  const current = submissions.get(input.withdrawalId);
  if (!current) {
    return candidateErr('UNKNOWN_WITHDRAWAL', 'withdrawal not found');
  }
  if (current.state !== 'SUBMISSION_UNKNOWN') {
    return candidateErr('NOT_UNKNOWN', 'query-before-retry applies only to SUBMISSION_UNKNOWN');
  }
  const queried = input.transport.exchange({
    method: 'GET',
    path: `/withdrawals/${input.withdrawalId}`,
    body: {},
  });
  if (!queried.ok) {
    return queried;
  }
  const nextState =
    input.providerFound || input.chainFound ? 'PENDING' : 'RECONCILIATION_REQUIRED';
  const next: CustodyWithdrawalSubmission = Object.freeze({
    ...current,
    state: nextState,
    providerQueryRequiredBeforeRetry: false,
    chainQueryRequiredBeforeRetry: false,
    locallyFinalized: false,
  });
  submissions.set(input.withdrawalId, next);
  return candidateOk(next);
}

export function admitWithdrawalCallback(callbackId: string): CustodyCandidateResult<true> {
  if (seenWithdrawalCallbacks.has(callbackId)) {
    return candidateErr('DUPLICATE_WITHDRAWAL_CALLBACK', 'duplicate withdrawal callback rejected');
  }
  seenWithdrawalCallbacks.add(callbackId);
  return candidateOk(true);
}

export function finalizeLocallyWithoutEvidence(): CustodyCandidateResult<never> {
  return candidateErr('LOCAL_FINALITY_FORBIDDEN', 'FINALIZED requires provider or chain evidence');
}

export function getWithdrawalSubmission(withdrawalId: string): CustodyWithdrawalSubmission | undefined {
  return submissions.get(withdrawalId);
}

export function resetWithdrawals(): void {
  submissions.clear();
  seenWithdrawalCallbacks.clear();
}
