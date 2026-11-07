import type { UtcInstant } from '@solstice/domain';

import { exec12ReconciliationBreakIdFor, exec12ReconciliationRunIdFor } from './ids.ts';
import { isAmbiguousExternalBreak, severityForExec12BreakKind } from './severity.ts';
import { HELIOS_EXEC12_SCHEMA } from './taxonomy.ts';
import type {
  BrokerStatementSnapshot,
  CashReconciliationBreak,
  CustodyStatementSnapshot,
  Exec12CanonicalAccountView,
  Exec12ReconciliationBreak,
  Exec12ThreeWayReconciliationRun,
  ExecutionReconciliationBreak,
  PositionReconciliationBreak,
  SettlementReconciliationBreak,
} from './types.ts';

export type RunExec12ThreeWayReconciliationInput = {
  readonly canonical: Exec12CanonicalAccountView;
  readonly broker: BrokerStatementSnapshot | null;
  readonly custody: CustodyStatementSnapshot | null;
  readonly now: UtcInstant;
  readonly sealBreakEvidence: (kind: string, detail: Record<string, unknown>) => string;
  readonly sealRunEvidence: (detail: Record<string, unknown>) => string;
};

/**
 * Three-way reconciliation across SunRey order lifecycle, broker execution records,
 * and custody/settlement records. Never mutates canonical financial state.
 */
