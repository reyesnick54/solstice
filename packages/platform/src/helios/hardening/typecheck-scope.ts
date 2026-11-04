/**
 * HELIOS strict scoped typecheck — paths that must compile without TS errors
 * before the next intelligence wave, independent of repository-wide debt.
 */

export const HELIOS_STRICT_TYPECHECK_PATH_FRAGMENTS = Object.freeze([
  'packages/platform/src/helios/',
  'packages/strategy-lab/src/',
  'packages/agentic-capital-mesh/src/',
  'packages/provider-sdk/src/venue/',
  'packages/external-data/src/helios/',
  'packages/evidence/src/tradingagents-native.ts',
  'tests/helios-',
  'scripts/helios-',
]);

export function lineMatchesHeliosStrictScope(line: string): boolean {
  return HELIOS_STRICT_TYPECHECK_PATH_FRAGMENTS.some((fragment) => line.includes(fragment));
}

export function evaluateHeliosStrictScopedTypecheck(output: string): {
  readonly pass: boolean;
  readonly scopedErrors: readonly string[];
  readonly detail: string;
} {
  const scopedErrors = output
    .split('\n')
    .filter((line) => line.includes('error TS') && lineMatchesHeliosStrictScope(line));
  const pass = scopedErrors.length === 0;
  const detail = pass
    ? 'HELIOS strict scoped typecheck: no errors in HELIOS intelligence surface'
    : `HELIOS strict scoped typecheck failed (${scopedErrors.length}): ${scopedErrors.slice(0, 3).join(' | ')}`;
  return Object.freeze({ pass, scopedErrors, detail });
}
