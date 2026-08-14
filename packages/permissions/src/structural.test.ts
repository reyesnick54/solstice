import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asAccountId } from '../../domain/src/account.ts';
import { asCurrencyCode } from '../../domain/src/currency.ts';
import { asCustomerId } from '../../domain/src/customer.ts';
import { asJurisdiction } from '../../domain/src/jurisdiction.ts';
import { asLegalEntityId } from '../../domain/src/legal-entity.ts';
import { asProductId } from '../../domain/src/product.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { isErr, isOk } from '../../domain/src/result.ts';
import { Money } from '../../money/src/money.ts';
import { asIntentId } from './action-intent.ts';
import { ACTION_TYPES, type OpenAccountIntent } from './action-types.ts';
import { validateIntentStructure, type StructuralCatalog } from './structural.ts';
import {
  PRODUCT_DEMAND_USD_GB,
  PRODUCT_SAVINGS_USD_GB,
  SOLSTICE_UK,
} from '../../../services/accounts/src/catalog.ts';
import { AccountStore, LegalEntityStore, ProductStore } from '../../../services/accounts/src/stores.ts';

const NOW = asUtcInstant('2026-08-13T15:00:00.000Z');

function catalog(): StructuralCatalog {
  const products = new ProductStore();
  products.put(PRODUCT_DEMAND_USD_GB.id, PRODUCT_DEMAND_USD_GB);
  products.put(PRODUCT_SAVINGS_USD_GB.id, PRODUCT_SAVINGS_USD_GB);
  const legalEntities = new LegalEntityStore();
  legalEntities.put(SOLSTICE_UK.id, SOLSTICE_UK);
  const accounts = new AccountStore();
  return {
    products: products.asCatalog(),
    legalEntities,
    accounts,
  };
}

function openIntent(overrides: Partial<OpenAccountIntent['payload']> = {}): OpenAccountIntent {
  return {
    id: asIntentId('intent_open_1'),
    actionType: ACTION_TYPES.OPEN_ACCOUNT,
    idempotencyKey: 'intent_open_1',
    actorId: 'actor_1',
    requestedAt: NOW,
    purpose: 'CUSTOMER_ONBOARDING',
    payload: {
      accountId: asAccountId('acct_1'),
      ownerId: asCustomerId('cust_1'),
      productId: asProductId('prod_demand_usd_gb'),
      accountClass: 'DEMAND_DEPOSIT',
      legalEntityId: asLegalEntityId('le_solstice_uk_ltd'),
      jurisdiction: asJurisdiction('GB'),
      currency: asCurrencyCode('USD'),
      ...overrides,
    },
  };
}

describe('structural validation', () => {
  it('accepts a well-formed OPEN_ACCOUNT', () => {
    const result = validateIntentStructure(openIntent(), catalog());
    assert.equal(isOk(result), true);
  });

  it('rejects missing product', () => {
    const result = validateIntentStructure(
      openIntent({ productId: asProductId('prod_missing') }),
      catalog(),
    );
    assert.equal(isErr(result), true);
    if (isErr(result)) {
      assert.equal(result.error.field, 'productId');
    }
  });

  it('rejects account class that does not match product', () => {
    const result = validateIntentStructure(
      openIntent({ accountClass: 'SAVINGS_DEPOSIT' }),
      catalog(),
    );
    assert.equal(isErr(result), true);
    if (isErr(result)) {
      assert.equal(result.error.field, 'accountClass');
    }
  });

  it('rejects jurisdiction that does not match legal entity', () => {
    const result = validateIntentStructure(
      openIntent({ jurisdiction: asJurisdiction('US') }),
      catalog(),
    );
    assert.equal(isErr(result), true);
    if (isErr(result)) {
      assert.equal(result.error.field, 'jurisdiction');
    }
  });

  it('rejects currency that does not match product', () => {
    const result = validateIntentStructure(
      openIntent({ currency: asCurrencyCode('GBP') }),
      catalog(),
    );
    assert.equal(isErr(result), true);
    if (isErr(result)) {
      assert.equal(result.error.field, 'currency');
    }
  });

  it('rejects POST_DEPOSIT when account does not exist', () => {
    const result = validateIntentStructure(
      {
        id: asIntentId('dep_1'),
        actionType: ACTION_TYPES.POST_DEPOSIT,
        idempotencyKey: 'dep_1',
        actorId: 'actor_1',
        requestedAt: NOW,
        purpose: 'CUSTOMER_FUNDING',
        payload: {
          accountId: asAccountId('acct_missing'),
          amount: Money.fromMinorUnits(100n, 'USD'),
        },
      },
      catalog(),
    );
    assert.equal(isErr(result), true);
  });

  it('rejects INTERNAL_TRANSFER when source equals destination', () => {
    const result = validateIntentStructure(
      {
        id: asIntentId('xfer_1'),
        actionType: ACTION_TYPES.INTERNAL_TRANSFER,
        idempotencyKey: 'xfer_1',
        actorId: 'actor_1',
        requestedAt: NOW,
        purpose: 'CUSTOMER_TRANSFER',
        payload: {
          sourceAccountId: asAccountId('acct_1'),
          destinationAccountId: asAccountId('acct_1'),
          amount: Money.fromMinorUnits(100n, 'USD'),
        },
      },
      catalog(),
    );
    assert.equal(isErr(result), true);
  });
});
