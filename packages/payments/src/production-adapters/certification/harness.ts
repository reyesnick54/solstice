/**
 * Shared certification harness. Passing a suite is not production
 * authorization and does not flip LIVE_* flags.
 */

export type CertificationCaseResult = {
  readonly id: string;
  readonly passed: boolean;
  readonly detail: string;
};

export type CertificationSuiteResult = {
  readonly suite: 'BANK' | 'PAYMENT' | 'FX' | 'CARD';
  readonly certified: boolean;
  readonly productionAuthorized: false;
  readonly cases: readonly CertificationCaseResult[];
};

export function suiteResult(
  suite: CertificationSuiteResult['suite'],
  cases: readonly CertificationCaseResult[],
): CertificationSuiteResult {
  return Object.freeze({
    suite,
    certified: cases.every((row) => row.passed),
    productionAuthorized: false,
    cases: Object.freeze([...cases]),
  });
}

export function caseResult(id: string, passed: boolean, detail: string): CertificationCaseResult {
  return Object.freeze({ id, passed, detail });
}