export function runExec12ThreeWayReconciliation(
  input: RunExec12ThreeWayReconciliationInput,
): { readonly run: Exec12ThreeWayReconciliationRun; readonly breaks: readonly Exec12ReconciliationBreak[] } {
  const runId = exec12ReconciliationRunIdFor(input.canonical.accountId, input.now);
  const breaks: Exec12ReconciliationBreak[] = [];

  const brokerOrdersByExternal = indexBrokerOrders(input.broker);
  const brokerOrdersById = indexBrokerOrdersById(input.broker);
  const canonicalByExternal = new Map(
    input.canonical.orders.map((order) => [order.externalOperationId, order] as const),
  );

  for (const order of input.canonical.orders) {
    const brokerOrder =
      brokerOrdersByExternal.get(order.externalOperationId) ??
      [...brokerOrdersById.values()].find((row) => row.clientOrderId === order.orderId) ??
      null;
    if (!brokerOrder) {
      breaks.push(
        makeExecutionBreak({
          runId,
          kind: 'MISSING_EXTERNAL_ORDER',
          canonical: input.canonical,
          orderId: order.orderId,
          instrumentId: order.instrumentId,
          sunReyValue: order.externalOperationId,
          brokerValue: null,
          custodyValue: null,
          description: `canonical order ${order.orderId} missing broker record`,
          now: input.now,
          sealBreakEvidence: input.sealBreakEvidence,
        }),
      );
      continue;
    }

    if (brokerOrder.filledQuantityUnits !== order.filledQuantityUnits) {
      breaks.push(
        makeExecutionBreak({
          runId,
          kind: 'FILL_MISMATCH',
          canonical: input.canonical,
          orderId: order.orderId,
          instrumentId: order.instrumentId,
          sunReyValue: order.filledQuantityUnits,
          brokerValue: brokerOrder.filledQuantityUnits,
          custodyValue: null,
          description: `fill quantity mismatch for ${order.orderId}`,
          now: input.now,
          sealBreakEvidence: input.sealBreakEvidence,
        }),
      );
    }

    if (brokerOrder.quantityUnits !== order.quantityUnits) {
      breaks.push(
        makeExecutionBreak({
          runId,
          kind: 'QUANTITY_MISMATCH',
          canonical: input.canonical,
          orderId: order.orderId,
          instrumentId: order.instrumentId,
          sunReyValue: order.quantityUnits,
          brokerValue: brokerOrder.quantityUnits,
          custodyValue: null,
          description: `order quantity mismatch for ${order.orderId}`,
          now: input.now,
          sealBreakEvidence: input.sealBreakEvidence,
        }),
      );
    }

    const canonicalFills = input.canonical.fills.filter((fill) => fill.orderId === order.orderId);
    const brokerFills = (input.broker?.fills ?? []).filter((fill) => fill.brokerOrderId === brokerOrder.brokerOrderId);
    const canonicalFillQty = canonicalFills.reduce((sum, fill) => sum + BigInt(fill.quantityUnits), 0n);
    const brokerFillQty = brokerFills.reduce((sum, fill) => sum + BigInt(fill.quantityUnits), 0n);
    if (canonicalFillQty !== brokerFillQty) {
      breaks.push(
        makeExecutionBreak({
          runId,
          kind: 'QUANTITY_MISMATCH',
          canonical: input.canonical,
          orderId: order.orderId,
          instrumentId: order.instrumentId,
          sunReyValue: canonicalFillQty.toString(),
          brokerValue: brokerFillQty.toString(),
          custodyValue: null,
          description: `aggregate fill quantity mismatch for ${order.orderId}`,
          now: input.now,
          sealBreakEvidence: input.sealBreakEvidence,
        }),
      );
    }

    for (const fill of canonicalFills) {
      const brokerFill = brokerFills.find((row) => row.brokerFillId === fill.providerFillId);
      if (!brokerFill) continue;
      if (brokerFill.priceMinorUnits !== fill.priceMinorUnits) {
        breaks.push(
          makeExecutionBreak({
            runId,
            kind: 'PRICE_MISMATCH',
            canonical: input.canonical,
            orderId: order.orderId,
            instrumentId: order.instrumentId,
            sunReyValue: fill.priceMinorUnits,
            brokerValue: brokerFill.priceMinorUnits,
            custodyValue: null,
            description: `price mismatch on fill ${fill.providerFillId}`,
            now: input.now,
            sealBreakEvidence: input.sealBreakEvidence,
          }),
        );
      }
      if (brokerFill.feeMinorUnits !== fill.feeMinorUnits) {
        breaks.push(
          makeExecutionBreak({
            runId,
            kind: 'FEE_MISMATCH',
            canonical: input.canonical,
            orderId: order.orderId,
            instrumentId: order.instrumentId,
            sunReyValue: fill.feeMinorUnits,
            brokerValue: brokerFill.feeMinorUnits,
            custodyValue: null,
            description: `fee mismatch on fill ${fill.providerFillId}`,
            now: input.now,
            sealBreakEvidence: input.sealBreakEvidence,
          }),
        );
      }
    }
  }

  for (const brokerOrder of input.broker?.orders ?? []) {
    const canonical =
      (brokerOrder.externalOperationId ? canonicalByExternal.get(brokerOrder.externalOperationId) : null) ??
      input.canonical.orders.find((row) => row.orderId === brokerOrder.clientOrderId) ??
      null;
    if (!canonical) {
      breaks.push(
        makeExecutionBreak({
          runId,
          kind: 'UNKNOWN_EXTERNAL_ORDER',
          canonical: input.canonical,
          orderId: null,
          instrumentId: brokerOrder.instrumentId,
          sunReyValue: null,
          brokerValue: brokerOrder.brokerOrderId,
          custodyValue: null,
          description: `broker order ${brokerOrder.brokerOrderId} not known to SunRey lifecycle`,
          now: input.now,
          sealBreakEvidence: input.sealBreakEvidence,
        }),
      );
    }
  }

  if (input.broker && input.broker.cashMinorUnits !== input.canonical.cashMinorUnits) {
    breaks.push(
      makeCashBreak({
        runId,
        kind: 'CASH_MISMATCH',
        canonical: input.canonical,
        sunReyValue: input.canonical.cashMinorUnits,
        brokerValue: input.broker.cashMinorUnits,
        custodyValue: input.custody?.cashMinorUnits ?? null,
        description: 'cash mismatch between SunRey and broker',
        now: input.now,
        sealBreakEvidence: input.sealBreakEvidence,
      }),
    );
  }

  if (input.custody && input.custody.cashMinorUnits !== input.canonical.cashMinorUnits) {
    breaks.push(
      makeCashBreak({
        runId,
        kind: 'CASH_MISMATCH',
        canonical: input.canonical,
        sunReyValue: input.canonical.cashMinorUnits,
        brokerValue: input.broker?.cashMinorUnits ?? null,
        custodyValue: input.custody.cashMinorUnits,
        description: 'cash mismatch between SunRey and custody',
        now: input.now,
        sealBreakEvidence: input.sealBreakEvidence,
      }),
    );
  }

  const instrumentIds = new Set([
    ...Object.keys(input.canonical.positions),
    ...Object.keys(input.broker?.positions ?? {}),
    ...Object.keys(input.custody?.positions ?? {}),
  ]);

  for (const instrumentId of instrumentIds) {
    const sunReyQty = input.canonical.positions[instrumentId] ?? '0';
    const brokerQty = input.broker?.positions[instrumentId] ?? '0';
    const custodyQty = input.custody?.positions[instrumentId] ?? '0';
    if (sunReyQty !== brokerQty || sunReyQty !== custodyQty || brokerQty !== custodyQty) {
      breaks.push(
        makePositionBreak({
          runId,
          kind: 'POSITION_MISMATCH',
          canonical: input.canonical,
          instrumentId,
          sunReyValue: sunReyQty,
          brokerValue: brokerQty,
          custodyValue: custodyQty,
          description: `position mismatch for ${instrumentId}`,
          now: input.now,
          sealBreakEvidence: input.sealBreakEvidence,
        }),
      );
    }
  }

  const brokerSettlementIds = new Set((input.broker?.settlements ?? []).map((row) => row.settlementId));
  const custodySettlementIds = new Set((input.custody?.settlements ?? []).map((row) => row.settlementId));
  const canonicalSettlementIds = new Set(input.canonical.settlementIds);

  for (const settlementId of canonicalSettlementIds) {
    if (!brokerSettlementIds.has(settlementId) || !custodySettlementIds.has(settlementId)) {
      breaks.push(
        makeSettlementBreak({
          runId,
          kind: 'SETTLEMENT_MISMATCH',
          canonical: input.canonical,
          settlementId,
          sunReyValue: settlementId,
          brokerValue: brokerSettlementIds.has(settlementId) ? settlementId : null,
          custodyValue: custodySettlementIds.has(settlementId) ? settlementId : null,
          description: `settlement ${settlementId} missing from external statements`,
          now: input.now,
          sealBreakEvidence: input.sealBreakEvidence,
        }),
      );
    }
  }

  const custodyCorpIds = new Set((input.custody?.corporateActions ?? []).map((row) => row.corporateActionId));
  for (const corporateActionId of input.canonical.corporateActionIds) {
    if (!custodyCorpIds.has(corporateActionId)) {
      breaks.push(
        makeExecutionBreak({
          runId,
          kind: 'CORPORATE_ACTION_MISMATCH',
          canonical: input.canonical,
          orderId: null,
          instrumentId: null,
          sunReyValue: corporateActionId,
          brokerValue: null,
          custodyValue: null,
          description: `corporate action ${corporateActionId} missing from custody statement`,
          now: input.now,
          sealBreakEvidence: input.sealBreakEvidence,
        }),
      );
    }
  }

  const runEvidenceRef = input.sealRunEvidence({
    accountId: input.canonical.accountId,
    breakCount: breaks.length,
    matched: breaks.length === 0,
  });

  const run: Exec12ThreeWayReconciliationRun = Object.freeze({
    runId,
    schemaVersion: HELIOS_EXEC12_SCHEMA,
    customerId: input.canonical.customerId,
    accountId: input.canonical.accountId,
    brokerSnapshotId: input.broker?.snapshotId ?? null,
    custodySnapshotId: input.custody?.snapshotId ?? null,
    matched: breaks.length === 0,
    breaks: Object.freeze(breaks),
    evidenceRef: runEvidenceRef,
    completedAt: input.now,
  });

  return Object.freeze({ run, breaks: Object.freeze(breaks) });
}

