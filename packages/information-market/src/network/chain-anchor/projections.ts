import type { HinAnchorState, HumanInformationAnchor, PrivacySafeAnchorPresentation, PrivacySafeAnchorStatus } from './types.ts';

export function parseChainHeight(blockReference: string | null): bigint | null {
  if (!blockReference) {
    return null;
  }
  const match = /cbl_(\d+)/.exec(blockReference);
  if (!match) {
    return null;
  }
  return BigInt(match[1] ?? '0');
}

export function presentationFor(anchor: HumanInformationAnchor): PrivacySafeAnchorPresentation {
  if (anchor.reorgObserved || anchor.chainState === 'REORG_OBSERVED') {
    return 'REVIEW_REQUIRED';
  }
  if (anchor.unknownAfterBroadcast || anchor.chainState === 'UNKNOWN') {
    return 'REVIEW_REQUIRED';
  }
  if (anchor.chainState === 'REJECTED' || anchor.chainState === 'FAILED') {
    return 'REVIEW_REQUIRED';
  }
  if (anchor.finalized && anchor.chainState === 'FINALIZED') {
    return 'FINALIZED';
  }
  return 'PENDING';
}

export function privacySafeStatus(anchor: HumanInformationAnchor | undefined): PrivacySafeAnchorStatus | null {
  if (!anchor) {
    return null;
  }
  return Object.freeze({
    presentation: presentationFor(anchor),
    chainState: anchor.chainState,
    transactionId: anchor.transactionId,
    blockReference: anchor.blockReference,
    confirmations: anchor.confirmations,
    finalized: anchor.finalized,
  });
}

export function isPendingState(state: HinAnchorState | string): boolean {
  return (
    state === 'CREATED' ||
    state === 'INTENT_CREATED' ||
    state === 'QUEUED' ||
    state === 'SUBMITTED' ||
    state === 'ACCEPTED' ||
    state === 'PENDING_FINALITY'
  );
}

export function scheduleFor(state: HinAnchorState | string): HumanInformationAnchor['schedule'] {
  if (state === 'FINALIZED') {
    return 'SETTLED';
  }
  if (
    state === 'UNKNOWN' ||
    state === 'REORG_OBSERVED' ||
    state === 'REJECTED' ||
    state === 'FAILED'
  ) {
    return 'REVIEW';
  }
  if (state === 'CREATED' || state === 'INTENT_CREATED' || state === 'QUEUED') {
    return 'PENDING_ANCHOR';
  }
  return 'SUBMITTED';
}

export function mapHinReconciliation(
  chainOutcome: string,
): 'MATCHED' | 'PENDING' | 'REVIEW_REQUIRED' | 'REANCHOR_REVIEW_REQUIRED' | 'FAILED' {
  switch (chainOutcome) {
    case 'MATCHED':
      return 'MATCHED';
    case 'PENDING':
      return 'PENDING';
    case 'REORG_OBSERVED':
      return 'REANCHOR_REVIEW_REQUIRED';
    case 'HASH_MISMATCH':
    case 'SUBMISSION_UNKNOWN':
    case 'DUPLICATE_EXTERNAL':
    case 'INVESTIGATION_REQUIRED':
      return 'REVIEW_REQUIRED';
    case 'MISSING_CHAIN_RECORD':
    case 'MISSING_INTERNAL_RECORD':
      return 'FAILED';
    default:
      return 'REVIEW_REQUIRED';
  }
}
