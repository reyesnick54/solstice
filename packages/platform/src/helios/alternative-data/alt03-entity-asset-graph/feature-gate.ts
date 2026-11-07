import type { AltObservationMatchState } from './taxonomy.ts';

export type AltCompanyFeatureGateResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: AltObservationMatchState; readonly message: string };

const BLOCKED_FOR_COMPANY_FEATURES = new Set<AltObservationMatchState>([
  'AMBIGUOUS',
  'UNRESOLVED',
  'CONFLICTING',
  'EXPIRED',
]);

/**
 * AMBIGUOUS / UNRESOLVED observations may not become company-specific investment features.
 */
export function assertAltObservationCompanyFeatureEligible(
  matchState: AltObservationMatchState,
): AltCompanyFeatureGateResult {
  if (BLOCKED_FOR_COMPANY_FEATURES.has(matchState)) {
    return {
      ok: false,
      code: matchState,
      message: `alternative observation match state ${matchState} cannot materialize company-specific investment features`,
    };
  }
  return { ok: true };
}
