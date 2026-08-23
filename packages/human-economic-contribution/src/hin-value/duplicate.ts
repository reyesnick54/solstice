/**
 * Deterministic duplicate / replay / obvious self-generated duplicate
 * foundation. This is not a global identity or Sybil solution.
 */

import { createHash } from 'node:crypto';

import type { UtcInstant } from '../../../domain/src/time.ts';
import type { SubjectRef } from '../ids.ts';
import type { HinProductCategory } from './categories.ts';

export function hinReplayKey(input: {
  readonly subject: SubjectRef;
  readonly category: HinProductCategory;
  readonly sourceReference: string;
  readonly observedAt: UtcInstant;
}): string {
  return createHash('sha256')
    .update([input.subject, input.category, input.sourceReference, input.observedAt].join('\n'))
    .digest('hex');
}

const ANONYMOUS_MARKERS = new Set(['', 'anonymous', 'unknown', 'anon', 'null', 'undefined']);

export function isAnonymousSubject(subject: string): boolean {
  const normalized = subject.trim().toLowerCase();
  if (ANONYMOUS_MARKERS.has(normalized)) {
    return true;
  }
  return /^(anon|unknown|null)[_:-]/.test(normalized);
}

export function isSelfGeneratedDuplicate(input: {
  readonly sourceClass: string;
  readonly actorKind: string;
  readonly existingSourceClass: string;
}): boolean {
  if (input.actorKind === 'AI' && input.sourceClass === 'MODEL_INFERENCE') {
    return true;
  }
  return (
    (input.sourceClass === 'USER_DECLARED' || input.sourceClass === 'MODEL_INFERENCE') &&
    input.existingSourceClass === input.sourceClass
  );
}