function indexBrokerOrders(snapshot: BrokerStatementSnapshot | null): Map<string, BrokerStatementSnapshot['orders'][number]> {
  const map = new Map<string, BrokerStatementSnapshot['orders'][number]>();
  for (const order of snapshot?.orders ?? []) {
    if (order.externalOperationId) {
      map.set(order.externalOperationId, order);
    }
  }
  return map;
}

function indexBrokerOrdersById(snapshot: BrokerStatementSnapshot | null): Map<string, BrokerStatementSnapshot['orders'][number]> {
  const map = new Map<string, BrokerStatementSnapshot['orders'][number]>();
  for (const order of snapshot?.orders ?? []) {
    map.set(order.brokerOrderId, order);
  }
  return map;
}

function makeExecutionBreak(input: {
  readonly runId: Exec12ThreeWayReconciliationRun['runId'];
  readonly kind: ExecutionReconciliationBreak['kind'];
  readonly canonical: Exec12CanonicalAccountView;
  readonly orderId: string | null;
  readonly instrumentId: string | null;
  readonly sunReyValue: string | null;
  readonly brokerValue: string | null;
  readonly custodyValue: string | null;
  readonly description: string;
  readonly now: UtcInstant;
  readonly sealBreakEvidence: (kind: string, detail: Record<string, unknown>) => string;
}): ExecutionReconciliationBreak {
  const severity = severityForExec12BreakKind(input.kind);
  const ambiguousExternal = isAmbiguousExternalBreak(input.kind);
  const evidenceRef = input.sealBreakEvidence('HELIOS_EXEC12_RECONCILIATION_BREAK', {
    kind: input.kind,
    domain: 'EXECUTION',
    accountId: input.canonical.accountId,
    orderId: input.orderId,
    severity,
  });
  return Object.freeze({
    breakId: exec12ReconciliationBreakIdFor(input.kind, input.canonical.accountId, input.description),
    runId: input.runId,
    kind: input.kind,
    severity,
    customerId: input.canonical.customerId,
    accountId: input.canonical.accountId,
    orderId: input.orderId,
    instrumentId: input.instrumentId,
    sunReyValue: input.sunReyValue,
    brokerValue: input.brokerValue,
    custodyValue: input.custodyValue,
    description: input.description,
    evidenceRef,
    detectedAt: input.now,
    ambiguousExternal,
    autoFixAttempted: false,
    domain: 'EXECUTION',
  });
}

