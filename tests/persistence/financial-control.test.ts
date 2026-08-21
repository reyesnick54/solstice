import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../../packages/domain/src/time.ts';
import { EvidenceVault } from '../../packages/evidence/src/vault.ts';
import { DomainEventLog } from '../../packages/events/src/events.ts';
import { FrozenClock } from '../../packages/config/src/clock.ts';
import {
  loadFinancialControlSnapshot,
  persistFinancialControlSnapshot,
} from '../../packages/persistence/src/treasury/pg-financial-control-store.ts';
import { closePersistencePools, createPersistencePools } from '../../packages/persistence/src/postgres/pools.ts';
import { asProviderBalanceId, asSettlementRecordId } from '../../packages/treasury/src/ids.ts';
import { FinancialControlService, FinancialControlStore, seedTreasuryStore } from '../../packages/treasury/src/index.ts';
import { TreasuryStore } from '../../packages/treasury/src/store.ts';
import { persistenceAvailable, preparePersistence } from './helpers.ts';

const describePersistence = persistenceAvailable() ? describe : describe.skip;
const NOW = asUtcInstant('2026-08-21T12:00:00.000Z');

describePersistence('treasury financial-control persistence', () => {
  it('round-trips provider balances, settlements, reconciliation, and breaks', async () => {
    const env = await preparePersistence();
    const clock = new FrozenClock(NOW);
    const treasury = new TreasuryStore();
    seedTreasuryStore(treasury);
    const control = new FinancialControlService(clock, new EvidenceVault(clock), new DomainEventLog(), treasury);
    control.recordProviderBalance({
      providerBalanceId: asProviderBalanceId('pbal_fc_1'),
      provider: 'SIMULATED_PROVIDER_GCC',
      externalAccount: 'ext_op_usd',
      currency: 'USD',
      reportedMinor: 10_000n,
      availableMinor: 9_000n,
      reportedAt: NOW,
      statementRef: 'stmt_fc',
      evidenceSource: 'SIMULATION_FIXTURE',
    });
    control.recordSettlement({
      settlementId: asSettlementRecordId('set_fc_1'),
      domain: 'PAYMENTS',
      provider: 'SIMULATED_PROVIDER_GCC',
      currency: 'USD',
      grossMinor: 1_500n,
      feesMinor: 500n,
      netMinor: 1_000n,
      expectedDate: NOW,
      actualDate: NOW,
      status: 'SETTLED',
      providerReferences: ['ext_fc'],
      ledgerReferences: ['jnl_fc'],
    });
    const mismatch = control.runReconciliation({
      runId: 'run_fc_1',
      window: {
        provider: 'SIMULATED_PROVIDER_GCC',
        periodStart: NOW,
        periodEnd: NOW,
        sourceVersion: 'sim-recon-adapter-v1',
      },
      expected: [
        {
          recordId: 'exp_fc',
          domain: 'PAYMENTS',
          provider: 'SIMULATED_PROVIDER_GCC',
          currency: 'USD',
          amountMinor: 99n,
          externalRef: 'ext_fc_m',
          occurredAt: NOW,
        },
      ],
      reported: [
        {
          recordId: 'rep_fc',
          provider: 'SIMULATED_PROVIDER_GCC',
          currency: 'USD',
          amountMinor: 1n,
          externalRef: 'ext_fc_m',
          statementRef: 'stmt_fc',
          occurredAt: NOW,
        },
      ],
    });
    assert.equal(mismatch.breaks.length, 1);
    const close = control.dailyClose({
      closeId: 'close_fc_1',
      periodStart: NOW,
      periodEnd: NOW,
      ports: {
        customerLiabilityByCurrency: { USD: 1n },
        ledgerControlByCurrency: { USD: 1n },
      },
    });
    assert.equal(close.legalSufficiency, 'NOT_A_REGULATORY_REPORT');

    const pools = createPersistencePools(env);
    await persistFinancialControlSnapshot(pools.customer, control.store.snapshot());
    const loaded = await loadFinancialControlSnapshot(pools.customer);
    const restored = new FinancialControlStore();
    restored.hydrate(loaded);
    assert.equal(restored.listProviderBalances().length >= 1, true);
    assert.equal(restored.getSettlement('set_fc_1')?.netMinor, 1_000n);
    assert.equal(restored.listBreaks().length, mismatch.breaks.length);
    assert.equal(restored.listCloses()[0]?.closeId, 'close_fc_1');
    assert.equal(restored.listCloses()[0]?.legalSufficiency, 'NOT_A_REGULATORY_REPORT');
    await closePersistencePools(pools);
  });
});
