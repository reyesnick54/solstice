import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { asAccountId } from '../packages/domain/src/account.ts';
import { asCurrencyCode } from '../packages/domain/src/currency.ts';
import { asJurisdiction } from '../packages/domain/src/jurisdiction.ts';
import { asLegalEntityId } from '../packages/domain/src/legal-entity.ts';
import { asProductId } from '../packages/domain/src/product.ts';
import { Money } from '../packages/money/src/money.ts';
import { asIntentId } from '../packages/permissions/src/action-intent.ts';
import { ACTION_TYPES } from '../packages/permissions/src/action-types.ts';
import { acceptIntent, quoteIntent } from './payment-world.ts';
import { createPhaseCWorld, ledgerBalance } from './phase-c-world.ts';

function median(samples: readonly number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function timeMs(fn: () => void): number {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

describe('Phase C non-production performance baseline', () => {
  it('measures sandbox money-path timings without inventing SLAs', () => {
    const world = createPhaseCWorld('perf', 2_000_000n);
    const balanceSamples: number[] = [];
    const transferSamples: number[] = [];
    const quoteSamples: number[] = [];
    const reconSamples: number[] = [];

    for (let i = 0; i < 20; i += 1) {
      balanceSamples.push(timeMs(() => {
        ledgerBalance(world, world.account);
      }));
      quoteSamples.push(timeMs(() => {
        world.payments.createQuote(quoteIntent(world, `perf_q_${i}`));
      }));
    }

    const quoteForAccept = world.payments.createQuote(quoteIntent(world, 'perf_fx'));
    assert.equal(quoteForAccept.outcome, 'OK');
    if (quoteForAccept.outcome !== 'OK') {
      throw new Error('perf quote');
    }
    const accepted = world.payments.acceptQuote(acceptIntent(world, 'perf_fx', quoteForAccept.value.quoteId));
    assert.equal(accepted.outcome, 'OK');

    const secondUsd = world.runtime.accountsService.open({
      id: asIntentId('open_usd2_perf'),
      actionType: ACTION_TYPES.OPEN_ACCOUNT,
      idempotencyKey: 'open_usd2_perf',
      actorId: world.actorId,
      requestedAt: world.clock.now(),
      purpose: 'CUSTOMER_ONBOARDING',
      payload: {
        accountId: asAccountId('acct_usd2_perf'),
        ownerId: world.customer.id,
        productId: asProductId('prod_demand_usd_us'),
        accountClass: 'DEMAND_DEPOSIT',
        legalEntityId: asLegalEntityId('le_solstice_us_inc'),
        jurisdiction: asJurisdiction('US'),
        currency: asCurrencyCode('USD'),
      },
    });
    assert.equal(secondUsd.outcome, 'OPENED');
    if (secondUsd.outcome === 'OPENED') {
      for (let i = 0; i < 5; i += 1) {
        transferSamples.push(
          timeMs(() => {
            world.runtime.money.transfer({
              id: asIntentId(`xfer_perf_${i}`),
              actionType: ACTION_TYPES.INTERNAL_TRANSFER,
              idempotencyKey: `xfer_perf_${i}`,
              actorId: world.actorId,
              requestedAt: world.clock.now(),
              purpose: 'CUSTOMER_TRANSFER',
              payload: {
                sourceAccountId: world.account.id,
                destinationAccountId: secondUsd.account.id,
                amount: Money.fromMinorUnits(100n, 'USD'),
              },
            });
          }),
        );
      }
    }

    for (let i = 0; i < 10; i += 1) {
      reconSamples.push(
        timeMs(() => {
          world.control.runReconciliation({
            runId: `run_perf_${i}`,
            window: {
              provider: 'SIMULATED_PROVIDER_GCC',
              periodStart: world.clock.now(),
              periodEnd: world.clock.now(),
              sourceVersion: 'sim-recon-adapter-v1',
            },
            expected: [
              {
                recordId: `exp_${i}`,
                domain: 'PAYMENTS',
                provider: 'SIMULATED_PROVIDER_GCC',
                currency: 'USD',
                amountMinor: BigInt(i + 1),
                externalRef: `ext_perf_${i}`,
                occurredAt: world.clock.now(),
              },
            ],
            reported: [
              {
                recordId: `rep_${i}`,
                provider: 'SIMULATED_PROVIDER_GCC',
                currency: 'USD',
                amountMinor: BigInt(i + 1),
                externalRef: `ext_perf_${i}`,
                statementRef: 'stmt_perf',
                occurredAt: world.clock.now(),
              },
            ],
          });
        }),
      );
    }

    const report = {
      environment: 'simulation',
      methodology: 'FrozenClock in-process sandbox. Not a hosted load test. Not an SLA.',
      samples: {
        balance_reads: { n: balanceSamples.length, median_ms: median(balanceSamples), max_ms: Math.max(...balanceSamples) },
        fx_quotes: { n: quoteSamples.length, median_ms: median(quoteSamples), max_ms: Math.max(...quoteSamples) },
        reconciliation_batch: { n: reconSamples.length, median_ms: median(reconSamples), max_ms: Math.max(...reconSamples) },
        transfer_samples: { n: transferSamples.length, median_ms: transferSamples.length ? median(transferSamples) : 0, max_ms: transferSamples.length ? Math.max(...transferSamples) : 0 },
      },
    };
    writeFileSync(
      join(import.meta.dirname, '..', 'docs/productization/PHASE_C_PERFORMANCE_BASELINE.json'),
      `${JSON.stringify(report, null, 2)}\n`,
    );
    assert.ok(report.samples.balance_reads.median_ms >= 0);
  });
});
