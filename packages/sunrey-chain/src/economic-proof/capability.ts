/**
 * Wave 3 — Economic Proof Architecture capability marker.
 *
 * Extends the canonical `packages/sunrey-chain` owner. Not a second ledger,
 * Kernel, mint, or governance engine.
 */

export const WAVE3_ECONOMIC_PROOF_CAPABILITY = {
  owner: 'packages/sunrey-chain',
  path: 'packages/sunrey-chain/src/economic-proof',
  wave: 3,
  roots: ['TRANSACTION', 'MONETARY_STATE', 'EVIDENCE', 'RIGHTS', 'POLICY'] as const,
  simulationOnly: true,
  productionActivated: false,
} as const;