function makePositionBreak(input: {
  readonly runId: Exec12ThreeWayReconciliationRun['runId'];
  readonly kind: PositionReconciliationBreak['kind'];
  readonly canonical: Exec12CanonicalAccountView;
  readonly instrumentId: string;
  readonly sunReyValue: string;
  readonly brokerValue: string;
  readonly custodyValue: string;
  readonly description: string;
  readonly now: UtcInstant;
  readonly sealBreakEvidence: (kind: string, detail: Record<string, unknown>) => string;
}): PositionReconciliationBreak {
  const severity = severityForExec12BreakKind(input.kind);
  const evidenceRef = input.sealBreakEvidence('HELIOS_EXEC12_RECONCILIATION_BREAK', {
    kind: input.kind,
    domain: 'POSITION',
    instrumentId: input.instrumentId,
    severity,
  });
  return Object.freeze({
    breakId: exec12ReconciliationBreakIdFor(input.kind, input.canonical.accountId, input.instrumentId),
    runId: input.runId,
    kind: input.kind,
    severity,
    customerId: input.canonical.customerId,
    accountId: input.canonical.accountId,
    orderId: null,
    instrumentId: input.instrumentId,
    sunReyValue: input.sunReyValue,
    brokerValue: input.brokerValue,
    custodyValue: input.custodyValue,
    description: input.description,
    evidenceRef,
    detectedAt: input.now,
    ambiguousExternal: false,
    autoFixAttempted: false,
    domain: 'POSITION',
  });
}

function makeCashBreak(input: {
  readonly runId: Exec12ThreeWayReconciliationRun['runId'];
  readonly kind: CashReconciliationBreak['kind'];
  readonly canonical: Exec12CanonicalAccountView;
  readonly sunReyValue: string;
  readonly brokerValue: string | null;
  readonly custodyValue: string | null;
  readonly description: string;
  readonly now: UtcInstant;
  readonly sealBreakEvidence: (kind: string, detail: Record<string, unknown>) => string;
}): CashReconciliationBreak {
  const severity = severityForExec12BreakKind(input.kind);
  const evidenceRef = input.sealBreakEvidence('HELIOS_EXEC12_RECONCILIATION_BREAK', {
    kind: input.kind,
    domain: 'CASH',
    severity,
  });
  return Object.freeze({
    breakId: exec12ReconciliationBreakIdFor(input.kind, input.canonical.accountId, 'cash'),
    runId: input.runId,
    kind: input.kind,
    severity,
    customerId: input.canonical.customerId,
    accountId: input.canonical.accountId,
    orderId: null,
    instrumentId: null,
    sunReyValue: input.sunReyValue,
    brokerValue: input.brokerValue,
    custodyValue: input.custodyValue,
    description: input.description,
    evidenceRef,
    detectedAt: input.now,
    ambiguousExternal: false,
    autoFixAttempted: false,
    domain: 'CASH',
  });
}

function makeSettlementBreak(input: {
  readonly runId: Exec12ThreeWayReconciliationRun['runId'];
  readonly kind: SettlementReconciliationBreak['kind'];
  readonly canonical: Exec12CanonicalAccountView;
  readonly settlementId: string;
  readonly sunReyValue: string;
  readonly brokerValue: string | null;
  readonly custodyValue: string | null;
  readonly description: string;
  readonly now: UtcInstant;
  readonly sealBreakEvidence: (kind: string, detail: Record<string, unknown>) => string;
}): SettlementReconciliationBreak {
  const severity = severityForExec12BreakKind(input.kind);
  const evidenceRef = input.sealBreakEvidence('HELIOS_EXEC12_RECONCILIATION_BREAK', {
    kind: input.kind,
    domain: 'SETTLEMENT',
    settlementId: input.settlementId,
    severity,
  });
  return Object.freeze({
    breakId: exec12ReconciliationBreakIdFor(input.kind, input.canonical.accountId, input.settlementId),
    runId: input.runId,
    kind: input.kind,
    severity,
    customerId: input.canonical.customerId,
    accountId: input.canonical.accountId,
    orderId: null,
    instrumentId: null,
    sunReyValue: input.sunReyValue,
    brokerValue: input.brokerValue,
    custodyValue: input.custodyValue,
    description: input.description,
    evidenceRef,
    detectedAt: input.now,
    ambiguousExternal: false,
    autoFixAttempted: false,
    domain: 'SETTLEMENT',
  });
}
