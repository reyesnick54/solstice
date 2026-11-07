/**
 * FIX workflow normalizer — version-agnostic field bag in, canonical broker protocol out.
 */

import type { UtcInstant } from '@solstice/domain';
import { BROKER_EXECUTION_PROTOCOL_SCHEMA_VERSION } from '../taxonomy.ts';
import type { FixWorkflowSemanticField } from '../taxonomy.ts';
import type { BrokerCancelReject, BrokerExecutionEvent } from '../types.ts';
import type { BrokerEventPurpose, BrokerOrderStateKind, BrokerTransportKind } from '../taxonomy.ts';
import { mapFixOrdStatusToBrokerOrderState, mapFixExecTypeToEventPurpose } from './fix-maps.ts';

export type FixSemanticFieldBag = Readonly<Partial<Record<FixWorkflowSemanticField, string>>>;

export type FixInboundContext = Readonly<{
  readonly transport: Extract<BrokerTransportKind, 'FIX'>;
  readonly providerAccountId: string;
  readonly operationId: string;
  readonly eventTime: UtcInstant;
  readonly arrivalTime: UtcInstant;
  readonly evidenceRef: string | null;
}>;

export type FixExecutionReportNormalizer = {
  readonly protocolFamily: 'FIX';
  normalizeExecutionReport(fields: FixSemanticFieldBag, context: FixInboundContext): BrokerExecutionEvent;
  normalizeOrderCancelReject(fields: FixSemanticFieldBag, context: FixInboundContext): BrokerCancelReject;
};

function requireField(fields: FixSemanticFieldBag, name: FixWorkflowSemanticField): string | null {
  const value = fields[name];
  if (value === undefined || value.trim() === '') {
    return null;
  }
  return value;
}

export function createFixExecutionReportNormalizer(): FixExecutionReportNormalizer {
  return Object.freeze({
    protocolFamily: 'FIX',
    normalizeExecutionReport(fields, context) {
      const ordStatus = requireField(fields, 'ordStatus');
      const execType = requireField(fields, 'execType');
      const resultingOrderState: BrokerOrderStateKind = mapFixOrdStatusToBrokerOrderState(ordStatus);
      const eventPurpose: BrokerEventPurpose = mapFixExecTypeToEventPurpose(execType, resultingOrderState);

      return Object.freeze({
        schemaVersion: BROKER_EXECUTION_PROTOCOL_SCHEMA_VERSION,
        eventPurpose,
        executionId: requireField(fields, 'execID') ?? `fix_exec_${context.operationId}`,
        operationId: context.operationId,
        clientOrderId: requireField(fields, 'clOrdID') ?? 'unknown',
        originalClientOrderId: requireField(fields, 'origClOrdID') ?? requireField(fields, 'clOrdID') ?? 'unknown',
        brokerOrderId: requireField(fields, 'orderID'),
        venueOrderId: requireField(fields, 'orderID'),
        providerAccountId: context.providerAccountId,
        resultingOrderState,
        eventTime: context.eventTime,
        arrivalTime: context.arrivalTime,
        transport: context.transport,
        fillQuantityUnits: requireField(fields, 'lastQty'),
        fillPriceMinorUnits: requireField(fields, 'lastPx'),
        feeMinorUnits: null,
        currency: null,
        evidenceRef: context.evidenceRef,
        simulation: true,
        grantsExecutionAuthority: false,
      });
    },
    normalizeOrderCancelReject(fields, context) {
      const ordStatus = requireField(fields, 'ordStatus');
      const resultingOrderState: BrokerOrderStateKind = mapFixOrdStatusToBrokerOrderState(ordStatus);
      return Object.freeze({
        schemaVersion: BROKER_EXECUTION_PROTOCOL_SCHEMA_VERSION,
        eventPurpose: 'REJECTION',
        operationId: context.operationId,
        clientOrderId: requireField(fields, 'clOrdID') ?? 'unknown',
        originalClientOrderId: requireField(fields, 'origClOrdID') ?? requireField(fields, 'clOrdID') ?? 'unknown',
        brokerOrderId: requireField(fields, 'orderID'),
        venueOrderId: requireField(fields, 'orderID'),
        providerAccountId: context.providerAccountId,
        rejectReasonCode: requireField(fields, 'text') ?? 'cancel_rejected',
        rejectReasonText: requireField(fields, 'text'),
        resultingOrderState,
        eventTime: context.eventTime,
        arrivalTime: context.arrivalTime,
        transport: context.transport,
        evidenceRef: context.evidenceRef,
        simulation: true,
      });
    },
  });
}
