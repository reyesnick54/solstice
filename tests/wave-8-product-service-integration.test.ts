/**
 * Wave 8 — Product service integration tests.
 *
 * Validates service boundaries, startup order, blockchain reference model,
 * reconciliation links, durable runtime wiring, and degraded-mode behavior.
 */

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';

import {
  asBlockHash,
  asChainId,
  asChainTransactionId,
  asEconomicClaimId,
  asEconomicReceiptId,
  asMonetaryStateRoot,
  freezeCanonicalBlockchainReference,
  isCanonicalBlockchainReference,
} from '../packages/domain/src/blockchain-reference.ts';
import {
  asProductReconciliationLinkId,
  freezeProductReconciliationLink,
} from '../packages/domain/src/product-reconciliation-link.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { ENVIRONMENT } from '../packages/config/src/flags.ts';
import { OPERATIONS_CONTROL_FLAGS } from '../packages/kernel/src/operations/flags.ts';
import { evaluateMainnetRuntimeGate } from '../packages/sunrey-chain/src/runtime/mainnet-gate.ts';
import { SUNREY_AGENT_ISOLATION } from '../packages/sunrey-agent/src/isolation.ts';
import { PRODUCT_SERVICE_BOUNDARIES } from '../services/api/src/product-integration/boundaries.ts';
import {
  PRODUCT_SERVICE_STARTUP_ORDER,
  canStartService,
  servicesInPhase,
} from '../services/api/src/product-integration/startup-order.ts';
import { resolveProductIntegrationMode } from '../services/api/src/product-integration/runtime.ts';

const NOW = asUtcInstant('2026-09-02T12:00:00.000Z');

function sampleChainReference() {
  return freezeCanonicalBlockchainReference({
    chainId: asChainId('chn_sunrey_development'),
    transactionId: asChainTransactionId(`tx_${randomUUID()}`),
    finalizedBlockHeight: 42,
    finalizedBlockHash: asBlockHash('0x' + 'ab'.repeat(32)),
    monetaryStateRoot: asMonetaryStateRoot('0x' + 'cd'.repeat(32)),
    economicClaimId: asEconomicClaimId('claim.wave8.test'),
    economicReceiptId: asEconomicReceiptId('receipt.wave8.test'),
    finalizedAt: NOW,
  });
}

