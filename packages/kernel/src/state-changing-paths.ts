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
    id: 'exchange.recordListingApproval',
    symbol: 'recordListingApproval',
    file: 'packages/pyramid-exchange/src/registry.ts',
    gated: true,
    kernelKind: 'APPROVE_LISTING',
  },
  {
    id: 'exchange.recordEnforcementDecision',
    symbol: 'recordEnforcementDecision',
    file: 'packages/pyramid-exchange/src/surveillance.ts',
    gated: true,
    kernelKind: 'RECORD_SURVEILLANCE_ENFORCEMENT',
  },
  {
    id: 'exchange.engageKillSwitch',
    symbol: 'engageKillSwitch',
    file: 'packages/pyramid-exchange/src/kill-switch.ts',
    gated: true,
    kernelKind: 'TOGGLE_KILL_SWITCH',
  },
]);
