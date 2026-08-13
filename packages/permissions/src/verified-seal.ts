/**
 * Module-private seal for a verified Execution Authority.
 * Callers cannot stamp this themselves without importing stampVerified,
 * which is not exported from the package index.
 */
export const VERIFIED_EXECUTION_AUTHORITY = Symbol('solstice.VerifiedExecutionAuthority');

export type VerifiedSeal = {
  readonly [VERIFIED_EXECUTION_AUTHORITY]: true;
};

export function stampVerified<T extends object>(value: T): T & VerifiedSeal {
  return Object.freeze({
    ...value,
    [VERIFIED_EXECUTION_AUTHORITY]: true as const,
  }) as T & VerifiedSeal;
}

export function carriesVerifiedSeal(value: unknown): value is VerifiedSeal {
  return (
    typeof value === 'object' &&
    value !== null &&
    VERIFIED_EXECUTION_AUTHORITY in value &&
    (value as VerifiedSeal)[VERIFIED_EXECUTION_AUTHORITY] === true
  );
}
