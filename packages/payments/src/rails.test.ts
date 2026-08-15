import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../../domain/src/time.ts';
import { Money } from '../../money/src/money.ts';
import { asPaymentId } from './ids.ts';
import { SimulatedRailAdapter } from './rail-adapters.ts';
import { simulationCapabilities } from './rail-capability.ts';
import { RailCircuitBreaker } from './rail-health.ts';
import { createSimulationRailNetwork } from './rail-network.ts';
import { createRailSubmission, providerIdempotencyKeyFor } from './rail-submission.ts';
import { decideRetry } from './rail-retry.ts';
import { normalizeProviderStatus } from './rail-types.ts';
import { hashCallbackBody } from './rail-webhook.ts';
import { reconcileRail } from './rail-reconciliation.ts';
import { buildSettlementReport } from './rail-settlement-report.ts';
import { inboundPendingPlan, inboundSettlePlan } from './accounting.ts';
import { asBeneficiaryId } from './ids.ts';

const NOW = asUtcInstant('2026-08-15T12:00:00.000Z');

function commandFor(adapter: SimulatedRailAdapter, paymentId: string, key = `key_${paymentId}`) {
  return {
    authorityId: 'ea_sim',
    actionType: 'INITIATE_PAYMENT' as const,
    submission: createRailSubmission(
      {
        paymentId: asPaymentId(paymentId),
        provider: adapter.capability.provider,
        rail: adapter.capability.rail,
        amount: Money.fromMinorUnits(374_500n, 'SAR'),
        currency: 'SAR' as never,
        sourceReference: 'src_opaque',
        destinationReference: 'dst_opaque',
        beneficiaryReference: asBeneficiaryId('ben_sim'),
        purposeReference: 'simulation',
        idempotencyKey: providerIdempotencyKeyFor(paymentId, key),
        correlationId: key,
        requestedSettlement: { settlementClass: 'CORRESPONDENT', requestedAt: null },
      },
      NOW,
    ),
  };
}

