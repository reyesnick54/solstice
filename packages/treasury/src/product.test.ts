import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { EvidenceVault } from '../../evidence/src/vault.ts';
import { DomainEventLog } from '../../events/src/events.ts';
import { asProviderBalanceId, asSettlementRecordId, asSuspenseItemId } from './ids.ts';
import { seedTreasuryStore } from './seed.ts';
import { TreasuryStore } from './store.ts';
import {
  FinancialControlService,
  SimulationReconciliationAdapter,
  controlledMismatchFixture,
  hashReconciliationInputs,
  reconcileExpectedToReported,
} from './product/index.ts';
import type { ExpectedFinancialRecord, ReportedFinancialRecord } from './product/index.ts';

const NOW = asUtcInstant('2026-08-21T12:00:00.000Z');

function expected(id: string, amount: bigint): ExpectedFinancialRecord {
  return {
    recordId: id,
    domain: 'PAYMENTS',
    provider: 'SIMULATED_PROVIDER_GCC',
    currency: 'USD',
    amountMinor: amount,
    externalRef: `ext_${id}`,
    occurredAt: NOW,
  };
}

function reported(id: string, amount: bigint): ReportedFinancialRecord {
  return {
    recordId: `rep_${id}`,
    provider: 'SIMULATED_PROVIDER_GCC',
    currency: 'USD',
    amountMinor: amount,
    externalRef: `ext_${id}`,
    statementRef: 'stmt_1',
    occurredAt: NOW,
  };
}

function service() {
  const clock = new FrozenClock(NOW);
  const evidence = new EvidenceVault(clock);
  const events = new DomainEventLog();
  const treasury = new TreasuryStore();
  seedTreasuryStore(treasury);
  return new FinancialControlService(clock, evidence, events, treasury);
}

