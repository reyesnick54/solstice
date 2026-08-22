import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { treasuryAdapterFromFinancialSnapshot } from './product/financial-provider-bridge.ts';

describe('Phase D treasury financial-provider bridge', () => {
  it('maps a provider snapshot onto the Phase C reconciliation adapter', () => {
    const adapter = treasuryAdapterFromFinancialSnapshot({
      window: {
        provider: 'SIMULATED_BANK_BAAS',
        periodStart: '2026-01-01T00:00:00.000Z',
        periodEnd: '2026-01-31T00:00:00.000Z',
        sourceVersion: 'phase-d-02',
      },
      balance: {
        provider: 'SIMULATED_BANK_BAAS',
        externalAccount: 'ext_sim',
        currency: 'USD',
        reportedMinor: 2500n,
        availableMinor: 2500n,
        reportedAt: '2026-01-31T00:00:00.000Z',
        statementRef: 'stmt_sim',
        isCustomerLedgerBalance: false,
      },
      transactions: [
        {
          recordId: 'tx_1',
          provider: 'SIMULATED_BANK_BAAS',
          currency: 'USD',
          amountMinor: 2500n,
          externalRef: 'ext_tx_1',
          statementRef: 'stmt_sim',
          occurredAt: '2026-01-15T00:00:00.000Z',
        },
      ],
      statement: {
        statementRef: 'stmt_sim',
        provider: 'SIMULATED_BANK_BAAS',
        periodStart: '2026-01-01T00:00:00.000Z',
        periodEnd: '2026-01-31T00:00:00.000Z',
        present: true,
      },
      providerBalanceIsLedgerAuthority: false,
    });
    const window = {
      provider: 'SIMULATED_BANK_BAAS',
      periodStart: '2026-01-01T00:00:00.000Z',
      periodEnd: '2026-01-31T00:00:00.000Z',
      sourceVersion: 'phase-d-02',
    };
    const balance = adapter.fetchBalance(window);
    assert.equal(balance?.reportedMinor, 2500n);
    assert.equal(adapter.fetchTransactions(window).length, 1);
    assert.equal(adapter.fetchStatement(window).present, true);
  });
});
