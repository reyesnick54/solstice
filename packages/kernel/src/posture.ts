/**
 * Compliance posture lattice. Severity only increases.
 *
 *   CLEAR < REVIEW < HOLD < BLOCK
 *
 * The only legal combiner is `escalate`. Assigning a weaker posture
 * over a stronger one is a critical invariant violation.
 */
export const POSTURES = ['CLEAR', 'REVIEW', 'HOLD', 'BLOCK'] as const;

export type Posture = (typeof POSTURES)[number];

export const POSTURE_RANK: Readonly<Record<Posture, number>> = Object.freeze({
  CLEAR: 0,
  REVIEW: 1,
  HOLD: 2,
  BLOCK: 3,
});

export type AuthorizingPosture = 'CLEAR' | 'REVIEW';

export function isPosture(value: unknown): value is Posture {
  return typeof value === 'string' && (POSTURES as readonly string[]).includes(value);
}

export function isAuthorizingPosture(value: Posture): value is AuthorizingPosture {
  return value === 'CLEAR' || value === 'REVIEW';
}

/**
 * Monotonic escalation. Returns the more severe posture.
 * Never relaxes. This is the only function that may combine postures.
 */
export function escalate(current: Posture, incoming: Posture): Posture {
  return POSTURE_RANK[incoming] > POSTURE_RANK[current] ? incoming : current;
}

export function foldPostures(postures: readonly Posture[]): Posture {
  let current: Posture = 'CLEAR';
  for (const next of postures) {
    current = escalate(current, next);
  }
  return current;
}

/**
 * Detect an attempted relaxation. Used by tests and by the Kernel
 * to refuse a proof evaluator that tries to lower severity.
 */
export function wouldRelax(current: Posture, incoming: Posture): boolean {
  return POSTURE_RANK[incoming] < POSTURE_RANK[current];
}
