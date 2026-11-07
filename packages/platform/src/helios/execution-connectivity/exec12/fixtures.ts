import type { CustomerId, UtcInstant } from '@solstice/domain';

import { brokerStatementSnapshotIdFor, custodyStatementSnapshotIdFor } from './ids.ts';
import { HELIOS_EXEC12_SCHEMA } from './taxonomy.ts';
import type { BrokerStatementSnapshot, CustodyStatementSnapshot, Exec12CanonicalAccountView } from './types.ts';

export function fixtureCanonicalAccountView(input: {
  readonly customerId: CustomerId;
  readonly accountId: string;
  readonly asOf: UtcInstant;
}): Exec12CanonicalAccountView {
  return Object.freeze({
    customerId: input.customerId,
    accountId: input.accountId,
    currency: 'USD',
    cashMinorUnits: '1000000',
    positions: Object.freeze({ inst_spy: '100' }),
    orders: Object.freeze([
      Object.freeze({
        orderId: 'ord_exec12_a',
        externalOperationId: 'op_exec12_a',
        instrumentId: 'inst_spy',
        quantityUnits: '100',
        filledQuantityUnits: '100',
        status: 'FILLED',
      }),
    ]),
    fills: Object.freeze([
      Object.freeze({
        orderId: 'ord_exec12_a',
        providerFillId: 'fill_exec12_a',
        quantityUnits: '100',
        priceMinorUnits: '10000',
        feeMinorUnits: '100',
      }),
    ]),
    settlementIds: Object.freeze(['stl_exec12_a']),
    corporateActionIds: Object.freeze(['ca_exec12_a']),
  });
}

export function fixtureMatchingBrokerSnapshot(input: {
  readonly customerId: CustomerId;
  readonly accountId: string;
  readonly asOf: UtcInstant;
}): BrokerStatementSnapshot {
  return Object.freeze({
    snapshotId: brokerStatementSnapshotIdFor('sandbox_broker_exec12', input.asOf),
    schemaVersion: HELIOS_EXEC12_SCHEMA,
    providerId: 'sandbox_broker_exec12',
    brokerAccountId: input.accountId,
    customerId: input.customerId,
    asOf: input.asOf,
    orders: Object.freeze([
      Object.freeze({
        brokerOrderId: 'brk_ord_1',
        externalOperationId: 'op_exec12_a',
        clientOrderId: 'ord_exec12_a',
        instrumentId: 'inst_spy',
        side: 'BUY',
        quantityUnits: '100',
        filledQuantityUnits: '100',
        status: 'FILLED',
      }),
    ]),
    fills: Object.freeze([
      Object.freeze({
        brokerFillId: 'fill_exec12_a',
        brokerOrderId: 'brk_ord_1',
        instrumentId: 'inst_spy',
        quantityUnits: '100',
        priceMinorUnits: '10000',
        feeMinorUnits: '100',
        currency: 'USD',
      }),
    ]),
    positions: Object.freeze({ inst_spy: '100' }),
    cashMinorUnits: '1000000',
    currency: 'USD',
    feesTotalMinorUnits: '100',
    settlements: Object.freeze([
      Object.freeze({
        settlementId: 'stl_exec12_a',
        brokerOrderId: 'brk_ord_1',
        quantityUnits: '100',
        cashMinorUnits: '1000000',
        currency: 'USD',
        status: 'SETTLED',
      }),
    ]),
    simulation: true,
    liveBrokerConnected: false,
  });
}

export function fixtureMatchingCustodySnapshot(input: {
  readonly customerId: CustomerId;
  readonly accountId: string;
  readonly asOf: UtcInstant;
}): CustodyStatementSnapshot {
  return Object.freeze({
    snapshotId: custodyStatementSnapshotIdFor('sandbox_custody_exec12', input.asOf),
    schemaVersion: HELIOS_EXEC12_SCHEMA,
    custodianId: 'sandbox_custody_exec12',
    custodyAccountId: input.accountId,
    customerId: input.customerId,
    asOf: input.asOf,
    positions: Object.freeze({ inst_spy: '100' }),
    cashMinorUnits: '1000000',
    currency: 'USD',
    settlements: Object.freeze([
      Object.freeze({
        settlementId: 'stl_exec12_a',
        instrumentId: 'inst_spy',
        quantityUnits: '100',
        cashMinorUnits: '1000000',
        currency: 'USD',
        status: 'SETTLED',
      }),
    ]),
    corporateActions: Object.freeze([
      Object.freeze({
        corporateActionId: 'ca_exec12_a',
        instrumentId: 'inst_spy',
        actionType: 'DIVIDEND',
        quantityDeltaUnits: '0',
      }),
    ]),
    simulation: true,
    liveCustodyConnected: false,
  });
}

export function fixtureBrokerWithUnknownOrder(input: {
  readonly customerId: CustomerId;
  readonly accountId: string;
  readonly asOf: UtcInstant;
}): BrokerStatementSnapshot {
  const base = fixtureMatchingBrokerSnapshot(input);
  return Object.freeze({
    ...base,
    orders: Object.freeze([
      ...base.orders,
      Object.freeze({
        brokerOrderId: 'brk_ord_unknown',
        externalOperationId: null,
        clientOrderId: null,
        instrumentId: 'inst_qqq',
        side: 'BUY',
        quantityUnits: '10',
        filledQuantityUnits: '10',
        status: 'FILLED',
      }),
    ]),
  });
}
