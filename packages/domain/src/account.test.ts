import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asIntentId, createActionIntent } from '../../permissions/src/index.ts';
import {
  ACCOUNT_CLASSES,
  ACCOUNT_STATUSES,
  asAccountId,
  asCurrency,
  asCustomerId,
  asJurisdiction,
  asLegalEntityId,
  asProductId,
  asUtcInstant,
  createLegalEntity,
  createOpenAccountIntent,
  createProduct,
  isErr,
  isOk,
  OPEN_ACCOUNT,
  openAccount,
  transitionAccountStatus,
  validateOpenAccountIntent,
  type Account,
  type AccountClass,
  type AccountStatus,
  type OpenAccountCatalog,
  type OpenAccountPayload,
} from './index.ts';

const NOW = asUtcInstant('2026-08-13T14:55:00.000Z');
const OPENED_AT = asUtcInstant('2026-08-13T12:00:00.000Z');

const US_ENTITY_ID = asLegalEntityId('le_solstice_us_inc');
const GB_ENTITY_ID = asLegalEntityId('le_solstice_uk_ltd');
const US = asJurisdiction('US');
const GB = asJurisdiction('GB');
const USD = asCurrency('USD');
const GBP = asCurrency('GBP');
const OWNER = asCustomerId('cust_test');

const PRODUCTS_BY_CLASS: { readonly [C in AccountClass]: ReturnType<typeof createProduct> } = {
  INSURED_DEPOSIT: createProduct({
    id: asProductId('prod_insured_checking_usd'),
    accountClass: 'INSURED_DEPOSIT',
    currency: USD,
    legalEntityId: US_ENTITY_ID,
  }),
  INVESTMENT_ASSET: createProduct({
    id: asProductId('prod_brokerage_usd'),
    accountClass: 'INVESTMENT_ASSET',
    currency: USD,
    legalEntityId: US_ENTITY_ID,
  }),
  DIGITAL_ASSET: createProduct({
    id: asProductId('prod_digital_wallet_usd'),
    accountClass: 'DIGITAL_ASSET',
    currency: USD,
    legalEntityId: US_ENTITY_ID,
  }),
  REWARD: createProduct({
    id: asProductId('prod_rewards_usd'),
    accountClass: 'REWARD',
    currency: USD,
    legalEntityId: US_ENTITY_ID,
  }),
  PENDING_EARNING: createProduct({
    id: asProductId('prod_pending_earnings_usd'),
    accountClass: 'PENDING_EARNING',
    currency: USD,
    legalEntityId: US_ENTITY_ID,
  }),
};

const CATALOG: OpenAccountCatalog = {
  products: Object.values(PRODUCTS_BY_CLASS),
  legalEntities: [
    createLegalEntity({ id: US_ENTITY_ID, jurisdiction: US }),
    createLegalEntity({ id: GB_ENTITY_ID, jurisdiction: GB }),
  ],
};

const LEGAL_TRANSITIONS: readonly (readonly [AccountStatus, AccountStatus])[] = [
  ['OPEN', 'FROZEN'],
  ['OPEN', 'CLOSED'],
  ['FROZEN', 'OPEN'],
  ['FROZEN', 'CLOSED'],
];

function isLegalPair(from: AccountStatus, to: AccountStatus): boolean {
  return LEGAL_TRANSITIONS.some(([f, t]) => f === from && t === to);
}

function payloadFor(accountClass: AccountClass): OpenAccountPayload {
  const product = PRODUCTS_BY_CLASS[accountClass];
  return {
    ownerId: OWNER,
    accountClass,
    productId: product.id,
    legalEntityId: US_ENTITY_ID,
    jurisdiction: US,
    currency: USD,
  };
}

function accountOf(
  accountClass: AccountClass,
  status: AccountStatus = 'OPEN',
  version = 0,
): Account {
  const product = PRODUCTS_BY_CLASS[accountClass];
  const opened = openAccount({
    id: asAccountId(`acct_${accountClass.toLowerCase()}`),
    ownerId: OWNER,
    accountClass,
    productId: product.id,
    legalEntityId: US_ENTITY_ID,
    jurisdiction: US,
    currency: USD,
    openedAt: OPENED_AT,
  });
  return Object.freeze({
    ...opened,
    status,
    version,
  });
}

function snapshot(account: Account): Account {
  return {
    id: account.id,
    ownerId: account.ownerId,
    ownerCustomerId: account.ownerCustomerId,
    accountClass: account.accountClass,
    productId: account.productId,
    legalEntityId: account.legalEntityId,
    jurisdiction: account.jurisdiction,
    currency: account.currency,
    status: account.status,
    openedAt: account.openedAt,
    version: account.version,
  };
}

