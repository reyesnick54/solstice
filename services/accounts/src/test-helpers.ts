import { asUtcInstant } from '../../../packages/domain/src/time.ts';
import {
  asCustomerId,
  createProspect,
  notStartedVerification,
  transitionCustomerStatus,
  type Customer,
} from '../../../packages/domain/src/customer.ts';
import { asJurisdiction } from '../../../packages/domain/src/jurisdiction.ts';
import { asLegalEntityId } from '../../../packages/domain/src/legal-entity.ts';
import { asResidency } from '../../../packages/domain/src/jurisdiction.ts';
import { isOk } from '../../../packages/domain/src/result.ts';
import { asAccountId } from '../../../packages/domain/src/account.ts';
import { asCurrencyCode } from '../../../packages/domain/src/currency.ts';
import { asIntentId } from '../../../packages/permissions/src/action-intent.ts';
import { ACTION_TYPES, type OpenAccountIntent } from '../../../packages/permissions/src/action-types.ts';
import type { AccountClass } from '../../../packages/domain/src/account-class.ts';
import type { ProductId } from '../../../packages/domain/src/product.ts';
import { asProductId } from '../../../packages/domain/src/product.ts';
import { FrozenClock } from '../../../packages/config/src/clock.ts';
import {
  createSimulationRuntime,
  type SimulationRuntime,
  type SimulationRuntimeOptions,
} from './runtime.ts';
import type { PurposeCode } from '../../../packages/permissions/src/action-intent.ts';

export const NOW = asUtcInstant('2026-08-13T15:00:00.000Z');

export function createTestRuntime(options: SimulationRuntimeOptions = {}): SimulationRuntime {
  return createSimulationRuntime({
    ...options,
    clock: options.clock ?? new FrozenClock(NOW),
  });
}

export function activateCustomer(
  runtime: SimulationRuntime,
  id = 'cust_active',
): Customer {
  let customer = createProspect({
    id: asCustomerId(id),
    legalEntityId: asLegalEntityId('le_solstice_uk_ltd'),
    jurisdiction: asJurisdiction('GB'),
    residency: asResidency('GB'),
    verification: notStartedVerification(asUtcInstant('2027-08-13T00:00:00.000Z')),
    createdAt: asUtcInstant('2026-01-15T09:00:00.000Z'),
  });
  const pending = transitionCustomerStatus(customer, 'PENDING_VERIFICATION', NOW);
  if (!isOk(pending)) {
    throw new Error('expected pending');
  }
  customer = pending.value.customer;
  const verified = {
    ...customer,
    verification: Object.freeze({
      kycState: 'VERIFIED' as const,
      kycRecordVersion: 1,
      refreshBy: asUtcInstant('2027-08-13T00:00:00.000Z'),
    }),
  };
  const active = transitionCustomerStatus(verified, 'ACTIVE', NOW);
  if (!isOk(active)) {
    throw new Error('expected active');
  }
  runtime.customers.put(active.value.customer.id, active.value.customer);
  return active.value.customer;
}

export function openIntent(input: {
  id: string;
  accountId: string;
  ownerId: string;
  productId?: ProductId;
  accountClass?: AccountClass;
  purpose?: PurposeCode;
}): OpenAccountIntent {
  return {
    id: asIntentId(input.id),
    actionType: ACTION_TYPES.OPEN_ACCOUNT,
    idempotencyKey: input.id,
    actorId: 'operator_1',
    requestedAt: NOW,
    purpose: input.purpose ?? 'CUSTOMER_ONBOARDING',
    payload: {
      accountId: asAccountId(input.accountId),
      ownerId: asCustomerId(input.ownerId),
      productId: input.productId ?? asProductId('prod_demand_usd_gb'),
      accountClass: input.accountClass ?? 'DEMAND_DEPOSIT',
      legalEntityId: asLegalEntityId('le_solstice_uk_ltd'),
      jurisdiction: asJurisdiction('GB'),
      currency: asCurrencyCode('USD'),
    },
  };
}