describe('treasury financial control', () => {
  it('matches identical expected and reported records deterministically', () => {
    const first = reconcileExpectedToReported([expected('a', 10_000n)], [reported('a', 10_000n)]);
    const second = reconcileExpectedToReported([expected('a', 10_000n)], [reported('a', 10_000n)]);
    assert.equal(first.inputHash, second.inputHash);
    assert.equal(first.matchedCount, 1);
    assert.equal(first.breakCount, 0);
    assert.equal(first.pairings[0]?.conclusion, 'MATCHED');
    assert.equal(
      first.inputHash,
      hashReconciliationInputs([expected('a', 10_000n)], [reported('a', 10_000n)]),
    );
  });

  it('creates an amount-mismatch break and never claims a ledger adjustment', () => {
    const control = service();
    const result = control.runReconciliation({
      runId: 'run_mismatch',
      window: {
        provider: 'SIMULATED_PROVIDER_GCC',
        periodStart: NOW,
        periodEnd: NOW,
        sourceVersion: 'sim-recon-adapter-v1',
      },
      expected: [expected('pay1', 10_000n)],
      reported: [reported('pay1', 9_000n)],
    });
    assert.equal(result.replay, false);
    assert.equal(result.breaks.length, 1);
    assert.equal(result.breaks[0]?.type, 'AMOUNT_MISMATCH');
    assert.equal(result.breaks[0]?.status, 'OPEN');
    const replay = control.runReconciliation({
      runId: 'run_mismatch_again',
      window: {
        provider: 'SIMULATED_PROVIDER_GCC',
        periodStart: NOW,
        periodEnd: NOW,
        sourceVersion: 'sim-recon-adapter-v1',
      },
      expected: [expected('pay1', 10_000n)],
      reported: [reported('pay1', 9_000n)],
    });
    assert.equal(replay.replay, true);
    assert.equal(replay.run.runId, result.run.runId);
  });

  it('classifies missing, duplicate, and currency mismatches', () => {
    const missingExternal = reconcileExpectedToReported([expected('gone', 5_000n)], []);
    assert.equal(missingExternal.pairings[0]?.conclusion, 'MISSING_EXTERNAL_RECORD');
    const missingInternal = reconcileExpectedToReported([], [reported('ghost', 5_000n)]);
    assert.equal(missingInternal.pairings[0]?.conclusion, 'MISSING_INTERNAL_RECORD');
    const duplicate = reconcileExpectedToReported(
      [expected('dup', 1_000n)],
      [reported('dup', 1_000n), { ...reported('dup', 1_000n), recordId: 'rep_dup_2' }],
    );
    assert.ok(duplicate.pairings.some((row) => row.conclusion === 'DUPLICATE_EXTERNAL_RECORD'));
    const ccy = reconcileExpectedToReported(
      [expected('ccy', 1_000n)],
      [{ ...reported('ccy', 1_000n), currency: 'SAR' }],
    );
    assert.equal(ccy.pairings[0]?.conclusion, 'CURRENCY_MISMATCH');
  });

  it('keeps suspense visible and supports daily close without regulatory labeling', () => {
    const control = service();
    control.placeInSuspense({
      suspenseId: asSuspenseItemId('susp_unattributed'),
      treasuryAccountId: 'ta_fx_clearing_usd',
      currency: 'USD',
      amountMinor: 2_500n,
      reason: 'unattributed inbound',
      domain: 'PAYMENTS',
      provider: 'SIMULATED_PROVIDER_GCC',
      internalReferences: [],
      externalReferences: ['ext_unknown'],
      createdAt: NOW,
    });
    control.recordSettlement({
      settlementId: asSettlementRecordId('set_pay_1'),
      domain: 'PAYMENTS',
      provider: 'SIMULATED_PROVIDER_GCC',
      currency: 'USD',
      grossMinor: 10_000n,
      feesMinor: 150n,
      netMinor: 9_850n,
      expectedDate: NOW,
      actualDate: null,
      status: 'EXPECTED',
      providerReferences: ['prov_1'],
      ledgerReferences: [],
    });
    control.recordProviderBalance({
      providerBalanceId: asProviderBalanceId('pbal_gcc_usd'),
      provider: 'SIMULATED_PROVIDER_GCC',
      externalAccount: 'ext_gcc_usd',
      currency: 'USD',
      reportedMinor: 1_000_000n,
      availableMinor: 900_000n,
      reportedAt: NOW,
      statementRef: 'stmt_gcc',
      evidenceSource: 'sim-recon-adapter-v1',
    });
    const close = control.dailyClose({
      closeId: 'close_sim_1',
      periodStart: NOW,
      periodEnd: NOW,
      ports: {
        customerLiabilityByCurrency: { USD: 200_000n, SAR: 0n },
        ledgerControlByCurrency: { USD: 200_000n, SAR: 0n },
        feeTotalsByCurrency: { USD: 1_500n },
        pendingHoldCount: 1,
        fxLongByCurrency: { SAR: 374_500n },
        fxShortByCurrency: { USD: 100_000n },
      },
    });
    assert.equal(close.legalSufficiency, 'NOT_A_REGULATORY_REPORT');
    assert.ok(close.openSuspense.length >= 1);
    assert.ok(close.liquidity.some((row) => row.currency === 'USD'));
    assert.equal(close.notes.includes('Ledger was not adjusted to force a match'), true);
  });

  it('resolves a test break through the controlled status path', () => {
    const control = service();
    const result = control.runReconciliation({
      runId: 'run_resolve',
      window: {
        provider: 'SIMULATED_PROVIDER_GCC',
        periodStart: NOW,
        periodEnd: NOW,
        sourceVersion: 'sim-recon-adapter-v1',
      },
      expected: [expected('x', 10n)],
      reported: [reported('x', 11n)],
    });
    const resolved = control.resolveBreak(result.breaks[0]!.breakId, 'RESOLVED', 'controlled_test_resolution');
    assert.equal(resolved.status, 'RESOLVED');
    assert.equal(resolved.resolutionEvidence, 'controlled_test_resolution');
  });

  it('applies a controlled mismatch fixture from the simulation adapter', () => {
    const clock = new FrozenClock(NOW);
    const matched = reported('fix', 50_000n);
    const adapter = new SimulationReconciliationAdapter([
      controlledMismatchFixture('SIMULATED_PROVIDER_GCC', matched, 49_000n),
    ]);
    const control = new FinancialControlService(clock, new EvidenceVault(clock), new DomainEventLog(), new TreasuryStore(), {
      adapter,
    });
    const result = control.runReconciliation({
      runId: 'run_fixture',
      window: {
        provider: 'SIMULATED_PROVIDER_GCC',
        periodStart: NOW,
        periodEnd: NOW,
        sourceVersion: 'sim-recon-adapter-v1',
      },
      expected: [expected('fix', 50_000n)],
    });
    assert.equal(result.breaks[0]?.type, 'AMOUNT_MISMATCH');
  });
});
