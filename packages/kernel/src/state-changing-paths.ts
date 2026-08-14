/**
 * Registry of every path that changes financial or regulated customer state.
 * CI (`scripts/check-kernel-gating.mjs`) fails if a new mutator is added
 * without KernelAuthorization, or if a listed mutator loses its gate.
 *
 * `gated: true` means the implementation requires a KernelAuthorization
 * minted by ComplianceKernel.evaluate.
 */
export type StateChangingPath = {
  readonly id: string;
  readonly symbol: string;
  readonly file: string;
  readonly gated: true;
  readonly kernelKind: string;
};

export const STATE_CHANGING_PATHS: readonly StateChangingPath[] = Object.freeze([
  {
    id: 'customer.put',
    symbol: 'putCustomer',
    file: 'packages/ledger/src/stores.ts',
    gated: true,
    kernelKind: 'CREATE_CUSTOMER',
  },
  {
    id: 'customer.transition',
    symbol: 'commitCustomerStatus',
    file: 'packages/ledger/src/stores.ts',
    gated: true,
    kernelKind: 'TRANSITION_CUSTOMER_STATUS',
  },
  {
    id: 'account.open',
    symbol: 'putAccount',
    file: 'packages/ledger/src/stores.ts',
    gated: true,
    kernelKind: 'OPEN_ACCOUNT',
  },
  {
    id: 'ledger.commitJournal',
    symbol: 'commitJournal',
    file: 'packages/ledger/src/journal.ts',
    gated: true,
    kernelKind: 'POST_JOURNAL|SEED_CREDIT|FX_CONVERT|SEND_PAYMENT|COMPENSATE_PAYMENT',
  },
  {
    id: 'beneficiary.put',
    symbol: 'putBeneficiary',
    file: 'packages/ledger/src/stores.ts',
    gated: true,
    kernelKind: 'ADD_BENEFICIARY',
  },
  {
    id: 'beneficiary.update',
    symbol: 'updateBeneficiary',
    file: 'packages/ledger/src/stores.ts',
    gated: true,
    kernelKind: 'UPDATE_BENEFICIARY',
  },
  {
    id: 'payment.put',
    symbol: 'putPayment',
    file: 'packages/ledger/src/stores.ts',
    gated: true,
    kernelKind: 'SEND_PAYMENT',
  },
  {
    id: 'payment.transition',
    symbol: 'transitionPayment',
    file: 'packages/ledger/src/stores.ts',
    gated: true,
    kernelKind: 'SEND_PAYMENT|COMPENSATE_PAYMENT',
  },
  {
    id: 'growth.recordCostAvoided',
    symbol: 'recordCostAvoided',
    file: 'packages/ledger/src/stores.ts',
    gated: true,
    kernelKind: 'RECORD_COST_AVOIDED',
  },
  {
    id: 'pyr.openWallet',
    symbol: 'openWallet',
    file: 'packages/pyr-ledger/src/books.ts',
    gated: true,
    kernelKind: 'OPEN_PYR_WALLET',
  },
  {
    id: 'pyr.seedCorporate',
    symbol: 'seedCorporate',
    file: 'packages/pyr-ledger/src/books.ts',
    gated: true,
    kernelKind: 'SEED_PYR',
  },
  {
    id: 'pyr.settleCompensation',
    symbol: 'settleCompensation',
    file: 'packages/pyr-ledger/src/books.ts',
    gated: true,
    kernelKind: 'SETTLE_PYR_COMPENSATION',
  },
  {
    id: 'pyr.transfer',
    symbol: 'transfer',
    file: 'packages/pyr-ledger/src/books.ts',
    gated: true,
    kernelKind: 'TRANSFER_PYR',
  },
  {
    id: 'consent.grant',
    symbol: 'grantConsent',
    file: 'packages/consent/src/ledger.ts',
    gated: true,
    kernelKind: 'GRANT_CONSENT',
  },
  {
    id: 'consent.revoke',
    symbol: 'revokeConsent',
    file: 'packages/consent/src/ledger.ts',
    gated: true,
    kernelKind: 'REVOKE_CONSENT',
  },
  {
    id: 'exchange.publish',
    symbol: 'publish',
    file: 'packages/data-exchange/src/request.ts',
    gated: true,
    kernelKind: 'PUBLISH_DATA_REQUEST',
  },
  {
    id: 'cleanRoom.run',
    symbol: 'run',
    file: 'packages/clean-room/src/clean-room.ts',
    gated: true,
    kernelKind: 'RUN_CLEAN_ROOM',
  },
  {
    id: 'proof.issue',
    symbol: 'issue',
    file: 'packages/proof-contribution/src/proof.ts',
    gated: true,
    kernelKind: 'ISSUE_PROOF_OF_CONTRIBUTION',
  },
]);
