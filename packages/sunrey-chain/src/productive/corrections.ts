import { PRODUCTIVE_SCHEMA_VERSION } from './types.ts';

export const CORRECTION_KINDS = [
  'FUTURE_ELIGIBILITY',
  'FUTURE_POLICY',
  'FUTURE_ISSUANCE',
  'DISPUTE_REVIEW',
] as const;
export type CorrectionKind = (typeof CORRECTION_KINDS)[number];

/**
 * Finalized history is not silently rewritten. A correction is a new
 * governed record that may affect future eligibility, policy, issuance,
 * or dispute review. Historical valid issuance is not erased without an
 * explicit governed corrective transaction.
 */
export type ProductiveCorrection = {
  readonly schemaVersion: typeof PRODUCTIVE_SCHEMA_VERSION;
  readonly correctionId: string;
  readonly kind: CorrectionKind;
  readonly targetId: string;
  readonly reason: string;
  readonly activationHeight: number;
  readonly erasesHistoricalIssuance: false;
  readonly governedTransactionId: string;
};
