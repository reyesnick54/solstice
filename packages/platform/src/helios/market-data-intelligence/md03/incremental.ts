import type { UtcInstant } from '@solstice/domain';
import type { Md03ApplyIncrementalResult, Md03IncrementalEnvelope, Md03SequenceState } from './types.ts';
import type { Md03SequenceOutcome } from './taxonomy.ts';

export function initialMd03SequenceState(): Md03SequenceState {
  return Object.freeze({
    lastSequence: 0n,
    lastAppliedAt: null,
    gapCount: 0,
    duplicateCount: 0,
  });
}

function classifySequence(
  sequence: bigint,
  prior: Md03SequenceState,
): { readonly outcome: Md03SequenceOutcome; readonly gap: boolean } {
  if (sequence <= prior.lastSequence) {
    if (sequence === prior.lastSequence) {
      return { outcome: 'DUPLICATE', gap: false };
    }
    return { outcome: 'REGRESSION', gap: false };
  }
  if (prior.lastSequence > 0n && sequence > prior.lastSequence + 1n) {
    return { outcome: 'GAP', gap: true };
  }
  return { outcome: 'APPLIED', gap: false };
}

/**
 * Apply a single incremental feed message with monotonic sequence semantics.
 * Gaps are recorded but may still apply the payload when the caller elects to continue.
 */
export function applyMd03Incremental<TState, TPayload>(input: {
  readonly prior: TState;
  readonly sequence: Md03SequenceState;
  readonly envelope: Md03IncrementalEnvelope<TPayload>;
  readonly merge: (prior: TState, payload: TPayload, at: UtcInstant) => TState;
  readonly applyOnGap?: boolean;
}): Md03ApplyIncrementalResult<TState> {
  const classification = classifySequence(input.envelope.sequence, input.sequence);
  let outcome = classification.outcome;
  let nextSeq = input.sequence;
  let nextState = input.prior;

  if (outcome === 'DUPLICATE' || outcome === 'REGRESSION') {
    return Object.freeze({ outcome, state: nextState, sequence: nextSeq });
  }

  if (outcome === 'GAP' && !input.applyOnGap) {
    nextSeq = Object.freeze({
      ...nextSeq,
      gapCount: nextSeq.gapCount + 1,
    });
    return Object.freeze({ outcome, state: nextState, sequence: nextSeq });
  }

  if (outcome === 'GAP') {
    nextSeq = Object.freeze({
      ...nextSeq,
      gapCount: nextSeq.gapCount + 1,
    });
    outcome = 'APPLIED';
  }

  nextState = input.merge(nextState, input.envelope.payload, input.envelope.knowableAt);
  nextSeq = Object.freeze({
    lastSequence: input.envelope.sequence,
    lastAppliedAt: input.envelope.knowableAt,
    gapCount: nextSeq.gapCount,
    duplicateCount: outcome === 'DUPLICATE' ? nextSeq.duplicateCount + 1 : nextSeq.duplicateCount,
  });

  return Object.freeze({ outcome, state: nextState, sequence: nextSeq });
}
