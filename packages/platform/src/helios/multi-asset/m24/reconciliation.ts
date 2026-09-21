import { createHash } from 'node:crypto';

import type { CustomerId, UtcInstant } from '@solstice/domain';
import type { HeliosOrderLifecycleService } from '../../order-lifecycle/service.ts';
import type { HeliosProviderOrderPort } from '../../order-lifecycle/provider-port.ts';
import type {
  MultiAssetFillRecord,
  MultiAssetOrderRecord,
  MultiAssetReconciliationException,
  MultiAssetReconciliationRun,
} from './types.ts';
import { mapH23StatusToM24 } from './taxonomy.ts';

export type ReconcileMultiAssetAccountInput = {
  readonly customerId: CustomerId;
  readonly accountId: string;
  readonly orders: readonly MultiAssetOrderRecord[];
  readonly fills: readonly MultiAssetFillRecord[];
  readonly orderLifecycle: HeliosOrderLifecycleService;
  readonly provider: HeliosProviderOrderPort;
  readonly providerCashMinor: string | null;
  readonly canonicalCashMinor: string;
  readonly providerPositions: Readonly<Record<string, string>> | null;
  readonly canonicalPositions: Readonly<Record<string, string>>;
  readonly now: UtcInstant;
};

export function reconcileMultiAssetAccount(input: ReconcileMultiAssetAccountInput): MultiAssetReconciliationRun {
  const exceptions: MultiAssetReconciliationException[] = [];
  const runId = `m24_recon_${createHash('sha256').update(`${input.accountId}:${input.now}`).digest('hex').slice(0, 12)}`;

  for (const order of input.orders) {
    if (order.accountId !== input.accountId) continue;
    const h23Order = input.orderLifecycle.store.getOrder(order.orderId);
    if (!h23Order) {
      exceptions.push(makeException({
        customerId: input.customerId,
        accountId: input.accountId,
        kind: 'MISSING_PROVIDER_RECORD',
        description: 'canonical order missing from H23 store',
        orderId: order.orderId,
        providerValue: null,
        canonicalValue: order.currentState,
        now: input.now,
      }));
      continue;
    }

    const m24FromH23 = mapH23StatusToM24(h23Order.status);
    if (m24FromH23 !== order.currentState && order.currentState !== 'SETTLEMENT_PENDING') {
      exceptions.push(makeException({
        customerId: input.customerId,
        accountId: input.accountId,
        kind: 'ORDER_STATUS_MISMATCH',
        description: `order status mismatch for ${order.orderId}`,
        orderId: order.orderId,
        providerValue: m24FromH23,
        canonicalValue: order.currentState,
        now: input.now,
      }));
    }

    const query = input.provider.query(h23Order.externalOperationId);
    if (query.found) {
      const providerFillQty = query.fills.reduce((sum, fill) => sum + BigInt(fill.quantityUnits), 0n);
      const canonicalFillQty = input.fills
        .filter((fill) => fill.orderId === order.orderId)
        .reduce((sum, fill) => sum + BigInt(fill.quantityUnits), 0n);
      if (providerFillQty !== canonicalFillQty) {
        exceptions.push(makeException({
          customerId: input.customerId,
          accountId: input.accountId,
          kind: 'FILL_QUANTITY_MISMATCH',
          description: `fill quantity mismatch for ${order.orderId}`,
          orderId: order.orderId,
          providerValue: providerFillQty.toString(),
          canonicalValue: canonicalFillQty.toString(),
          now: input.now,
        }));
      }
    }
  }

  if (input.providerCashMinor !== null && input.providerCashMinor !== input.canonicalCashMinor) {
    exceptions.push(makeException({
      customerId: input.customerId,
      accountId: input.accountId,
      kind: 'CASH_MISMATCH',
      description: 'provider cash balance differs from canonical ledger',
      orderId: null,
      providerValue: input.providerCashMinor,
      canonicalValue: input.canonicalCashMinor,
      now: input.now,
    }));
  }

  if (input.providerPositions) {
    for (const [instrumentId, canonicalQty] of Object.entries(input.canonicalPositions)) {
      const providerQty = input.providerPositions[instrumentId] ?? '0';
      if (providerQty !== canonicalQty) {
        exceptions.push(makeException({
          customerId: input.customerId,
          accountId: input.accountId,
          kind: 'POSITION_MISMATCH',
          description: `position mismatch for ${instrumentId}`,
          orderId: null,
          providerValue: providerQty,
          canonicalValue: canonicalQty,
          now: input.now,
        }));
      }
    }
  }

  return Object.freeze({
    runId,
    customerId: input.customerId,
    accountId: input.accountId,
    matched: exceptions.length === 0,
    exceptions: Object.freeze(exceptions),
    evidenceRef: `ev_recon_${runId}`,
    completedAt: input.now,
  });
}

function makeException(input: {
  readonly customerId: CustomerId;
  readonly accountId: string;
  readonly kind: MultiAssetReconciliationException['kind'];
  readonly description: string;
  readonly orderId: MultiAssetReconciliationException['orderId'];
  readonly providerValue: string | null;
  readonly canonicalValue: string | null;
  readonly now: UtcInstant;
}): MultiAssetReconciliationException {
  const exceptionId = `m24_exc_${createHash('sha256').update(`${input.kind}:${input.description}:${input.now}`).digest('hex').slice(0, 10)}`;
  return Object.freeze({
    exceptionId,
    customerId: input.customerId,
    accountId: input.accountId,
    kind: input.kind,
    description: input.description,
    providerValue: input.providerValue,
    canonicalValue: input.canonicalValue,
    orderId: input.orderId,
    evidenceRef: `ev_exc_${exceptionId}`,
    detectedAt: input.now,
    resolved: false,
  });
}