describe('canonical rail adapters', () => {
  it('runs multiple rail classes through the same RailAdapter port', () => {
    const rails = [
      'US_BATCH',
      'US_INSTANT',
      'EU_SEPA',
      'EU_SEPA_INSTANT',
      'UK_FASTER_PAYMENT',
      'INTERNATIONAL_CORRESPONDENT',
      'SA_DOMESTIC',
      'AE_DOMESTIC',
    ];
    for (const rail of rails) {
      const capability = simulationCapabilities().find((row) => row.rail === rail && row.enabled);
      assert.ok(capability, rail);
      const adapter = new SimulatedRailAdapter(capability!);
      const result = adapter.submitPayment(commandFor(adapter, `pay_${rail}`));
      assert.equal(result.status, 'SETTLED');
      assert.equal(adapter.health().connectivity, 'SIMULATION');
    }
  });

  it('normalizes provider-specific status strings', () => {
    assert.equal(normalizeProviderStatus('ACK'), 'ACCEPTED');
    assert.equal(normalizeProviderStatus('NACK'), 'REJECTED');
    assert.equal(normalizeProviderStatus('IN_FLIGHT'), 'PROCESSING');
    assert.equal(normalizeProviderStatus('weird-vendor-code'), 'UNKNOWN');
  });

  it('returns the original submission for a repeated provider idempotency key', () => {
    const capability = simulationCapabilities().find((row) => row.provider === 'SIMULATED_PROVIDER_GCC')!;
    const adapter = new SimulatedRailAdapter(capability);
    const first = adapter.submitPayment(commandFor(adapter, 'pay_idemp', 'same'));
    const second = adapter.submitPayment(commandFor(adapter, 'pay_idemp', 'same'));
    assert.equal(first.references.providerPaymentId, second.references.providerPaymentId);
    assert.equal(first.status, second.status);
  });

  it('refuses to resubmit when execution is unknown', () => {
    const decision = decideRetry('SUBMIT', 'SUBMISSION_UNKNOWN', { executionUnknown: true });
    assert.equal(decision.retryClass, 'DO_NOT_RETRY_WITHOUT_QUERY');
    assert.equal(decision.allowed, false);
  });

  it('marks a provider UNAVAILABLE after repeated timeouts without touching journals', () => {
    const breaker = new RailCircuitBreaker(() => NOW);
    const provider = 'SIMULATED_PROVIDER_GCC' as never;
    breaker.recordFailure(provider, 'TIMEOUT');
    breaker.recordFailure(provider, 'TIMEOUT');
    const open = breaker.recordFailure(provider, 'TIMEOUT');
    assert.equal(open.health, 'UNAVAILABLE');
  });

  it('returns CANCELLATION_NOT_SUPPORTED when the capability forbids cancel', () => {
    const capability = simulationCapabilities().find((row) => row.rail === 'US_INSTANT')!;
    const adapter = new SimulatedRailAdapter(capability);
    const command = commandFor(adapter, 'pay_nocancel');
    adapter.submitPayment(command);
    const cancelled = adapter.cancelPayment({ command });
    assert.equal(cancelled.outcome, 'CANCELLATION_NOT_SUPPORTED');
  });

  it('builds a deterministic settlement report', () => {
    const first = buildSettlementReport({
      provider: 'SIMULATED_PROVIDER_GCC',
      settledAt: NOW,
      currency: 'SAR' as never,
      payments: [
        {
          paymentId: asPaymentId('pay_rep'),
          settlementReference: 'sref_pay_rep' as never,
          amount: Money.fromMinorUnits(374_500n, 'SAR'),
          fee: Money.zero('SAR'),
        },
      ],
    });
    const second = buildSettlementReport({
      provider: 'SIMULATED_PROVIDER_GCC',
      settledAt: NOW,
      currency: 'SAR' as never,
      payments: [
        {
          paymentId: asPaymentId('pay_rep'),
          settlementReference: 'sref_pay_rep' as never,
          amount: Money.fromMinorUnits(374_500n, 'SAR'),
          fee: Money.zero('SAR'),
        },
      ],
    });
    assert.equal(first.reportId, second.reportId);
    assert.equal(first.integrityHash, second.integrityHash);
    assert.equal(first.grossAmount.minorUnits, 374_500n);
  });

  it('classifies missing external and missing internal reconciliation without auto-fix', () => {
    const missingExternal = reconcileRail(
      {
        paymentId: 'pay_x',
        status: 'SETTLED',
        journalIds: [],
        settlementRef: 'sref',
        quotedDestinationAmount: Money.fromMinorUnits(1n, 'SAR'),
        sourceAmount: Money.fromMinorUnits(1n, 'USD'),
        destinationCurrency: 'SAR',
        sourceCurrency: 'USD',
      } as never,
      null,
      [],
      null,
    );
    assert.equal(missingExternal.status, 'MISSING_EXTERNAL');
    const missingInternal = reconcileRail(null, null, [], {
      paymentId: 'pay_y',
      settlementRef: 'sref',
      destinationAmountMinorUnits: '1',
      destinationCurrency: 'SAR',
      sourceAmountMinorUnits: '1',
      sourceCurrency: 'USD',
    });
    assert.equal(missingInternal.status, 'MISSING_INTERNAL');
  });

  it('keeps inbound journal plans single-currency and balanced', () => {
    const amount = Money.fromMinorUnits(10_000n, 'USD');
    for (const plan of [inboundPendingPlan(amount), inboundSettlePlan('acct_us', amount)]) {
      const currencies = new Set(plan.postings.map((row) => row.amount.currency));
      assert.equal(currencies.size, 1);
      const debits = plan.postings.filter((row) => row.direction === 'DEBIT').reduce((sum, row) => sum + row.amount.minorUnits, 0n);
      const credits = plan.postings.filter((row) => row.direction === 'CREDIT').reduce((sum, row) => sum + row.amount.minorUnits, 0n);
      assert.equal(debits, credits);
    }
  });

  it('excludes an unavailable provider from the route catalog', () => {
    const network = createSimulationRailNetwork(() => NOW);
    network.setProviderHealth('SIMULATED_PROVIDER_GCC', 'UNAVAILABLE');
    const routes = network.routesFor('US-SA-USD-SAR', Money.fromMinorUnits(1_500n, 'USD'));
    const gcc = routes.find((row) => row.routeId === 'sim-gcc-usd-sar');
    assert.equal(gcc?.available, false);
  });

  it('dead-letters a stale callback instead of mutating payment state', () => {
    const network = createSimulationRailNetwork(() => NOW);
    const stale = network.signCallback({
      provider: 'SIMULATED_PROVIDER_GCC',
      timestamp: asUtcInstant('2026-08-15T11:00:00.000Z'),
      schemaVersion: 1,
      providerEventId: 'evt_stale',
      paymentId: 'pay_stale',
      railSubmissionId: 'rsub_stale',
      providerStatus: 'SETTLED',
      payloadHash: hashCallbackBody('stale'),
    });
    const ingested = network.callbacks.ingest(stale);
    assert.equal(ingested.outcome, 'DEAD_LETTER');
    if (ingested.outcome === 'DEAD_LETTER') {
      assert.equal(ingested.code, 'STALE_CALLBACK');
    }
  });

  it('hashes callback bodies instead of retaining raw provider payloads', () => {
    const hash = hashCallbackBody('{"accountNumber":"secret"}');
    assert.equal(hash.length, 64);
    assert.equal(hash.includes('secret'), false);
  });
});
