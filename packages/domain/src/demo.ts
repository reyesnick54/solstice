/**
 * End-to-end demo of the Customer and Account domains: open a prospect,
 * walk legal status changes, validate an OPEN_ACCOUNT intent, construct
 * an Account, and show typed rejections. No balances are stored.
 */
import { asIntentId } from '@solstice/permissions';
import {
  asAccountId,
  asCurrency,
  asCustomerId,
  asJurisdiction,
  asLegalEntityId,
  asProductId,
  asResidency,
  asUtcInstant,
  createLegalEntity,
  createOpenAccountIntent,
  createProduct,
  createProspect,
  isErr,
  isOk,
  notStartedVerification,
  OPEN_ACCOUNT,
  openAccount,
  transitionAccountStatus,
  transitionCustomerStatus,
  validateOpenAccountIntent,
  type Customer,
  type CustomerStatus,
} from './index.ts';

const occurredAt = asUtcInstant('2026-08-13T14:55:00.000Z');

function mustTransition(customer: Customer, to: CustomerStatus): Customer {
  const result = transitionCustomerStatus(customer, to, occurredAt);
  if (isErr(result)) {
    throw new Error(
      `demo expected legal transition ${customer.status} -> ${to}, got ${result.error.code}`,
    );
  }
  console.log(
    JSON.stringify({
      event: 'customer.status.changed',
      customerId: result.value.customer.id,
      legalEntityId: result.value.customer.legalEntityId,
      from: customer.status,
      to: result.value.customer.status,
      version: result.value.customer.version,
      occurredAt: result.value.occurredAt,
    }),
  );
  return result.value.customer;
}

const prospect = createProspect({
  id: asCustomerId('cust_demo_001'),
  legalEntityId: asLegalEntityId('le_solstice_uk_ltd'),
  jurisdiction: asJurisdiction('GB'),
  residency: asResidency('GB'),
  verification: notStartedVerification(asUtcInstant('2026-11-13T00:00:00.000Z')),
  createdAt: asUtcInstant('2026-08-13T12:00:00.000Z'),
});

console.log(
  JSON.stringify({
    event: 'customer.opened',
    customerId: prospect.id,
    legalEntityId: prospect.legalEntityId,
    jurisdiction: prospect.jurisdiction,
    residency: prospect.residency,
    status: prospect.status,
    version: prospect.version,
    createdAt: prospect.createdAt,
  }),
);

const pending = mustTransition(prospect, 'PENDING_VERIFICATION');
const active = mustTransition(pending, 'ACTIVE');
const suspended = mustTransition(active, 'SUSPENDED');
const reinstated = mustTransition(suspended, 'ACTIVE');
const closed = mustTransition(reinstated, 'CLOSED');

const illegal = transitionCustomerStatus(closed, 'ACTIVE', occurredAt);
if (!isOk(illegal) && illegal.error.code === 'ILLEGAL_CUSTOMER_STATUS_TRANSITION') {
  console.log(
    JSON.stringify({
      event: 'customer.status.rejected',
      customerId: illegal.error.customerId,
      from: illegal.error.from,
      to: illegal.error.to,
      code: illegal.error.code,
    }),
  );
} else {
  throw new Error('demo expected CLOSED -> ACTIVE to be rejected');
}

const usd = asCurrency('USD');
const us = asJurisdiction('US');
const usEntityId = asLegalEntityId('le_solstice_us_inc');
const checking = createProduct({
  id: asProductId('prod_insured_checking_usd'),
  accountClass: 'INSURED_DEPOSIT',
  currency: usd,
  legalEntityId: usEntityId,
});
const catalog = {
  products: [checking],
  legalEntities: [createLegalEntity({ id: usEntityId, jurisdiction: us })],
};

const openIntent = createOpenAccountIntent({
  intentId: asIntentId('int_demo_open_001'),
  payload: {
    ownerId: prospect.id,
    accountClass: 'INSURED_DEPOSIT',
    productId: checking.id,
    legalEntityId: usEntityId,
    jurisdiction: us,
    currency: usd,
  },
  actor: { kind: 'CUSTOMER', id: prospect.id },
  proposedAt: occurredAt,
});

const validated = validateOpenAccountIntent(openIntent, catalog);
if (isErr(validated)) {
  throw new Error(`demo expected well-formed ${OPEN_ACCOUNT}, got ${validated.error.code}`);
}

console.log(
  JSON.stringify({
    event: 'account.open.intent.validated',
    actionType: validated.value.actionType,
    intentId: validated.value.intentId,
    productId: validated.value.payload.productId,
    accountClass: validated.value.payload.accountClass,
  }),
);

const account = openAccount({
  id: asAccountId('acct_demo_001'),
  ownerId: validated.value.payload.ownerId,
  accountClass: validated.value.payload.accountClass,
  productId: validated.value.payload.productId,
  legalEntityId: validated.value.payload.legalEntityId,
  jurisdiction: validated.value.payload.jurisdiction,
  currency: validated.value.payload.currency,
  openedAt: occurredAt,
});

console.log(
  JSON.stringify({
    event: 'account.opened',
    accountId: account.id,
    ownerId: account.ownerId,
    accountClass: account.accountClass,
    status: account.status,
    version: account.version,
    hasBalanceField: 'balance' in account,
  }),
);

const frozen = transitionAccountStatus(account, 'FROZEN', occurredAt);
if (isErr(frozen)) {
  throw new Error(`demo expected OPEN -> FROZEN, got ${frozen.error.code}`);
}
console.log(
  JSON.stringify({
    event: 'account.status.changed',
    accountId: frozen.value.account.id,
    from: account.status,
    to: frozen.value.account.status,
    version: frozen.value.account.version,
  }),
);

const illegalAccount = transitionAccountStatus(frozen.value.account, 'FROZEN', occurredAt);
if (
  !isOk(illegalAccount) &&
  illegalAccount.error.code === 'ILLEGAL_ACCOUNT_STATUS_TRANSITION'
) {
  console.log(
    JSON.stringify({
      event: 'account.status.rejected',
      accountId: illegalAccount.error.accountId,
      from: illegalAccount.error.from,
      to: illegalAccount.error.to,
      code: illegalAccount.error.code,
    }),
  );
} else {
  throw new Error('demo expected FROZEN -> FROZEN to be rejected');
}

const classMismatch = createOpenAccountIntent({
  intentId: asIntentId('int_demo_mismatch'),
  payload: {
    ownerId: prospect.id,
    accountClass: 'DIGITAL_ASSET',
    productId: checking.id,
    legalEntityId: usEntityId,
    jurisdiction: us,
    currency: usd,
  },
  actor: { kind: 'CUSTOMER', id: prospect.id },
  proposedAt: occurredAt,
});
const rejected = validateOpenAccountIntent(classMismatch, catalog);
if (isErr(rejected) && rejected.error.code === 'ACCOUNT_CLASS_MISMATCH') {
  console.log(
    JSON.stringify({
      event: 'account.open.intent.rejected',
      code: rejected.error.code,
      expected: rejected.error.expected,
      actual: rejected.error.actual,
    }),
  );
} else {
  throw new Error('demo expected ACCOUNT_CLASS_MISMATCH');
}

console.log('demo: ok');