describe('Account construction', () => {
  for (const accountClass of ACCOUNT_CLASSES) {
    it(`constructs an immutable OPEN ${accountClass} account with no balance`, () => {
      const product = PRODUCTS_BY_CLASS[accountClass];
      const account = openAccount({
        id: asAccountId(`acct_${accountClass}`),
        ownerId: OWNER,
        accountClass,
        productId: product.id,
        legalEntityId: US_ENTITY_ID,
        jurisdiction: US,
        currency: USD,
        openedAt: OPENED_AT,
      });

      assert.equal(account.status, 'OPEN');
      assert.equal(account.version, 0);
      assert.equal(account.accountClass, accountClass);
      assert.equal(account.productId, product.id);
      assert.equal(account.ownerId, OWNER);
      assert.equal(account.legalEntityId, US_ENTITY_ID);
      assert.equal(account.jurisdiction, US);
      assert.equal(account.currency, USD);
      assert.equal(account.openedAt, OPENED_AT);
      assert.ok(Object.isFrozen(account));
    });
  }

  it('Account type has no balance property', () => {
    const account = accountOf('INSURED_DEPOSIT');
    assert.equal('balance' in account, false);
    assert.equal(Object.hasOwn(account, 'balance'), false);

    type AccountHasBalance = 'balance' extends keyof Account ? true : false;
    const accountHasBalance: AccountHasBalance = false;
    assert.equal(accountHasBalance, false);
  });
});

describe('Account status transitions', () => {
  for (const [from, to] of LEGAL_TRANSITIONS) {
    it(`allows ${from} -> ${to}`, () => {
      const account = accountOf('INSURED_DEPOSIT', from, 3);
      const before = snapshot(account);
      const result = transitionAccountStatus(account, to, NOW);

      assert.equal(isOk(result), true);
      if (!isOk(result)) {
        return;
      }

      assert.equal(result.value.account.status, to);
      assert.equal(result.value.account.id, account.id);
      assert.equal(result.value.account.ownerId, account.ownerId);
      assert.equal(result.value.account.accountClass, account.accountClass);
      assert.equal(result.value.account.openedAt, account.openedAt);
      assert.equal(result.value.account.version, account.version + 1);
      assert.equal(result.value.occurredAt, NOW);
      assert.ok(Object.isFrozen(result.value.account));
      assert.notEqual(result.value.account, account);
      assert.deepEqual(snapshot(account), before);
    });
  }

  for (const from of ACCOUNT_STATUSES) {
    for (const to of ACCOUNT_STATUSES) {
      if (isLegalPair(from, to)) {
        continue;
      }

      it(`rejects ${from} -> ${to} as a typed value`, () => {
        const account = accountOf('INVESTMENT_ASSET', from, 4);
        const before = snapshot(account);
        const result = transitionAccountStatus(account, to, NOW);

        assert.equal(result.ok, false);
        assert.equal(isErr(result), true);
        if (!isErr(result)) {
          return;
        }

        assert.equal(result.error.code, 'ILLEGAL_ACCOUNT_STATUS_TRANSITION');
        assert.equal(result.error.from, from);
        assert.equal(result.error.to, to);
        assert.equal(result.error.accountId, account.id);
        assert.deepEqual(snapshot(account), before);
      });
    }
  }

  it('does not throw for an illegal transition', () => {
    const closed = accountOf('REWARD', 'CLOSED');
    assert.doesNotThrow(() => {
      const result = transitionAccountStatus(closed, 'OPEN', NOW);
      assert.equal(result.ok, false);
    });
  });
});

