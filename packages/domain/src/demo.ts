/**
 * End-to-end demo of the Customer domain: open a prospect, walk legal
 * status changes, and show that illegal moves are typed rejections.
 */
import {
  asCustomerId,
  asJurisdiction,
  asLegalEntityId,
  asResidency,
  asUtcInstant,
  createProspect,
  isErr,
  isOk,
  notStartedVerification,
  transitionCustomerStatus,
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

console.log('demo: ok');
