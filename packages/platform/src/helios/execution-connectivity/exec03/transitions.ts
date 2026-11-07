import type { ExecutionIntentState } from './taxonomy.ts';
import type { ExecutionIntent } from './types.ts';

const ALLOWED: Readonly<Record<ExecutionIntentState, readonly ExecutionIntentState[]>> =
  Object.freeze({
    NOT_SUBMITTED: Object.freeze(['SUBMITTING']),
    SUBMITTING: Object.freeze(['ACKNOWLEDGED', 'SUBMISSION_UNKNOWN', 'CONFIRMED', 'REJECTED']),
    ACKNOWLEDGED: Object.freeze(['CONFIRMED', 'RECONCILING', 'SUBMISSION_UNKNOWN']),
    SUBMISSION_UNKNOWN: Object.freeze(['RECONCILING']),
    RECONCILING: Object.freeze([
      'CONFIRMED',
      'ACKNOWLEDGED',
      'REJECTED',
      'SUBMISSION_UNKNOWN',
      'NOT_SUBMITTED',
    ]),
    CONFIRMED: Object.freeze([]),
    REJECTED: Object.freeze([]),
  });

export function canTransitionExec03Intent(
  from: ExecutionIntentState,
  to: ExecutionIntentState,
): boolean {
  if (from === to) {
    return true;
  }
  return (ALLOWED[from] ?? []).includes(to);
}

export function assertExec03Transition(
  intent: ExecutionIntent,
  next: ExecutionIntentState,
): void {
  if (!canTransitionExec03Intent(intent.state, next)) {
    throw new Error(`illegal EXEC03 intent transition ${intent.state} → ${next}`);
  }
}

export function requiresReconciliationBeforeResubmit(intent: ExecutionIntent): boolean {
  return (
    intent.state === 'SUBMISSION_UNKNOWN' ||
    intent.state === 'RECONCILING' ||
    (intent.state === 'SUBMITTING' && intent.submittedOnce)
  );
}

export function incompleteAfterRestart(intent: ExecutionIntent): boolean {
  return intent.state === 'SUBMITTING' || intent.state === 'SUBMISSION_UNKNOWN';
}