describe('OPEN_ACCOUNT intent validation', () => {
  it('accepts a well-formed OPEN_ACCOUNT intent', () => {
    const intent = createOpenAccountIntent({
      intentId: asIntentId('int_open_ok'),
      payload: payloadFor('INSURED_DEPOSIT'),
      actor: { kind: 'CUSTOMER', id: OWNER },
      proposedAt: NOW,
    });

    const result = validateOpenAccountIntent(intent, CATALOG);

    assert.equal(isOk(result), true);
    if (!isOk(result)) {
      return;
    }

    assert.equal(result.value.actionType, OPEN_ACCOUNT);
    assert.equal(result.value.payload.accountClass, 'INSURED_DEPOSIT');
    assert.equal(result.value.payload.productId, PRODUCTS_BY_CLASS.INSURED_DEPOSIT.id);
    assert.equal(result.value.payload.jurisdiction, US);
    assert.equal(result.value.intentId, 'int_open_ok');
  });

  it('rejects a wrong actionType', () => {
    const intent = createActionIntent({
      intentId: asIntentId('int_wrong_type'),
      actionType: 'CLOSE_ACCOUNT',
      payload: payloadFor('INSURED_DEPOSIT'),
      actor: { kind: 'CUSTOMER', id: OWNER },
      proposedAt: NOW,
    });

    const result = validateOpenAccountIntent(intent, CATALOG);
    assert.equal(isErr(result), true);
    if (isErr(result)) {
      assert.equal(result.error.code, 'WRONG_ACTION_TYPE');
      assert.equal(result.error.actionType, 'CLOSE_ACCOUNT');
    }
  });

  it('rejects a missing ownerId as MALFORMED_PAYLOAD', () => {
    const intent = createActionIntent({
      intentId: asIntentId('int_no_owner'),
      actionType: OPEN_ACCOUNT,
      payload: {
        accountClass: 'INSURED_DEPOSIT',
        productId: PRODUCTS_BY_CLASS.INSURED_DEPOSIT.id,
        legalEntityId: US_ENTITY_ID,
        jurisdiction: US,
        currency: USD,
      },
      actor: { kind: 'CUSTOMER', id: OWNER },
      proposedAt: NOW,
    });

    const result = validateOpenAccountIntent(intent, CATALOG);
    assert.equal(isErr(result), true);
    if (isErr(result)) {
      assert.equal(result.error.code, 'MALFORMED_PAYLOAD');
      assert.equal(result.error.field, 'ownerId');
    }
  });

  it('rejects an unknown accountClass as MALFORMED_PAYLOAD', () => {
    const intent = createActionIntent({
      intentId: asIntentId('int_bad_class'),
      actionType: OPEN_ACCOUNT,
      payload: {
        ...payloadFor('INSURED_DEPOSIT'),
        accountClass: 'COMMINGLED',
      },
      actor: { kind: 'CUSTOMER', id: OWNER },
      proposedAt: NOW,
    });

    const result = validateOpenAccountIntent(intent, CATALOG);
    assert.equal(isErr(result), true);
    if (isErr(result)) {
      assert.equal(result.error.code, 'MALFORMED_PAYLOAD');
      assert.equal(result.error.field, 'accountClass');
    }
  });

  it('rejects a product that is not in the catalog', () => {
    const intent = createOpenAccountIntent({
      intentId: asIntentId('int_unknown_product'),
      payload: {
        ...payloadFor('INSURED_DEPOSIT'),
        productId: asProductId('prod_does_not_exist'),
      },
      actor: { kind: 'CUSTOMER', id: OWNER },
      proposedAt: NOW,
    });

    const result = validateOpenAccountIntent(intent, CATALOG);
    assert.equal(isErr(result), true);
    if (isErr(result)) {
      assert.equal(result.error.code, 'PRODUCT_NOT_IN_CATALOG');
      assert.equal(result.error.productId, 'prod_does_not_exist');
    }
  });

  it('rejects an account class that does not match the product', () => {
    const intent = createOpenAccountIntent({
      intentId: asIntentId('int_class_mismatch'),
      payload: {
        ...payloadFor('INSURED_DEPOSIT'),
        accountClass: 'DIGITAL_ASSET',
      },
      actor: { kind: 'CUSTOMER', id: OWNER },
      proposedAt: NOW,
    });

    const result = validateOpenAccountIntent(intent, CATALOG);
    assert.equal(isErr(result), true);
    if (isErr(result)) {
      assert.equal(result.error.code, 'ACCOUNT_CLASS_MISMATCH');
      assert.equal(result.error.expected, 'INSURED_DEPOSIT');
      assert.equal(result.error.actual, 'DIGITAL_ASSET');
    }
  });

  it('rejects a legal entity that is not in the catalog', () => {
    const intent = createOpenAccountIntent({
      intentId: asIntentId('int_unknown_le'),
      payload: {
        ...payloadFor('REWARD'),
        legalEntityId: asLegalEntityId('le_unknown'),
      },
      actor: { kind: 'CUSTOMER', id: OWNER },
      proposedAt: NOW,
    });

    const result = validateOpenAccountIntent(intent, CATALOG);
    assert.equal(isErr(result), true);
    if (isErr(result)) {
      assert.equal(result.error.code, 'LEGAL_ENTITY_NOT_FOUND');
      assert.equal(result.error.legalEntityId, 'le_unknown');
    }
  });

  it('rejects a jurisdiction that does not match the legal entity', () => {
    const intent = createOpenAccountIntent({
      intentId: asIntentId('int_jurisdiction_mismatch'),
      payload: {
        ...payloadFor('PENDING_EARNING'),
        legalEntityId: US_ENTITY_ID,
        jurisdiction: GB,
      },
      actor: { kind: 'CUSTOMER', id: OWNER },
      proposedAt: NOW,
    });

    const result = validateOpenAccountIntent(intent, CATALOG);
    assert.equal(isErr(result), true);
    if (isErr(result)) {
      assert.equal(result.error.code, 'JURISDICTION_MISMATCH');
      assert.equal(result.error.expected, US);
      assert.equal(result.error.actual, GB);
    }
  });

  it('rejects a currency that does not match the product', () => {
    const intent = createOpenAccountIntent({
      intentId: asIntentId('int_currency_mismatch'),
      payload: {
        ...payloadFor('INVESTMENT_ASSET'),
        currency: GBP,
      },
      actor: { kind: 'CUSTOMER', id: OWNER },
      proposedAt: NOW,
    });

    const result = validateOpenAccountIntent(intent, CATALOG);
    assert.equal(isErr(result), true);
    if (isErr(result)) {
      assert.equal(result.error.code, 'CURRENCY_MISMATCH');
      assert.equal(result.error.expected, USD);
      assert.equal(result.error.actual, GBP);
    }
  });
});
