import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asCustomerId } from '../../packages/domain/src/customer.ts';
import { asJurisdiction, asResidency } from '../../packages/domain/src/jurisdiction.ts';
import { asLegalEntityId } from '../../packages/domain/src/legal-entity.ts';
import { asUtcInstant } from '../../packages/domain/src/time.ts';
import { createProspect, notStartedVerification, transitionCustomerStatus } from '../../packages/domain/src/customer.ts';
import { isOk } from '../../packages/domain/src/result.ts';
import { asIntentId } from '../../packages/permissions/src/action-intent.ts';
import { ACTION_TYPES } from '../../packages/permissions/src/action-types.ts';
import { asProductId } from '../../packages/domain/src/product.ts';
import { asAccountId } from '../../packages/domain/src/account.ts';
import { asCurrencyCode } from '../../packages/domain/src/currency.ts';
import { PRODUCT_DEMAND_USD_US, SOLSTICE_US } from '../../services/accounts/src/catalog.ts';
import { createDurableRuntime, persistenceAvailable, preparePersistence } from './helpers.ts';

const describePersistence = persistenceAvailable() ? describe : describe.skip;
const NOW = asUtcInstant('2026-08-14T09:00:00.000Z');

describePersistence('Chunk 6 policy engine persistence', () => {
  it('survives PostgreSQL restart and keeps the same policy version hash', async () => {
    const env = await preparePersistence();
    let durable = await createDurableRuntime(env);

    let customer = createProspect({
      id: asCustomerId('cust_policy_pg'),
      legalEntityId: asLegalEntityId('le_solstice_us_inc'),
      jurisdiction: asJurisdiction('US'),
      residency: asResidency('US'),
      verification: notStartedVerification(asUtcInstant('2027-08-13T00:00:00.000Z')),
      createdAt: asUtcInstant('2026-01-15T09:00:00.000Z'),
    });
    const pending = transitionCustomerStatus(customer, 'PENDING_VERIFICATION', NOW);
    assert.equal(isOk(pending), true);
    if (!isOk(pending)) {
      return;
    }
    customer = {
      ...pending.value.customer,
      verification: Object.freeze({
        kycState: 'VERIFIED' as const,
        kycRecordVersion: 1,
        refreshBy: asUtcInstant('2027-08-13T00:00:00.000Z'),
      }),
    };
    const active = transitionCustomerStatus(customer, 'ACTIVE', NOW);
    assert.equal(isOk(active), true);
    if (!isOk(active)) {
      return;
    }
    customer = active.value.customer;
    durable.runtime.customers.put(customer.id, customer);
    await durable.saveCustomer(customer);

    const opened = await durable.open({
      id: asIntentId('pg_policy_open'),
      actionType: ACTION_TYPES.OPEN_ACCOUNT,
      idempotencyKey: 'pg_policy_open',
      actorId: 'operator_1',
      requestedAt: NOW,
      purpose: 'CUSTOMER_ONBOARDING',
      payload: {
        accountId: asAccountId('pg_policy_us'),
        ownerId: customer.id,
        productId: asProductId('prod_demand_usd_us'),
        accountClass: 'DEMAND_DEPOSIT',
        legalEntityId: SOLSTICE_US.id,
        jurisdiction: asJurisdiction('US'),
        currency: asCurrencyCode('USD'),
      },
    });
    assert.equal(opened.outcome, 'OPENED');
    if (opened.outcome !== 'OPENED') {
      return;
    }
    const hashBefore = opened.decision.policySnapshot?.packHash;
    const versionBefore = opened.decision.policySnapshot?.versionId;
    assert.ok(hashBefore);
    assert.equal(versionBefore, 'us-sim-v1');

    const evidence = durable.runtime.evidence.list().find((row) => row.kind === 'KERNEL_DECISION');
    assert.ok(evidence);
    const payload = evidence.payload as { policy: { packId: string; versionId: string } };
    assert.equal(payload.policy.packId, 'US');

    await durable.close();
    durable = await createDurableRuntime(env);
    const reloaded = durable.runtime.kernel.policy.registry.getVersion('us-sim-v1');
    assert.ok(reloaded);
    assert.equal(reloaded.contentHash, hashBefore);
    assert.ok(PRODUCT_DEMAND_USD_US);
    await durable.close();
  });
});
