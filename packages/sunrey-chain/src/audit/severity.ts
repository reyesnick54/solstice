import type { InternalSeverity } from './types.ts';

/**
 * Internal engineering severity guide.
 * The external reviewer remains free to use their own scale.
 * This mapping never rewrites reviewer_severity.
 */
export const INTERNAL_SEVERITY_GUIDE: Readonly<Record<InternalSeverity, string>> = Object.freeze({
  S0_EMERGENCY: 'Active exploitation or immediate consensus / supply integrity failure.',
  S1_CRITICAL: 'Direct unauthorized state change, key extraction, or supply inflation.',
  S2_HIGH: 'Bypass of a preventive control with a realistic path to unauthorized state change.',
  S3_MEDIUM: 'Control gap with compensating detective or recovery controls.',
  S4_LOW: 'Defense-in-depth gap or documentation defect without a current exploit path.',
  S5_INFORMATIONAL: 'Clarification, residual-risk statement, or process observation.',
});

export function suggestInternalSeverity(_reviewerSeverity: string): InternalSeverity | null {
  return null;
}
