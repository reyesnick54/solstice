/**
 * Financial transaction lifecycle.
 *
 * A committed journal is always POSTED. Earlier states (INITIATED, PENDING,
 * AUTHORIZED) belong to the domain command (payment, card, hold, withdrawal)
 * and must not rewrite a posted journal. FAILED and CANCELLED also stay on
 * the command. SETTLED may be recorded as a later compensating or
 * reclassification journal, never as an in-place mutation.
 */
export const FINANCIAL_COMMAND_STATES = [
  'INITIATED',
  'PENDING',
  'AUTHORIZED',
  'POSTED',
  'SETTLED',
  'REVERSED',
  'FAILED',
  'CANCELLED',
] as const;

export type FinancialCommandState = (typeof FINANCIAL_COMMAND_STATES)[number];

export function isFinancialCommandState(value: unknown): value is FinancialCommandState {
  return typeof value === 'string' && (FINANCIAL_COMMAND_STATES as readonly string[]).includes(value);
}

export function journalReadStatus(input: {
  readonly posted: true;
  readonly reversed: boolean;
}): 'POSTED' | 'REVERSED' {
  return input.reversed ? 'REVERSED' : 'POSTED';
}
