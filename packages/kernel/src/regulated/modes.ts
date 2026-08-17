/**
 * Chunk 69 — explicit regulated-service activation modes.
 *
 * There is no generic "live" mode that silently activates financial
 * execution. PRODUCTION_CANDIDATE_DISABLED is the strongest production
 * posture this chunk may record.
 */

export const REGULATED_SERVICE_MODES = [
  'SIMULATION',
  'SANDBOX',
  'INTEGRATION_TEST',
  'PRODUCTION_CANDIDATE_DISABLED',
] as const;
export type RegulatedServiceMode = (typeof REGULATED_SERVICE_MODES)[number];

export const LIVE_FINANCIAL_EXECUTION_MODES = [] as const;

export function isRegulatedServiceMode(value: unknown): value is RegulatedServiceMode {
  return typeof value === 'string' && (REGULATED_SERVICE_MODES as readonly string[]).includes(value);
}

export function modeAllowsLiveFinancialExecution(_mode: RegulatedServiceMode): false {
  return false;
}

export function assertNoSilentLiveActivation(mode: RegulatedServiceMode): void {
  if (modeAllowsLiveFinancialExecution(mode)) {
    throw new TypeError('live financial execution is not an allowed regulated-service mode');
  }
}