describe('Wave 8 — product service integration', () => {
  it('preserves simulation environment and mainnet fail-closed', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(OPERATIONS_CONTROL_FLAGS.PRODUCTION_ACTIVE, false);
    assert.equal(evaluateMainnetRuntimeGate().passed, false);
  });

  it('defines service boundaries without granting monetary authority to product layers', () => {
    assert.equal(PRODUCT_SERVICE_BOUNDARIES.BLOCKCHAIN_NODE.mayNot.includes('postJournal'), true);
    assert.equal(PRODUCT_SERVICE_BOUNDARIES.LEDGER.mayNot.includes('canonical native supply'), true);
    assert.equal(PRODUCT_SERVICE_BOUNDARIES.EXCHANGE.mayNot.includes('Mint'), true);
    assert.equal(PRODUCT_SERVICE_BOUNDARIES.CONSUMER_API.mayNot.includes('Mint'), true);
    assert.equal(PRODUCT_SERVICE_BOUNDARIES.AGENT.mayNot.includes('AuthorityIssuer'), true);
    assert.equal(SUNREY_AGENT_ISOLATION.mayNotCall.includes('AuthorityIssuer'), true);
  });

  it('orders startup so consumer API depends on accounts and identity', () => {
    const consumer = PRODUCT_SERVICE_STARTUP_ORDER.find((row) => row.serviceId === 'consumer-api');
    assert.ok(consumer);
    assert.ok(consumer.requiredDependencies.includes('accounts'));
    assert.ok(consumer.requiredDependencies.includes('identity'));
    assert.ok(consumer.blocksFinancialWrites);
    const blockchain = PRODUCT_SERVICE_STARTUP_ORDER.find((row) => row.serviceId === 'blockchain-node');
    assert.ok(blockchain?.degradedMode?.includes('stale'));
  });

  it('blocks service start when dependencies are missing', () => {
    const ready = new Set(['config', 'persistence', 'evidence']);
    const ledger = canStartService('ledger', ready);
    assert.equal(ledger.allowed, true);
    const exchange = canStartService('exchange', ready);
    assert.equal(exchange.allowed, false);
    assert.ok(exchange.missing.includes('blockchain-query'));
  });

  it('allows degraded consumer API when core deps ready', () => {
    const ready = new Set([
      'config',
      'persistence',
      'evidence',
      'kernel',
      'ledger',
      'accounts',
      'identity',
      'consent',
    ]);
    const result = canStartService('consumer-api', ready);
    assert.equal(result.allowed, true);
  });

  it('groups services into startup phases', () => {
    const ledgerPhase = servicesInPhase('LEDGER_AND_ACCOUNTS');
    assert.ok(ledgerPhase.some((row) => row.serviceId === 'ledger'));
    assert.ok(ledgerPhase.some((row) => row.serviceId === 'accounts'));
  });

  it('validates canonical blockchain reference shape', () => {
    const ref = sampleChainReference();
    assert.ok(isCanonicalBlockchainReference(ref));
    assert.throws(() =>
      freezeCanonicalBlockchainReference({
        ...ref,
        finalizedBlockHeight: -1,
      }),
    );
  });

  it('creates product reconciliation links with chain and journal traceability', () => {
    const link = freezeProductReconciliationLink({
      linkId: asProductReconciliationLinkId(`link_${randomUUID()}`),
      sourceKind: 'LEDGER_JOURNAL',
      sourceId: 'journal_wave8_test',
      journalId: 'journal_wave8_test',
      chainReference: sampleChainReference(),
      correlationId: 'corr_wave8',
      createdAt: NOW,
    });
    assert.equal(link.sourceKind, 'LEDGER_JOURNAL');
    assert.ok(link.chainReference);
    assert.equal(link.chainReference.economicClaimId, 'claim.wave8.test');
  });

  it('defaults to in-memory product integration mode in unit tests', () => {
    assert.equal(resolveProductIntegrationMode({ forceMode: 'IN_MEMORY' }), 'IN_MEMORY');
    const mode = resolveProductIntegrationMode();
    assert.ok(mode === 'IN_MEMORY' || mode === 'DURABLE');
  });

  it('creates in-memory product integration runtime with kernel-gated accounts', async () => {
    const { createProductIntegrationRuntime } = await import(
      '../services/api/src/product-integration/runtime.ts'
    );
    const runtime = await createProductIntegrationRuntime({ forceMode: 'IN_MEMORY' });
    try {
      assert.equal(runtime.mode, 'IN_MEMORY');
      assert.equal(runtime.environment, 'simulation');
      assert.ok(runtime.accounts.kernel);
      assert.ok(runtime.accounts.ledger);
      assert.ok(runtime.consent);
      assert.ok(runtime.vault);
      assert.equal(runtime.durableAccounts, null);
    } finally {
      await runtime.close();
    }
  });

  it('parses durable event envelopes with stable event identity', async () => {
    const { parseEnvelope, newEventId } = await import('../packages/events/src/envelope.ts');
    const eventId = newEventId();
    const base = {
      eventId,
      eventType: 'sunrey.test.wave8',
      eventVersion: 1 as const,
      schemaVersion: 1 as const,
      occurredAt: NOW,
      producer: 'wave8.test',
      actor: null,
      subject: null,
      environment: 'simulation' as const,
      requestId: null,
      aggregateType: 'test',
      aggregateId: 'agg1',
      aggregateSequence: 1,
      correlationId: eventId,
      causationId: null,
      intentId: null,
      evidenceId: null,
      jurisdiction: null,
      cellId: null,
      schemaRef: 'sunrey.test.wave8/1',
      payload: { ok: true },
      metadata: {},
    };
    const first = parseEnvelope(JSON.stringify(base));
    assert.equal(first.eventId, eventId);
    const second = parseEnvelope(JSON.stringify({ ...base, aggregateSequence: 2 }));
    assert.equal(second.eventId, eventId);
  });
});

describe('Wave 8 — authority boundary regression', () => {
  it('only blockchain node boundary claims canonical native supply responsibility', () => {
    for (const [id, boundary] of Object.entries(PRODUCT_SERVICE_BOUNDARIES)) {
      const claimsSupply = boundary.responsibility.toLowerCase().includes('canonical native');
      if (id === 'BLOCKCHAIN_NODE') {
        assert.equal(claimsSupply, true);
      } else {
        assert.equal(claimsSupply, false);
      }
    }
  });

  it('wallet boundary is projection-only', () => {
    const wallet = PRODUCT_SERVICE_BOUNDARIES.WALLET;
    assert.ok(wallet.responsibility.toLowerCase().includes('projection'));
    assert.ok(wallet.mayNot.includes('Be canonical supply authority'));
  });

  it('ledger and blockchain responsibilities are distinct', () => {
    const ledger = PRODUCT_SERVICE_BOUNDARIES.LEDGER;
    const chain = PRODUCT_SERVICE_BOUNDARIES.BLOCKCHAIN_NODE;
    assert.notEqual(ledger.responsibility, chain.responsibility);
    assert.ok(ledger.persistence.includes('solstice_ledger'));
    assert.ok(chain.persistence.includes('redb'));
  });
});
